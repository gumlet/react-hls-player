export class PlaybackUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaybackUrlError';
  }
}

const MANIFEST_FILE = /^main\.(m3u8|mpd)$/;

/** `/{collection_id}/{asset_id}/main.m3u8` or `main.mpd`. Query strings are ignored. */
export function parsePlaybackUrl(src: string): {
  collectionId: string;
  assetId: string;
} {
  let pathname: string;
  try {
    pathname = new URL(src).pathname;
  } catch {
    throw new PlaybackUrlError(
      'Playback URL must be /{collection_id}/{asset_id}/main.m3u8 or main.mpd'
    );
  }

  const parts = pathname.split('/');
  const segments = parts[0] === '' ? parts.slice(1) : parts;
  const collectionId = segments[0] ?? '';
  const assetId = segments[1] ?? '';
  const file = segments[2];
  const validFile = file != null && MANIFEST_FILE.test(file);
  const fileInAssetSlot = segments.length === 2 && MANIFEST_FILE.test(assetId);

  if (
    !collectionId ||
    !assetId ||
    fileInAssetSlot ||
    !validFile ||
    segments.length !== 3
  ) {
    const missing: string[] = [];
    if (!collectionId) {
      missing.push('collection id');
    }
    if (!assetId || fileInAssetSlot) {
      missing.push('asset id');
    }
    const detail =
      missing.length > 0
        ? `Missing ${missing.join(' and ')}.`
        : 'Path must be /{collection_id}/{asset_id}/main.m3u8 or main.mpd.';
    throw new PlaybackUrlError(detail);
  }

  return {
    collectionId: decodeURIComponent(collectionId),
    assetId: decodeURIComponent(assetId),
  };
}
