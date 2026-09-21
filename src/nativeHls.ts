const HLS_MIME = 'application/vnd.apple.mpegurl';

/** True when the browser can play HLS without hls.js (typically Safari / iOS). */
export function isNativeHlsSupported(
  video?: HTMLVideoElement | null
): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const el = video ?? document.createElement('video');
  return el.canPlayType(HLS_MIME) !== '';
}
