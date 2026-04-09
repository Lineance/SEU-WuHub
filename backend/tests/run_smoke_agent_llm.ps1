param(
    [string]$Model = "anthropic/claude-3-5-sonnet-latest",
    [string]$AnthropicBaseUrl = "https://api.kimi.com/coding",
    [string]$AnthropicApiKey = 
    [string]$PythonExe = "d:/Code/Working/SEU-WuHub/backend/.venv/Scripts/python.exe",
    [string]$SmokeScript = "backend/scripts/smoke_agent.py",
    [int]$MaxSteps = 2
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AnthropicApiKey)) {
    Write-Error "ANTHROPIC_API_KEY is empty. Pass -AnthropicApiKey or set env:ANTHROPIC_API_KEY first."
    exit 1
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")

$env:SEU_WUHUB_AGENT_MODEL = $Model
$env:ANTHROPIC_BASE_URL = $AnthropicBaseUrl.TrimEnd("/")
$env:ANTHROPIC_API_KEY = $AnthropicApiKey

Write-Host "SEU_WUHUB_AGENT_MODEL=$($env:SEU_WUHUB_AGENT_MODEL)"
Write-Host "ANTHROPIC_BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "Running smoke test..."

Push-Location $repoRoot
try {
    & $PythonExe $SmokeScript --mode llm --max-steps $MaxSteps
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
