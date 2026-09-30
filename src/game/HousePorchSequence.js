const PORCH_BACKDROP = new URL(
  '../../assets/backgrounds/house/house_porch_ps1.jpg',
  import.meta.url,
).href;

const PORCH_LIMBS = new URL(
  '../../assets/backgrounds/house/house_porch_limbs_clean.webp',
  import.meta.url,
).href;

const REVEAL_PARTS = [
  { key: 'left-arm', start: 1.40, duration: 0.20 },
  { key: 'right-arm', start: 1.95, duration: 0.20 },
  { key: 'top-legs', start: 2.50, duration: 0.24 },
  { key: 'left-low', start: 3.05, duration: 0.20 },
  { key: 'bottom-leg', start: 3.65, duration: 0.24 },
];

// Isolated cinematic capsule. No Bryan, no controls.
// The porch pushes in while prerendered limbs emerge rapidly from the doorway.
export class HousePorchSequence {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.pushDuration = 9.5;
    this.revealTriggered = new Set();
    this.audioContext = null;

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
    this.prepareAudio();
  }

  prepareAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.audioContext = new AudioContextClass();
    } catch {
      return;
    }

    const unlock = () => {
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    unlock();
  }

  playRevealStinger(index) {
    const ctx = this.audioContext;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      return;
    }

    const now = ctx.currentTime;
    const output = ctx.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(0.105, now + 0.012);
    output.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    output.connect(ctx.destination);

    // Low cinematic thump.
    const low = ctx.createOscillator();
    low.type = index % 2 === 0 ? 'triangle' : 'sine';
    low.frequency.setValueAtTime(62 + index * 4, now);
    low.frequency.exponentialRampToValueAtTime(34 + index * 2, now + 0.46);
    low.connect(output);
    low.start(now);
    low.stop(now + 0.50);

    // Short breath/scrape of filtered noise makes every reveal feel organic.
    const length = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const decay = 1 - (i / length);
      channel[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(920 - index * 75, now);
    filter.Q.setValueAtTime(1.25, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.23);
  }

  onResize() {}

  update(dt) {
    this.time += dt;

    // Keep the push-in tense, but stop before the low-res source is enlarged
    // enough to become visibly blocky.
    const raw = Math.min(this.time / this.pushDuration, 1);
    const t = raw * raw * (3 - 2 * raw);
    const scale = 1 + (0.12 * t);
    const y = 0.85 * t;
    this.stage.style.transform =
      `translate3d(0, ${y}%, 0) scale(${scale})`;

    this.revealParts.forEach((part, index) => {
      const phase = Math.max(0, Math.min(1,
        (this.time - part.config.start) / part.config.duration,
      ));
      const eased = phase * phase * (3 - 2 * phase);

      if (phase > 0 && !this.revealTriggered.has(part.config.key)) {
        this.revealTriggered.add(part.config.key);
        this.playRevealStinger(index);
      }

      part.image.style.opacity = String(eased);

      if (phase > 0 && phase < 1) {
        const creep = (1 - eased) * (index % 2 === 0 ? -0.35 : 0.35);
        part.image.style.transform =
          `translate3d(${creep}%, 0, 0) scale(${0.985 + eased * 0.015})`;
      } else {
        part.image.style.transform = 'translate3d(0,0,0) scale(1)';
      }
    });

    const terror = Math.max(0, Math.min(1, (this.time - 1.15) / 3.3));
    this.vignette.style.opacity = String(0.70 + terror * 0.18);

    this.game.input.clearFrameState();
  }
}
