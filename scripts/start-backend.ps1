$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'python.ps1')
$python = Get-RagPython $root
$env:PYTHONUTF8 = '1'
$env:HF_HOME = Join-Path $root 'hf_cache'
Set-Location (Join-Path $root 'RAG_Backend')
& $python -m uvicorn src.api:app --host 127.0.0.1 --port 8000
exit $LASTEXITCODE
