import { Game } from './game.js';

const params = new URLSearchParams(location.search);
const game = new Game(params);
window.__game = game;

game.init().catch((err) => {
  const msg = err ? (err.stack || err.message || String(err)) : 'init error';
  window.__errors.push(msg);
  console.error(err);
});
