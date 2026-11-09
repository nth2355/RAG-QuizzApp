$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'python.ps1')
try { $python = Get-RagPython $root } catch {
    $venv = Join-Path $root 'RAG_Backend\.venv-local'
    if (Test-Path -LiteralPath $venv) { throw "Existing environment is broken: $venv. Rename it before retrying." }
    & py -3.11 -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.11 from python.org, then retry.' }
    $python = Join-Path $venv 'Scripts\python.exe'
}
$envFile = Join-Path $root 'RAG_Backend\.env'
if (!(Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath (Join-Path $root 'RAG_Backend\.env.example') -Destination $envFile
    $secret = & $python -c 'import secrets; print(secrets.token_urlsafe(48))'
    $content = [IO.File]::ReadAllText($envFile).Replace('replace-with-random-secret', $secret)
    [IO.File]::WriteAllText($envFile, $content, [Text.UTF8Encoding]::new($false))
}
$override = Join-Path $root 'RAG_Backend\.env.local'
if (!(Test-Path -LiteralPath $override)) {
    $db = (Join-Path $root 'RAG_Backend\storage\rag.db').Replace('\', '/')
    $vectors = (Join-Path $root 'RAG_Backend\storage\qdrant-local').Replace('\', '/')
    [IO.File]::WriteAllText($override, "RAG_DATABASE_URL=sqlite:///$db`nRAG_STORAGE_DIR=$vectors`n", [Text.UTF8Encoding]::new($false))
}
& $python -m pip install -r (Join-Path $root 'RAG_Backend\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
Push-Location (Join-Path $root 'RAG_Frontend')
try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
} finally { Pop-Location }
Write-Host 'Setup complete. Set RAG_GOOGLE_API_KEY in RAG_Backend\.env, then run start-backend.cmd and start-frontend.cmd.'
