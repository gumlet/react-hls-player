import { cleanup, render, waitFor } from '@testing-library/react';
import Hls from 'hls.js';
import React, { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReactHlsPlayer from './index';

type HlsHandler = (...args: unknown[]) => void;

const { instances, MockHls } = vi.hoisted(() => {
  const instances: MockHls[] = [];

  class MockHls {
    static isSupported = vi.fn(() => true);
    static Events = {
      MEDIA_ATTACHED: 'hlsMediaAttached',
      MANIFEST_PARSED: 'hlsManifestParsed',
      LEVEL_SWITCHED: 'hlsLevelSwitched',
      ERROR: 'hlsError',
    };
    static ErrorTypes = {
      NETWORK_ERROR: 'networkError',
      MEDIA_ERROR: 'mediaError',
      OTHER_ERROR: 'otherError',
    };

    attachMedia = vi.fn();
    loadSource = vi.fn();
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    destroy = vi.fn();
    levels: { height?: number; bitrate?: number }[] = [];
    handlers: Record<string, HlsHandler[]> = {};

    constructor(public config?: unknown) {
      instances.push(this);
    }

    on(event: string, handler: HlsHandler) {
      this.handlers[event] = this.handlers[event] ?? [];
      this.handlers[event].push(handler);
    }

    emit(event: string, ...args: unknown[]) {
      for (const handler of this.handlers[event] ?? []) {
        handler(event, ...args);
      }
    }
  }

  return { instances, MockHls };
});

vi.mock('hls.js', () => ({
  default: MockHls,
}));

afterEach(() => {
  cleanup();
  instances.length = 0;
  vi.clearAllMocks();
  MockHls.isSupported.mockReturnValue(true);
});

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.load = vi.fn();
  HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('');
});

describe('ReactHlsPlayer', () => {
  it('attaches hls.js, loads src, and exposes the instance', async () => {
    const getHLSRef = vi.fn();
    const playerRef = createRef<HTMLVideoElement>();

    const { unmount } = render(
      <ReactHlsPlayer
        src="https://example.com/vod.m3u8"
        playerRef={playerRef}
        getHLSRef={getHLSRef}
      />
    );

    expect(instances).toHaveLength(1);
    expect(window.Hls).toBe(Hls);
    expect(instances[0].attachMedia).toHaveBeenCalledWith(playerRef.current);
    expect(getHLSRef).toHaveBeenCalledWith(instances[0]);

    instances[0].emit(MockHls.Events.MEDIA_ATTACHED);
    expect(instances[0].loadSource).toHaveBeenCalledWith(
      'https://example.com/vod.m3u8'
    );

    unmount();
    await waitFor(() => {
      expect(instances[0].destroy).toHaveBeenCalled();
      expect(getHLSRef).toHaveBeenLastCalledWith(null);
    });
  });

  it('works without playerRef', () => {
    render(<ReactHlsPlayer src="https://example.com/live.m3u8" />);
    expect(instances).toHaveLength(1);
    expect(instances[0].attachMedia).toHaveBeenCalled();
  });

  it('autoplays after MANIFEST_PARSED', () => {
    const playerRef = createRef<HTMLVideoElement>();
    render(
      <ReactHlsPlayer
        src="https://example.com/vod.m3u8"
        playerRef={playerRef}
        autoPlay
      />
    );

    instances[0].emit(MockHls.Events.MANIFEST_PARSED);
    expect(playerRef.current?.play).toHaveBeenCalled();
  });

  it('recovers fatal network errors and stops after maxFatalRetries', () => {
    const getHLSRef = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ReactHlsPlayer
        src="https://example.com/vod.m3u8"
        getHLSRef={getHLSRef}
        maxFatalRetries={2}
      />
    );

    const fatalNetwork = {
      fatal: true,
      type: MockHls.ErrorTypes.NETWORK_ERROR,
    };

    instances[0].emit(MockHls.Events.ERROR, fatalNetwork);
    expect(instances[0].startLoad).toHaveBeenCalledTimes(1);

    instances[0].emit(MockHls.Events.ERROR, fatalNetwork);
    expect(instances[0].startLoad).toHaveBeenCalledTimes(2);

    instances[0].emit(MockHls.Events.ERROR, fatalNetwork);
    expect(instances[0].destroy).toHaveBeenCalled();
    expect(getHLSRef).toHaveBeenLastCalledWith(null);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('uses native HLS when MSE is unavailable', () => {
    MockHls.isSupported.mockReturnValue(false);
    HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('maybe');

    const playerRef = createRef<HTMLVideoElement>();
    render(
      <ReactHlsPlayer
        src="https://example.com/native.m3u8"
        playerRef={playerRef}
      />
    );

    expect(instances).toHaveLength(0);
    expect(playerRef.current?.getAttribute('src')).toBe(
      'https://example.com/native.m3u8'
    );
  });

  it('prefers native HLS by default when the browser can play it', () => {
    MockHls.isSupported.mockReturnValue(true);
    HTMLMediaElement.prototype.canPlayType = vi
      .fn()
      .mockReturnValue('probably');

    render(<ReactHlsPlayer src="https://example.com/native.m3u8" />);

    expect(instances).toHaveLength(0);
  });

  it('uses hls.js when preferNativeHls is false even if native HLS exists', () => {
    MockHls.isSupported.mockReturnValue(true);
    HTMLMediaElement.prototype.canPlayType = vi
      .fn()
      .mockReturnValue('probably');

    render(
      <ReactHlsPlayer
        src="https://example.com/vod.m3u8"
        preferNativeHls={false}
      />
    );

    expect(instances).toHaveLength(1);
  });

  it('assigns both playerRef and forwarded ref to the video element', () => {
    const playerRef = createRef<HTMLVideoElement>();
    const forwardedRef = createRef<HTMLVideoElement>();

    render(
      <ReactHlsPlayer
        ref={forwardedRef}
        playerRef={playerRef}
        src="https://example.com/vod.m3u8"
      />
    );

    expect(playerRef.current).toBeInstanceOf(HTMLVideoElement);
    expect(forwardedRef.current).toBe(playerRef.current);
  });

  it('fires playback and hls.js callbacks', () => {
    const onPlay = vi.fn();
    const onReady = vi.fn();
    const onError = vi.fn();
    const onManifestParsed = vi.fn();
    const onQualityChange = vi.fn();
    const onTimeUpdate = vi.fn();
    const onProgress = vi.fn();
    const playerRef = createRef<HTMLVideoElement>();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ReactHlsPlayer
        src="https://example.com/vod.m3u8"
        playerRef={playerRef}
        onPlay={onPlay}
        onReady={onReady}
        onError={onError}
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

    instances[0].emit(MockHls.Events.MANIFEST_PARSED);
    expect(onManifestParsed).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);

    instances[0].levels = [{ height: 720, bitrate: 1_200_000 }];
    instances[0].emit(MockHls.Events.LEVEL_SWITCHED, { level: 0 });
    expect(onQualityChange).toHaveBeenCalledWith({
      level: 0,
      height: 720,
      bitrate: 1_200_000,
    });

    instances[0].emit(MockHls.Events.ERROR, {
      fatal: true,
      type: MockHls.ErrorTypes.NETWORK_ERROR,
      details: 'fragLoadError',
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        fatal: true,
        source: 'hls',
        message: 'fragLoadError',
      })
    );

    errorSpy.mockRestore();
  });

  it('fires onReady from native loadedmetadata', () => {
    MockHls.isSupported.mockReturnValue(false);
    HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('maybe');
    const onReady = vi.fn();
    const playerRef = createRef<HTMLVideoElement>();

    render(
      <ReactHlsPlayer
        src="https://example.com/native.m3u8"
        playerRef={playerRef}
        onReady={onReady}
      />
    );

    playerRef.current?.dispatchEvent(new Event('loadedmetadata'));
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
