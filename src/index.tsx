import { GumletInsights } from '@gumlet/insights-js-core';
// biome-ignore lint/style/useImportType: TypeScript uses the classic JSX transform.
import React, { forwardRef, useEffect, useRef } from 'react';
import type shaka from 'shaka-player';
import { version } from '../package.json';
import { buildEmbedPlayerConfig, lockHighestVariant } from './drm/abrSettings';
import { applyDrm } from './drm/applyDrm';
import { loadShaka, setActiveShaka } from './loadShaka';
import { parsePlaybackUrl } from './playbackUrl';
import type { HlsPlayerProps, TimeEventData } from './types';

const PLAYER_NAME = 'gumlet-react-hls-player';

export type {
  AnalyticsConfig,
  DrmConfig,
  HlsPlayerProps,
  InsightsConfig,
  PlayerConfig,
  PlayerErrorData,
  ProgressEventData,
  QualityChangeData,
  TimeEventData,
  VolumeEventData,
} from './types';

const DEFAULT_MAX_FATAL_RETRIES = 3;

const AUTOPLAY_BLOCKED_MESSAGE =
  'Unable to autoplay prior to user interaction with the DOM.';

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref != null) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function timeEvent(video: HTMLVideoElement): TimeEventData {
  return {
    currentTime: video.currentTime,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
  };
}

function isNonRetryableDrmCode(code: number): boolean {
  return (code >= 6000 && code <= 6010) || (code >= 3014 && code <= 3016);
}

function shakaErrorDetail(event: Event): shaka.util.Error | undefined {
  const detail = (event as CustomEvent<shaka.util.Error | undefined>).detail;
  return detail ?? undefined;
}

function playIfAllowed(video: HTMLVideoElement) {
  video.play().catch(() => {
    console.log(AUTOPLAY_BLOCKED_MESSAGE);
  });
}

const ReactHlsPlayer = forwardRef<HTMLVideoElement, HlsPlayerProps>(
  function ReactHlsPlayer(
    {
      playerConfig,
      playerRef,
      getPlayerRef,
      src,
      autoPlay,
      muted,
      aspectRatio,
      startHighestRes = false,
      drm,
      enableInsights = true,
      insights,
      debug = false,
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
    const autoPlayRef = useRef(autoPlay);
    autoPlayRef.current = autoPlay;

    const callbacksRef = useRef({
      getPlayerRef,
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
      getPlayerRef,
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

    const widevineLicenseUri = drm?.widevineLicenseUri;
    const widevineRobustness = drm?.widevineRobustness;
    const organizationId = drm?.organizationId;
    const collectionId = drm?.collectionId;
    const fairplayLicenseUri = drm?.fairplayLicenseUri;
    const fairplayCertificateUri = drm?.fairplayCertificateUri;

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
      if (muted != null) {
        video.muted = muted;
      }
      if (autoPlay) {
        playIfAllowed(video);
      }
    }, [autoPlay, muted]);

    useEffect(() => {
      const video = internalRef.current;
      if (!video) {
        return;
      }
      const media = video;
      const starttime = Date.now();

      let playback: ReturnType<typeof parsePlaybackUrl>;
      try {
        playback = parsePlaybackUrl(src);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Invalid playback URL';
        callbacksRef.current.onError?.({
          fatal: true,
          source: 'video',
          message,
        });
        throw error instanceof Error ? error : new Error(message);
      }

      let destroyed = false;
      let fatalRetries = 0;
      let unbindDrm = () => {};
      let insightsClient: GumletInsights | undefined;
      let player: shaka.Player | undefined;
      let onShakaError: ((event: Event) => void) | undefined;
      let onAdaptation: (() => void) | undefined;

      void (async () => {
        let shakaNs: Awaited<ReturnType<typeof loadShaka>>;
        try {
          shakaNs = await loadShaka(debug);
        } catch (error) {
          if (destroyed) {
            return;
          }
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load Shaka Player';
          console.error(message);
          callbacksRef.current.onError?.({
            fatal: true,
            source: 'shaka',
            message,
          });
          callbacksRef.current.getPlayerRef?.(null);
          return;
        }
        if (destroyed) {
          return;
        }
        setActiveShaka(shakaNs);

        if (!shakaNs.Player.isBrowserSupported()) {
          const message = 'Browser does not support Shaka Player';
          console.error(message);
          callbacksRef.current.onError?.({
            fatal: true,
            source: 'shaka',
            message,
          });
          callbacksRef.current.getPlayerRef?.(null);
          return;
        }

        shakaNs.polyfill.installAll();

        const created = new shakaNs.Player();
        player = created;
        if (destroyed) {
          void created.destroy();
          return;
        }
        window.shakaPlayer = created;
        callbacksRef.current.getPlayerRef?.(created);

        const drmConfig = {
          widevineLicenseUri,
          widevineRobustness,
          organizationId,
          collectionId,
          fairplayLicenseUri,
          fairplayCertificateUri,
        };
        const fairPlay = Boolean(fairplayLicenseUri && fairplayCertificateUri);

        function finishLoad() {
          if (destroyed) {
            return;
          }
          if (startHighestRes) {
            lockHighestVariant(created);
          }
          callbacksRef.current.onManifestParsed?.();
          callbacksRef.current.onReady?.();
          if (autoPlayRef.current) {
            playIfAllowed(media);
          }
        }

        onShakaError = (event: Event) => {
          if (destroyed) {
            return;
          }
          const detail = shakaErrorDetail(event);
          const fatal =
            detail?.severity === shakaNs.util.Error.Severity.CRITICAL;
          const code =
            typeof detail?.code === 'number' ? detail.code : undefined;
          callbacksRef.current.onError?.({
            fatal,
            source: 'shaka',
            data: detail,
            message:
              detail?.message || (code != null ? String(code) : undefined),
          });

          if (!fatal) {
            return;
          }

          if (code != null && isNonRetryableDrmCode(code)) {
            console.error('Shaka DRM error', detail);
            return;
          }

          fatalRetries += 1;
          console.error('Shaka fatal error', detail);

          if (fatalRetries > maxFatalRetries) {
            console.error(
              `Shaka fatal error: exhausted ${maxFatalRetries} retries`,
              detail
            );
            return;
          }

          created
            .load(src)
            .then(finishLoad)
            .catch(() => {});
        };

        onAdaptation = () => {
          const activeTrack = created
            .getVariantTracks()
            .find((track) => track.active);
          if (!activeTrack) {
            return;
          }
          callbacksRef.current.onQualityChange?.({
            level: activeTrack.id,
            height: activeTrack.height ?? undefined,
            bitrate: activeTrack.bandwidth,
          });
        };

        created.addEventListener('error', onShakaError);
        created.addEventListener('adaptation', onAdaptation);

        try {
          await created.attach(media);
          if (destroyed) {
            return;
          }
          if (playerConfig) {
            created.configure(playerConfig);
          }
          created.configure(
            buildEmbedPlayerConfig({
              aspectRatio,
              startHighestRes,
              fairPlay,
            })
          );
          unbindDrm = applyDrm(created, drmConfig);
          if (enableInsights && !destroyed) {
            insightsClient = new GumletInsights({
              ...insights,
              workspace_id: playback.collectionId,
              customVideoId: insights?.customVideoId ?? playback.assetId,
              customPlayerName: PLAYER_NAME,
              customPlayerVersion: version,
            });
            try {
              await insightsClient.attach(created, {
                mediaElement: media,
                starttime,
              });
            } catch (error) {
              console.error('Failed to initialize Gumlet Insights', error);
            }
            if (destroyed) {
              insightsClient.detach();
              return;
            }
          }
          await created.load(src);
          finishLoad();
        } catch {
          /* Shaka also dispatches `error`, which owns retry. */
        }
      })();

      return () => {
        destroyed = true;
        insightsClient?.detach();
        unbindDrm();
        if (player) {
          if (onShakaError) {
            player.removeEventListener('error', onShakaError);
          }
          if (onAdaptation) {
            player.removeEventListener('adaptation', onAdaptation);
          }
          void player.destroy();
          if (window.shakaPlayer === player) {
            window.shakaPlayer = undefined;
          }
        }
        callbacksRef.current.getPlayerRef?.(null);
      };
    }, [
      aspectRatio,
      collectionId,
      debug,
      enableInsights,
      fairplayCertificateUri,
      fairplayLicenseUri,
      insights,
      maxFatalRetries,
      organizationId,
      playerConfig,
      src,
      startHighestRes,
      widevineLicenseUri,
      widevineRobustness,
    ]);

    return (
      <video {...props} ref={setVideoRef} autoPlay={autoPlay} muted={muted} />
    );
  }
);

export { ReactHlsPlayer };
export default ReactHlsPlayer;
