[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ConnectionString,

    [string]$WorkbookPath = "$PSScriptRoot\..\data\imports\google-drive\Open Salary Database for Engineers (7-2026).xlsx",

    [switch]$SkipWorkerDeploy
)

$ErrorActionPreference = 'Stop'
$ConnectionString = $ConnectionString.Trim([char]0xFEFF, [char]0x200B, [char]0x20, [char]0x09, [char]0x0D, [char]0x0A)
if ($ConnectionString -notmatch '^postgres(?:ql)?://') {
    throw 'ConnectionString must be a PostgreSQL connection URL.'
}

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

function Wait-Healthy([string]$Url, [int]$TimeoutSeconds = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "The local migration host did not become healthy within $TimeoutSeconds seconds."
}

function Convert-NeonUriToNpgsql([string]$UriText) {
    $uri = [Uri]$UriText
    if ($uri.Scheme -notin @('postgres', 'postgresql') -or -not $uri.UserInfo -or -not $uri.Host -or $uri.AbsolutePath -eq '/') {
        throw 'The supplied Neon connection URL is invalid.'
    }

    $credentials = $uri.UserInfo.Split(':', 2)
    if ($credentials.Count -ne 2) { throw 'The supplied Neon connection URL is missing credentials.' }
    $username = [Uri]::UnescapeDataString($credentials[0])
    $password = [Uri]::UnescapeDataString($credentials[1])
    $database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
    $port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }

    # Neon URLs are URI-formatted for JavaScript clients; Npgsql expects key/value syntax.
    return "Host=$($uri.Host);Port=$port;Database=$database;Username=$username;Password=$password;Ssl Mode=Require;Trust Server Certificate=false;Pooling=true;Maximum Pool Size=10;Timeout=15;Command Timeout=15"
}

Assert-Command dotnet
Assert-Command npx

$root = (Resolve-Path "$PSScriptRoot\..").Path
$workbook = (Resolve-Path $WorkbookPath -ErrorAction Stop).Path
$apiProject = Join-Path $root 'backend\EngineersSalary.Api\EngineersSalary.Api.csproj'
$workerDirectory = Join-Path $root 'worker'
$localUrl = 'http://127.0.0.1:5189'
$logPath = Join-Path $env:TEMP ("engref-neon-recovery-{0}.log" -f [guid]::NewGuid().ToString('N'))
$npgsqlConnectionString = Convert-NeonUriToNpgsql $ConnectionString

# Secrets are process-scoped only and are never written to the repository or output.
$priorEnvironment = @{}
foreach ($name in @(
    'ASPNETCORE_ENVIRONMENT', 'ASPNETCORE_URLS', 'Database__Provider',
    'Database__MigrateOnStartup', 'ConnectionStrings__DefaultConnection',
    'GoogleSheetSalaryImport__WorkbookPath', 'GoogleSheetSalaryImport__WorkbookUrl',
    'GoogleSheetSalaryImport__Enabled'
)) {
    $priorEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

$apiProcess = $null
try {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = $localUrl
    $env:Database__Provider = 'PostgreSQL'
    $env:Database__MigrateOnStartup = 'true'
    $env:ConnectionStrings__DefaultConnection = $npgsqlConnectionString
    $env:GoogleSheetSalaryImport__WorkbookPath = $workbook
    $env:GoogleSheetSalaryImport__WorkbookUrl = ''
    $env:GoogleSheetSalaryImport__Enabled = 'false'

    Push-Location $root
    try {
        dotnet build $apiProject --configuration Release --nologo | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }

        $apiArguments = "run --no-build --no-launch-profile --configuration Release --project `"$apiProject`""
        $apiProcess = Start-Process dotnet -ArgumentList $apiArguments -RedirectStandardOutput $logPath -RedirectStandardError "$logPath.err" -PassThru -WindowStyle Hidden

        Wait-Healthy "$localUrl/health/live"
        Invoke-WebRequest -Uri "$localUrl/api/salary-reports/synchronize-source" -Method Post -UseBasicParsing -TimeoutSec 180 | Out-Null
        $reports = (Invoke-WebRequest -Uri "$localUrl/api/salary-reports/read-rows?pageNumber=1&pageSize=1" -UseBasicParsing -TimeoutSec 30).Content | ConvertFrom-Json
        if ([int]$reports.totalCount -lt 1) { throw 'The source import completed without creating any salary reports.' }
        Write-Output "Neon schema and salary data restored: $($reports.totalCount) reports."
    } finally {
        Pop-Location
    }

    if (-not $SkipWorkerDeploy) {
        Push-Location $workerDirectory
        try {
            npm ci | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'Worker dependency installation failed.' }
            npm test | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'Worker tests failed.' }
            npm run typecheck | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'Worker typecheck failed.' }
            npx wrangler deploy | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'Worker deployment failed.' }
            # Worker secrets are version-bound. Apply the connection URL to the newly deployed version.
            $ConnectionString | npx wrangler secret put DATABASE_URL | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'Updating the Worker DATABASE_URL secret failed.' }
        } finally {
            Pop-Location
        }
    }

    $remote = 'https://engineers-salary-api.engref-cloud.workers.dev/api/salary-reports/read-rows?pageNumber=1&pageSize=1'
    $live = (Invoke-WebRequest -Uri $remote -UseBasicParsing -TimeoutSec 30).Content | ConvertFrom-Json
    if ([int]$live.totalCount -lt 1) { throw 'The deployed Worker returned no salary reports.' }
    Write-Output "Production Worker verified: $($live.totalCount) reports."
}
finally {
    if ($apiProcess -and -not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -Force }
    foreach ($item in $priorEnvironment.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($item.Key, $item.Value, 'Process')
    }
    Remove-Item -LiteralPath $logPath, "$logPath.err" -Force -ErrorAction SilentlyContinue
}
