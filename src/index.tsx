import React, { forwardRef, useEffect, useRef } from 'react';
import Hls, { type ErrorData } from 'hls.js';
import { isNativeHlsSupported } from './nativeHls';
import type { HlsPlayerProps, TimeEventData } from './types';

export { isNativeHlsSupported } from './nativeHls';
export type {
  HlsPlayerProps,
  PlayerErrorData,
  ProgressEventData,
  QualityChangeData,
  TimeEventData,
  VolumeEventData,
} from './types';

const DEFAULT_MAX_FATAL_RETRIES = 3;

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref != null) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function shouldUseHlsJs(preferNativeHls: boolean): boolean {
  if (preferNativeHls && isNativeHlsSupported()) {
    return false;
  }
  return Hls.isSupported();
}

function timeEvent(video: HTMLVideoElement): TimeEventData {
  return {
    currentTime: video.currentTime,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
  };
}

const ReactHlsPlayer = forwardRef<HTMLVideoElement, HlsPlayerProps>(
  function ReactHlsPlayer(
    {
      hlsConfig,
      playerRef,
      getHLSRef,
      src,
      autoPlay,
      preferNativeHls = true,
      maxFatalRetries = DEFAULT_MAX_FATAL_RETRIES,
      onReady,
      onPlay,
      onPause,
      onPlaying,
      onEnded,
      onWaiting,
      onTimeUpdate,
      onProgress,
      onSeeked,
      onVolumeChange,
      onManifestParsed,
      onQualityChange,
      onError,
      ...props
    },
    forwardedRef
  ) {
    const internalRef = useRef<HTMLVideoElement | null>(null);
    const useHlsJs = shouldUseHlsJs(preferNativeHls);
    const callbacksRef = useRef({
      getHLSRef,
      onReady,
      onPlay,
      onPause,
      onPlaying,
      onEnded,
      onWaiting,
      onTimeUpdate,
      onProgress,
      onSeeked,
      onVolumeChange,
      onManifestParsed,
      onQualityChange,
      onError,
    });
    callbacksRef.current = {
      getHLSRef,
      onReady,
      onPlay,
      onPause,
      onPlaying,
      onEnded,
      onWaiting,
      onTimeUpdate,
      onProgress,
      onSeeked,
      onVolumeChange,
      onManifestParsed,
      onQualityChange,
      onError,
    };

    const setVideoRef = (node: HTMLVideoElement | null) => {
      internalRef.current = node;
      setRef(playerRef, node);
      setRef(forwardedRef, node);
    };

    useEffect(() => {
      const video = internalRef.current;
      if (!video) {
        return;
      }

      const handlePlay = () => callbacksRef.current.onPlay?.();
      const handlePause = () => callbacksRef.current.onPause?.();
      const handlePlaying = () => callbacksRef.current.onPlaying?.();
      const handleEnded = () => callbacksRef.current.onEnded?.();
      const handleWaiting = () => callbacksRef.current.onWaiting?.();
      const handleTimeUpdate = () => {
        const event = timeEvent(video);
        callbacksRef.current.onTimeUpdate?.(event);
        if (event.duration > 0) {
          callbacksRef.current.onProgress?.({
            percent: event.currentTime / event.duration,
          });
        }
      };
      const handleSeeked = () =>
        callbacksRef.current.onSeeked?.(timeEvent(video));
      const handleVolumeChange = () =>
        callbacksRef.current.onVolumeChange?.({
          volume: video.volume,
          muted: video.muted,
        });
      const handleVideoError = () =>
        callbacksRef.current.onError?.({
          fatal: true,
          source: 'video',
          mediaError: video.error,
          message: video.error?.message,
        });

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('volumechange', handleVolumeChange);
      video.addEventListener('error', handleVideoError);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('volumechange', handleVolumeChange);
        video.removeEventListener('error', handleVideoError);
      };
    }, []);

    useEffect(() => {
      const video = internalRef.current;
      if (!video) {
        return;
      }

      if (!shouldUseHlsJs(preferNativeHls)) {
        if (!isNativeHlsSupported(video)) {
          const message =
            'HLS playback is not supported in this browser (no MSE and no native HLS).';
          console.error(message);
          callbacksRef.current.onError?.({
            fatal: true,
            source: 'video',
            message,
          });
          callbacksRef.current.getHLSRef?.(null);
          return;
        }

        const handleReady = () => callbacksRef.current.onReady?.();
        video.addEventListener('loadedmetadata', handleReady);
        video.src = src;
        if (autoPlay) {
          video.play().catch(() => {
            console.log(
              'Unable to autoplay prior to user interaction with the DOM.'
            );
          });
        }

        return () => {
          video.removeEventListener('loadedmetadata', handleReady);
          video.removeAttribute('src');
          video.load();
          callbacksRef.current.getHLSRef?.(null);
        };
      }

      let hls: Hls | undefined;
      let fatalRetries = 0;
      let destroyed = false;
      let readyEmitted = false;

      function initPlayer() {
        if (destroyed || internalRef.current == null) {
          return;
        }

        if (hls != null) {
          hls.destroy();
        }

        window.Hls = Hls;

        const newHls = new Hls({
          ...hlsConfig,
        });

        callbacksRef.current.getHLSRef?.(newHls);

        newHls.attachMedia(internalRef.current);

        newHls.on(Hls.Events.MEDIA_ATTACHED, () => {
          newHls.loadSource(src);
        });

        newHls.on(Hls.Events.MANIFEST_PARSED, () => {
          callbacksRef.current.onManifestParsed?.();
          if (!readyEmitted) {
            readyEmitted = true;
            callbacksRef.current.onReady?.();
          }
          if (autoPlay) {
            internalRef.current
              ?.play()
              .catch(() =>
                console.log(
                  'Unable to autoplay prior to user interaction with the DOM.'
                )
              );
          }
        });

        newHls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const level = newHls.levels[data.level];
          callbacksRef.current.onQualityChange?.({
            level: data.level,
            height: level?.height,
            bitrate: level?.bitrate,
          });
        });

        newHls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
          callbacksRef.current.onError?.({
            fatal: data.fatal,
            source: 'hls',
            data,
            message: data.details,
          });

          if (!data.fatal) {
            return;
          }

          fatalRetries += 1;
          console.error('HLS fatal error', data);

          if (fatalRetries > maxFatalRetries) {
            console.error(
              `HLS fatal error: exhausted ${maxFatalRetries} retries`,
              data
            );
            newHls.destroy();
            callbacksRef.current.getHLSRef?.(null);
            return;
          }

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              newHls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              newHls.recoverMediaError();
              break;
            default:
              initPlayer();
              break;
          }
        });

        hls = newHls;
      }

      initPlayer();

      return () => {
        destroyed = true;
        if (hls != null) {
          hls.destroy();
        }
        callbacksRef.current.getHLSRef?.(null);
      };
    }, [autoPlay, hlsConfig, src, preferNativeHls, maxFatalRetries]);

    return (
      <video
        {...props}
        ref={setVideoRef}
        autoPlay={autoPlay}
        src={useHlsJs ? undefined : src}
      />
    );
  }
);

export { ReactHlsPlayer };
export default ReactHlsPlayer;
