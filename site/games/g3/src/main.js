import { Game } from './game.js';

const canvas = document.getElementById('c');
const game = new Game(canvas);
window.__game = game;
game.start();
