import type shaka from 'shaka-player';
import type { DrmConfig } from '../types';
import { PREFERRED_AVC_VIDEO, PREFERRED_SAFARI_VIDEO } from './abrSettings';
import {
  createFairPlayLicenseRequestFilter,
  createFairPlayLicenseResponseFilter,
} from './fairPlayHelpers';
import { buildWidevineAdvancedConfig } from './widevineAdvanced';

/**
 * FairPlay via Shaka MSE. `streaming.useNativeHlsForFairPlay` stays false so
 * the manifest is not assigned to `<video src>`.
 */
function bindFairPlay(
  player: shaka.Player,
  fairplayLicenseUri: string,
  fairplayCertificateUri: string
): () => void {
  const networkingEngine = player.getNetworkingEngine();
  const requestFilter = createFairPlayLicenseRequestFilter(fairplayLicenseUri);
  const responseFilter =
    createFairPlayLicenseResponseFilter(fairplayLicenseUri);
  networkingEngine?.registerRequestFilter(requestFilter);
  networkingEngine?.registerResponseFilter(responseFilter);

  player.configure({
    drm: {
      servers: {
        'com.apple.fps': fairplayLicenseUri,
      },
      advanced: {
        'com.apple.fps': {
          serverCertificateUri: fairplayCertificateUri,
        },
      },
    },
    streaming: {
      useNativeHlsForFairPlay: false,
    },
    preferredVideo: [...PREFERRED_SAFARI_VIDEO],
  });

  return () => {
    networkingEngine?.unregisterRequestFilter(requestFilter);
    networkingEngine?.unregisterResponseFilter(responseFilter);
  };
}

/** Returns an unregister function. No-op when no DRM URIs are set. */
export function applyDrm(
  player: shaka.Player,
  drm?: DrmConfig | null
): () => void {
  const fairplayLicenseUri = drm?.fairplayLicenseUri;
  const fairplayCertificateUri = drm?.fairplayCertificateUri;
  if (fairplayLicenseUri && fairplayCertificateUri) {
    return bindFairPlay(player, fairplayLicenseUri, fairplayCertificateUri);
  }

  const widevineLicenseUri = drm?.widevineLicenseUri;
  if (widevineLicenseUri) {
    player.configure({
      drm: {
        servers: {
          'com.widevine.alpha': widevineLicenseUri,
        },
        advanced: buildWidevineAdvancedConfig({
          widevineRobustness: drm?.widevineRobustness ?? null,
          organizationId: drm?.organizationId ?? null,
          collectionId: drm?.collectionId ?? null,
        }),
      },
      preferredVideo: [...PREFERRED_AVC_VIDEO],
    });
  }

  return () => {};
}
