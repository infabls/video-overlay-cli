# GTA San Andreas overlay

A GoPro-style ride video with the San Andreas look: a round radar bottom-left and the status cluster (clock, health and armor bars, speed, distance) top-right.

The two halves are rendered separately and merged in a single ffmpeg encode:

| Part | Made by | Source |
| --- | --- | --- |
| Radar with heading-up map, north marker, player arrow | Go renderer, layout `layouts/gta-sa.xml` (`moving_map style="gta-sa" marker="gta-sa"`, `compass labels="N" label_radius="0.97"` with `outline`/`outline_width`: the N rides the radar ring) | GPX/FIT |
| Status cluster | React app in `hud-react/` (fork of [MickMelon/gta-sa-hud-react](https://github.com/MickMelon/gta-sa-hud-react), MIT), captured frame by frame in headless Chrome by `themes/capture.cjs` | GPX |

## One command (Windows)

```powershell
.\scripts\build-gta-sa.ps1 -Video E:\DCIM\100GOPRO\GX015729.MP4 -Gpx .\tracks\track.gpx -Output .\renders\gta-sa.mp4
```

Requirements: `ffmpeg`/`ffprobe`, Node, `pnpm`, Chrome, and a built `bin/video-overlay-cli.exe` (`go build -o bin/video-overlay-cli.exe ./cmd/video-overlay-cli`; `-Cli` overrides). The first run installs and builds `hud-react`.

Useful parameters: `-Offset` (seconds into the video where the track starts), `-TzHours` (clock = GPX time + offset), `-Limit` (render only the first N seconds of video, for quick checks), `-Layout`, `-Stars` (lit wanted-level stars, 0-6, default 6), `-Map vector` (radar from vector tiles, `themes/gta-sa-radar`, instead of the Go renderer; the CLI binary is then not needed, see [themes.md](themes.md#vector-minimap)).

The speed and distance on the HUD are computed from consecutive GPX points, so a track with invented timestamps shows invented speeds. Use a recorded track for real values.

## Fast iteration on the radar

`--snapshot SEC` renders a single PNG frame instead of a video:

```powershell
.\bin\video-overlay-cli.exe render --activity tracks\track.gpx --layout layouts\gta-sa.xml --output snap.png --background transparent --snapshot 30
```

## Changing the HUD

Edit `hud-react/src/components/Hud.tsx` (layout, icon in `hud-react/public/`, font in `hud-react/src/fonts/`), then `pnpm build` in `hud-react/`.

## Updates from the original author

This repository is a fork of `Bupyc/video-overlay-cli`: remote `upstream` is the author, `origin` is the fork. `main` mirrors upstream; the GTA work lives on branch `gta-sa`, and all changes are additive (new attributes, new flag), so existing layouts behave as before. To pull the author's updates and rebase: `.\scripts\sync-upstream.ps1`.

## Folder layout

`layouts/` XML layouts - `scripts/` pipeline - `hud-react/` HUD app - `bin/` built executables, `renders/` finished videos, `tracks/` GPX/FIT, `assets/fonts/gta-sa/` game fonts, `assets/reference/` screenshots (all five are git-ignored).
