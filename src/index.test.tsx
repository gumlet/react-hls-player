import { cleanup, render, waitFor } from '@testing-library/react';
// biome-ignore lint/correctness/noUnusedImports: React is required by the classic JSX transform.
import React, { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { version } from '../package.json';
import { ReactHlsPlayer } from './index';
import { resetShakaLoaderForTests } from './loadShaka';

type Handler = (event: Event) => void;

const { instances, videoTracks, MockShaka, insightsInstances, MockInsights } =
  vi.hoisted(() => {
    const instances: MockPlayer[] = [];
    const insightsInstances: MockInsightsClient[] = [];

    class MockInsightsClient {
      attach = vi.fn().mockResolvedValue(undefined);
      detach = vi.fn();

      constructor(public config: unknown) {
        insightsInstances.push(this);
      }
    }

    const videoTracks: MockVideoTrack[] = [];

    class MockPlayer {
      static isBrowserSupported = vi.fn(() => true);

      attach = vi.fn().mockResolvedValue(undefined);
      load = vi.fn().mockResolvedValue(undefined);
      configure = vi.fn();
      destroy = vi.fn().mockResolvedValue(undefined);
      selectVideoTrack = vi.fn();
      getVariantTracks = vi.fn(() => [] as MockTrack[]);
      getVideoTracks = vi.fn(() => videoTracks);
      handlers: Record<string, Handler[]> = {};
      networking = {
        registerRequestFilter: vi.fn(),
        registerResponseFilter: vi.fn(),
        unregisterRequestFilter: vi.fn(),
        unregisterResponseFilter: vi.fn(),
      };

      constructor() {
        instances.push(this);
      }

      addEventListener(type: string, handler: Handler) {
        this.handlers[type] = this.handlers[type] ?? [];
        this.handlers[type].push(handler);
      }

      removeEventListener(type: string, handler: Handler) {
        this.handlers[type] = (this.handlers[type] ?? []).filter(
          (item) => item !== handler
        );
      }

      getNetworkingEngine() {
        return this.networking;
      }

      emit(type: string, event: Event) {
        for (const handler of this.handlers[type] ?? []) {
          handler(event);
        }
      }
    }

    class StubTextDisplayer {}

    const MockShaka = {
      polyfill: { installAll: vi.fn() },
      Player: MockPlayer,
      log: {
        setLevel: vi.fn(),
        Level: { DEBUG: 4 },
      },
      util: {
        Error: {
          Severity: { CRITICAL: 2, RECOVERABLE: 1 },
        },
        StringUtils: { fromBytesAutoDetect: vi.fn() },
      },
      net: {
        NetworkingEngine: { RequestType: { LICENSE: 'license' } },
      },
      text: { StubTextDisplayer },
    };

    return {
      instances,
      videoTracks,
      MockShaka,
      insightsInstances,
      MockInsights: MockInsightsClient,
    };
  });

type MockTrack = {
  id: number;
  active: boolean;
  height: number | null;
  bandwidth: number;
};

type MockVideoTrack = {
  width: number | null;
  height: number | null;
  hdr: string | null;
  active?: boolean;
};

type MockPlayer = {
  attach: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  configure: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  selectVideoTrack: ReturnType<typeof vi.fn>;
  getVariantTracks: ReturnType<typeof vi.fn>;
  getVideoTracks: ReturnType<typeof vi.fn>;
  networking: {
    registerRequestFilter: ReturnType<typeof vi.fn>;
    registerResponseFilter: ReturnType<typeof vi.fn>;
    unregisterRequestFilter: ReturnType<typeof vi.fn>;
    unregisterResponseFilter: ReturnType<typeof vi.fn>;
  };
  emit: (type: string, event: Event) => void;
};

vi.mock('shaka-player/dist/shaka-player.compiled.js', () => ({
  default: MockShaka,
}));

vi.mock('shaka-player/dist/shaka-player.compiled.debug.js', () => ({
  default: MockShaka,
}));

vi.mock('shaka-player/dist/shaka-player.hls.js', () => ({
  default: MockShaka,
}));

vi.mock('shaka-player/dist/shaka-player.hls.debug.js', () => ({
  default: MockShaka,
}));

vi.mock('shaka-player/dist/shaka-player.dash.js', () => ({
  default: MockShaka,
}));

vi.mock('shaka-player/dist/shaka-player.dash.debug.js', () => ({
  default: MockShaka,
}));

vi.mock('@gumlet/insights-js-core', () => ({
  GumletInsights: MockInsights,
}));

function fatalError(code: number, message = 'failed') {
  return new CustomEvent('error', {
    detail: { severity: 2, code, message },
  });
}

function embedConfig(player: MockPlayer) {
  const call = player.configure.mock.calls.find(
    (args) => args[0]?.manifest?.disableText === true
  );
  return call?.[0];
}

afterEach(() => {
  cleanup();
  instances.length = 0;
  videoTracks.length = 0;
  insightsInstances.length = 0;
  resetShakaLoaderForTests();
  vi.clearAllMocks();
  MockShaka.Player.isBrowserSupported.mockReturnValue(true);
});

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.load = vi.fn();
});

describe('ReactHlsPlayer', () => {
  it('attaches Shaka, loads src, and exposes the instance', async () => {
    const getPlayerRef = vi.fn();
    const playerRef = createRef<HTMLVideoElement>();

    const { unmount } = render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        playerRef={playerRef}
        getPlayerRef={getPlayerRef}
      />
    );

    await waitFor(() => {
      expect(instances).toHaveLength(1);
    });
    expect(window.shaka).toBe(MockShaka);
    expect(window.shakaPlayer).toBe(instances[0]);
    expect(playerRef.current?.getAttribute('src')).toBeNull();
    expect(getPlayerRef).toHaveBeenCalledWith(instances[0]);
    expect(MockShaka.log.setLevel).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(instances[0].attach).toHaveBeenCalledWith(playerRef.current);
      expect(instances[0].load).toHaveBeenCalledWith(
        'https://cdn.example/collection/asset/main.m3u8'
      );
    });

    unmount();
    await waitFor(() => {
      expect(instances[0].destroy).toHaveBeenCalled();
      expect(insightsInstances[0].detach).toHaveBeenCalled();
      expect(getPlayerRef).toHaveBeenLastCalledWith(null);
      expect(window.shakaPlayer).toBeUndefined();
    });
  });

  it('applies embed ABR, retry, buffering, and text settings', async () => {
    render(
      <ReactHlsPlayer src="https://cdn.example/collection/asset/main.m3u8" />
    );

    await waitFor(() => {
      expect(embedConfig(instances[0])).toBeTruthy();
    });

    const config = embedConfig(instances[0]);
    expect(config.manifest).toMatchObject({
      disableText: true,
      retryParameters: {
        maxAttempts: 6,
        baseDelay: 1000,
        backoffFactor: 2,
        fuzzFactor: 0.5,
        timeout: 30000,
      },
    });
    expect(config.streaming).toMatchObject({
      rebufferingGoal: 4,
      bufferingGoal: 20,
      retryParameters: {
        maxAttempts: 6,
        baseDelay: 500,
        backoffFactor: 2,
        fuzzFactor: 0.5,
        timeout: 20000,
      },
    });
    expect(config.abr).toMatchObject({
      enabled: true,
      restrictToElementSize: true,
      useNetworkInformation: false,
      defaultBandwidthEstimate: 3_000_000,
      bandwidthUpgradeTarget: 0.85,
      switchInterval: 8,
      clearBufferSwitch: true,
      safeMarginSwitch: 20,
    });
    expect(config.textDisplayFactory()).toBeInstanceOf(
      MockShaka.text.StubTextDisplayer
    );
  });

  it('turns off restrictToElementSize for portrait aspect ratio', async () => {
    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        aspectRatio="9:16"
      />
    );

    await waitFor(() => {
      expect(embedConfig(instances[0])?.abr.restrictToElementSize).toBe(false);
    });
  });

  it('locks the tallest variant when startHighestRes is set', async () => {
    videoTracks.push(
      { width: 640, height: 360, hdr: 'SDR' },
      { width: 1920, height: 1080, hdr: 'SDR' }
    );

    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        startHighestRes
      />
    );

    await waitFor(() => {
      expect(instances[0].selectVideoTrack).toHaveBeenCalledWith(
        expect.objectContaining({ height: 1080, width: 1920 })
      );
    });
    expect(embedConfig(instances[0]).abr.enabled).toBe(false);
  });

  it('applies playerConfig before embed settings', async () => {
    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        playerConfig={{ streaming: { bufferingGoal: 1 } }}
      />
    );

    await waitFor(() => {
      expect(instances[0].configure).toHaveBeenCalledTimes(2);
    });

    expect(instances[0].configure.mock.calls[0][0]).toMatchObject({
      streaming: { bufferingGoal: 1 },
    });
    expect(
      instances[0].configure.mock.calls[1][0].streaming.bufferingGoal
    ).toBe(20);
  });

  it('configures Widevine robustness and license server', async () => {
    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        drm={{
          widevineLicenseUri: 'https://license.example/wv',
          widevineRobustness: 'L1',
        }}
      />
    );

    await waitFor(() => {
      expect(instances[0].configure).toHaveBeenCalledWith(
        expect.objectContaining({
          drm: {
            servers: { 'com.widevine.alpha': 'https://license.example/wv' },
            advanced: {
              'com.widevine.alpha': {
                videoRobustness: ['HW_SECURE_ALL'],
                audioRobustness: ['SW_SECURE_CRYPTO'],
              },
            },
          },
        })
      );
    });
  });

  it('configures FairPlay filters, certificate, and MSE playback', async () => {
    const { unmount } = render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        drm={{
          fairplayLicenseUri: 'https://license.example/fp',
          fairplayCertificateUri: 'https://cert.example/fp',
          widevineLicenseUri: 'https://license.example/wv',
        }}
      />
    );

    await waitFor(() => {
      expect(instances[0].networking.registerRequestFilter).toHaveBeenCalled();
      expect(instances[0].networking.registerResponseFilter).toHaveBeenCalled();
    });

    expect(instances[0].configure).toHaveBeenCalledWith(
      expect.objectContaining({
        drm: expect.objectContaining({
          servers: { 'com.apple.fps': 'https://license.example/fp' },
          advanced: {
            'com.apple.fps': {
              serverCertificateUri: 'https://cert.example/fp',
            },
          },
        }),
        streaming: { useNativeHlsForFairPlay: false },
        preferredVideo: expect.arrayContaining([
          expect.objectContaining({ codec: 'hvc1' }),
        ]),
      })
    );
    expect(instances[0].configure).not.toHaveBeenCalledWith(
      expect.objectContaining({
        drm: expect.objectContaining({
          servers: { 'com.widevine.alpha': 'https://license.example/wv' },
        }),
      })
    );

    unmount();
    expect(instances[0].networking.unregisterRequestFilter).toHaveBeenCalled();
    expect(instances[0].networking.unregisterResponseFilter).toHaveBeenCalled();
  });

  it('passes muted, autoPlay, controls, loop, and playsInline to the video', async () => {
    const playerRef = createRef<HTMLVideoElement>();
    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        playerRef={playerRef}
        muted
        autoPlay
        controls
        loop
        playsInline
      />
    );

    const video = playerRef.current;
    expect(video?.muted).toBe(true);
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.hasAttribute('loop')).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);

    await waitFor(() => {
      expect(video?.play).toHaveBeenCalled();
    });
  });

  it('reports an error when Shaka is not supported', async () => {
    MockShaka.Player.isBrowserSupported.mockReturnValue(false);
    const onError = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          fatal: true,
          source: 'shaka',
          message: 'Browser does not support Shaka Player',
        })
      );
    });
    expect(instances).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it('loads the debug build and sets the DEBUG log level', async () => {
    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        debug
      />
    );

    await waitFor(() => {
      expect(instances[0].load).toHaveBeenCalled();
    });
    expect(MockShaka.log.setLevel).toHaveBeenCalledWith(
      MockShaka.log.Level.DEBUG
    );
    expect(window.shaka).toBe(MockShaka);
  });

  it('retries fatal errors and stops after maxFatalRetries', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        maxFatalRetries={2}
      />
    );

    await waitFor(() => {
      expect(instances[0].load).toHaveBeenCalledTimes(1);
    });

    instances[0].emit('error', fatalError(1001));
    await waitFor(() => {
      expect(instances[0].load).toHaveBeenCalledTimes(2);
    });

    instances[0].emit('error', fatalError(1001));
    await waitFor(() => {
      expect(instances[0].load).toHaveBeenCalledTimes(3);
    });

    instances[0].emit('error', fatalError(1001));
    expect(instances[0].load).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('does not retry DRM error codes', async () => {
    const onError = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(instances[0].load).toHaveBeenCalledTimes(1);
    });

    instances[0].emit('error', fatalError(6007, 'license'));
    expect(instances[0].load).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        fatal: true,
        source: 'shaka',
        message: 'license',
      })
    );
    errorSpy.mockRestore();
  });

  it('fires playback and adaptation callbacks', async () => {
    const onPlay = vi.fn();
    const onReady = vi.fn();
    const onManifestParsed = vi.fn();
    const onQualityChange = vi.fn();
    const onTimeUpdate = vi.fn();
    const onProgress = vi.fn();
    const playerRef = createRef<HTMLVideoElement>();

    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        playerRef={playerRef}
        onPlay={onPlay}
        onReady={onReady}
        onManifestParsed={onManifestParsed}
        onQualityChange={onQualityChange}
        onTimeUpdate={onTimeUpdate}
        onProgress={onProgress}
      />
    );

    playerRef.current?.dispatchEvent(new Event('play'));
    expect(onPlay).toHaveBeenCalledTimes(1);

    Object.defineProperty(playerRef.current, 'duration', {
      configurable: true,
      value: 10,
    });
    Object.defineProperty(playerRef.current, 'currentTime', {
      configurable: true,
      value: 2.5,
    });
    playerRef.current?.dispatchEvent(new Event('timeupdate'));
    expect(onTimeUpdate).toHaveBeenCalledWith({
      currentTime: 2.5,
      duration: 10,
    });
    expect(onProgress).toHaveBeenCalledWith({ percent: 0.25 });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(onManifestParsed).toHaveBeenCalledTimes(1);
    });

    instances[0].getVariantTracks.mockReturnValue([
      { id: 3, active: true, height: 720, bandwidth: 1_200_000 },
    ]);
    instances[0].emit('adaptation', new Event('adaptation'));
    expect(onQualityChange).toHaveBeenCalledWith({
      level: 3,
      height: 720,
      bitrate: 1_200_000,
    });
  });

  it('assigns both playerRef and forwarded ref to the video element', () => {
    const playerRef = createRef<HTMLVideoElement>();
    const forwardedRef = createRef<HTMLVideoElement>();

    render(
      <ReactHlsPlayer
        ref={forwardedRef}
        playerRef={playerRef}
        src="https://cdn.example/collection/asset/main.m3u8"
      />
    );

    expect(playerRef.current).toBeInstanceOf(HTMLVideoElement);
    expect(forwardedRef.current).toBe(playerRef.current);
  });

  it('passes collection and asset ids to Insights', async () => {
    render(
      <ReactHlsPlayer
        src="https://play.example/collection/asset/main.mpd?token=1"
        insights={{ customData4: 'caller', customVideoTitle: 'Episode' }}
      />
    );

    await waitFor(() => {
      expect(insightsInstances).toHaveLength(1);
      expect(instances[0].load).toHaveBeenCalledWith(
        'https://play.example/collection/asset/main.mpd?token=1'
      );
    });

    expect(insightsInstances[0].config).toMatchObject({
      workspace_id: 'collection',
      customVideoId: 'asset',
      customPlayerName: 'gumlet-react-hls-player',
      customPlayerVersion: version,
      customData4: 'caller',
      customVideoTitle: 'Episode',
    });
    expect(insightsInstances[0].attach).toHaveBeenCalledWith(
      instances[0],
      expect.objectContaining({
        mediaElement: expect.any(HTMLVideoElement),
        starttime: expect.any(Number),
      })
    );
  });

  it('keeps a caller customVideoId', async () => {
    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        insights={{ customVideoId: 'override' }}
      />
    );

    await waitFor(() => {
      expect(insightsInstances[0].config).toMatchObject({
        workspace_id: 'collection',
        customVideoId: 'override',
      });
    });
  });

  it('still loads when insights are disabled', async () => {
    render(
      <ReactHlsPlayer
        src="https://cdn.example/collection/asset/main.m3u8"
        enableInsights={false}
      />
    );

    await waitFor(() => {
      expect(instances[0].load).toHaveBeenCalled();
    });
    expect(insightsInstances).toHaveLength(0);
  });

  it('throws when the playback URL has no asset id', () => {
    const onError = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <ReactHlsPlayer
          src="https://cdn.example/collection/main.m3u8"
          enableInsights={false}
          onError={onError}
        />
      )
    ).toThrow(/asset id/);

    expect(instances).toHaveLength(0);
    expect(insightsInstances).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        fatal: true,
        message: expect.stringMatching(/asset id/),
      })
    );
    errorSpy.mockRestore();
  });
});
