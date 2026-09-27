export class InputManager {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('keydown', (event) => {
      if (!this.keys.has(event.code)) {
        this.justPressed.add(event.code);
      }
      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
  }

  isPressed(code) {
    return this.keys.has(code);
  }

  isJustPressed(code) {
    const pressed = this.justPressed.has(code);
    if (pressed) {
      this.justPressed.delete(code);
    }
    return pressed;
  }

  clearFrameState() {
    this.justPressed.clear();
  }
}
