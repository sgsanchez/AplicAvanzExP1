# =====================================================================
#  TurnoConnect - Detencion de MongoDB local
#  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
# =====================================================================
#  Uso:  npm run mongo:stop
# =====================================================================

$ErrorActionPreference = 'Stop'

$raiz    = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $raiz '.mongodb\mongod.pid'

Write-Host ''
Write-Host '  TurnoConnect - Deteniendo MongoDB local' -ForegroundColor Cyan

$detenidos = 0

# ---------------------------------------------------------------------
#  1) Intento por el PID guardado al arrancar
# ---------------------------------------------------------------------
if (Test-Path $pidFile) {
    $idProceso = (Get-Content $pidFile -Raw).Trim()

    if ($idProceso -match '^\d+$') {
        $proceso = Get-Process -Id ([int]$idProceso) -ErrorAction SilentlyContinue
        if ($proceso) {
            Stop-Process -Id $proceso.Id -Force
            Write-Host "  [OK] Proceso mongod detenido (PID $($proceso.Id))" -ForegroundColor Green
            $detenidos++
        }
    }

    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------
#  2) Cualquier mongod.exe que haya quedado activo
# ---------------------------------------------------------------------
$restantes = Get-Process -Name 'mongod' -ErrorAction SilentlyContinue

foreach ($p in $restantes) {
    Stop-Process -Id $p.Id -Force
    Write-Host "  [OK] Proceso mongod detenido (PID $($p.Id))" -ForegroundColor Green
    $detenidos++
}

if ($detenidos -eq 0) {
    Write-Host '  (No habia ningun proceso mongod en ejecucion)' -ForegroundColor DarkGray
}

Write-Host ''
