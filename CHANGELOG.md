# Changelog

## [3.0.0] — 2026-10-12

Replaces hls.js with Shaka Player. Breaking: `hlsConfig`, `getHLSRef`, `preferNativeHls`, and `isNativeHlsSupported` are removed.

### Feature
- Playback goes through Shaka Player 5.1 (`shaka.polyfill.installAll`, `attach`, `load`). HLS and DASH manifests both load from `src`. The manifest URL is not set on `<video>`. (`src/index.tsx`)
- Embed-player Shaka settings on every load: ABR (`defaultBandwidthEstimate` 3 Mbps, network information off, portrait `aspectRatio` clears `restrictToElementSize`), manifest and streaming retries, `rebufferingGoal: 4`, `bufferingGoal: 20`, `manifest.disableText`, and `StubTextDisplayer`. (`src/drm/abrSettings.ts`)
- `startHighestRes` disables ABR during `load()`, then selects the tallest playable variant (HDR preferred when present).
- Gumlet Widevine robustness (`buildWidevineAdvancedConfig`) and FairPlay license filters (JSON `{ spc }` / `{ ckc }`, `useNativeHlsForFairPlay: false`). FairPlay wins when both license and certificate URIs are set. (`src/drm/fairPlayHelpers.ts`, `src/drm/widevineAdvanced.ts`, `src/drm/applyDrm.ts`)
- `getPlayerRef` exposes `shaka.Player`. `window.shaka` and `window.shakaPlayer` are set for the active instance.
- `muted`, `autoPlay`, `controls`, `loop`, `playsInline`, and other video attributes stay on the element. `autoPlay` calls `play()` after `load()` without recreating the player when the flag changes.
- Gumlet Insights (`@gumlet/insights-js-core`) starts by default. `src` is always parsed as `/{collection_id}/{asset_id}/main.m3u8` or `main.mpd` before Shaka is created. A missing id calls `onError` and throws. `workspace_id` is the collection id and `customVideoId` is the asset id. `customPlayerName` is `gumlet-react-hls-player` and `customPlayerVersion` is this package version. `enableInsights={false}` skips the SDK only. (`src/playbackUrl.ts`, `src/index.tsx`)

### Bug Fix
- Fatal Shaka errors (severity `CRITICAL`) call `load(src)` again up to `maxFatalRetries` (default 3). DRM codes `6000–6010` and `3014–3016` are reported and not retried.

### Dependency Update
- Remove `hls.js`. Add `shaka-player@5.1.x` and `@gumlet/insights-js-core@^4.2.0`.

## [2.0.0] — 2026-09-21

Same work as the 2.0.0 GitHub / npm release. See `RELEASE_NOTES_2.0.0.md` for the integrator-facing summary.

### Feature
- Typed player callbacks (`onReady`, `onPlay`, `onPause`, `onPlaying`, `onEnded`, `onWaiting`, `onTimeUpdate`, `onProgress`, `onSeeked`, `onVolumeChange`, `onManifestParsed`, `onQualityChange`, `onError`). Callbacks are stored in refs so inline handlers do not recreate hls.js. (`src/types.ts`, `src/index.tsx`)
- `preferNativeHls` (default `true`) uses Safari/iOS native HLS when `canPlayType('application/vnd.apple.mpegurl')` succeeds. (`src/nativeHls.ts`, `src/index.tsx`)
- Example app streams every callback into an Event log (`example/App/App.tsx`).

### Improvement
- Live and VOD; optional `playerRef` + `forwardRef`; `getHLSRef(null)` on teardown / native path / exhausted retries.
- Fatal hls.js errors retry up to `maxFatalRetries` (default 3) then `console.error`.
- `hlsConfig` is `Partial<HlsConfig>` (not the Hls class). React 18+ peers, hls.js ^1.7, TypeScript 5, Vitest.

### Bug Fix
- Stop creating a new `createRef()` every render when `playerRef` is omitted.
- Register `MANIFEST_PARSED` once instead of nesting it inside `MEDIA_ATTACHED`.
- Webpack example loader matches `.ts` as well as `.tsx` (`webpack/webpack.config.js`).

## [1.1.0] — 2026-09-21 (superseded by 2.0.0)

Draft heading used before the version was set to 2.0.0. Contents live under **[2.0.0]** above.
