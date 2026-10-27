/** Deep imports of Shaka's prebuilt files. The package types only cover the main entry. */
type ShakaDefaultExport = typeof import('shaka-player').default;

declare module 'shaka-player/dist/shaka-player.compiled.js' {
  const shaka: ShakaDefaultExport;
  export default shaka;
}

declare module 'shaka-player/dist/shaka-player.compiled.debug.js' {
  const shakaDebug: ShakaDefaultExport;
  export default shakaDebug;
}

declare module 'shaka-player/dist/shaka-player.hls.js' {
  const shakaHls: ShakaDefaultExport;
  export default shakaHls;
}

declare module 'shaka-player/dist/shaka-player.hls.debug.js' {
  const shakaHlsDebug: ShakaDefaultExport;
  export default shakaHlsDebug;
}

declare module 'shaka-player/dist/shaka-player.dash.js' {
  const shakaDash: ShakaDefaultExport;
  export default shakaDash;
}

declare module 'shaka-player/dist/shaka-player.dash.debug.js' {
  const shakaDashDebug: ShakaDefaultExport;
  export default shakaDashDebug;
}
