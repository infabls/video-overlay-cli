<#
.SYNOPSIS
  Backward-compatible wrapper: GTA San Andreas overlay (see build-overlay.ps1 for all themes and parameters).
.EXAMPLE
  .\scripts\build-gta-sa.ps1 -Video E:\DCIM\100GOPRO\GX015729.MP4 -Gpx .\tracks\track.gpx -Output .\renders\gta-sa.mp4
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Video,
  [Parameter(Mandatory)][string]$Gpx,
  [Parameter(Mandatory)][string]$Output,
  [double]$Offset = 0,
  [double]$TzHours = 0,
  [int]$Stars = 6,
  [double]$Limit = 0,
  [string]$Layout = "",
  [string]$Cli = ""
)
$forward = @{} + $PSBoundParameters
& (Join-Path $PSScriptRoot "build-overlay.ps1") -Theme gta-sa @forward
