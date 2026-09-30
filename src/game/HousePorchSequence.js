const PORCH_BACKDROP = new URL(
  '../../assets/backgrounds/house/house_porch_ps1.jpg',
  import.meta.url,
).href;

const PORCH_LIMBS = new URL(
  '../../assets/backgrounds/house/house_porch_limbs.jpg',
  import.meta.url,
).href;

const REVEAL_PARTS = [
  { key: 'left-arm', start: 4.8, duration: 0.85 },
  { key: 'right-arm', start: 6.1, duration: 0.85 },
  { key: 'top-legs', start: 7.5, duration: 0.95 },
  { key: 'left-low', start: 8.9, duration: 0.85 },
  { key: 'bottom-leg', start: 10.3, duration: 0.95 },
];

// Isolated cinematic capsule. No Bryan, no controls.
// The porch pushes in slowly while prerendered limbs emerge from the doorway.
export class HousePorchSequence {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.pushDuration = 17;

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

    this.stage = document.createElement('div');
    this.stage.className = 'house-porch-cinematic__stage';

    this.image = document.createElement('img');
    this.image.className = 'house-porch-cinematic__image';
    this.image.alt = '';
    this.image.draggable = false;
    this.image.src = PORCH_BACKDROP;

    this.doorVoid = document.createElement('div');
    this.doorVoid.className = 'house-porch-cinematic__door-void';

    this.revealParts = REVEAL_PARTS.map(config => {
      const image = document.createElement('img');
      image.className =
        `house-porch-cinematic__limb-layer house-porch-cinematic__limb-layer--${config.key}`;
      image.alt = '';
      image.draggable = false;
      image.src = PORCH_LIMBS;
      image.addEventListener('error', () => {
        image.hidden = true;
        console.error('House porch limb plate failed to load:', PORCH_LIMBS);
      }, { once: true });
      return { config, image };
    });

    this.vignette = document.createElement('div');
    this.vignette.className = 'house-porch-cinematic__vignette';

    this.stage.append(
      this.image,
      this.doorVoid,
      ...this.revealParts.map(part => part.image),
    );
    this.root.append(this.stage, this.vignette);
    game.container.append(this.root);
  }

  onResize() {}

  update(dt) {
    this.time += dt;

    // One continuous, slow push toward the doorway.
    const raw = Math.min(this.time / this.pushDuration, 1);
    const t = raw * raw * (3 - 2 * raw);
    const scale = 1 + (0.22 * t);
    const y = 1.45 * t;
    this.stage.style.transform =
      `translate3d(0, ${y}%, 0) scale(${scale})`;

    // Each region comes from the same prerendered final plate, so lighting,
    // anatomy and perspective remain photographic instead of looking drawn on.
    this.revealParts.forEach((part, index) => {
      const phase = Math.max(0, Math.min(1,
        (this.time - part.config.start) / part.config.duration,
      ));
      const eased = phase * phase * (3 - 2 * phase);

      part.image.style.opacity = String(eased);

      if (phase > 0 && phase < 1) {
        const creep = (1 - eased) * (index % 2 === 0 ? -0.22 : 0.22);
        part.image.style.transform = `translate3d(${creep}%, 0, 0)`;
      } else {
        part.image.style.transform = 'translate3d(0,0,0)';
      }
    });

    // The frame closes in almost imperceptibly as the doorway fills.
    const terror = Math.max(0, Math.min(1, (this.time - 4.3) / 7.5));
    this.vignette.style.opacity = String(0.74 + terror * 0.2);

    this.game.input.clearFrameState();
  }
}
