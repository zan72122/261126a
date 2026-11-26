import { Game } from './game.js';

(async () => {
  try {
    const params = new URLSearchParams(location.search);
    const game = new Game(params);
    await game.init();
  } catch (err) {
    const msg = err && (err.stack || err.message || String(err));
    window.__errors = window.__errors || [];
    window.__errors.push(msg);
    console.error(err);
  }
})();
