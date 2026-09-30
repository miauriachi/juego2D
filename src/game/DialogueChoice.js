// Keyboard choice presentation; DialogueManager owns the conversation lock.
export class DialogueChoice {
  constructor(panel, input) {
    this.input = input;
    this.element = document.createElement('div');
    this.element.className = 'dialogue-choices';
    this.element.setAttribute('role', 'listbox');
    this.element.setAttribute('aria-label', 'Respuesta de Bryan');
    this.element.hidden = true;
    panel.append(this.element);
    this.active = false;
  }

  show(options, onSelect) {
    this.options = options; this.onSelect = onSelect; this.index = 0;
    this.active = true; this.element.hidden = false;
    this.element.replaceChildren(...options.map((text, i) => {
      const row = document.createElement('div');
      row.id = `dialogue-option-${i}`;
      row.setAttribute('role', 'option'); row.textContent = text;
      return row;
    }));
    this.render();
  }

  render() {
    [...this.element.children].forEach((row, i) => row.setAttribute('aria-selected', String(i === this.index)));
    this.element.setAttribute('aria-activedescendant', `dialogue-option-${this.index}`);
  }

  update() {
    const up = this.input.isJustPressed('KeyW') | this.input.isJustPressed('ArrowUp');
    const down = this.input.isJustPressed('KeyS') | this.input.isJustPressed('ArrowDown');
    this.index = (this.index + down - up + this.options.length) % this.options.length;
    this.render();
    if (this.input.isJustPressed('KeyE')) {
      const select = this.onSelect, index = this.index;
      this.active = false; this.element.hidden = true; this.onSelect = null;
      select(index);
    }
  }
}
