param(
  [Parameter(Mandatory = $true)]
  [string]$CsvPath,

  [Parameter(Mandatory = $true)]
  [string]$LookupSnapshotDir,

  [string]$OutputDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Sanitize-Text {
  param([AllowNull()][string]$Value)

  if ($null -eq $Value) {
    return ''
  }

  $normalized = $Value `
    -replace "[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]", ' ' `
    -replace "[\u200E\u200F\u061C\u2066-\u2069\uFEFF]", '' `
    -replace "[\u0000-\u001F\u007F]", ' ' `
    -replace '\s+', ' '

  return $normalized.Trim()
}

function Get-RawCsvText {
  param([AllowNull()][string]$Value)

  if ($null -eq $Value) {
    return ''
  }

  return ($Value -replace '^\uFEFF', '')
}

function Normalize-Key {
  param([AllowNull()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ''
  }

  return ((Sanitize-Text -Value $Value).ToLowerInvariant())
}

function Convert-ToNullableNumber {
  param([AllowNull()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  $candidate = ($Value -replace ',', ' ')
  $match = [regex]::Match($candidate, '-?\d+(?:\.\d+)?')
  if (-not $match.Success) {
    return $null
  }

  $parsedNumber = 0.0
  if ([double]::TryParse($match.Value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsedNumber)) {
    return [decimal]$parsedNumber
  }

  throw "Failed to parse numeric value '$Value'."
}

function Convert-ToNullableDate {
  param([AllowNull()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  $trimmed = $Value.Trim()
  $formats = @('M/d/yyyy', 'MM/dd/yyyy', 'M/d/yy')
  foreach ($format in $formats) {
    try {
      $parsedExact = [datetime]::ParseExact($trimmed, $format, [System.Globalization.CultureInfo]::InvariantCulture)
      return [datetimeoffset]::new($parsedExact, [timespan]::Zero)
    } catch {
    }
  }

  $parsed = $null
  if ([datetime]::TryParse($trimmed, [ref]$parsed)) {
    return [datetimeoffset]::new($parsed, [timespan]::Zero)
  }

  throw "Failed to parse date value '$Value'."
}

function New-LookupMap {
  param([array]$Items)

  $map = @{}
  foreach ($item in $Items) {
    if ($null -eq $item) {
      continue
    }

    $key = Normalize-Key ([string]$item.name)
    if (-not [string]::IsNullOrWhiteSpace($key) -and -not $map.ContainsKey($key)) {
      $map[$key] = $item
    }
  }

  return $map
}

function Resolve-StageLabel {
  param(
    $Row,
    [hashtable]$GroupStageMap
  )

  $normalized = Normalize-Key $Row.Stage
  if ($normalized -eq 'in hand' -or $normalized -eq 'inhand') {
    return 'InHand'
  }

  if ($normalized -eq 'tender') {
    return 'Tender'
  }

  if ([string]::IsNullOrWhiteSpace($normalized) -or $normalized -eq '0') {
    $groupKey = Normalize-Key("$($Row.ProjectTitle)|$($Row.Owner)|$($Row.DeadlineText)")
    if ($GroupStageMap.ContainsKey($groupKey) -and $GroupStageMap[$groupKey].Count -eq 1) {
      return $GroupStageMap[$groupKey][0]
    }
    return $null
  }

  return $Row.Stage.Trim()
}

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function To-SqlValue {
  param(
    $Value,
    [switch]$Unicode,
    [switch]$DateTimeOffset,
    [switch]$Decimal
  )

  if ($null -eq $Value -or ($Value -is [string] -and [string]::IsNullOrWhiteSpace([string]$Value))) {
    return 'NULL'
  }

  if ($DateTimeOffset) {
    return "'" + ([datetimeoffset]$Value).ToString('yyyy-MM-ddTHH:mm:ss.fffzzz') + "'"
  }

  if ($Decimal) {
    return ([decimal]$Value).ToString([System.Globalization.CultureInfo]::InvariantCulture)
  }

  if ($Value -is [int] -or $Value -is [long]) {
    return [string]$Value
  }

  $text = [string]$Value
  $escaped = $text.Replace("'", "''")
  return ($(if ($Unicode) { 'N' } else { '' }) + "'" + $escaped + "'")
}

if (-not (Test-Path -LiteralPath $CsvPath)) {
  throw "CSV file not found: $CsvPath"
}

if (-not (Test-Path -LiteralPath $LookupSnapshotDir)) {
  throw "Lookup snapshot directory not found: $LookupSnapshotDir"
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $stamp = (Get-Date).ToString('yyyy-MM-ddTHH-mm-ss-fffK').Replace(':', '-')
  $OutputDir = Join-Path (Get-Location) "backups\tender-projects-direct-sql-$stamp"
}

Ensure-Directory -Path $OutputDir

$owners = Get-Content (Join-Path $LookupSnapshotDir 'owners.json') | ConvertFrom-Json
$statuses = Get-Content (Join-Path $LookupSnapshotDir 'statuses.json') | ConvertFrom-Json
$stages = Get-Content (Join-Path $LookupSnapshotDir 'stages.json') | ConvertFrom-Json
$types = Get-Content (Join-Path $LookupSnapshotDir 'types.json') | ConvertFrom-Json
$degrees = Get-Content (Join-Path $LookupSnapshotDir 'degrees.json') | ConvertFrom-Json
$countries = Get-Content (Join-Path $LookupSnapshotDir 'countries.json') | ConvertFrom-Json
$assignToSettings = Get-Content (Join-Path $LookupSnapshotDir 'assign_to_settings.json') | ConvertFrom-Json
$inChargeSettings = Get-Content (Join-Path $LookupSnapshotDir 'in_charge_settings.json') | ConvertFrom-Json

$ownerMap = New-LookupMap $owners
$statusMap = New-LookupMap $statuses
$stageMap = New-LookupMap $stages
$typeMap = New-LookupMap $types
$degreeMap = New-LookupMap $degrees
$countryMap = New-LookupMap $countries
$assignToMap = New-LookupMap $assignToSettings
$inChargeMap = New-LookupMap $inChargeSettings

$importedRows = Import-Csv -Path $CsvPath
$rows = @()
$index = 0

foreach ($item in $importedRows) {
  $index += 1
  $rows += [pscustomobject]@{
    Index        = $index
    ProjectTitle = Get-RawCsvText -Value ([string]$item.'Project Title')
    Owner        = Sanitize-Text -Value ([string]$item.'Owner ')
    DeadlineText = Sanitize-Text -Value ([string]$item.Deadline)
    Type         = Sanitize-Text -Value ([string]$item.'Type ')
    Stage        = Sanitize-Text -Value ([string]$item.Stage)
    PriceText    = Sanitize-Text -Value ([string]$item.Price)
    AssignTo     = Sanitize-Text -Value ([string]$item.'Assign To')
    AcceptDate   = Sanitize-Text -Value ([string]$item.AcceptDate)
    Status       = Sanitize-Text -Value ([string]$item.Status)
    PrbText      = Sanitize-Text -Value ([string]$item.PRB)
    Importance   = Sanitize-Text -Value ([string]$item.importance)
    Country      = Sanitize-Text -Value ([string]$item.Country)
    InCharge     = Sanitize-Text -Value ([string]$item.'In Charge')
  }
}

$groupStageMap = @{}
foreach ($row in $rows) {
  $candidate = Normalize-Key $row.Stage
  if ($candidate -eq 'in hand') {
    $candidate = 'inhand'
  }

  if ($candidate -eq 'tender') {
    $candidate = 'tender'
  }

  if ($candidate -ne 'inhand' -and $candidate -ne 'tender') {
    continue
  }

  $resolved = if ($candidate -eq 'inhand') { 'InHand' } else { 'Tender' }
  $groupKey = Normalize-Key("$($row.ProjectTitle)|$($row.Owner)|$($row.DeadlineText)")
  if (-not $groupStageMap.ContainsKey($groupKey)) {
    $groupStageMap[$groupKey] = New-Object 'System.Collections.Generic.List[string]'
  }

  if (-not $groupStageMap[$groupKey].Contains($resolved)) {
    $groupStageMap[$groupKey].Add($resolved)
  }
}

$missingMappings = New-Object 'System.Collections.Generic.List[object]'
$preparedRows = New-Object 'System.Collections.Generic.List[object]'

foreach ($row in $rows) {
  $resolvedStage = Resolve-StageLabel -Row $row -GroupStageMap $groupStageMap

  $owner = if ($row.Owner) { $ownerMap[(Normalize-Key $row.Owner)] } else { $null }
  $status = if ($row.Status) { $statusMap[(Normalize-Key $row.Status)] } else { $null }
  $type = if ($row.Type) { $typeMap[(Normalize-Key $row.Type)] } else { $null }
  $stage = if ($resolvedStage) { $stageMap[(Normalize-Key $resolvedStage)] } else { $null }
  $degree = if ($row.Importance) { $degreeMap[(Normalize-Key $row.Importance)] } else { $null }
  $country = if ($row.Country) { $countryMap[(Normalize-Key $row.Country)] } else { $null }
  $assignTo = if ($row.AssignTo) { $assignToMap[(Normalize-Key $row.AssignTo)] } else { $null }
  $inCharge = if ($row.InCharge) { $inChargeMap[(Normalize-Key $row.InCharge)] } else { $null }

  foreach ($check in @(
      [pscustomobject]@{ Field = 'Owner'; Value = $row.Owner; Resolved = $owner },
      [pscustomobject]@{ Field = 'Status'; Value = $row.Status; Resolved = $status },
      [pscustomobject]@{ Field = 'Type'; Value = $row.Type; Resolved = $type },
      [pscustomobject]@{ Field = 'Stage'; Value = $resolvedStage; Resolved = $stage },
      [pscustomobject]@{ Field = 'Importance'; Value = $row.Importance; Resolved = $degree },
      [pscustomobject]@{ Field = 'Country'; Value = $row.Country; Resolved = $country },
      [pscustomobject]@{ Field = 'AssignTo'; Value = $row.AssignTo; Resolved = $assignTo },
      [pscustomobject]@{ Field = 'InCharge'; Value = $row.InCharge; Resolved = $inCharge }
    )) {
    if (-not [string]::IsNullOrWhiteSpace([string]$check.Value) -and $null -eq $check.Resolved) {
      $missingMappings.Add([pscustomobject]@{
          RowIndex      = $row.Index
          ProjectTitle  = $row.ProjectTitle
          Field         = $check.Field
          UnmappedValue = $check.Value
        })
    }
  }

  $preparedRows.Add([pscustomobject]@{
      Index                = $row.Index
      Name                 = $row.ProjectTitle
      OwnerId              = if ($owner) { [int]$owner.id } else { $null }
      StatusId             = if ($status) { [int]$status.id } else { $null }
      TypeOfProjectId      = if ($type) { [int]$type.id } else { $null }
      TenderStageId        = if ($stage) { [int]$stage.id } else { $null }
      DegreeOfImportanceId = if ($degree) { [int]$degree.id } else { $null }
      CountryId            = if ($country) { [int]$country.id } else { $null }
      AssignTo             = if ($assignTo) { [string]$assignTo.name } elseif ($row.AssignTo) { $row.AssignTo } else { $null }
      InCharge             = if ($inCharge) { [string]$inCharge.name } elseif ($row.InCharge) { $row.InCharge } else { $null }
      Deadline             = Convert-ToNullableDate $row.DeadlineText
      AcceptDate           = Convert-ToNullableDate $row.AcceptDate
      PRB                  = Convert-ToNullableNumber $row.PrbText
      Price                = Convert-ToNullableNumber $row.PriceText
      SourceStage          = $row.Stage
      ResolvedStage        = $resolvedStage
    })
}

$report = [pscustomobject]@{
  generatedAt         = (Get-Date).ToString('o')
  csvPath             = $CsvPath
  lookupSnapshotDir   = $LookupSnapshotDir
  rowCount            = $rows.Count
  missingMappingCount = $missingMappings.Count
  missingMappings     = @($missingMappings | Select-Object -First 100)
  inferredStages      = @(
    $preparedRows |
      Where-Object {
        (Normalize-Key $_.SourceStage) -eq '0' -or
        [string]::IsNullOrWhiteSpace([string]$_.SourceStage)
      } |
      Select-Object Index, Name, SourceStage, ResolvedStage
  )
  duplicateTitleGroups = @(
    $rows |
      Group-Object ProjectTitle |
      Where-Object { $_.Count -gt 1 } |
      Sort-Object Count -Descending |
      Select-Object Name, Count
  )
  priceNonNullCount = @($preparedRows | Where-Object { $null -ne $_.Price }).Count
  titlePreservedCount = @($preparedRows | Where-Object { $_.Name -eq $rows[$_.Index - 1].ProjectTitle }).Count
}

$reportPath = Join-Path $OutputDir 'direct-sql-plan.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding utf8

if ($missingMappings.Count -gt 0) {
  throw "Missing lookup mappings found. See $reportPath"
}

$sqlLines = New-Object 'System.Collections.Generic.List[string]'
$sqlLines.Add('SET XACT_ABORT ON;')
$sqlLines.Add('BEGIN TRANSACTION;')
$sqlLines.Add('UPDATE [dbo].[Projects] SET [IsDeleted] = 1 WHERE [IsDeleted] = 0;')

foreach ($item in $preparedRows) {
  $values = @(
    (To-SqlValue $item.Name -Unicode),
    'NULL',
    'NULL',
    (To-SqlValue $item.AssignTo -Unicode),
    (To-SqlValue $item.InCharge -Unicode),
    'NULL',
    'NULL',
    (To-SqlValue $item.AcceptDate -DateTimeOffset),
    (To-SqlValue $item.Deadline -DateTimeOffset),
    'NULL',
    (To-SqlValue $item.PRB -Decimal),
    'NULL',
    'NULL',
    (To-SqlValue $item.Price -Decimal),
    '0',
    'SYSUTCDATETIME()',
    (To-SqlValue $item.OwnerId),
    (To-SqlValue $item.StatusId),
    (To-SqlValue $item.TypeOfProjectId),
    (To-SqlValue $item.DegreeOfImportanceId),
    (To-SqlValue $item.TenderStageId),
    (To-SqlValue $item.CountryId)
  )

  $sqlLines.Add(
    "INSERT INTO [dbo].[Projects] " +
    "([Name],[Description],[DelayReasons],[AssignTo],[InCharge],[Consultant],[StartDate],[AcceptDate],[Deadline],[EndDate],[PRB],[Tone],[CustomLabel],[Price],[IsDeleted],[CreatedAt],[OwnerId],[StatusId],[TypeOfProjectId],[DegreeOfImportanceId],[TenderStageId],[CountryId]) " +
    "VALUES ($($values -join ', '));"
  )
}

$sqlLines.Add("SELECT COUNT(*) AS ActiveProjects FROM [dbo].[Projects] WHERE [IsDeleted] = 0;")
$sqlLines.Add('COMMIT;')

$sqlPath = Join-Path $OutputDir 'reimport-projects.sql'
[System.IO.File]::WriteAllLines($sqlPath, $sqlLines, [System.Text.UTF8Encoding]::new($true))

Copy-Item -LiteralPath $CsvPath -Destination (Join-Path $OutputDir ([System.IO.Path]::GetFileName($CsvPath))) -Force
Write-Output $OutputDir
