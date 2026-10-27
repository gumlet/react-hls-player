import { describe, expect, it } from 'vitest';
import { resolveShakaBuildVariant } from './loadShaka';

describe('resolveShakaBuildVariant', () => {
  it('picks the HLS build for m3u8, including a query or hash', () => {
    expect(
      resolveShakaBuildVariant(
        'https://cdn.example/collection/asset/main.m3u8'
      )
    ).toBe('hls');
    expect(
      resolveShakaBuildVariant(
        'https://cdn.example/collection/asset/main.m3u8?token=1'
      )
    ).toBe('hls');
    expect(
      resolveShakaBuildVariant(
        'https://cdn.example/collection/asset/MAIN.M3U8#t=1'
      )
    ).toBe('hls');
  });

  it('picks the DASH build for mpd, including a query or hash', () => {
    expect(
      resolveShakaBuildVariant('https://cdn.example/collection/asset/main.mpd')
    ).toBe('dash');
    expect(
      resolveShakaBuildVariant(
        'https://play.example/collection/asset/main.mpd?token=1'
      )
    ).toBe('dash');
  });

  it('falls back to the full build when the manifest type is unknown', () => {
    expect(resolveShakaBuildVariant()).toBe('compiled');
    expect(resolveShakaBuildVariant(null)).toBe('compiled');
    expect(resolveShakaBuildVariant('https://cdn.example/playlist')).toBe(
      'compiled'
    );
  });
});
