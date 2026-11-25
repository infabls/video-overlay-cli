<#
.SYNOPSIS
  Game-style overlay for a video from a GPX track: an HTML/CSS/JS theme rendered frame by frame,
  optionally plus the Go radar layer, composited with ffmpeg in one encode.

.EXAMPLE
  .\scripts\build-overlay.ps1 -Theme nfsu2 -Units mph -Video E:\DCIM\100GOPRO\GX015729.MP4 -Gpx .\tracks\track.gpx -Output .\renders\nfsu2.mp4
  .\scripts\build-overlay.ps1 -Theme gta-sa -Video ... -Gpx ... -Output .\renders\gta-sa.mp4

.NOTES
  Themes: gta-sa (React app in hud-react/ + Go radar from layouts/gta-sa.xml), nfsu2 (themes/nfsu2, draws its own minimap).
  Needs: ffmpeg/ffprobe in PATH, Node + pnpm, Chrome. The first run installs dependencies.
  The clock shows GPX time + TzHours; speed, distance and heading come from the GPX track.
#>
param(
  [Parameter(Mandatory)][string]$Video,
  [Parameter(Mandatory)][string]$Gpx,
  [Parameter(Mandatory)][string]$Output,
  [string]$Theme = "gta-sa",
  [ValidateSet("kph", "mph")][string]$Units = "kph",
  [string]$Layout = "",
  [string]$Cli = "",
  [double]$Offset = 0,
  [double]$TzHours = 0,
  [int]$Stars = 6,
  [int]$Fps = 10,
  [int]$Width = 1920,
  [int]$Height = 1080,
  [double]$Limit = 0,
  [string]$Work = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$themesDir = Join-Path $root "themes"
if (-not $Cli) { $Cli = Join-Path $root "bin/video-overlay-cli.exe" }
if (-not $Work) { $Work = Join-Path ([IO.Path]::GetTempPath()) "overlay-build-$Theme" }

# gta-sa keeps its React app in hud-react/ and a Go radar; other themes are plain folders in themes/.
$useRadar = $false
if ($Theme -eq "gta-sa") {
  $themeDir = Join-Path $root "hud-react\build"
  $useRadar = $true
  if (-not $Layout) { $Layout = "layouts\gta-sa.xml" }
} else {
  $themeDir = Join-Path $themesDir $Theme
  if ($Layout) { $useRadar = $true }
}
if ($Layout -and -not [IO.Path]::IsPathRooted($Layout)) { $Layout = Join-Path $root $Layout }

function Invoke-Step([string]$Name, [scriptblock]$Block) {
  Write-Host "== $Name"
  & $Block
  if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)" }
}

$duration = [double]::Parse((ffprobe -v error -show_entries format=duration -of csv=p=0 $Video), [Globalization.CultureInfo]::InvariantCulture)
if ($Limit -gt 0 -and $Limit -lt $duration) { $duration = $Limit }
New-Item -ItemType Directory -Force $Work | Out-Null
$frames = Join-Path $Work "frames"
$radar = Join-Path $Work "radar.mov"
if (Test-Path $frames) { Remove-Item -Recurse -Force $frames }

if (-not (Test-Path (Join-Path $themesDir "node_modules"))) {
  Push-Location $themesDir
  try { Invoke-Step "themes install" { pnpm install --ignore-workspace } } finally { Pop-Location }
}
if ($Theme -eq "gta-sa" -and -not (Test-Path (Join-Path $themeDir "index.html"))) {
  Push-Location (Join-Path $root "hud-react")
  try {
    Invoke-Step "hud-react install" { pnpm install --ignore-workspace }
    $env:CI = "false"
    Invoke-Step "hud-react build" { pnpm build }
  } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $themeDir "index.html"))) { throw "Theme '$Theme' not found: $themeDir\index.html" }

if ($useRadar) {
  Invoke-Step "radar (Go)" {
    & $Cli render --activity $Gpx --layout $Layout --output $radar --size "${Width}x${Height}" --fps $Fps `
      --background transparent --profile alpha-prores
  }
}
Invoke-Step "theme frames ($Theme)" {
  node (Join-Path $themesDir "capture.cjs") --theme $themeDir --gpx $Gpx --out $frames --duration $duration --fps $Fps `
    --width $Width --height $Height --tz $TzHours --stars $Stars --units $Units
}
$clip = Get-Content (Join-Path $frames "clip.json") -Raw | ConvertFrom-Json

Invoke-Step "composite (ffmpeg)" {
  $themeInput = @("-itsoffset", $Offset, "-framerate", $Fps, "-i", (Join-Path $frames "hud_%04d.png"))
  $place = "overlay=$($clip.x):$($clip.y):format=auto,format=yuv420p[v]"
  if ($useRadar) {
    $filter = "[0:v][1:v]overlay=0:0[a];[a][2:v]$place"
    ffmpeg -v error -y -i $Video -itsoffset $Offset -i $radar @themeInput `
      -filter_complex $filter -map "[v]" -map "0:a?" -t $duration -c:v libx264 -crf 18 -preset medium -c:a copy $Output
  } else {
    $filter = "[0:v][1:v]$place"
    ffmpeg -v error -y -i $Video @themeInput `
      -filter_complex $filter -map "[v]" -map "0:a?" -t $duration -c:v libx264 -crf 18 -preset medium -c:a copy $Output
  }
}
Write-Host "Wrote $Output"
