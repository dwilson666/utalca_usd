# Prueba la base de datos SIN Docker: PostgreSQL vanilla + shim de Supabase.
# Requiere psql en el PATH y las variables PGHOST/PGPORT/PGUSER/PGDATABASE
# apuntando a una base DESECHABLE (este script hace DROP SCHEMA public CASCADE).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$psql = if ($env:PSQL) { $env:PSQL } else { 'psql' }
$conn = $args[0]
if (-not $conn) { Write-Error 'Uso: test_local.ps1 "postgresql://user:pass@host:port/db"'; exit 1 }

function Run($file) {
  Write-Host "-> $file" -ForegroundColor Cyan
  & $psql $conn -v ON_ERROR_STOP=1 -q -f $file
  if ($LASTEXITCODE -ne 0) { throw "fallo en $file" }
}

& $psql $conn -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade; create schema public; drop schema if exists app cascade; drop schema if exists auth cascade;"

Run "$root/scripts/local_pg_shim.sql"
Get-ChildItem "$root/supabase/migrations/*.sql" | Sort-Object Name | ForEach-Object { Run $_.FullName }
Push-Location "$root/supabase"; Run "$root/supabase/seed.sql"; Pop-Location

if (Test-Path "$root/../../pgtap.sql") { Run "$root/../../pgtap.sql" }
elseif ($env:PGTAP) { Run $env:PGTAP }
else { Write-Host "pgtap.sql no encontrado; omito la suite pgTAP" -ForegroundColor Yellow; exit 0 }

Write-Host "`n=== supabase/tests/authz_matrix_test.sql ===" -ForegroundColor Green
& $psql $conn -q -f "$root/supabase/tests/authz_matrix_test.sql"
