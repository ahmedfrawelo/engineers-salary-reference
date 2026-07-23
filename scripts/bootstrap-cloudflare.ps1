[CmdletBinding()]
param([string]$BucketName = 'engineers-salary-private', [string]$PagesOrigin = 'https://engineers-salary-reference.pages.dev')
$ErrorActionPreference = 'Stop'
foreach ($name in 'CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN') { if (-not [Environment]::GetEnvironmentVariable($name)) { Write-Output 'Cloudflare credentials unavailable; R2 bootstrap skipped without creating resources.'; exit 0 } }
$headers = @{ Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN"; 'Content-Type' = 'application/json' }
$uri = "https://api.cloudflare.com/client/v4/accounts/$env:CLOUDFLARE_ACCOUNT_ID/r2/buckets"
$existing = Invoke-RestMethod -Headers $headers -Uri $uri -Method Get
if (-not ($existing.result | Where-Object name -eq $BucketName)) {
  Invoke-RestMethod -Headers $headers -Uri $uri -Method Post -Body (@{ name = $BucketName } | ConvertTo-Json) | Out-Null
}
$corsUri = "$uri/$BucketName/cors"
$cors = @{ rules = @(@{ allowed = @{ origins = @($PagesOrigin); methods = @('GET','PUT','HEAD'); headers = @('content-type') }; exposeHeaders = @('etag'); maxAgeSeconds = 300 }) } | ConvertTo-Json -Depth 6
Invoke-RestMethod -Headers $headers -Uri $corsUri -Method Put -Body $cors | Out-Null
Write-Output "Private R2 bucket and exact-origin CORS ready: $BucketName. No secret values were printed."
