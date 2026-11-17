# =====================================================================
#  TurnoConnect - Arranque de MongoDB local (instalacion portable)
#  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
# =====================================================================
#  Inicia mongod.exe usando los binarios extraidos en .mongodb\server
#  y guarda los datos en .mongodb\data.
#
#  Uso:   npm run mongo:start
#     o   powershell -ExecutionPolicy Bypass -File scripts\mongo-start.ps1
#
#  No requiere permisos de administrador ni instala servicios de Windows.
# =====================================================================

$ErrorActionPreference = 'Stop'

$raiz      = Split-Path -Parent $PSScriptRoot
$mongoHome = Join-Path $raiz '.mongodb'
$mongodExe = Join-Path $mongoHome 'server\bin\mongod.exe'
$dbPath    = Join-Path $mongoHome 'data'
$logsDir   = Join-Path $mongoHome 'logs'
$logPath   = Join-Path $logsDir 'mongod.log'
$pidFile   = Join-Path $mongoHome 'mongod.pid'
$puerto    = 27017

Write-Host ''
Write-Host '==============================================================' -ForegroundColor Cyan
Write-Host '  TurnoConnect - MongoDB local' -ForegroundColor Cyan
Write-Host '  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869' -ForegroundColor Cyan
Write-Host '==============================================================' -ForegroundColor Cyan

# ---------------------------------------------------------------------
#  Comprobacion de los binarios
# ---------------------------------------------------------------------
if (-not (Test-Path $mongodExe)) {
    Write-Host ''
    Write-Host '  [ERROR] No se encontro mongod.exe' -ForegroundColor Red
    Write-Host "          Ruta esperada: $mongodExe" -ForegroundColor Yellow
    Write-Host '          Descargue el ZIP de MongoDB y extraigalo segun el README.' -ForegroundColor Yellow
    Write-Host ''
    exit 1
}

# ---------------------------------------------------------------------
#  Funcion auxiliar: comprobar si un puerto local acepta conexiones
# ---------------------------------------------------------------------
function Test-PuertoAbierto {
    param([int]$Puerto)

    $cliente = $null
    try {
        $cliente = New-Object System.Net.Sockets.TcpClient
        $tarea = $cliente.ConnectAsync('127.0.0.1', $Puerto)
        if ($tarea.Wait(500) -and $tarea.Result) { return $true }
        return $false
    } catch {
        return $false
    } finally {
        if ($cliente) { $cliente.Close() }
    }
}

# ---------------------------------------------------------------------
#  Si ya esta corriendo no se lanza otro proceso
# ---------------------------------------------------------------------
if (Test-PuertoAbierto -Puerto $puerto) {
    Write-Host ''
    Write-Host "  [OK] MongoDB ya esta escuchando en el puerto $puerto" -ForegroundColor Green
    Write-Host '       No es necesario iniciarlo de nuevo.' -ForegroundColor DarkGray
    Write-Host ''
    exit 0
}

# ---------------------------------------------------------------------
#  Preparacion de carpetas
# ---------------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $dbPath  | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

# ---------------------------------------------------------------------
#  Arranque del proceso
#  IMPORTANTE: las rutas se entrecomillan porque el proyecto esta dentro
#  de una ruta con espacios ("Disco Anterior Revision").
# ---------------------------------------------------------------------
Write-Host ''
Write-Host "  Iniciando mongod en el puerto $puerto ..." -ForegroundColor DarkGray
Write-Host "  Datos : $dbPath"  -ForegroundColor DarkGray
Write-Host "  Log   : $logPath" -ForegroundColor DarkGray

$argumentos = '--dbpath "{0}" --logpath "{1}" --logappend --port {2} --bind_ip 127.0.0.1' -f `
              $dbPath, $logPath, $puerto

$proceso = Start-Process -FilePath $mongodExe `
                         -ArgumentList $argumentos `
                         -WindowStyle Hidden `
                         -PassThru

$proceso.Id | Set-Content -Path $pidFile -Encoding ASCII

# ---------------------------------------------------------------------
#  Espera activa hasta 40 segundos
# ---------------------------------------------------------------------
$inicio = Get-Date
$listo  = $false

while (((Get-Date) - $inicio).TotalSeconds -lt 40) {
    if ($proceso.HasExited) { break }
    if (Test-PuertoAbierto -Puerto $puerto) { $listo = $true; break }
    Start-Sleep -Milliseconds 500
}

if ($listo) {
    $segundos = [math]::Round(((Get-Date) - $inicio).TotalSeconds, 1)
    Write-Host ''
    Write-Host "  [OK] MongoDB activo en mongodb://127.0.0.1:$puerto/turnoconnect ($segundos s)" -ForegroundColor Green
    Write-Host "       PID $($proceso.Id)  -  Detener con: npm run mongo:stop" -ForegroundColor DarkGray
    Write-Host ''
    exit 0
}

# ---------------------------------------------------------------------
#  Diagnostico del fallo
# ---------------------------------------------------------------------
Write-Host ''
Write-Host '  [ERROR] MongoDB no respondio en el puerto esperado.' -ForegroundColor Red

if ($proceso.HasExited) {
    Write-Host "          El proceso termino con codigo $($proceso.ExitCode)." -ForegroundColor Yellow
}

if (Test-Path $logPath) {
    Write-Host '          Ultimas lineas del log:' -ForegroundColor DarkGray
    Get-Content $logPath -Tail 20 | ForEach-Object { Write-Host "          $_" -ForegroundColor DarkGray }
} else {
    Write-Host '          No se genero el archivo de log.' -ForegroundColor Yellow
    Write-Host '          Causa habitual: falta el paquete Visual C++ Redistributable.' -ForegroundColor Yellow
    Write-Host "          Ejecute como administrador: $mongoHome\server\bin\vc_redist.x64.exe" -ForegroundColor Yellow
}

Write-Host ''
exit 1
