import { InputManager } from './InputManager.js';
import { CreditsSequence } from './CreditsSequence.js';
import { GameAudio } from './GameAudio.js';

// Pre-game screens and fade; constructs Game only after New Game.
export class MainMenu {
  constructor(container, onStart) {
    this.container = container; this.onStart = onStart;
    this.input = new InputManager(); this.settings = { sound: true, cameraMotion: true };
    this.audio = new GameAudio(this.settings);
    this.phase = 'menu'; this.index = 0; this.time = 0;
    this.element = document.createElement('section'); this.element.className = 'main-menu';
    const subtitle = document.createElement('p'); subtitle.className = 'menu-kicker'; subtitle.textContent = 'A FAN GAME TRIBUTE';
    const title = document.createElement('h1'); title.textContent = 'RE NOCHE CERO';
    this.list = document.createElement('nav'); this.list.setAttribute('aria-label', 'Menú principal');
    this.help = document.createElement('p'); this.help.className = 'menu-help';
    this.element.append(subtitle, title, this.list, this.help); container.append(this.element);
    this.fade = document.createElement('div'); this.fade.className = 'screen-fade'; this.fade.hidden = true;
    container.append(this.fade);
    this.credits = new CreditsSequence(container, this.input, () => {
      this.phase = 'menu'; this.element.hidden = false; this.index = 3; this.render();
    });
    this.render();
  }
  get options() {
    return this.phase === 'options'
      ? [`SONIDO: ${this.settings.sound ? 'SÍ' : 'NO'}`, `MOVIMIENTO DE CÁMARA: ${this.settings.cameraMotion ? 'NORMAL' : 'REDUCIDO'}`, 'VOLVER']
      : ['NUEVA PARTIDA', 'CONTINUAR', 'OPCIONES', 'CRÉDITOS'];
  }
  render() {
    this.list.replaceChildren(...this.options.map((text, i) => {
      const button = document.createElement('button'); button.textContent = text;
      // No save provider exists yet: never offer a misleading Continue.
      button.disabled = this.phase === 'menu' && i === 1;
      button.className = i === this.index ? 'selected' : '';
      button.setAttribute('aria-current', String(i === this.index));
      button.addEventListener('click', () => { this.index = i; this.confirm(); });
      return button;
    }));
    this.help.textContent = this.phase === 'options'
      ? '[W/S · ↑/↓] Seleccionar   [E · ENTER] Cambiar   [ESC] Volver'
      : '[W/S · ↑/↓] Seleccionar   [E · ENTER] Confirmar\nNo hay partida guardada.';
  }
  confirm() {
    if (this.phase === 'options') {
      if (this.index === 0) this.settings.sound = !this.settings.sound;
      else if (this.index === 1) this.settings.cameraMotion = !this.settings.cameraMotion;
      else { this.phase = 'menu'; this.index = 2; }
      this.render(); return;
    }
    if (this.phase !== 'menu') return;
    if (this.index === 0) {
      this.phase = 'fade'; this.time = 0; this.fade.hidden = false; this.fade.style.opacity = '0';
    } else if (this.index === 2) { this.phase = 'options'; this.index = 0; this.render(); }
    else if (this.index === 3) { this.phase = 'credits'; this.element.hidden = true; this.credits.start(); }
    this.input.keys.clear(); this.input.clearFrameState();
  }
  update(dt) {
    if (this.phase === 'playing') return;
    if (this.phase === 'credits') this.credits.update(dt);
    else if (this.phase === 'fade') {
      this.time += dt;
      this.fade.style.opacity = String(this.time < 1.15 ? Math.min(1, this.time / 0.7) : Math.max(0, 1 - (this.time - 1.15) / 0.8));
      if (this.time >= 1.15 && !this.game) {
        this.element.hidden = true; this.input.keys.clear(); this.input.clearFrameState();
        this.game = this.onStart(this.input, this.settings, this.audio);
        (this.game.ready || this.game.visualReady).then(() => { this.assetsReady = true; });
        this.game.clock.getDelta();
        // OpeningSequence may use a DOM door transition instead of its own THREE camera.
        // Always fall back to the game's fixed camera so the first frame cannot crash.
        if (!this.game.openingSequence?.transition) {
          this.game.renderer.render(this.game.scene, this.game.openingSequence?.camera || this.game.cameraRig.camera);
        }
      }
      if (this.game && !this.assetsReady) this.time = 1.15;
      if (this.time >= 1.95) { this.phase = 'playing'; this.fade.hidden = true; this.game.clock.getDelta(); }
    } else {
      const up = this.input.isJustPressed('KeyW') | this.input.isJustPressed('ArrowUp');
      const down = this.input.isJustPressed('KeyS') | this.input.isJustPressed('ArrowDown');
      if (up !== down) {
        const step = down ? 1 : -1;
        do { this.index = (this.index + step + this.options.length) % this.options.length; }
        while (this.phase === 'menu' && this.index === 1);
        this.render();
      }
      if (this.input.isJustPressed('Escape') && this.phase === 'options') { this.phase = 'menu'; this.index = 2; this.render(); }
      if (this.input.isJustPressed('KeyE') | this.input.isJustPressed('Enter')) this.confirm();
    }
    this.input.clearFrameState();
  }
}
