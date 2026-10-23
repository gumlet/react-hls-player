import shaka from 'shaka-player';

/** Same ABR knobs as the embed player's ABR_SETTINGS. */
export const ABR_SETTINGS = {
  enabled: true,
  restrictToElementSize: true,
  useNetworkInformation: false,
  defaultBandwidthEstimate: 3_000_000,
  bandwidthUpgradeTarget: 0.85,
  switchInterval: 8,
  clearBufferSwitch: true,
  safeMarginSwitch: 20,
  preferNetworkInformationBandwidth: false,
  advanced: {
    slowHalfLife: 4,
    fastHalfLife: 2,
  },
};

/**
 * Portrait `W:H` / `W/H` with W < H disables restrictToElementSize.
 * Missing or invalid aspect ratio keeps it true.
 */
export function abrSettingsForAspectRatio(aspectRatio?: string | null) {
  let restrictToElementSize = true;
  if (aspectRatio) {
    const sep = aspectRatio.includes(':')
      ? ':'
      : aspectRatio.includes('/')
        ? '/'
        : null;
    if (sep) {
      const [wStr, hStr] = aspectRatio.split(sep);
      const w = parseInt(wStr, 10);
      const h = parseInt(hStr, 10);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 && w < h) {
        restrictToElementSize = false;
      }
    }
  }
  return {
    ...ABR_SETTINGS,
    restrictToElementSize,
  };
}

/** Prefer AV1, then AVC, over HEVC. */
export const PREFERRED_AVC_VIDEO = [
  { codec: 'av01', hdrLevel: '', label: '', layout: '', role: '' },
  { codec: 'avc1', hdrLevel: '', label: '', layout: '', role: '' },
] as const;

/**
 * Safari FairPlay on Shaka: first codec that exists in the manifest wins.
 * `hvc1` and `hev1` are both HEVC.
 */
export const PREFERRED_SAFARI_VIDEO = [
  { codec: 'av01', hdrLevel: '', label: '', layout: '', role: '' },
  { codec: 'hvc1', hdrLevel: '', label: '', layout: '', role: '' },
  { codec: 'hev1', hdrLevel: '', label: '', layout: '', role: '' },
  { codec: 'avc1', hdrLevel: '', label: '', layout: '', role: '' },
] as const;

const MANIFEST_RETRY = {
  maxAttempts: 6,
  baseDelay: 1000,
  backoffFactor: 2,
  fuzzFactor: 0.5,
  timeout: 30000,
};

const STREAMING_RETRY = {
  maxAttempts: 6,
  baseDelay: 500,
  backoffFactor: 2,
  fuzzFactor: 0.5,
  timeout: 20000,
};

export function buildEmbedPlayerConfig(options: {
  aspectRatio?: string | null;
  startHighestRes?: boolean;
  fairPlay: boolean;
}) {
  const abr = abrSettingsForAspectRatio(options.aspectRatio);
  return {
    manifest: {
      disableText: true,
      retryParameters: MANIFEST_RETRY,
    },
    abr: options.startHighestRes ? { ...abr, enabled: false } : abr,
    streaming: {
      retryParameters: STREAMING_RETRY,
      rebufferingGoal: 4,
      bufferingGoal: 20,
      ...(options.fairPlay ? { useNativeHlsForFairPlay: false } : {}),
    },
    textDisplayFactory: () => new shaka.text.StubTextDisplayer(),
  };
}

/** Tallest playable variant, preferring HDR when the ladder has it. */
export function lockHighestVariant(player: shaka.Player): void {
  const tracks = player.getVideoTracks();
  if (tracks.length === 0) return;

  const hasHdr = tracks.some((track) => track.hdr && track.hdr !== 'SDR');
  const targetTracks = hasHdr
    ? tracks.filter((track) => track.hdr && track.hdr !== 'SDR')
    : tracks;
  const highest = targetTracks.reduce((best, track) => {
    const area = (track.width || 0) * (track.height || 0);
    const bestArea = (best.width || 0) * (best.height || 0);
    return area > bestArea ? track : best;
  }, targetTracks[0]);

  player.configure({ abr: { enabled: false } });
  player.selectVideoTrack(highest);
}
