import type Hls from 'hls.js';
import type { ErrorData, HlsConfig } from 'hls.js';
import type React from 'react';

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
  source: 'hls' | 'video';
  data?: ErrorData;
  mediaError?: MediaError | null;
  message?: string;
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
  hlsConfig?: Partial<HlsConfig>;
  playerRef?: React.Ref<HTMLVideoElement | null>;
  getHLSRef?: (hlsObj: Hls | null) => void;
  preferNativeHls?: boolean;
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
