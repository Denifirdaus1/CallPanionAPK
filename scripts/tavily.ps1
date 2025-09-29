# PowerShell wrapper for Tavily search (Codex)
# Usage examples:
#   ./scripts/tavily.ps1 "query about Flutter 3.24"
#   ./scripts/tavily.ps1 "Supabase Edge Functions best practices" --search-depth advanced --max-results 5

param(
  [Parameter(Mandatory=$false, Position=0)] [string] $Query,
  [Parameter(ValueFromRemainingArguments=$true)] [string[]] $Rest
)

$ErrorActionPreference = 'Stop'

function Ensure-Node {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is required (node not found in PATH)"
  }
}

function Resolve-RepoPath([string] $rel) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  return Join-Path $scriptDir $rel
}

Ensure-Node
$script = Resolve-RepoPath 'tavily-search.mjs'

if (-not $Query -and $Rest.Count -gt 0 -and ($Rest[0] -notlike '--*')) {
  $Query = $Rest[0]
  $Rest = $Rest[1..($Rest.Count-1)]
}

if (-not $Query) {
  Write-Host "Usage: ./scripts/tavily.ps1 '<query>' [--max-results 5] [--search-depth advanced] [--include-domains docs.flutter.dev]"
  exit 1
}

node $script --query $Query @Rest

