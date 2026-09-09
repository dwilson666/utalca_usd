# Aplica migraciones + seed al proyecto Supabase (nube).
# Uso:
#   $env:SUPABASE_DB_URL = "postgresql://postgres:<PASSWORD>@db.<ref>.supabase.co:5432/postgres"
#   powershell -File scripts/deploy_supabase.ps1
#
# La contraseña NO se guarda en disco. Está en:
#   Supabase Dashboard -> Project Settings -> Database -> Database password
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$url = $env:SUPABASE_DB_URL
if (-not $url) { Write-Error 'Falta $env:SUPABASE_DB_URL'; exit 1 }

Push-Location $root
try {
  Write-Host '== supabase db push ==' -f Cyan
  supabase db push --db-url $url --yes
  if ($LASTEXITCODE) { throw 'db push falló' }

  Write-Host '== seed (base + unidades + seguimiento) ==' -f Cyan
  $psql = if ($env:PSQL) { $env:PSQL } else { 'psql' }
  foreach ($f in @('supabase/seed.sql', 'supabase/seed/units.sql', 'supabase/seed/engagements.sql')) {
    Write-Host "-> $f"
    & $psql $url -v ON_ERROR_STOP=1 -q -f $f
    if ($LASTEXITCODE) { throw "seed falló en $f" }
  }
  Write-Host "`n== LISTO ==" -f Green
  & $psql $url -q -tAc "select 'unidades='||count(*) from organizational_units" -tAc "select 'roles='||count(*) from roles"
}
finally { Pop-Location }
