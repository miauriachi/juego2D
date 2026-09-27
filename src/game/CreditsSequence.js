import { CREDITS, creditLines } from '../config/credits.js';

// Time-based scrolling, configurable content and one completion path (including ESC).
export class CreditsSequence {
  constructor(container, input, onComplete, config = CREDITS) {
    this.input = input; this.onComplete = onComplete; this.config = config;
    this.active = false; this.travel = 0;
    this.element = document.createElement('section');
    this.element.className = 'credits-sequence'; this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Créditos');
    this.roll = document.createElement('div'); this.roll.className = 'credits-roll';
    for (const text of creditLines(config)) {
      const line = document.createElement('p'); line.textContent = text || '\u00a0';
      this.roll.append(line);
    }
    const help = document.createElement('small'); help.textContent = '[ESC] Saltar créditos';
    this.element.append(this.roll, help); container.append(this.element);
  }

  start() {
    this.travel = 0; this.active = true; this.element.hidden = false;
    this.input.clearFrameState(); this.render();
  }

  render() { this.roll.style.transform = `translateY(${window.innerHeight - this.travel}px)`; }

  update(dt) {
    if (!this.active) return;
    this.travel += dt * this.config.pixelsPerSecond;
    this.render();
    if (this.input.isJustPressed('Escape') || this.travel > window.innerHeight + this.roll.offsetHeight + 40) {
      this.active = false; this.element.hidden = true; this.onComplete();
    }
  }
}
