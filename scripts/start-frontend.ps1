$ErrorActionPreference = 'Stop'
Set-Location (Join-Path (Split-Path $PSScriptRoot -Parent) 'RAG_Frontend')
if (!(Test-Path -LiteralPath 'node_modules')) { throw 'Run scripts\setup.ps1 first.' }
& npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
exit $LASTEXITCODE
