# GTA San Andreas overlay

A GoPro-style ride video with the San Andreas look: a round radar bottom-left and the status cluster (clock, health and armor bars, speed, distance) top-right.

The two halves are rendered separately and merged in a single ffmpeg encode:

| Part | Made by | Source |
| --- | --- | --- |
| Radar with heading-up map, north marker, player arrow | Go renderer, layout `gta-sa.xml` (`moving_map style="gta-sa" marker="gta-sa"`, `compass labels="N"`) | GPX/FIT |
| Status cluster | React app in `hud-react/` (fork of [MickMelon/gta-sa-hud-react](https://github.com/MickMelon/gta-sa-hud-react), MIT), captured frame by frame in headless Chrome by `hud-react/capture.cjs` | GPX |

## One command (Windows)

```powershell
.\scripts\build-gta-sa.ps1 -Video E:\DCIM\100GOPRO\GX015729.MP4 -Gpx ".\track.gpx" -Output .\gta-result.mp4
```

Requirements: `ffmpeg`/`ffprobe`, Node, `pnpm`, Chrome, and a built `video-overlay-cli.exe` in the repository root (`-Cli` overrides). The first run installs and builds `hud-react`.

Useful parameters: `-Offset` (seconds into the video where the track starts), `-TzHours` (clock = GPX time + offset), `-Limit` (render only the first N seconds of video, for quick checks), `-Layout`.

The speed and distance on the HUD are computed from consecutive GPX points, so a track with invented timestamps shows invented speeds. Use a recorded track for real values.

## Fast iteration on the radar

`--snapshot SEC` renders a single PNG frame instead of a video:

```powershell
.\video-overlay-cli.exe render --activity track.gpx --layout gta-sa.xml --output snap.png --background transparent --snapshot 30
```

## Changing the HUD

Edit `hud-react/src/components/Hud.tsx` (layout, icon in `hud-react/public/`, font in `hud-react/src/fonts/`), then `pnpm build` in `hud-react/`.
