// Automatic subtitles: never reads input or locks movement.
export class TimedConversation {
  constructor(container) {
    this.element = document.createElement('aside'); this.element.className = 'driving-dialogue';
    this.element.setAttribute('aria-live', 'polite'); this.element.hidden = true;
    this.speaker = document.createElement('strong'); this.text = document.createElement('p');
    this.element.append(this.speaker, this.text); container.append(this.element);
    this.reset();
  }
  reset() { this.active = false; this.completed = false; this.index = 0; this.elapsed = 0; this.element.hidden = true; }
  start(lines) { this.lines = lines; this.reset(); this.active = true; this.show(); }
  show() {
    const line = this.lines[this.index];
    this.element.hidden = !line.text; this.speaker.textContent = line.speaker || '';
    this.text.textContent = line.text || '';
  }
  stop() { this.active = false; this.completed = true; this.element.hidden = true; }
  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.elapsed >= this.lines[this.index].duration) {
      this.elapsed -= this.lines[this.index].duration;
      if (++this.index >= this.lines.length) this.stop(); else this.show();
    }
  }
}
