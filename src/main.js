import { Game } from './game/Game.js';
import { MainMenu } from './game/MainMenu.js';

const root = document.getElementById('game-root');
const menu = new MainMenu(root, (input, settings, audio) => new Game(root, { input, settings, audio }));
let previous = performance.now();
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
  if (menu.phase === 'playing') menu.game.update();
  else menu.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
