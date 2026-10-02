const FENCE_ARRIVAL_PLATE = new URL(
  '../../assets/backgrounds/fence/fence_arrival_dialogue.png',
  import.meta.url,
).href;

// Standalone prerendered capsule for the fence reveal.
// It intentionally keeps all prior game scenes untouched and can be moved later.
export class FenceArrivalSequence {
  constructor(game) {
    this.game = game;
    this.time = 0;

    game.player.group.visible = false;
    game.player.velocity.set(0, 0, 0);
    game.playerInputEnabled = false;
    game.objective.hidden = true;
    game.dialogueManager.setHint('');
    game.container.classList.remove('driving-mode');
    game.input.keys.clear();
    game.input.clearFrameState();

    this.root = document.createElement('section');
    this.root.dataset.role = 'fence-arrival-sequence';
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '120',
      background: '#000',
      overflow: 'hidden',
      opacity: '0',
      transition: 'opacity 420ms ease',
      pointerEvents: 'none',
    });

    this.image = document.createElement('img');
    this.image.alt = '';
    this.image.draggable = false;
    this.image.src = FENCE_ARRIVAL_PLATE;
    Object.assign(this.image.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      objectPosition: 'center center',
      imageRendering: 'auto',
      transform: 'scale(1.01)',
      transformOrigin: '50% 52%',
      willChange: 'transform',
      userSelect: 'none',
    });

    this.image.addEventListener('load', () => {
      requestAnimationFrame(() => { this.root.style.opacity = '1'; });
    }, { once: true });

    this.image.addEventListener('error', () => {
      console.error('Fence arrival plate failed to load:', FENCE_ARRIVAL_PLATE);
    }, { once: true });

    this.root.append(this.image);
    game.container.append(this.root);
  }

  onResize() {}

  update(dt) {
    this.time += dt;
    // Very subtle fixed-camera push so the still plate feels like an authored
    // PS1-era cinematic shot without distorting or pixelating the source.
    const t = Math.min(this.time / 10, 1);
    const eased = t * t * (3 - 2 * t);
    this.image.style.transform = `scale(${1.01 + eased * 0.018})`;
    this.game.input.clearFrameState();
  }

  destroy() {
    this.root?.remove();
  }
}
