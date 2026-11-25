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
  [ValidateSet("raster", "vector")][string]$Map = "raster",
  # video encoder: auto = NVIDIA GPU (NVENC) when it works, otherwise libx264 on the CPU
  [ValidateSet("auto", "nvenc", "x264")][string]$Encoder = "auto",
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
if ($Map -eq "vector" -and $Theme -notin "nfsu2", "gta-sa") { throw "-Map vector is supported by the nfsu2 and gta-sa themes only" }
$root = Split-Path -Parent $PSScriptRoot
$themesDir = Join-Path $root "themes"
if (-not $Cli) { $Cli = Join-Path $root "bin/video-overlay-cli.exe" }
if (-not $Work) { $Work = Join-Path ([IO.Path]::GetTempPath()) "overlay-build-$Theme" }

# gta-sa keeps its React app in hud-react/ and a Go radar; other themes are plain folders in themes/.
# With -Map vector the gta-sa radar is themes/gta-sa-radar instead of the Go layer.
$useRadar = $false
$radarTheme = ""
if ($Theme -eq "gta-sa") {
  $themeDir = Join-Path $root "hud-react\build"
  if ($Map -eq "vector") { $radarTheme = Join-Path $themesDir "gta-sa-radar" }
  elseif (-not $Layout) { $Layout = "layouts\gta-sa.xml" }
} else {
  $themeDir = Join-Path $themesDir $Theme
}
if ($Layout) { $useRadar = $true }
if ($Layout -and -not [IO.Path]::IsPathRooted($Layout)) { $Layout = Join-Path $root $Layout }

function Invoke-Step([string]$Name, [scriptblock]$Block) {
  Write-Host "== $Name"
  & $Block
  if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)" }
}

if ($Encoder -eq "auto") {
  # listed encoders may still fail without a suitable GPU or driver, so try a tiny encode
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  ffmpeg -v quiet -f lavfi -i "color=size=256x256:duration=0.1" -c:v h264_nvenc -f null - 2>$null
  $Encoder = if ($LASTEXITCODE -eq 0) { "nvenc" } else { "x264" }
  $ErrorActionPreference = $previous
}
# -cq 19 matches the quality of libx264 -crf 18 (measured by PSNR/SSIM on GoPro footage)
if ($Encoder -eq "nvenc") {
  $decodeArgs = @("-hwaccel", "cuda")
  $encodeArgs = @("-c:v", "h264_nvenc", "-profile:v", "high", "-preset", "p5", "-rc", "vbr", "-cq", "19", "-b:v", "0")
} else {
  $decodeArgs = @()
  $encodeArgs = @("-c:v", "libx264", "-crf", "18", "-preset", "medium")
}
Write-Host "encoder: $Encoder"

$duration = [double]::Parse((ffprobe -v error -show_entries format=duration -of csv=p=0 $Video), [Globalization.CultureInfo]::InvariantCulture)
if ($Limit -gt 0 -and $Limit -lt $duration) { $duration = $Limit }
New-Item -ItemType Directory -Force $Work | Out-Null
$frames = Join-Path $Work "frames"
$radar = Join-Path $Work "radar.mov"
if (Test-Path $frames) { Remove-Item -Recurse -Force $frames }

if (-not (Test-Path (Join-Path $themesDir "node_modules")) -or
    ($Map -eq "vector" -and -not (Test-Path (Join-Path $themesDir "node_modules\@mapbox\vector-tile")))) {
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
    --width $Width --height $Height --tz $TzHours --stars $Stars --units $Units --map $Map
}
$clip = Get-Content (Join-Path $frames "clip.json") -Raw | ConvertFrom-Json
if ($radarTheme) {
  $radarFrames = Join-Path $Work "radar-frames"
  if (Test-Path $radarFrames) { Remove-Item -Recurse -Force $radarFrames }
  Invoke-Step "radar frames (vector)" {
    node (Join-Path $themesDir "capture.cjs") --theme $radarTheme --gpx $Gpx --out $radarFrames --duration $duration --fps $Fps `
      --width $Width --height $Height
  }
  $radarClip = Get-Content (Join-Path $radarFrames "clip.json") -Raw | ConvertFrom-Json
}

Invoke-Step "composite (ffmpeg)" {
  # layers over the video, bottom to top: radar (Go .mov and/or vector frames), then the theme
  $inputs = @()
  $positions = @()
  if ($useRadar) {
    $inputs += @("-itsoffset", $Offset, "-i", $radar)
    $positions += "0:0"
  }
  if ($radarTheme) {
    $inputs += @("-itsoffset", $Offset, "-framerate", $Fps, "-i", (Join-Path $radarFrames "hud_%04d.png"))
    $positions += "$($radarClip.x):$($radarClip.y)"
  }
  $inputs += @("-itsoffset", $Offset, "-framerate", $Fps, "-i", (Join-Path $frames "hud_%04d.png"))
  $positions += "$($clip.x):$($clip.y)"
  $chain = @()
  $last = "0:v"
  for ($i = 0; $i -lt $positions.Count - 1; $i++) {
    $chain += "[$last][$($i + 1):v]overlay=$($positions[$i])[l$i]"
    $last = "l$i"
  }
  $chain += "[$last][$($positions.Count):v]overlay=$($positions[-1]):format=auto,format=yuv420p[v]"
  ffmpeg -v error -y @decodeArgs -i $Video @inputs `
    -filter_complex ($chain -join ";") -map "[v]" -map "0:a?" -t $duration @encodeArgs -c:a copy $Output
}
Write-Host "Wrote $Output"
