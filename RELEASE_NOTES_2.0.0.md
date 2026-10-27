# Release Notes — v2.0.0

`@gumlet/react-hls-player` 2.0 is a rewrite of the React HLS wrapper for **live and VOD**. It adds typed playback callbacks, safer teardown, native Safari/iOS HLS by default, and current React / hls.js support.

```bash
npm i @gumlet/react-hls-player@2.0.0
```

Requires **React 18 or later**.

## What’s new

### Easy player callbacks

You no longer need to attach listeners to the `<video>` element. Use `onReady`, `onPlay`, `onPause`, `onPlaying`, `onEnded`, `onWaiting`, `onTimeUpdate`, `onProgress`, `onSeeked`, `onVolumeChange`, `onManifestParsed`, `onQualityChange`, and `onError`.

```jsx
<ReactHlsPlayer
  src={src}
  controls
  onReady={() => console.log('ready')}
  onPlay={() => console.log('play')}
  onTimeUpdate={({ currentTime, duration }) => {
    console.log(currentTime, duration);
  }}
  onError={({ fatal, source, message }) => {
    console.error(source, message, fatal);
  }}
/>
```

`onReady` fires when the stream is ready to play (hls.js manifest parsed, or native HLS `loadedmetadata`). `onError` reports both hls.js failures (`source: 'hls'`) and video-element errors (`source: 'video'`). Changing these handlers does not recreate the player.

The example app (`npm start`) prints every callback into a live **Event log**.

### Native HLS on Safari / iOS

`preferNativeHls` defaults to **true**. If the browser can play `.m3u8` natively, the component uses that path and does not start hls.js. Chrome and other browsers without native HLS still use hls.js.

To force hls.js on Safari:

```jsx
<ReactHlsPlayer src={src} preferNativeHls={false} />
```

### Both the video element and the hls.js instance

- `playerRef` / `ref` — the `<video>` element. **Optional.**
- `getHLSRef` — the hls.js instance, or `null` when it is destroyed, the source changes, retries are exhausted, or native HLS is used.

```jsx
<ReactHlsPlayer
  src={src}
  playerRef={videoRef}
  getHLSRef={(hls) => {
    if (!hls) return;
    // hls.js instance (also set on window.Hls)
  }}
/>
```

### More reliable recovery

Fatal hls.js errors retry up to **`maxFatalRetries` (default 3)**, then log with `console.error` and tear down. `hlsConfig` is typed as hls.js `Partial<HlsConfig>`.

## Breaking changes from 1.x

| Change | What to do |
| --- | --- |
| Peer dependency is React **18+** (was 16) | Upgrade React / React DOM |
| `preferNativeHls` defaults to `true` | Desktop Safari may use native HLS instead of hls.js. Pass `preferNativeHls={false}` to keep the old path |
| `enableWorker: false` is no longer hardcoded | hls.js defaults apply. Set `hlsConfig={{ enableWorker: false }}` if your bundler cannot load the worker |
| `getHLSRef` is called with `null` on teardown | Guard `if (!hls) return` before using the instance |
| `playerRef` is optional | You can omit it; `ref` also points at the `<video>` |
| `onPlay` / `onPause` / `onEnded` / `onError` / `onTimeUpdate` / `onProgress` / `onSeeked` / `onVolumeChange` / `onWaiting` / `onPlaying` are **typed player callbacks**, not React’s native video event handlers | Update handlers to the new signatures (see above). Other `<video>` attributes still pass through |
| `hlsConfig` type is `Partial<HlsConfig>` | Import config types from `hls.js` if you need them |

## Types

These are exported from the package:

`HlsPlayerProps`, `TimeEventData`, `ProgressEventData`, `VolumeEventData`, `QualityChangeData`, `PlayerErrorData`.

hls.js types (`Hls`, `HlsConfig`, `ErrorData`) still come from `hls.js`.
