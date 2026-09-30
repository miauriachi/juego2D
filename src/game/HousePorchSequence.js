const PORCH_BACKDROP = new URL(
  '../../assets/backgrounds/house/house_porch_ps1.jpg',
  import.meta.url,
).href;

const REVEAL_PARTS = [
  { key: 'left-high', start: 4.8, duration: 0.95, dx: -34, dy: 6, rotate: -10 },
  { key: 'right', start: 6.2, duration: 0.95, dx: 34, dy: 6, rotate: 9 },
  { key: 'left-low', start: 7.6, duration: 0.8, dx: -28, dy: 10, rotate: -16 },
  { key: 'top', start: 9.2, duration: 1.05, dx: 0, dy: -42, rotate: 4 },
  { key: 'bottom', start: 10.8, duration: 0.9, dx: 8, dy: 34, rotate: -5 },
];

const LIMB_SVGS = {
  left: `
    <svg viewBox="0 0 240 140" aria-hidden="true">
      <defs>
        <linearGradient id="skinL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4a3a31"/>
          <stop offset=".42" stop-color="#b18762"/>
          <stop offset=".72" stop-color="#6e5140"/>
          <stop offset="1" stop-color="#211918"/>
        </linearGradient>
        <filter id="roughL">
          <feTurbulence baseFrequency=".035" numOctaves="2" seed="7" result="n"/>
          <feColorMatrix in="n" type="saturate" values="0"/>
          <feBlend in="SourceGraphic" in2="n" mode="multiply"/>
        </filter>
      </defs>
      <path d="M229 43 C190 39 165 46 143 58 C118 73 98 84 74 87 C57 89 43 94 29 105
               C18 113 11 117 5 123 L18 132 C31 123 41 118 55 116 C84 112 108 102 130 87
               C151 73 178 70 211 76 Z"
            fill="url(#skinL)" filter="url(#roughL)"/>
      <path d="M31 106 C20 103 11 106 4 111 M30 112 C18 112 10 117 4 124
               M34 117 C24 120 18 126 14 133 M38 120 C31 125 28 132 28 138"
            fill="none" stroke="#9d785d" stroke-width="5" stroke-linecap="round"/>
      <path d="M117 77 C104 88 96 96 92 108" fill="none" stroke="#2c211d" stroke-width="4" opacity=".7"/>
    </svg>`,
  right: `
    <svg viewBox="0 0 240 140" aria-hidden="true">
      <defs>
        <linearGradient id="skinR" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4a3a31"/>
          <stop offset=".42" stop-color="#b18762"/>
          <stop offset=".72" stop-color="#6e5140"/>
          <stop offset="1" stop-color="#211918"/>
        </linearGradient>
        <filter id="roughR">
          <feTurbulence baseFrequency=".035" numOctaves="2" seed="11" result="n"/>
          <feColorMatrix in="n" type="saturate" values="0"/>
          <feBlend in="SourceGraphic" in2="n" mode="multiply"/>
        </filter>
      </defs>
      <path d="M11 43 C50 39 75 46 97 58 C122 73 142 84 166 87 C183 89 197 94 211 105
               C222 113 229 117 235 123 L222 132 C209 123 199 118 185 116 C156 112 132 102 110 87
               C89 73 62 70 29 76 Z"
            fill="url(#skinR)" filter="url(#roughR)"/>
      <path d="M209 106 C220 103 229 106 236 111 M210 112 C222 112 230 117 236 124
               M206 117 C216 120 222 126 226 133 M202 120 C209 125 212 132 212 138"
            fill="none" stroke="#9d785d" stroke-width="5" stroke-linecap="round"/>
      <path d="M123 77 C136 88 144 96 148 108" fill="none" stroke="#2c211d" stroke-width="4" opacity=".7"/>
    </svg>`,
  top: `
    <svg viewBox="0 0 220 250" aria-hidden="true">
      <defs>
        <linearGradient id="skinT" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2a211d"/>
          <stop offset=".38" stop-color="#987154"/>
          <stop offset=".7" stop-color="#5b4134"/>
          <stop offset="1" stop-color="#161313"/>
        </linearGradient>
        <filter id="roughT">
          <feTurbulence baseFrequency=".03" numOctaves="3" seed="19" result="n"/>
          <feBlend in="SourceGraphic" in2="n" mode="multiply"/>
        </filter>
      </defs>
      <path d="M62 8 C57 41 59 73 72 104 C82 128 86 146 91 169 L115 164
               C111 137 103 113 96 90 C89 65 88 34 93 5 Z"
            fill="url(#skinT)" filter="url(#roughT)"/>
      <path d="M130 4 C136 34 136 63 127 89 C120 111 112 136 108 163 L133 170
               C140 142 151 117 160 92 C171 61 168 31 160 7 Z"
            fill="url(#skinT)" filter="url(#roughT)"/>
      <path d="M72 150 C91 141 122 142 143 155 L151 201
               C128 218 94 218 69 200 Z"
            fill="#312b27" stroke="#6b5b4e" stroke-width="3"/>
      <path d="M75 164 C96 174 124 174 144 162 M78 183 C98 191 123 191 143 181"
            fill="none" stroke="#74614e" stroke-width="3" opacity=".65"/>
      <path d="M65 8 L52 1 M62 12 L43 8 M159 8 L172 1 M161 14 L181 9"
            fill="none" stroke="#7f604b" stroke-width="5" stroke-linecap="round"/>
    </svg>`,
  bottom: `
    <svg viewBox="0 0 130 230" aria-hidden="true">
      <defs>
        <linearGradient id="skinB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#31251f"/>
          <stop offset=".45" stop-color="#a47a59"/>
          <stop offset=".72" stop-color="#634638"/>
          <stop offset="1" stop-color="#171313"/>
        </linearGradient>
      </defs>
      <path d="M68 6 C48 35 38 68 42 100 C45 126 58 145 61 166
               C64 184 57 199 44 214 L67 226 C84 207 91 185 87 160
               C84 138 74 121 73 101 C72 73 82 47 96 23 Z"
            fill="url(#skinB)"/>
      <path d="M44 214 C34 216 27 222 21 229 M50 216 C42 222 39 228 38 233
               M57 219 C52 225 51 232 52 237"
            fill="none" stroke="#8f6a52" stroke-width="5" stroke-linecap="round"/>
      <path d="M50 110 C61 105 69 105 80 111" fill="none" stroke="#2b211e" stroke-width="4" opacity=".65"/>
    </svg>`,
};

// Isolated cinematic capsule. No Bryan, no controls: the camera slowly pushes
// toward the door while impossible human-like limbs emerge one by one.
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

    this.stage = document.createElement('div');
    this.stage.className = 'house-porch-cinematic__stage';

    this.image = document.createElement('img');
    this.image.className = 'house-porch-cinematic__image';
    this.image.src = PORCH_BACKDROP;
    this.image.alt = '';
    this.image.draggable = false;

    this.doorVoid = document.createElement('div');
    this.doorVoid.className = 'house-porch-cinematic__door-void';

    const spriteKind = key => {
      if (key === 'right') return 'right';
      if (key === 'top') return 'top';
      if (key === 'bottom') return 'bottom';
      return 'left';
    };

    this.revealParts = REVEAL_PARTS.map(config => {
      const sprite = document.createElement('div');
      sprite.className =
        `house-porch-cinematic__limb house-porch-cinematic__limb--${config.key}`;
      sprite.innerHTML = LIMB_SVGS[spriteKind(config.key)];
      return { config, sprite };
    });

    this.vignette = document.createElement('div');
    this.vignette.className = 'house-porch-cinematic__vignette';

    this.stage.append(
      this.image,
      this.doorVoid,
      ...this.revealParts.map(part => part.sprite),
    );
    this.root.append(this.stage, this.vignette);
    game.container.append(this.root);
  }

  onResize() {}

  update(dt) {
    this.time += dt;

    const raw = Math.min(this.time / this.pushDuration, 1);
    const t = raw * raw * (3 - 2 * raw);
    const scale = 1 + (0.20 * t);
    const y = 1.2 * t;
    this.stage.style.transform =
      `translate3d(0, ${y}%, 0) scale(${scale})`;

    this.revealParts.forEach((part, index) => {
      const { config, sprite } = part;
      const phase = Math.max(0, Math.min(1,
        (this.time - config.start) / config.duration,
      ));

      if (phase <= 0) {
        sprite.style.opacity = '0';
        return;
      }

      const eased = phase * phase * (3 - 2 * phase);
      const twitch = phase >= 1
        ? Math.sin((this.time - config.start) * (6.2 + index * 0.55)) * 1.1
        : 0;
      const breathe = phase >= 1
        ? Math.sin((this.time - config.start) * 2.0 + index) * 0.8
        : 0;

      const x = config.dx * (1 - eased) + twitch;
      const yy = config.dy * (1 - eased) + breathe;
      const rotation = config.rotate * (1 - eased) + twitch * 0.35;
      const spriteScale = 0.86 + eased * 0.14;

      sprite.style.opacity = String(Math.min(1, eased * 1.2));
      sprite.style.transform =
        `translate3d(${x}px, ${yy}px, 0) scale(${spriteScale}) rotate(${rotation}deg)`;
    });

    const terror = Math.max(0, Math.min(1, (this.time - 4.5) / 8));
    this.doorVoid.style.filter =
      `brightness(${0.94 - terror * 0.16})`;
    this.vignette.style.opacity = String(0.76 + terror * 0.20);

    this.game.input.clearFrameState();
  }
}
