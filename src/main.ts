import './style.css';
import { Game } from './game';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Could not find the #game canvas element.');
}

// Boot the game.
new Game(canvas);
