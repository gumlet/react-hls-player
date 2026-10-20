# React Player HLS

[![npm version](https://img.shields.io/npm/v/@gumlet/react-hls-player?style=flat-square)](https://www.npmjs.com/package/@gumlet/react-hls-player)
[![npm downloads](https://img.shields.io/npm/dm/@gumlet/react-hls-player?style=flat-square)](https://www.npmjs.com/package/@gumlet/react-hls-player)

## Introduction

`@gumlet/react-hls-player` is a React component for **HLS live and VOD** playback.

It uses [hls.js](https://github.com/video-dev/hls.js) when the browser supports Media Source Extensions. On browsers that can play HLS natively (typically Safari / iOS), it prefers the native `<video>` path. Chrome and other MSE-only browsers still use hls.js.

```bash
npm i @gumlet/react-hls-player
```

Requires **React 18+**. Depends on **hls.js ^1.7**.

```bash
npm start
```

The demo (`example/`) plays a sample playlist and streams every player callback into an **Event log** under the video (`onReady`, `onPlay`, `onTimeUpdate`, `onError`, …). `onTimeUpdate` / `onProgress` are sampled so the log stays readable.

## Examples

### Using the ReactHlsPlayer component

```javascript
import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactHlsPlayer from '@gumlet/react-hls-player';

createRoot(document.getElementById('app')).render(
  <ReactHlsPlayer
    src="https://video.gumlet.io/5f462c1561cf8a766464ffc4/635789f017629894d4d125a4/main.m3u8"
    autoPlay={false}
    controls={true}
    width="100%"
    height="auto"
  />
);
```

### Callbacks

Use the `on*` props instead of attaching listeners to the video element. Handler identity can change every render; the player does not rebuild.

```javascript
import React, { useState } from 'react';
import ReactHlsPlayer from '@gumlet/react-hls-player';

function PlayerWithLog({ src }) {
  const [log, setLog] = useState([]);

  function append(name, payload) {
    setLog((rows) => [
      ...rows,
      payload == null ? name : `${name} ${JSON.stringify(payload)}`,
    ]);
  }

  return (
    <>
      <ReactHlsPlayer
        src={src}
        controls
        onReady={() => append('onReady')}
        onPlay={() => append('onPlay')}
        onPause={() => append('onPause')}
        onPlaying={() => append('onPlaying')}
        onEnded={() => append('onEnded')}
        onWaiting={() => append('onWaiting')}
        onTimeUpdate={({ currentTime, duration }) =>
          append('onTimeUpdate', { currentTime, duration })
        }
        onProgress={({ percent }) => append('onProgress', { percent })}
        onSeeked={({ currentTime, duration }) =>
          append('onSeeked', { currentTime, duration })
        }
        onVolumeChange={({ volume, muted }) =>
          append('onVolumeChange', { volume, muted })
        }
        onManifestParsed={() => append('onManifestParsed')}
        onQualityChange={({ level, height, bitrate }) =>
          append('onQualityChange', { level, height, bitrate })
        }
        onError={(error) => append('onError', error)}
      />
      <pre>{log.join('\n')}</pre>
    </>
  );
}
```

`onReady` fires when the hls.js manifest is parsed, or on `loadedmetadata` for native HLS. `onError` covers both hls.js and the video element (`source: 'hls' | 'video'`).

### Using hlsConfig (advanced)

All config keys are documented in the [hls.js Fine Tuning](https://github.com/video-dev/hls.js/blob/master/docs/API.md#fine-tuning) section.

hls.js defaults apply (including `enableWorker: true`). Pass `enableWorker: false` if your bundler cannot load the worker.

```javascript
<ReactHlsPlayer
  src="https://video.gumlet.io/5f462c1561cf8a766464ffc4/635789f017629894d4d125a4/main.m3u8"
  hlsConfig={{
    maxLoadingDelay: 4,
    minAutoBitrate: 0,
    lowLatencyMode: true,
  }}
/>
```

### `playerRef` vs `getHLSRef`

These are two different objects:

| Prop | What you get |
| --- | --- |
| `playerRef` / `ref` | The HTML **`<video>`** element (`play()`, `pause()`, `currentTime`) |
| `getHLSRef` | The **hls.js** instance (`loadSource`, quality/audio tracks, `destroy`, …). Called with `null` when that instance is torn down, and on the native-HLS path. |

`playerRef` is optional. If you omit it, the component keeps an internal ref.

```javascript
import React from 'react';
import ReactHlsPlayer from '@gumlet/react-hls-player';

function MyCustomComponent() {
  const playerRef = React.useRef(null);

  function playVideo() {
    playerRef.current.play();
  }

  function pauseVideo() {
    playerRef.current.pause();
  }

  return (
    <ReactHlsPlayer
      playerRef={playerRef}
      getHLSRef={(hls) => {
        if (hls == null) {
          return;
        }
        // hls.js instance; also assigned to window.Hls
      }}
      src="https://video.gumlet.io/5f462c1561cf8a766464ffc4/635789f017629894d4d125a4/main.m3u8"
    />
  );
}
```

### Native HLS (Safari / iOS)

`preferNativeHls` defaults to **true**. If `canPlayType('application/vnd.apple.mpegurl')` succeeds, the component uses native playback and does not create an hls.js instance.

Force hls.js even on Safari:

```javascript
<ReactHlsPlayer src={src} preferNativeHls={false} />
```

## Props

Standard [video attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) are passed through to `<video>`, except the media event handlers below, which are replaced by the typed callbacks.

| Prop | Description |
| --- | --- |
| src `String`, `required` | HLS playlist URL (live or VOD) |
| autoPlay `Boolean` | Autoplay when the manifest is ready (or immediately on native HLS). Defaults to `false` |
| controls `Boolean` | Show native playback controls. Defaults to `false` |
| width / height | Passed through to `<video>` |
| hlsConfig `Partial<HlsConfig>` | hls.js config |
| playerRef `React.Ref` | Optional ref to the `<video>` element (same node as `ref`) |
| ref | Also the `<video>` element (`forwardRef`) |
| getHLSRef `(hls: Hls \| null) => void` | hls.js instance, or `null` on destroy / native HLS |
| preferNativeHls `Boolean` | Prefer native HLS when the browser can play it. Defaults to `true` |
| maxFatalRetries `Number` | Fatal hls.js recoveries before giving up. Defaults to `3`. Exhausted retries are logged with `console.error` |
| onReady `() => void` | Manifest parsed (hls.js) or `loadedmetadata` (native HLS) |
| onPlay / onPause / onPlaying / onEnded / onWaiting | `<video>` playback state |
| onTimeUpdate `({ currentTime, duration }) => void` | Clock during playback |
| onProgress `({ percent }) => void` | `currentTime / duration` (0–1) |
| onSeeked `({ currentTime, duration }) => void` | After a seek |
| onVolumeChange `({ volume, muted }) => void` | Volume or mute change |
| onManifestParsed `() => void` | hls.js manifest is ready (not used on native HLS) |
| onQualityChange `({ level, height, bitrate }) => void` | hls.js level switch |
| onError `({ fatal, source, data?, mediaError?, message? }) => void` | `source` is `'hls'` or `'video'` |

The constructor still assigns `window.Hls = Hls` so code that looks up the global can find it.

Types (`HlsPlayerProps`, `TimeEventData`, `ProgressEventData`, `VolumeEventData`, `QualityChangeData`, `PlayerErrorData`) are exported from the package.

## Maintainer

This library is maintained by <a href="https://www.gumlet.com" target="_blank">Gumlet.com</a>

[<img src="https://assets.gumlet.com/public/img/logo.png" width="300px">](https://www.gumlet.com)
