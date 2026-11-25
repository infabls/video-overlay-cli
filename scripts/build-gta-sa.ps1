<#
.SYNOPSIS
  GTA San Andreas overlay for a video: Go radar + React HUD, composited with ffmpeg in one encode.

.EXAMPLE
  .\scripts\build-gta-sa.ps1 -Video E:\DCIM\100GOPRO\GX015729.MP4 -Gpx ".\New file-timed.gpx" -Output .\gta-result.mp4

.NOTES
  Needs: ffmpeg/ffprobe in PATH, Node + pnpm, Chrome. First run installs and builds hud-react.
  The HUD clock shows GPX time + TzHours; speed and distance come from the GPX track.
#>
param(
  [Parameter(Mandatory)][string]$Video,
  [Parameter(Mandatory)][string]$Gpx,
  [Parameter(Mandatory)][string]$Output,
  [string]$Layout = "gta-sa.xml",
  [string]$Cli = "",
  [double]$Offset = 0,
  [double]$TzHours = 0,
  [int]$Fps = 10,
  [int]$Width = 1920,
  [int]$Height = 1080,
  [double]$Limit = 0,
  [string]$Work = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$hudDir = Join-Path $root "hud-react"
if (-not $Cli) { $Cli = Join-Path $root "video-overlay-cli.exe" }
if (-not $Work) { $Work = Join-Path ([IO.Path]::GetTempPath()) "gta-sa-build" }
if (-not [IO.Path]::IsPathRooted($Layout)) { $Layout = Join-Path $root $Layout }

function Invoke-Step([string]$Name, [scriptblock]$Block) {
  Write-Host "== $Name"
  & $Block
  if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)" }
}

$duration = [double]::Parse((ffprobe -v error -show_entries format=duration -of csv=p=0 $Video), [Globalization.CultureInfo]::InvariantCulture)
if ($Limit -gt 0 -and $Limit -lt $duration) { $duration = $Limit }
New-Item -ItemType Directory -Force $Work | Out-Null
$frames = Join-Path $Work "hud"
$radar = Join-Path $Work "radar.mov"
if (Test-Path $frames) { Remove-Item -Recurse -Force $frames }

if (-not (Test-Path (Join-Path $hudDir "build\index.html"))) {
  Push-Location $hudDir
  try {
    Invoke-Step "hud-react install" { pnpm install --ignore-workspace }
    $env:CI = "false"
    Invoke-Step "hud-react build" { pnpm build }
  } finally { Pop-Location }
}

Invoke-Step "radar (Go)" {
  & $Cli render --activity $Gpx --layout $Layout --output $radar --size "${Width}x${Height}" --fps $Fps `
    --background transparent --profile alpha-prores
}
Invoke-Step "HUD frames (React)" {
  node (Join-Path $hudDir "capture.cjs") --gpx $Gpx --out $frames --duration $duration --fps $Fps --width $Width --height $Height --tz $TzHours
}
Invoke-Step "composite (ffmpeg)" {
  $hudX = $Width - 540
  $filter = "[0:v][1:v]overlay=0:0[a];[a][2:v]overlay=${hudX}:0:format=auto,format=yuv420p[v]"
  ffmpeg -v error -y -i $Video -itsoffset $Offset -i $radar -itsoffset $Offset -framerate $Fps -i (Join-Path $frames "hud_%04d.png") `
    -filter_complex $filter -map "[v]" -map "0:a?" -t $duration -c:v libx264 -crf 18 -preset medium -c:a copy $Output
}
Write-Host "Wrote $Output"
