import React, { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';

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
  const logBoxRef = useRef<HTMLPreElement>(null);
  const logIdRef = useRef(0);
  const lastHighFreqRef = useRef<Record<string, number>>({});
  const [hlsUrl, setHlsUrl] = useState(
    'https://video.gumlet.io/5f462c1561cf8a766464ffc4/635789f017629894d4d125a4/main.m3u8'
  );
  const [destroy, setDestroy] = useState(false);
  const [preferNativeHls, setPreferNativeHls] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const appendLog = useCallback((name: string, payload?: unknown, throttle = false) => {
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
  }, []);

  useEffect(() => {
    const box = logBoxRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }, [logs]);

  function _handleEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      setHlsUrl(inputRef.current?.value ?? '');
    }
  }

  function _handleDestroyClick() {
    setDestroy(true);
    appendLog('destroy');
  }

  function _handleToggleControls() {
    if (playerRef.current?.hasAttribute('controls')) {
      playerRef.current.removeAttribute('controls');
      appendLog('controls', { enabled: false });
    } else {
      playerRef.current?.setAttribute('controls', 'true');
      appendLog('controls', { enabled: true });
    }
  }

  return (
    <div>
      <div
        style={{
          margin: '0 0 20px',
        }}
      >
        <label
          style={{
            display: 'block',
            marginBottom: 10,
          }}
          htmlFor="url-input"
        >
          hls url :{' '}
        </label>
        <input
          ref={inputRef}
          id="url-input"
          type="text"
          defaultValue={hlsUrl}
          onKeyUp={_handleEnter}
          style={{
            width: '100%',
            height: '30px',
            lineHeight: '30px',
            fontSize: '16px',
            color: '#333',
          }}
        />
      </div>

      <label htmlFor="prefer-native" style={{ display: 'block', marginBottom: 12 }}>
        <input
          id="prefer-native"
          type="checkbox"
          checked={preferNativeHls}
          onChange={(e) => setPreferNativeHls(e.target.checked)}
        />{' '}
        prefer native HLS
      </label>

      {!destroy ? (
        <HlsPlayer
          loop={true}
          width="100%"
          height="auto"
          autoPlay
          controls
          playerRef={playerRef}
          src={hlsUrl}
          preferNativeHls={preferNativeHls}
          getHLSRef={(hls: Hls | null) => {
            appendLog('getHLSRef', hls ? 'hls.js instance' : null);
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
        style={{
          padding: '5px 10px',
        }}
        onClick={_handleDestroyClick}
      >
        Destroy Video
      </button>

      <button
        style={{
          padding: '5px 10px',
        }}
        onClick={_handleToggleControls}
      >
        Toggle Controls (via custom ref)
      </button>

      <button
        style={{
          padding: '5px 10px',
        }}
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

export default App;
