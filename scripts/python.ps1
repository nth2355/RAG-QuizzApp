function Get-RagPython {
    param([string]$Root)
    foreach ($name in @('venv', '.venv', '.venv-local')) {
        $candidate = Join-Path $Root "RAG_Backend\$name\Scripts\python.exe"
        if (Test-Path -LiteralPath $candidate) {
            try {
                & $candidate -c "import sys; assert sys.version_info[:2] in ((3, 11), (3, 12))" 2>$null
                if ($LASTEXITCODE -eq 0) { return $candidate }
            } catch { continue }
        }
    }
    throw 'No working backend Python environment. Run scripts\setup.ps1 first.'
}
