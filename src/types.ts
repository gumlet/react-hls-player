import type { AnalyticsConfig } from '@gumlet/insights-js-core';
import type shaka from 'shaka-player';
import type React from 'react';

export type { AnalyticsConfig };

/** Insights fields this player accepts. Workspace id and player identity are set internally. */
export type InsightsConfig = Omit<
  AnalyticsConfig,
  | 'workspace_id'
  | 'customWorkspaceId'
  | 'customPlayerName'
  | 'customPlayerVersion'
  | 'customPlayerIntegrationVersion'
  | 'mediaElement'
  | 'cast'
>;

export interface TimeEventData {
  currentTime: number;
  duration: number;
}

export interface ProgressEventData {
  percent: number;
}

export interface VolumeEventData {
  volume: number;
  muted: boolean;
}

export interface QualityChangeData {
  level: number;
  height?: number;
  bitrate?: number;
}

export interface PlayerErrorData {
  fatal: boolean;
  source: 'shaka' | 'video';
  data?: shaka.util.Error;
  mediaError?: MediaError | null;
  message?: string;
}

type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/** Partial Shaka config. Embed ABR, retry, buffering, and DRM are applied after it. */
export type PlayerConfig = DeepPartial<shaka.extern.PlayerConfiguration>;

export interface DrmConfig {
  widevineLicenseUri?: string;
  widevineRobustness?: string | null;
  organizationId?: string | null;
  collectionId?: string | null;
  fairplayLicenseUri?: string;
  fairplayCertificateUri?: string;
}

type NativeVideoProps = Omit<
  React.VideoHTMLAttributes<HTMLVideoElement>,
  | 'onPlay'
  | 'onPause'
  | 'onEnded'
  | 'onError'
  | 'onTimeUpdate'
  | 'onSeeked'
  | 'onVolumeChange'
  | 'onProgress'
  | 'onWaiting'
  | 'onPlaying'
>;

export interface HlsPlayerProps extends NativeVideoProps {
  src: string;
  playerConfig?: PlayerConfig;
  playerRef?: React.Ref<HTMLVideoElement | null>;
  getPlayerRef?: (player: shaka.Player | null) => void;
  aspectRatio?: string;
  startHighestRes?: boolean;
  drm?: DrmConfig;
  enableInsights?: boolean;
  insights?: InsightsConfig;
  /** Load `shaka-player.compiled.debug.js` and set Shaka's log level to DEBUG. */
  debug?: boolean;
  maxFatalRetries?: number;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onPlaying?: () => void;
  onEnded?: () => void;
  onWaiting?: () => void;
  onTimeUpdate?: (event: TimeEventData) => void;
  onProgress?: (event: ProgressEventData) => void;
  onSeeked?: (event: TimeEventData) => void;
  onVolumeChange?: (event: VolumeEventData) => void;
  onManifestParsed?: () => void;
  onQualityChange?: (event: QualityChangeData) => void;
  onError?: (event: PlayerErrorData) => void;
}
