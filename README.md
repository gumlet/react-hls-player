# @gumlet/react-hls-player

![NPM Downloads](https://img.shields.io/npm/dm/@gumlet/react-hls-player?style=flat-square)
![npm bundle size](https://img.shields.io/bundlephobia/min/@gumlet/react-hls-player)

React component for **HLS and DASH** live and VOD. Playback uses [Shaka Player](https://github.com/shaka-project/shaka-player) 5.1 with the same ABR, retry, and buffering settings as the Gumlet embed player. Widevine and FairPlay use Gumlet's license helpers.

```bash
npm i @gumlet/react-hls-player
```

Requires **React 18+**. Depends on **shaka-player 5.1**.

Version 3 replaces hls.js. `hlsConfig`, `getHLSRef`, and `preferNativeHls` are gone. Use `playerConfig`, `getPlayerRef`, and `drm` instead.

## Demo

```bash
npm start
```

Opens the example on port 8000. It plays a sample Gumlet playlist and writes every callback into an event log under the video. `onTimeUpdate` and `onProgress` are sampled so the log stays readable.

- **Load**, or Enter in the stream URL field, applies the URL and any Widevine or FairPlay URIs and mounts the player. Use it again after **Destroy Video**.
- Checkboxes toggle `muted`, `autoPlay`, and `startHighestRes`.
- Leave the DRM fields blank for clear playback.

## Basic playback

```javascript
import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactHlsPlayer from '@gumlet/react-hls-player';

createRoot(document.getElementById('app')).render(
  <ReactHlsPlayer
    src="https://video.gumlet.io/5f462c1561cf8a766464ffc4/635789f017629894d4d125a4/main.m3u8"
    autoPlay={false}
    muted
    controls
    playsInline
    loop
    width="100%"
    height="auto"
  />
);
```

Shaka loads `src`. The path must be `/{collection_id}/{asset_id}/main.m3u8` or `main.mpd` on any host. A missing collection id or asset id is reported with `onError` and thrown before Shaka is created. The URL is not set on the `<video>` element. `autoPlay` calls `play()` after `load()` resolves. Pair it with `muted` when the browser blocks autoplay with sound. `loop`, `playsInline`, `poster`, `preload`, `crossOrigin`, `width`, and `height` are normal video attributes.

Changing `muted` or `autoPlay` updates the element without creating a new Shaka instance. Changing `src` or `drm` does.

## Callbacks

Pass `on*` props instead of listeners on the video element. A new function identity on each render does not rebuild the player.

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
        muted
        playsInline
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

`onReady` and `onManifestParsed` both fire when `player.load()` resolves. `onQualityChange` runs on Shaka `adaptation`; `bitrate` is the active variant's bandwidth. `onError` reports Shaka errors (`source: 'shaka'`) and media-element errors (`source: 'video'`).

## Video element and Shaka instance

| Prop | What you get |
| --- | --- |
| `playerRef` / `ref` | The `<video>` element (`play()`, `pause()`, `currentTime`) |
| `getPlayerRef` | The Shaka `Player`. Called with `null` when that instance is destroyed. |

`playerRef` is optional. The component keeps an internal ref when you omit it. The active player is also `window.shaka` and `window.shakaPlayer`.

```javascript
import React from 'react';
import ReactHlsPlayer from '@gumlet/react-hls-player';

function MyCustomComponent() {
  const playerRef = React.useRef(null);

  return (
    <ReactHlsPlayer
      playerRef={playerRef}
      getPlayerRef={(player) => {
        if (player == null) {
          return;
        }
      }}
      src="https://video.gumlet.io/5f462c1561cf8a766464ffc4/635789f017629894d4d125a4/main.m3u8"
      controls
    />
  );
}
```

## DRM

FairPlay is used when both `fairplayLicenseUri` and `fairplayCertificateUri` are set. Playback stays on Shaka MSE (`streaming.useNativeHlsForFairPlay: false`). License requests are JSON `{ spc }` and responses are JSON `{ ckc }`.

Otherwise `widevineLicenseUri` configures `com.widevine.alpha`. `widevineRobustness` is `L1`, `L2`, `custom`, or omitted for the default ladder. `organizationId` and `collectionId` apply the same org overrides as the embed player.

```javascript
<ReactHlsPlayer
  src={src}
  drm={{
    widevineLicenseUri: 'https://widevine.gumlet.com/licence/example',
    widevineRobustness: 'L1',
    organizationId: 'org-id',
    collectionId: 'collection-id',
    fairplayLicenseUri: 'https://fairplay.gumlet.com/licence/example',
    fairplayCertificateUri: 'https://fairplay.gumlet.com/certificate/example',
  }}
/>
```

When both FairPlay URIs are present, Widevine is not configured for that load.

## Insights

Insights is on by default (`enableInsights`). Every playback URL is parsed before Shaka starts, including when insights are off. `workspace_id` is the collection id. `customVideoId` is the asset id unless you pass `insights.customVideoId`.

```javascript
<ReactHlsPlayer
  src="https://video.gumlet.io/collection-id/asset-id/main.m3u8"
  insights={{
    property_id: 'property-id',
    customVideoTitle: 'Episode 3',
    customData1: 'experiment-a',
    userId: 'viewer-1',
  }}
/>
```

`customPlayerName` is `gumlet-react-hls-player` and `customPlayerVersion` is this package's version. Those cannot be overridden. `workspace_id` is not a prop.

`insights` accepts the fields `@gumlet/insights-js-core` still documents: `property_id`, `debug`, `test`, `page_url`, `sessionID`, `userID`, `sendSessionRequest`, `deviceData`, `playerData`, `disable_analytics_v2`, `getUUID`, `customData1` through `customData10`, video fields (`customVideoId`, `customVideoTitle`, `customVideoDurationMillis`, `customVideoSeries`, `customVideoProducer`, `customVideoLanguage`, `customVideoVariant`, `customVideoVariantName`, `customContentType`, `customEncodingVariant`), user fields (`userId`, `userName`, `userEMail` or `userEmail`, `userPhone`, `userProfileImage`, address fields, `userCity`, `userState`, `userCountry`, `userZipcode`), plus `customPageType` and `experimentName`.

```javascript
<ReactHlsPlayer src={src} enableInsights={false} />
```

## Playback settings

Every load applies the embed player's Shaka settings:

- ABR with a 3 Mbps default estimate and the network-information API off
- Manifest retries: 6 attempts, 1s base delay, 30s timeout
- Segment retries: 6 attempts, 500ms base delay, 20s timeout
- `rebufferingGoal: 4`, `bufferingGoal: 20`
- `manifest.disableText` and `StubTextDisplayer`, so Shaka does not take over native `<track>` captions

`startHighestRes` keeps ABR off while `load()` runs, then selects the tallest playable variant. A portrait `aspectRatio` such as `9:16` turns off `restrictToElementSize`.

`playerConfig` is an optional partial Shaka `PlayerConfiguration`. It is applied first. Embed settings and DRM are applied after it, so those values stay in effect.

```javascript
<ReactHlsPlayer
  src={src}
  aspectRatio="16:9"
  startHighestRes
  playerConfig={{ streaming: { bufferingGoal: 30 } }}
/>
```

Fatal Shaka errors (severity `CRITICAL`) call `load(src)` again up to `maxFatalRetries` (default 3). DRM codes `6000–6010` and `3014–3016` are reported and not retried.

## Props

Other [video attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) pass through to `<video>`, except `onPlay`, `onPause`, `onPlaying`, `onWaiting`, `onEnded`, `onError`, `onTimeUpdate`, `onProgress`, `onSeeked`, and `onVolumeChange`. Those are the typed callbacks above.

| Prop | Description |
| --- | --- |
| `src` `string`, required | `/{collection_id}/{asset_id}/main.m3u8` or `main.mpd`. Any host |
| `autoPlay` `boolean` | Call `play()` after `load()` resolves. Default `false` |
| `muted` `boolean` | Mute the element before `play()` |
| `controls` `boolean` | Native controls. Default `false` |
| `loop`, `playsInline`, `poster`, `preload`, `crossOrigin`, `width`, `height` | Passed through to `<video>` |
| `playerConfig` | Partial Shaka config, applied before embed settings |
| `playerRef` | Ref to the `<video>` element (same node as `ref`) |
| `ref` | The `<video>` element |
| `getPlayerRef` | `(player: shaka.Player \| null) => void` |
| `aspectRatio` `string` | Portrait `W:H` or `W/H` disables ABR `restrictToElementSize` |
| `startHighestRes` `boolean` | ABR off through `load()`, then lock the tallest variant |
| `drm` | `DrmConfig`: Widevine and FairPlay fields |
| `enableInsights` `boolean` | Start Gumlet Insights after the URL is parsed. Default `true` |
| `insights` | Documented Insights fields. Workspace id and player name/version are set by this package |
| `maxFatalRetries` `number` | Fatal retries before giving up. Default `3` |
| `onReady` | `load()` resolved |
| `onPlay`, `onPause`, `onPlaying`, `onEnded`, `onWaiting` | Video playback state |
| `onTimeUpdate` | `{ currentTime, duration }` |
| `onProgress` | `{ percent }` from `currentTime / duration` |
| `onSeeked` | `{ currentTime, duration }` |
| `onVolumeChange` | `{ volume, muted }` |
| `onManifestParsed` | Fires with `onReady` when `load()` resolves |
| `onQualityChange` | `{ level, height, bitrate }` after adaptation |
| `onError` | `{ fatal, source, data?, mediaError?, message? }` |

Exported types: `HlsPlayerProps`, `DrmConfig`, `InsightsConfig`, `AnalyticsConfig`, `PlayerConfig`, `TimeEventData`, `ProgressEventData`, `VolumeEventData`, `QualityChangeData`, `PlayerErrorData`.

## Maintainer

This library is maintained by <a href="https://www.gumlet.com" target="_blank">Gumlet.com</a>

[<img src="https://assets.gumlet.com/public/img/logo.png" width="300px">](https://www.gumlet.com)
