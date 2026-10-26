import type shaka from 'shaka-player';

export type ShakaNamespace = typeof shaka;

type ShakaModule = { default?: ShakaNamespace } | ShakaNamespace;

const cached = new Map<boolean, ShakaNamespace>();
const inflight = new Map<boolean, Promise<ShakaNamespace>>();
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

/**
 * Load the compiled Shaka build, or the debug build when `debug` is set.
 * The debug file is a separate import so the release bundle does not include it.
 */
export async function loadShaka(debug = false): Promise<ShakaNamespace> {
  const hit = cached.get(debug);
  if (hit) {
    return hit;
  }
  const pending = inflight.get(debug);
  if (pending) {
    return pending;
  }

  const gen = generation;
  const promise = (async () => {
    const mod = debug
      ? await import('shaka-player/dist/shaka-player.compiled.debug.js')
      : await import('shaka-player/dist/shaka-player.compiled.js');
    const shakaNs = unwrap(mod);
    if (gen !== generation) {
      return shakaNs;
    }
    if (debug) {
      enableDebugLogs(shakaNs);
    }
    cached.set(debug, shakaNs);
    return shakaNs;
  })();

  inflight.set(debug, promise);
  try {
    return await promise;
  } finally {
    if (inflight.get(debug) === promise) {
      inflight.delete(debug);
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
