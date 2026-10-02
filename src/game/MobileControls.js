export class MobileControls {
  constructor(container, input) {
    this.container = container;
    this.input = input;
    this.visible = false;
    this.activeCodes = new Set();

    this.root = document.createElement('div');
    this.root.className = 'mobile-controls';
    this.root.hidden = true;

    this.pad = document.createElement('div');
    this.pad.className = 'mobile-controls__pad';

    const makeButton = (label, code, className = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `mobile-controls__button ${className}`.trim();
      button.textContent = label;
      button.setAttribute('aria-label', label);

      const press = event => {
        event.preventDefault();
        if (!this.activeCodes.has(code)) this.input.justPressed.add(code);
        this.activeCodes.add(code);
        this.input.keys.add(code);
        button.classList.add('pressed');
      };
      const release = event => {
        event.preventDefault();
        this.activeCodes.delete(code);
        this.input.keys.delete(code);
        button.classList.remove('pressed');
      };

      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', event => {
        if (event.buttons === 0) release(event);
      });
      return button;
    };

    this.forward = makeButton('▲', 'KeyW', 'mobile-controls__forward');
    this.left = makeButton('◀', 'KeyA', 'mobile-controls__left');
    this.backward = makeButton('▼', 'KeyS', 'mobile-controls__backward');
    this.right = makeButton('▶', 'KeyD', 'mobile-controls__right');
    this.run = makeButton('CORRER', 'ShiftLeft', 'mobile-controls__run');

    this.pad.append(this.forward, this.left, this.backward, this.right);
    this.root.append(this.pad, this.run);
    container.append(this.root);

    this.coarse = window.matchMedia?.('(pointer: coarse)') || null;
    this.syncDeviceVisibility = () => {
      this.root.classList.toggle('mobile-controls--touch', Boolean(this.coarse?.matches || navigator.maxTouchPoints > 0));
    };
    this.syncDeviceVisibility();
    this.coarse?.addEventListener?.('change', this.syncDeviceVisibility);
  }

  show() {
    this.visible = true;
    this.root.hidden = false;
    this.syncDeviceVisibility();
  }

  hide() {
    this.visible = false;
    this.root.hidden = true;
    this.releaseAll();
  }

  releaseAll() {
    for (const code of this.activeCodes) this.input.keys.delete(code);
    this.activeCodes.clear();
    this.root.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
  }

  destroy() {
    this.releaseAll();
    this.coarse?.removeEventListener?.('change', this.syncDeviceVisibility);
    this.root.remove();
  }
}
