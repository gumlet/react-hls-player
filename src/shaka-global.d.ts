import type shaka from 'shaka-player';

declare global {
  interface Window {
    shaka?: typeof shaka;
    shakaPlayer?: shaka.Player;
  }
}
