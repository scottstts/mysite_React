# Background Video Bake Pipeline

This directory contains the source needed to rebuild the baked background video.

## Files

- `input/bg_video.webm`: the original base black-hole video, before the WebGL petals were baked in.
- `renderer.html`: deterministic WebGL renderer for the transparent petal overlay.
- `build-bg-video.mjs`: pipeline script that extracts source frames, renders overlay frames, composites them, and encodes a VP9 WebM.

## How It Works

1. `ffmpeg` extracts the original video frames from `input/bg_video.webm`.
2. Headless Chrome opens `renderer.html` and renders 151 transparent overlay PNG frames at `3840x2160`.
3. `ffmpeg` composites each overlay frame onto the matching original video frame.
4. `ffmpeg` encodes the result as VP9 WebM with the same frame count, frame rate, dimensions, and color metadata as the original.
5. Temporary frames are written under `/private/tmp/mysite-bg-bake-work` and removed when the script finishes.

The overlay uses a six-sector, 60-degree periodic animation aligned to the black-hole accretion disk plane. A small periodic phase easing reduces the visible loop-boundary step without crossfading or duplicating endpoint frames.

## Requirements

- Node.js 22+
- Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- `ffmpeg` with `libvpx-vp9` encoder support

The script prefers `/opt/homebrew/Cellar/ffmpeg/8.0_1/bin/ffmpeg` because the newer Homebrew ffmpeg available on this machine can decode VP9 but does not expose the VP9 encoder. Set `FFMPEG=/path/to/ffmpeg` to override.

## Usage

Write to `utils/bg-video-bake/output/bg_video.webm`:

```sh
node utils/bg-video-bake/build-bg-video.mjs
```

Replace the production background video:

```sh
node utils/bg-video-bake/build-bg-video.mjs public/static_assets/bg_video.webm
```
