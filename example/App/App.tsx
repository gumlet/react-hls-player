// biome-ignore lint/style/useImportType: TypeScript uses the classic JSX transform.
import React, { useCallback, useEffect, useRef, useState } from 'react';

import HlsPlayer from '../../src';
import type {
  PlayerErrorData,
  ProgressEventData,
  QualityChangeData,
  TimeEventData,
  VolumeEventData,
} from '../../src';

type LogEntry = {
  id: number;
  time: string;
  name: string;
  detail?: string;
};

const MAX_LOG_ENTRIES = 300;
const HIGH_FREQ_MS = 250;

function formatTime() {
  return new Date().toISOString().slice(11, 23);
}

function stringify(value: unknown) {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function App() {
  const playerRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widevineRef = useRef<HTMLInputElement>(null);
  const fairplayLicenseRef = useRef<HTMLInputElement>(null);
  const fairplayCertRef = useRef<HTMLInputElement>(null);
  const logBoxRef = useRef<HTMLPreElement>(null);
  const logIdRef = useRef(0);
  const lastHighFreqRef = useRef<Record<string, number>>({});
  const [hlsUrl, setHlsUrl] = useState(
    'https://video.gumlet.io/5f462c1561cf8a766464ffc4/635789f017629894d4d125a4/main.mpd'
  );
  const [destroy, setDestroy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [startHighestRes, setStartHighestRes] = useState(false);
  const [debug, setDebug] = useState(false);
  const [widevineLicenseUri, setWidevineLicenseUri] = useState('');
  const [fairplayLicenseUri, setFairplayLicenseUri] = useState('');
  const [fairplayCertificateUri, setFairplayCertificateUri] = useState('');
  const [loadId, setLoadId] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const appendLog = useCallback(
    (name: string, payload?: unknown, throttle = false) => {
      if (throttle) {
        const now = Date.now();
        if (now - (lastHighFreqRef.current[name] ?? 0) < HIGH_FREQ_MS) {
          return;
        }
        lastHighFreqRef.current[name] = now;
      }

      const entry: LogEntry = {
        id: ++logIdRef.current,
        time: formatTime(),
        name,
        detail: stringify(payload),
      };

      setLogs((prev) => {
        const next = [...prev, entry];
        if (next.length > MAX_LOG_ENTRIES) {
          return next.slice(next.length - MAX_LOG_ENTRIES);
        }
        return next;
      });
    },
    []
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Logs intentionally retrigger auto-scroll.
  useEffect(() => {
    const box = logBoxRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }, [logs]);

  function loadVideo() {
    setHlsUrl(inputRef.current?.value.trim() ?? '');
    setWidevineLicenseUri(widevineRef.current?.value.trim() ?? '');
    setFairplayLicenseUri(fairplayLicenseRef.current?.value.trim() ?? '');
    setFairplayCertificateUri(fairplayCertRef.current?.value.trim() ?? '');
    setDestroy(false);
    setLoadId((id) => id + 1);
    appendLog('load');
  }

  function commitUrl(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      loadVideo();
    }
  }

  function commitOnEnter(
    event: React.KeyboardEvent<HTMLInputElement>,
    apply: (value: string) => void
  ) {
    if (event.key === 'Enter') {
      apply(event.currentTarget.value.trim());
    }
  }

  const drm =
    widevineLicenseUri || fairplayLicenseUri || fairplayCertificateUri
      ? {
          ...(widevineLicenseUri ? { widevineLicenseUri } : {}),
          ...(fairplayLicenseUri ? { fairplayLicenseUri } : {}),
          ...(fairplayCertificateUri ? { fairplayCertificateUri } : {}),
        }
      : undefined;

  return (
    <div>
      <div style={{ margin: '0 0 20px' }}>
        <label
          style={{ display: 'block', marginBottom: 10 }}
          htmlFor="url-input"
        >
          stream url :{' '}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            id="url-input"
            type="text"
            defaultValue={hlsUrl}
            onKeyUp={commitUrl}
            style={{ ...inputStyle, marginBottom: 0 }}
          />
          <button
            type="button"
            style={{ padding: '5px 12px' }}
            onClick={loadVideo}
          >
            Load
          </button>
        </div>
      </div>

      <label htmlFor="widevine-input" style={labelStyle}>
        widevine license URI
      </label>
      <input
        ref={widevineRef}
        id="widevine-input"
        type="text"
        placeholder="blank for clear playback"
        defaultValue={widevineLicenseUri}
        onKeyUp={(event) => commitOnEnter(event, setWidevineLicenseUri)}
        style={inputStyle}
      />

      <label htmlFor="fairplay-license-input" style={labelStyle}>
        fairplay license URI
      </label>
      <input
        ref={fairplayLicenseRef}
        id="fairplay-license-input"
        type="text"
        defaultValue={fairplayLicenseUri}
        onKeyUp={(event) => commitOnEnter(event, setFairplayLicenseUri)}
        style={inputStyle}
      />

      <label htmlFor="fairplay-cert-input" style={labelStyle}>
        fairplay certificate URI
      </label>
      <input
        ref={fairplayCertRef}
        id="fairplay-cert-input"
        type="text"
        defaultValue={fairplayCertificateUri}
        onKeyUp={(event) => commitOnEnter(event, setFairplayCertificateUri)}
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <label htmlFor="muted" style={checkStyle}>
        <input
          id="muted"
          type="checkbox"
          checked={muted}
          onChange={(event) => setMuted(event.target.checked)}
        />{' '}
        muted
      </label>
      <label htmlFor="autoplay" style={checkStyle}>
        <input
          id="autoplay"
          type="checkbox"
          checked={autoPlay}
          onChange={(event) => setAutoPlay(event.target.checked)}
        />{' '}
        autoplay
      </label>
      <label htmlFor="start-highest" style={checkStyle}>
        <input
          id="start-highest"
          type="checkbox"
          checked={startHighestRes}
          onChange={(event) => setStartHighestRes(event.target.checked)}
        />{' '}
        start highest resolution
      </label>
      <label htmlFor="shaka-debug" style={checkStyle}>
        <input
          id="shaka-debug"
          type="checkbox"
          checked={debug}
          onChange={(event) => setDebug(event.target.checked)}
        />{' '}
        debug
      </label>

      {!destroy ? (
        <HlsPlayer
          key={loadId}
          loop
          width="100%"
          height="auto"
          autoPlay={autoPlay}
          muted={muted}
          controls
          playsInline
          playerRef={playerRef}
          src={hlsUrl}
          startHighestRes={startHighestRes}
          debug={debug}
          drm={drm}
          getPlayerRef={(player) => {
            appendLog('getPlayerRef', player ? 'shaka.Player' : null);
          }}
          onReady={() => appendLog('onReady')}
          onPlay={() => appendLog('onPlay')}
          onPause={() => appendLog('onPause')}
          onPlaying={() => appendLog('onPlaying')}
          onEnded={() => appendLog('onEnded')}
          onWaiting={() => appendLog('onWaiting')}
          onTimeUpdate={(event: TimeEventData) =>
            appendLog('onTimeUpdate', event, true)
          }
          onProgress={(event: ProgressEventData) =>
            appendLog('onProgress', event, true)
          }
          onSeeked={(event: TimeEventData) => appendLog('onSeeked', event)}
          onVolumeChange={(event: VolumeEventData) =>
            appendLog('onVolumeChange', event)
          }
          onManifestParsed={() => appendLog('onManifestParsed')}
          onQualityChange={(event: QualityChangeData) =>
            appendLog('onQualityChange', event)
          }
          onError={(event: PlayerErrorData) =>
            appendLog('onError', {
              fatal: event.fatal,
              source: event.source,
              message: event.message,
            })
          }
        />
      ) : null}

      <br />

      <button
        type="button"
        style={{ padding: '5px 10px' }}
        onClick={() => {
          setDestroy(true);
          appendLog('destroy');
        }}
      >
        Destroy Video
      </button>

      <button
        type="button"
        style={{ padding: '5px 10px' }}
        onClick={() => {
          if (playerRef.current?.hasAttribute('controls')) {
            playerRef.current.removeAttribute('controls');
            appendLog('controls', { enabled: false });
          } else {
            playerRef.current?.setAttribute('controls', 'true');
            appendLog('controls', { enabled: true });
          }
        }}
      >
        Toggle Controls (via custom ref)
      </button>

      <button
        type="button"
        style={{ padding: '5px 10px' }}
        onClick={() => setLogs([])}
      >
        Clear log
      </button>

      <h3 style={{ margin: '16px 0 8px' }}>Event log</h3>
      <pre
        ref={logBoxRef}
        style={{
          margin: 0,
          padding: 12,
          height: 280,
          overflow: 'auto',
          background: '#111',
          color: '#d6f5d6',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          lineHeight: 1.45,
          borderRadius: 4,
        }}
      >
        {logs.length === 0
          ? 'Waiting for events…'
          : logs
              .map((entry) =>
                entry.detail
                  ? `${entry.time}  ${entry.name}  ${entry.detail}`
                  : `${entry.time}  ${entry.name}`
              )
              .join('\n')}
      </pre>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '30px',
  lineHeight: '30px',
  fontSize: '16px',
  color: '#333',
  marginBottom: 10,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
};

const checkStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 8,
};

export default App;
