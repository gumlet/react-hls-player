import type shaka from 'shaka-player';

export type ShakaNamespace = typeof shaka;

/** Prebuilt artifact selected from the manifest URL (or full `compiled` when unknown). */
export type ShakaBuildVariant = 'dash' | 'hls' | 'compiled';

export type LoadShakaOptions = {
  debug?: boolean;
  /** `.mpd` / `.m3u8` URL used to pick the dash/hls prebuilt. */
  manifestUrl?: string | null;
};

type ShakaModule = { default?: ShakaNamespace } | ShakaNamespace;

const cached = new Map<string, ShakaNamespace>();
const inflight = new Map<string, Promise<ShakaNamespace>>();
let active: ShakaNamespace | null = null;
let generation = 0;

function unwrap(mod: ShakaModule): ShakaNamespace {
  if (typeof mod === 'object' && mod && 'default' in mod && mod.default) {
    return mod.default;
  }
  return mod as ShakaNamespace;
}

function enableDebugLogs(shakaNs: ShakaNamespace) {
  const logApi = shakaNs as ShakaNamespace & {
    log?: { setLevel: (level: number) => void; Level?: { DEBUG?: number } };
  };
  if (logApi.log?.setLevel && logApi.log.Level?.DEBUG != null) {
    logApi.log.setLevel(logApi.log.Level.DEBUG);
  }
}

/** Map a manifest URL to the smallest Shaka prebuilt that can play it. */
export function resolveShakaBuildVariant(
  manifestUrl?: string | null
): ShakaBuildVariant {
  if (!manifestUrl) {
    return 'compiled';
  }
  if (/\.m3u8(\?|#|$)/i.test(manifestUrl)) {
    return 'hls';
  }
  if (/\.mpd(\?|#|$)/i.test(manifestUrl)) {
    return 'dash';
  }
  return 'compiled';
}

function cacheKey(debug: boolean, variant: ShakaBuildVariant): string {
  return `${debug ? 'debug' : 'prod'}:${variant}`;
}

async function importShakaBuild(
  variant: ShakaBuildVariant,
  debug: boolean
): Promise<ShakaNamespace> {
  let mod: ShakaModule;
  if (debug) {
    switch (variant) {
      case 'dash':
        mod = await import('shaka-player/dist/shaka-player.dash.debug.js');
        break;
      case 'hls':
        mod = await import('shaka-player/dist/shaka-player.hls.debug.js');
        break;
      default:
        mod = await import('shaka-player/dist/shaka-player.compiled.debug.js');
    }
  } else {
    switch (variant) {
      case 'dash':
        mod = await import('shaka-player/dist/shaka-player.dash.js');
        break;
      case 'hls':
        mod = await import('shaka-player/dist/shaka-player.hls.js');
        break;
      default:
        mod = await import('shaka-player/dist/shaka-player.compiled.js');
    }
  }
  return unwrap(mod);
}

/**
 * Load the Shaka prebuilt that matches the manifest. `.m3u8` uses the HLS
 * build and `.mpd` uses the DASH build. `debug` selects that build's debug
 * file and sets the log level to DEBUG. Each file is its own import.
 */
export async function loadShaka(
  options: LoadShakaOptions = {}
): Promise<ShakaNamespace> {
  const debug = options.debug ?? false;
  const variant = resolveShakaBuildVariant(options.manifestUrl);
  const key = cacheKey(debug, variant);
  const hit = cached.get(key);
  if (hit) {
    return hit;
  }
  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const gen = generation;
  const promise = (async () => {
    const shakaNs = await importShakaBuild(variant, debug);
    if (gen !== generation) {
      return shakaNs;
    }
    if (debug) {
      enableDebugLogs(shakaNs);
    }
    cached.set(key, shakaNs);
    return shakaNs;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  }
}

/** Namespace that constructed the current player. Helpers must use this copy. */
export function setActiveShaka(shakaNs: ShakaNamespace) {
  active = shakaNs;
  if (typeof window !== 'undefined') {
    window.shaka = shakaNs;
  }
}

export function getShaka(): ShakaNamespace {
  if (active) {
    return active;
  }
  if (typeof window !== 'undefined' && window.shaka) {
    active = window.shaka;
    return active;
  }
  throw new Error('Shaka not loaded yet — call loadShaka() first');
}

/** Drops the cached builds. Tests use this so each case loads Shaka again. */
export function resetShakaLoaderForTests() {
  generation += 1;
  cached.clear();
  inflight.clear();
  active = null;
}
