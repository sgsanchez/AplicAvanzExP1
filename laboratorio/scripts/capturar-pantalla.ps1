# =====================================================================
#  TurnoConnect - Captura de pantalla para el informe
#  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
# =====================================================================
#  Toma una captura REAL de la pantalla completa y la guarda en
#  ..\Entregables\capturas\ con numeración automática.
#
#  Antes de ejecutarlo, deje visible en pantalla lo que desea capturar
#  (terminal, Postman, navegador, MongoDB, etc.).
#
#  Uso:
#     npm run captura                       -> nombre automatico
#     npm run captura -- "03-cliente-tcp"   -> nombre personalizado
#
#  También puede llamarse directamente:
#     powershell -ExecutionPolicy Bypass -File scripts\capturar-pantalla.ps1 "mi-captura"
# =====================================================================

param(
    [string]$Nombre = ''
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$raiz      = Split-Path -Parent $PSScriptRoot
$carpeta   = Join-Path (Split-Path -Parent $raiz) 'Entregables\capturas'

if (-not (Test-Path $carpeta)) {
    New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
}

# ---------------------------------------------------------------------
#  Nombre del archivo: personalizado o consecutivo automatico
# ---------------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($Nombre)) {
    $existentes = @(Get-ChildItem -Path $carpeta -Filter '*.png' -ErrorAction SilentlyContinue)
    $siguiente  = $existentes.Count + 1
    $Nombre     = ('captura-{0:d2}' -f $siguiente)
}

# Se eliminan caracteres no validos para nombres de archivo
$Nombre = ($Nombre -replace '[\\/:*?"<>|]', '-')

if (-not $Nombre.ToLower().EndsWith('.png')) { $Nombre = "$Nombre.png" }

$rutaCompleta = Join-Path $carpeta $Nombre

# Si el archivo ya existe se agrega un sufijo
$contador = 1
while (Test-Path $rutaCompleta) {
    $rutaCompleta = Join-Path $carpeta ($Nombre -replace '\.png$', "-$contador.png")
    $contador++
}

# ---------------------------------------------------------------------
#  Captura de la pantalla completa (incluye todos los monitores)
# ---------------------------------------------------------------------
$limites  = [System.Windows.Forms.SystemInformation]::VirtualScreen
$ancho    = $limites.Width
$alto     = $limites.Height

$bitmap   = New-Object System.Drawing.Bitmap($ancho, $alto)
$grafico  = [System.Drawing.Graphics]::FromImage($bitmap)

$grafico.CopyFromScreen($limites.Left, $limites.Top, 0, 0, $bitmap.Size)
$bitmap.Save($rutaCompleta, [System.Drawing.Imaging.ImageFormat]::Png)

$grafico.Dispose()
$bitmap.Dispose()

Write-Host ''
Write-Host "  [OK] Captura guardada:" -ForegroundColor Green
Write-Host "       $rutaCompleta" -ForegroundColor Cyan
Write-Host "       Tamano: ${ancho} x ${alto} px" -ForegroundColor DarkGray

# Abre la carpeta en el Explorador de Windows
Start-Process explorer.exe $carpeta
