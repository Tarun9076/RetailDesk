<#
.SYNOPSIS
  Sends the "who owes us how much" list from a Tally export to RetailDesk. Run it by hand, or on a schedule (Windows Task Scheduler) after the day's vouchers are entered in Tally.

.DESCRIPTION
  1. In Tally, export the Sundry Debtors list (Display, Account Books, Outstandings) as CSV.
  2. Run this script on that file. By default it only CHECKS and reports what would change.
  3. Add -Apply to write the amounts.

  The address and the token come from the environment, so the token is never typed into a command or saved in a script:
    $env:RETAILDESK_URL   = "https://your-app.vercel.app"
    $env:RETAILDESK_TOKEN = "<the same value as BALANCES_API_TOKEN on the server>"

.EXAMPLE
  .\send-balances.ps1 -File C:\Tally\debtors.csv
  .\send-balances.ps1 -File C:\Tally\debtors.csv -Apply
  .\send-balances.ps1 -File C:\Tally\debtors.csv -NameColumn "Particulars" -BalanceColumn "Closing Balance" -Apply
#>
param(
  [Parameter(Mandatory = $true)][string]$File,
  [string]$NameColumn = "Particulars",
  [string]$BalanceColumn = "Closing Balance",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
if (-not $env:RETAILDESK_URL -or -not $env:RETAILDESK_TOKEN) { throw "Set RETAILDESK_URL and RETAILDESK_TOKEN first (see the notes at the top of this file)." }
if (-not (Test-Path $File)) { throw "File not found: $File" }

$rows = Import-Csv -Path $File
if (-not $rows) { throw "The file has no rows." }
$names = $rows[0].PSObject.Properties.Name
if ($names -notcontains $NameColumn) { throw "No column called '$NameColumn'. The file has: $($names -join ', ')" }
if ($names -notcontains $BalanceColumn) { throw "No column called '$BalanceColumn'. The file has: $($names -join ', ')" }

# Total lines and blank rows are not shops.
$payload = @($rows | Where-Object { $_.$NameColumn -and $_.$NameColumn.Trim() -and $_.$NameColumn -notmatch '^(grand\s+)?total' } |
  ForEach-Object { @{ ledger = $_.$NameColumn.Trim(); balance = "$($_.$BalanceColumn)".Trim() } })
if ($payload.Count -eq 0) { throw "No ledger rows found in the file." }

$body = @{ rows = $payload; apply = [bool]$Apply } | ConvertTo-Json -Depth 4 -Compress
try {
  $r = Invoke-RestMethod -Method Post -Uri "$($env:RETAILDESK_URL.TrimEnd('/'))/api/integrations/balances" `
    -Headers @{ Authorization = "Bearer $($env:RETAILDESK_TOKEN)" } -ContentType "application/json; charset=utf-8" `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
} catch {
  $detail = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
  throw "RetailDesk refused the file: $detail"
}

$s = $r.summary
"{0} rows read: {1} shops matched, {2} amounts would change, {3} names matched no shop." -f $payload.Count, $s.matched, $s.changed, $s.unmatched.Count
if ($r.applied) { "Saved: {0} shops updated, {1} skipped because they changed meanwhile." -f $r.result.updated, $r.result.skippedChanged }
else { "Nothing was saved (check only). Add -Apply to write the amounts." }
