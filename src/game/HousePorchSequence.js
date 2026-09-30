const PORCH_BACKDROP = new URL(
  '../../assets/backgrounds/house/house_porch_ps1.jpg',
  import.meta.url,
).href;

// Isolated cinematic capsule. No Bryan, no controls: just a slow approach to
// the front door. It can be moved later in the story without rewriting it.
export class HousePorchSequence {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.pushDuration = 14;

    game.player.group.visible = false;
    game.player.velocity.set(0, 0, 0);
    game.playerInputEnabled = false;
    game.objective.hidden = true;
    game.dialogueManager.setHint('');
    game.container.classList.remove('driving-mode');
    game.input.keys.clear();
    game.input.clearFrameState();

    this.root = document.createElement('section');
    this.root.className = 'house-porch-cinematic';
    this.root.dataset.role = 'house-porch-cinematic';

    this.image = document.createElement('img');
    this.image.className = 'house-porch-cinematic__image';
    this.image.alt = '';
    this.image.draggable = false;

    const reveal = () => this.root.classList.add('is-ready');
    this.image.addEventListener('load', reveal, { once: true });
    this.image.addEventListener('error', () => {
      console.error('House porch backdrop failed to load:', PORCH_BACKDROP);
      // Keep the cinematic layer visible instead of exposing the gray game root.
      this.root.classList.add('is-ready');
    }, { once: true });
    this.image.src = PORCH_BACKDROP;
    if (this.image.complete && this.image.naturalWidth > 0) reveal();

    this.vignette = document.createElement('div');
    this.vignette.className = 'house-porch-cinematic__vignette';

    this.root.append(this.image, this.vignette);
    game.container.append(this.root);

    if (this.image.complete && this.image.naturalWidth > 0) reveal();
  }

  onResize() {}

  update(dt) {
    this.time += dt;

    // Deliberate slow push-in. Hold on the door after reaching the end so the
    // next reveal can be authored later.
    const raw = Math.min(this.time / this.pushDuration, 1);
    const t = raw * raw * (3 - 2 * raw);
    const scale = 1 + (0.22 * t);
    const y = 1.5 * t;

    this.image.style.transform =
      `translate3d(0, ${y}%, 0) scale(${scale})`;

    this.game.input.clearFrameState();
  }
}
