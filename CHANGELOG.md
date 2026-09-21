# Changelog

## [1.1.0] — 2026-09-21

### Improvement
- Live and VOD HLS playback; optional `playerRef`; `getHLSRef(null)` on teardown.
- Fatal hls.js errors retry up to `maxFatalRetries` (default 3) and then `console.error`.
- `hlsConfig` is typed as `Partial<HlsConfig>`.
- Keep both the `<video>` (`playerRef` / `ref`) and the hls.js instance (`getHLSRef`).
- Player callbacks: `onReady`, `onPlay`, `onPause`, `onPlaying`, `onEnded`, `onWaiting`, `onTimeUpdate`, `onProgress`, `onSeeked`, `onVolumeChange`, `onManifestParsed`, `onQualityChange`, `onError`.
- React 18+ peers, hls.js ^1.7, TypeScript 5, Vitest.

### Bug Fix
- Stop creating a new `createRef()` every render when `playerRef` is omitted.
- Register `MANIFEST_PARSED` once instead of nesting it inside `MEDIA_ATTACHED`.
