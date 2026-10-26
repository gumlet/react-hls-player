import type shaka from 'shaka-player';
import { getShaka } from '../loadShaka';

export function stringToArray(string: string) {
  const buffer = new ArrayBuffer(string.length * 2);
  const array = new Uint16Array(buffer);
  for (let i = 0, strLen = string.length; i < strLen; i++) {
    array[i] = string.charCodeAt(i);
  }
  return array;
}

export function arrayToString(array: Uint16Array) {
  const uint16array = new Uint16Array(array.buffer);
  return String.fromCharCode.apply(null, Array.from(uint16array));
}

export function extractContentId(initData: BufferSource) {
  let contentId = getShaka().util.StringUtils.fromBytesAutoDetect(initData);
  if (contentId.includes('skd://')) {
    contentId = contentId.split('skd://')[1];
  }
  return contentId;
}

export function concatInitDataIdAndCertificate(
  initData: Uint8Array,
  id: string | Uint16Array,
  cert: Uint8Array
) {
  const idArr: Uint16Array = typeof id === 'string' ? stringToArray(id) : id;
  let offset = 0;
  const buffer = new ArrayBuffer(
    initData.byteLength + 4 + idArr.byteLength + 4 + cert.byteLength
  );
  const dataView = new DataView(buffer);

  const initDataArray = new Uint8Array(buffer, offset, initData.byteLength);
  initDataArray.set(initData);
  offset += initData.byteLength;

  dataView.setUint32(offset, idArr.byteLength, true);
  offset += 4;

  const idArray = new Uint16Array(buffer, offset, idArr.length);
  idArray.set(idArr);
  offset += idArray.byteLength;

  dataView.setUint32(offset, cert.byteLength, true);
  offset += 4;

  const certArray = new Uint8Array(buffer, offset, cert.byteLength);
  certArray.set(cert);

  return new Uint8Array(buffer, 0, buffer.byteLength);
}

export function uInt8ArrayToString(array: Uint8Array) {
  return String.fromCharCode.apply(null, Array.from(array));
}

export function base64EncodeUint8Array(input: Uint8Array) {
  return btoa(uInt8ArrayToString(input));
}

function bufferSourceToUint8(
  source: ArrayBuffer | ArrayBufferView
): Uint8Array {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

/** Chunked so a large SPC does not blow `String.fromCharCode`'s argument limit. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isFairPlayLicense(
  type: shaka.net.NetworkingEngine.RequestType,
  request: shaka.extern.Request,
  licenseUri: string
): boolean {
  if (type !== getShaka().net.NetworkingEngine.RequestType.LICENSE)
    return false;
  const keySystem = request.drmInfo?.keySystem ?? '';
  if (keySystem.startsWith('com.apple.fps')) return true;
  return request.uris.some((uri) => uri === licenseUri);
}

/**
 * Gumlet's FairPlay license server expects `POST` JSON `{ spc }` and returns
 * JSON `{ ckc }`. Shaka's `FairPlay.gumletFairPlayRequest` skips the wrap when
 * `attempt > 0` or `drmInfo` is missing, so the raw SPC is sent and the server
 * rejects it. These filters always wrap a raw SPC body and always unwrap `ckc`.
 */
export function createFairPlayLicenseRequestFilter(
  licenseUri: string
): shaka.extern.RequestFilter {
  return (type, request) => {
    if (!isFairPlayLicense(type, request, licenseUri) || !request.body) return;
    const bytes = bufferSourceToUint8(request.body);
    if (bytes[0] === 0x7b) {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
          spc?: unknown;
        };
        if (typeof parsed.spc === 'string') return;
      } catch {
        /* raw SPC that happens to start with '{' — wrap it */
      }
    }
    const body = JSON.stringify({ spc: bytesToBase64(bytes) });
    request.body = new TextEncoder().encode(body);
    request.headers['Content-Type'] = 'application/json';
    request.contentType = 'application/json';
  };
}

export function createFairPlayLicenseResponseFilter(
  licenseUri: string
): shaka.extern.ResponseFilter {
  return (type, response) => {
    if (!isFairPlayLicense(type, response.originalRequest, licenseUri)) return;
    let text: string;
    try {
      text = new TextDecoder()
        .decode(bufferSourceToUint8(response.data))
        .trim();
    } catch {
      return;
    }
    if (!text.startsWith('{')) return;
    try {
      const parsed = JSON.parse(text) as { ckc?: unknown };
      if (typeof parsed.ckc !== 'string' || !parsed.ckc) return;
      response.data = base64ToBytes(parsed.ckc);
    } catch {
      /* leave non-JSON license bodies unchanged */
    }
  };
}
