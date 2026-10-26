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
