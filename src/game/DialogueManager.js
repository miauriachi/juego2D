import { DialogueChoice } from './DialogueChoice.js';

// Reusable dialogue presentation/state. InteractionManager remains responsible for E to start.
export class DialogueManager {
  constructor(container, input) {
    this.input = input;
    this.lines = [];
    this.index = 0;
    this.isOpen = false;
    this.touchContinueRequested = false;
    this.touchCapable = (navigator.maxTouchPoints || 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches;
    this.hint = document.createElement('div');
    this.hint.className = 'interaction-hint'; this.hint.hidden = true;
    this.panel = document.createElement('section');
    this.panel.className = 'dialogue-panel'; this.panel.hidden = true;
    this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-label', 'Conversación');
    this.speaker = document.createElement('strong');
    this.text = document.createElement('p'); this.text.setAttribute('aria-live', 'polite');
    this.help = document.createElement('small'); this.help.textContent = this.continueHelpText();
    this.panel.append(this.speaker, this.text);
    this.panel.addEventListener('pointerup', event => {
      if (!this.isOpen || this.choice?.active) return;
      event.preventDefault();
      this.touchContinueRequested = true;
    });
    this.choice = new DialogueChoice(this.panel, input);
    this.panel.append(this.help);
    container.append(this.hint, this.panel);
  }

  continueHelpText() {
    return this.touchCapable ? '[TOCA] Continuar' : '[E] Continuar';
  }

  start(lines, onClose = () => {}) {
    if (this.isOpen || !lines.length) return false;
    this.lines = lines; this.index = 0; this.onClose = onClose;
    this.touchContinueRequested = false;
    this.help.textContent = this.continueHelpText();
    this.isOpen = true; this.panel.hidden = false; this.setHint(''); this.showLine();
    return true;
  }

  showLine() {
    this.speaker.textContent = this.lines[this.index].speaker;
    this.text.textContent = this.lines[this.index].text;
  }

  update() {
    if (this.choice.active) { this.choice.update(); return; }
    if (!this.isOpen) return;
    const continueRequested = this.input.isJustPressed('KeyE') || this.touchContinueRequested;
    this.touchContinueRequested = false;
    if (!continueRequested) return;
    this.index++;
    if (this.index < this.lines.length) this.showLine();
    else {
      this.isOpen = false; this.panel.hidden = true; this.touchContinueRequested = false;
      const close = this.onClose; this.onClose = null; close();
    }
  }

  choose(options, onSelect) {
    if (this.isOpen || !options.length) return false;
    this.isOpen = true; this.panel.hidden = false; this.setHint('');
    this.speaker.textContent = 'BRYAN'; this.text.textContent = '¿Qué respondes?';
    this.help.textContent = '[W/S o ↑/↓] Elegir · [E] Confirmar';
    this.choice.show(options, index => {
      this.isOpen = false; this.panel.hidden = true;
      onSelect(index);
    });
    return true;
  }

  setHint(text) {
    this.hint.textContent = text;
    this.hint.hidden = this.isOpen || !text;
  }
}
