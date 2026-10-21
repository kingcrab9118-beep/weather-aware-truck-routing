$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\backend"
if (-not (Test-Path .\.venv\Scripts\python.exe)) {
  Write-Error "Missing backend\.venv — run: python -m venv .venv && .\.venv\Scripts\pip install -r requirements.txt"
}
& .\.venv\Scripts\python.exe manage.py runserver 8001
