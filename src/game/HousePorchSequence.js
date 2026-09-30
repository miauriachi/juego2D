const PORCH_BACKDROP = new URL(
  '../../assets/backgrounds/house/house_porch_ps1.jpg',
  import.meta.url,
).href;

const REVEAL_BACKDROP = new URL(
  '../../assets/backgrounds/house/house_porch_reveal.webp',
  import.meta.url,
).href;

const REVEAL_PARTS = [
  { key: 'left-high', start: 7.0, duration: 0.85, x: -1.2, y: 0.35, rotate: -5 },
  { key: 'right', start: 8.25, duration: 0.82, x: 1.1, y: 0.2, rotate: 4 },
  { key: 'left-low', start: 9.45, duration: 0.78, x: -1.0, y: 0.45, rotate: -4 },
  { key: 'top', start: 10.8, duration: 1.0, x: 0.2, y: -1.7, rotate: 3 },
  { key: 'bottom', start: 12.15, duration: 0.95, x: 0.4, y: 1.5, rotate: -2 },
];

// Isolated cinematic capsule. No Bryan, no controls: the camera slowly pushes
// toward the door while impossible human-like shapes emerge one by one.
export class HousePorchSequence {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.pushDuration = 18;

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
      this.root.classList.add('is-ready');
    }, { once: true });
    this.image.src = PORCH_BACKDROP;
    if (this.image.complete && this.image.naturalWidth > 0) reveal();

    this.doorVoid = document.createElement('div');
    this.doorVoid.className = 'house-porch-cinematic__door-void';

    this.revealParts = REVEAL_PARTS.map(config => {
      const image = document.createElement('img');
      image.className =
        `house-porch-cinematic__reveal house-porch-cinematic__reveal--${config.key}`;
      image.alt = '';
      image.draggable = false;
      image.src = REVEAL_BACKDROP;
      image.addEventListener('error', () => {
        image.style.display = 'none';
        console.error('House porch reveal failed to load:', REVEAL_BACKDROP);
      }, { once: true });
      return { config, image };
    });

    this.vignette = document.createElement('div');
    this.vignette.className = 'house-porch-cinematic__vignette';

    this.root.append(
      this.image,
      this.doorVoid,
      ...this.revealParts.map(part => part.image),
      this.vignette,
    );
    game.container.append(this.root);

    if (this.image.complete && this.image.naturalWidth > 0) reveal();
  }

  onResize() {}

  update(dt) {
    this.time += dt;

    const raw = Math.min(this.time / this.pushDuration, 1);
    const t = raw * raw * (3 - 2 * raw);
    const scale = 1 + (0.22 * t);
    const y = 1.5 * t;

    const baseTransform = `translate3d(0, ${y}%, 0) scale(${scale})`;
    this.image.style.transform = baseTransform;
    this.doorVoid.style.transform = baseTransform;

    this.revealParts.forEach((part, index) => {
      const { config, image } = part;
      const phase = Math.max(0, Math.min(1,
        (this.time - config.start) / config.duration,
      ));

      if (phase <= 0) {
        image.style.opacity = '0';
        return;
      }

      const eased = phase * phase * (3 - 2 * phase);
      const settled = phase >= 1;
      const twitch = settled
        ? Math.sin((this.time - config.start) * (7.5 + index * 0.7)) * 0.16
        : 0;
      const breathe = settled
        ? Math.sin((this.time - config.start) * 2.1 + index) * 0.06
        : 0;

      const localX = config.x * (1 - eased) + twitch;
      const localY = config.y * (1 - eased) + breathe;
      const localScale = 0.94 + eased * 0.06;
      const rotate = config.rotate * (1 - eased) + twitch * 0.6;

      image.style.opacity = String(Math.min(0.98, eased * 1.08));
      image.style.transform =
        `translate3d(${localX}%, ${y + localY}%, 0) ` +
        `scale(${scale * localScale}) rotate(${rotate}deg)`;
    });

    // Once the first shape appears, tighten the darkness almost imperceptibly.
    if (this.time > 6.8) {
      const terror = Math.min((this.time - 6.8) / 6.5, 1);
      this.vignette.style.opacity = String(0.78 + terror * 0.18);
    }

    this.game.input.clearFrameState();
  }
}
