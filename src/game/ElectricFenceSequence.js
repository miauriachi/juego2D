import * as THREE from 'three';
import { MobileControls } from './MobileControls.js';

const FENCE_BACKDROP = new URL(
  '../../assets/backgrounds/fence/electric_fence_clean.webp',
  import.meta.url,
).href;

const FENCE_OPPOSITE_BACKDROP = new URL(
  '../../assets/backgrounds/fence/electric_fence_opposite.webp',
  import.meta.url,
).href;

const FARM_PRERENDER = new URL(
  '../../assets/backgrounds/fence/farm_prerender.webp',
  import.meta.url,
).href;

// Dedicated bridge plate between the fence and barn shots. It is intentionally
// composed as a snowy path with the barn still far away, rather than cropping
// the barn plate and pretending it is a new location.
const BARN_PATH_PRERENDER = new URL(
  '../../assets/backgrounds/fence/barn_path_generated.svg',
  import.meta.url,
).href;

const CORNFIELD_BACKDROP = new URL(
  '../../assets/backgrounds/fence/cornfield_chase.webp',
  import.meta.url,
).href;

const ASPECT = 4 / 3;
const WALK_SPEED = 0.92;
const START = new THREE.Vector3(-0.85, 0, 3.65);
const STOP = new THREE.Vector3(-0.20, 0, -0.35);
const FALLEN_POSITION = new THREE.Vector3(0.18, 0.12, -3.15);

function makeWarningTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#d6b83b';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#17140d';
  ctx.fillRect(4, 4, 120, 56);
  ctx.fillStyle = '#d6b83b';
  ctx.fillRect(8, 8, 112, 48);
  ctx.fillStyle = '#17140d';
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('PELIGRO', 64, 28);
  ctx.font = 'bold 11px monospace';
  ctx.fillText('CERCA ELECTRICA', 64, 45);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function makeFence() {
  const fence = new THREE.Group();
  fence.name = 'electric-cattle-fence';

  const wood = new THREE.MeshLambertMaterial({ color: 0x4b3529, flatShading: true });
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x2d211c, flatShading: true });
  const wire = new THREE.MeshLambertMaterial({ color: 0x171a1d, flatShading: true });
  const insulator = new THREE.MeshLambertMaterial({ color: 0xd3ae27, flatShading: true });
  const snow = new THREE.MeshLambertMaterial({ color: 0xc6d3da, flatShading: true });

  const postXs = [-3.15, -1.55, 0, 1.55, 3.15];
  const fenceZ = -2.45;
  const postGeometry = new THREE.BoxGeometry(0.18, 1.38, 0.18);
  const snowGeometry = new THREE.BoxGeometry(0.22, 0.07, 0.22);

  postXs.forEach((x, index) => {
    const post = new THREE.Mesh(postGeometry, index % 2 ? woodDark : wood);
    post.position.set(x, 0.69, fenceZ);
    post.rotation.y = (index % 2 ? -1 : 1) * 0.025;
    post.castShadow = true;
    post.receiveShadow = true;
    fence.add(post);

    if (index !== 1) {
      const cap = new THREE.Mesh(snowGeometry, snow);
      cap.position.set(x + 0.01, 1.405, fenceZ - 0.005);
      cap.rotation.z = (index - 2) * 0.012;
      cap.castShadow = true;
      fence.add(cap);
    }
  });

  const cableLevels = [0.48, 0.79, 1.08];
  for (let i = 0; i < postXs.length - 1; i += 1) {
    const x0 = postXs[i];
    const x1 = postXs[i + 1];
    const mid = (x0 + x1) / 2;
    const length = x1 - x0;

    cableLevels.forEach((y, level) => {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, length, 5, 1, false),
        wire,
      );
      cable.rotation.z = Math.PI / 2;
      cable.position.set(mid, y - Math.abs(mid) * 0.006 + level * 0.004, fenceZ + 0.005);
      cable.castShadow = true;
      fence.add(cable);
    });
  }

  postXs.forEach(x => {
    cableLevels.forEach(y => {
      const nub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.10, 6),
        insulator,
      );
      nub.rotation.x = Math.PI / 2;
      nub.position.set(x, y, fenceZ + 0.105);
      nub.castShadow = true;
      fence.add(nub);
    });
  });

  const warning = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.36),
    new THREE.MeshBasicMaterial({ map: makeWarningTexture() }),
  );
  warning.position.set(0, 0.84, fenceZ + 0.102);
  warning.rotation.z = -0.035;
  fence.add(warning);

  return fence;
}

function makeLowPolyDog() {
  const dog = new THREE.Group();
  dog.name = 'cornfield-dog';

  const fur = new THREE.MeshLambertMaterial({ color: 0x3a2a24, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x171413, flatShading: true });
  const flesh = new THREE.MeshLambertMaterial({ color: 0x6d2a24, flatShading: true });
  const eye = new THREE.MeshBasicMaterial({ color: 0xd8a235 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.62, 0.55), fur);
  body.position.set(0, 0.86, 0);
  body.rotation.z = -0.05;
  dog.add(body);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.58), fur);
  chest.position.set(0.48, 0.92, 0);
  chest.rotation.z = -0.18;
  dog.add(chest);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.50), fur);
  head.position.set(0.83, 1.31, 0);
  head.rotation.z = -0.12;
  dog.add(head);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.34), dark);
  muzzle.position.set(1.22, 1.22, 0);
  dog.add(muzzle);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.10, 0.29), flesh);
  mouth.position.set(1.24, 1.08, 0);
  mouth.rotation.z = 0.10;
  dog.add(mouth);

  const earGeo = new THREE.ConeGeometry(0.16, 0.44, 4);
  const earL = new THREE.Mesh(earGeo, dark);
  const earR = earL.clone();
  earL.position.set(0.76, 1.66, -0.18);
  earR.position.set(0.76, 1.66, 0.18);
  earL.rotation.z = -0.18;
  earR.rotation.z = -0.18;
  dog.add(earL, earR);

  const eyeGeo = new THREE.SphereGeometry(0.045, 5, 4);
  const eyeL = new THREE.Mesh(eyeGeo, eye);
  const eyeR = eyeL.clone();
  eyeL.position.set(1.05, 1.39, -0.25);
  eyeR.position.set(1.05, 1.39, 0.25);
  dog.add(eyeL, eyeR);

  const legGeo = new THREE.BoxGeometry(0.18, 0.72, 0.18);
  const legPositions = [
    [0.43, 0.42, -0.22],
    [0.43, 0.42, 0.22],
    [-0.48, 0.42, -0.22],
    [-0.48, 0.42, 0.22],
  ];
  const legs = legPositions.map(([x,y,z]) => {
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(x, y, z);
    leg.geometry.translate(0, -0.18, 0);
    dog.add(leg);
    return leg;
  });

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.95, 5), fur);
  tail.rotation.z = Math.PI / 2.6;
  tail.position.set(-0.93, 1.08, 0);
  dog.add(tail);

  dog.scale.setScalar(0.82);
  dog.userData.body = body;
  dog.userData.head = head;
  dog.userData.legs = legs;
  dog.userData.tail = tail;
  dog.userData.phase = 0;
  dog.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return dog;
}

// Independent fixed-camera capsule.
// The prerendered plate is DOM art; Bryan and the fence are rendered as real 3D
// on a transparent WebGL canvas layered above it.
export class ElectricFenceSequence {
  constructor(game) {
    this.game = game;
    this.state = 'arriving';
    this.stopTime = 0;
    this.dialogueStarted = false;
    this.afterShockDialogueStarted = false;
    this.houseDialogueStarted = false;
    this.growlDialogueStarted = false;
    this.bryanReactionStarted = false;
    this.transitionTime = 0;
    this.dogJumpTime = 0;
    this.dogLandingTime = 0;
    this.chaseTime = 0;
    this.chaseGrace = 0;
    this.panTime = 0;
    this.biteCount = 0;
    this.biteCooldown = 0;
    this.chaseScene = 'fence';
    this.barnProgress = 0;
    this.collapseTime = 0;
    this.postCollapseLeapTime = 0;
    this.gameOverShown = false;
    this.rigAnimationEnabled = true;

    this.originalParent = game.player.group.parent;
    this.originalPosition = game.player.position.clone();
    this.originalRotation = game.player.rotationY;
    this.originalGroupRotation = game.player.group.rotation.clone();
    this.originalVisible = game.player.group.visible;
    this.originalGameCanvasVisibility = game.renderer.domElement.style.visibility;

    game.playerInputEnabled = false;
    game.objective.hidden = true;
    game.dialogueManager.setHint('');
    game.container.classList.remove('driving-mode');
    game.input.keys.clear();
    game.input.clearFrameState();

    // Hide the main renderer while this isolated capsule is active.
    game.renderer.domElement.style.visibility = 'hidden';

    this.root = document.createElement('section');
    this.root.dataset.role = 'electric-fence-sequence';
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '5',
      display: 'grid',
      placeItems: 'center',
      overflow: 'hidden',
      background: '#02060b',
      pointerEvents: 'none',
    });

    this.stage = document.createElement('div');
    Object.assign(this.stage.style, {
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(#0a1420, #18232c 52%, #d1d9dd 53%, #9aa8af)',
      boxShadow: '0 0 80px rgba(0,0,0,.85)',
    });

    this.backdrop = document.createElement('img');
    this.backdrop.alt = '';
    this.backdrop.draggable = false;
    this.backdrop.src = FENCE_BACKDROP;
    Object.assign(this.backdrop.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      imageRendering: 'auto',
      filter: 'brightness(.88) contrast(1.04) saturate(.84)',
      userSelect: 'none',
    });
    this.backdrop.addEventListener('error', () => {
      console.error('Electric fence backdrop failed to load:', this.backdrop.src);
      this.backdrop.hidden = true;
    });

    this.oppositeBackdrop = new Image();
    this.oppositeBackdrop.src = FENCE_OPPOSITE_BACKDROP;

    this.vignette = document.createElement('div');
    Object.assign(this.vignette.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '3',
      background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,.22) 70%, rgba(0,0,0,.62) 100%)',
      pointerEvents: 'none',
    });

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    Object.assign(this.renderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '2',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    });

    this.stage.append(this.backdrop, this.renderer.domElement, this.vignette);
    this.root.append(this.stage);
    game.container.append(this.root);

    this.blackout = document.createElement('div');
    this.blackout.dataset.role = 'electric-fence-blackout';
    Object.assign(this.blackout.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '25',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
    });
    game.container.append(this.blackout);

    this.mobileControls = new MobileControls(game.container, game.input);

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x111b26, 17, 40);

    game.player.group.visible = true;
    this.scene.add(game.player.group);
    game.player.position.copy(START);
    game.player.previousPosition.copy(START);
    game.player.velocity.set(0, 0, 0);

    const direction = STOP.clone().sub(START);
    game.player.rotationY = Math.atan2(-direction.x, -direction.z);
    game.player.group.rotation.y = game.player.rotationY;

    this.camera = new THREE.PerspectiveCamera(43, ASPECT, 0.1, 80);
    this.camera.position.set(6.4, 3.75, 8.15);
    this.camera.lookAt(new THREE.Vector3(-0.1, 0.92, -1.35));

    this.scene.add(new THREE.HemisphereLight(0x9eb8cf, 0x111820, 1.75));
    this.scene.add(new THREE.AmbientLight(0x8394a4, 0.52));

    const moon = new THREE.DirectionalLight(0xbcd5eb, 2.8);
    moon.position.set(-5, 9, 6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -8;
    moon.shadow.camera.right = 8;
    moon.shadow.camera.top = 8;
    moon.shadow.camera.bottom = -8;
    moon.shadow.camera.near = 0.1;
    moon.shadow.camera.far = 28;
    moon.shadow.bias = -0.00035;
    this.scene.add(moon);

    const shadowGround = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.ShadowMaterial({ color: 0x0a1118, opacity: 0.28 }),
    );
    shadowGround.rotation.x = -Math.PI / 2;
    shadowGround.position.y = 0.006;
    shadowGround.receiveShadow = true;
    this.scene.add(shadowGround);

    this.fence = makeFence();
    this.scene.add(this.fence);

    this.dog = makeLowPolyDog();
    this.dog.visible = false;
    this.scene.add(this.dog);

    this.farmBackdrop = new Image();
    this.farmBackdrop.src = FARM_PRERENDER;
    this.barnPathBackdrop = new Image();
    this.barnPathBackdrop.src = BARN_PATH_PRERENDER;

    this.onResize();
    this.animateBryan(0, 'walk');
    game.bryanVisual.update();

    // Submit a frame immediately. Even before gameplay starts updating, the
    // capsule is already visible when the menu fade clears.
    this.render();
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const viewWidth = Math.max(1, Math.floor(Math.min(width, height * ASPECT)));
    const viewHeight = Math.max(1, Math.floor(viewWidth / ASPECT));

    this.stage.style.width = viewWidth + 'px';
    this.stage.style.height = viewHeight + 'px';
    this.renderer.setSize(viewWidth, viewHeight, false);
    this.camera.aspect = ASPECT;
    this.camera.updateProjectionMatrix();
  }

  animateBryan(dt, mode) {
    if (!this.rigAnimationEnabled) return;
    try {
      this.game.bryanVisual?.setRigMotion?.(mode);
      this.game.bryanVisual?.animateRig?.(dt, mode);
    } catch (error) {
      this.rigAnimationEnabled = false;
      console.error('Bryan visual animation disabled for ElectricFenceSequence:', error);
    }
  }

  startDialogue() {
    if (this.dialogueStarted) return;
    this.dialogueStarted = true;
    this.game.dialogueManager.start([
      { speaker: 'Bryan', text: '¿Una cerca? Dice que está electrificada...' },
    ], () => this.beginShockTransition());
  }

  beginShockTransition() {
    this.state = 'shockFadeOut';
    this.transitionTime = 0;
    this.game.input.keys.clear();
    this.game.input.clearFrameState();
  }

  placeBryanBeyondFence() {
    const player = this.game.player;
    player.position.copy(FALLEN_POSITION);
    player.previousPosition.copy(FALLEN_POSITION);
    player.velocity.set(0, 0, 0);

    // Cut to a new prerendered angle from the far side of the same fence.
    this.backdrop.hidden = false;
    this.backdrop.src = FENCE_OPPOSITE_BACKDROP;
    this.camera.position.set(-5.45, 3.35, -7.75);
    this.camera.lookAt(new THREE.Vector3(0.05, 0.55, -2.45));

    // Bryan wakes up on the far side of the live 3D fence, flat on the snow.
    player.rotationY = 0.08;
    player.group.rotation.set(-Math.PI / 2, player.rotationY, 0);
    this.animateBryan(0, 'idle');
    this.game.bryanVisual.update(0);
  }

  startAfterShockDialogue() {
    if (this.afterShockDialogueStarted) return;
    this.afterShockDialogueStarted = true;
    this.game.dialogueManager.start([
      { speaker: 'Bryan', text: 'Maldita sea eso dolio... que pendejo' },
    ], () => this.beginGetUp());
  }

  beginGetUp() {
    this.state = 'gettingUp';
    this.transitionTime = 0;
    this.game.player.velocity.set(0, 0, 0);
  }

  updateGetUp(dt) {
    const player = this.game.player;
    this.transitionTime += dt;
    const duration = 1.65;
    const t = THREE.MathUtils.clamp(this.transitionTime / duration, 0, 1);

    // Two-stage recovery: roll onto a knee, then rise to a stable idle.
    const kneePhase = THREE.MathUtils.smoothstep(t, 0.0, 0.58);
    const standPhase = THREE.MathUtils.smoothstep(t, 0.46, 1.0);
    player.group.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, -0.38, kneePhase);
    player.group.rotation.z = Math.sin(t * Math.PI) * -0.16 * (1 - standPhase);
    player.group.rotation.y = THREE.MathUtils.lerp(0.08, -0.18, standPhase);
    player.position.y = THREE.MathUtils.lerp(0.12, 0.04, kneePhase);
    player.position.y = THREE.MathUtils.lerp(player.position.y, 0, standPhase);
    player.previousPosition.copy(player.position);
    player.animate(dt, true);
    this.game.bryanVisual.update(dt);

    if (t >= 1) {
      player.group.rotation.set(0, -0.18, 0);
      player.rotationY = -0.18;
      player.position.y = 0;
      player.previousPosition.copy(player.position);
      this.beginFarmPan();
    }
  }

  beginFarmPan() {
    this.state = 'farmPan';
    this.panTime = 0;
    this.fence.visible = false;
    this.game.player.group.visible = false;

    // Switch to the generated prerendered farm plate. No barn, tractor or house
    // geometry exists in Three.js; the camera movement is simulated on the plate.
    this.backdrop.hidden = false;
    this.backdrop.src = FARM_PRERENDER;
    Object.assign(this.backdrop.style, {
      width: '136%',
      height: '136%',
      objectFit: 'cover',
      objectPosition: 'center center',
      transformOrigin: '50% 50%',
      transform: 'translate3d(11%, 0, 0) scale(1.06)',
      willChange: 'transform',
      filter: 'brightness(.92) contrast(1.04) saturate(.88)',
    });
  }

  updateFarmPan(dt) {
    this.panTime += dt;
    const duration = 5.6;
    const t = THREE.MathUtils.clamp(this.panTime / duration, 0, 1);
    const eased = THREE.MathUtils.smoothstep(t, 0, 1);

    // Begin on the illuminated barn at the left, pass the tractor, and finish
    // on the yellow wooden house at the right of the same prerender.
    const x = THREE.MathUtils.lerp(11, -24, eased);
    const scale = THREE.MathUtils.lerp(1.06, 1.18, eased);
    this.backdrop.style.transform = `translate3d(${x}%, 0, 0) scale(${scale})`;

    if (t >= 1) {
      this.state = 'farmFadeOut';
      this.transitionTime = 0;
    }
  }

  switchToHouseClose() {
    this.state = 'houseFadeIn';
    this.transitionTime = 0;

    // Same prerendered location, now tightly framed on the yellow house at right.
    // Bryan stays off-screen: this shot represents what he is noticing.
    this.game.player.group.visible = false;
    this.backdrop.hidden = false;
    this.backdrop.src = FARM_PRERENDER;
    Object.assign(this.backdrop.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      transformOrigin: '84% 52%',
      transform: 'translate3d(-8%, 0%, 0) scale(2.15)',
      filter: 'brightness(.96) contrast(1.06) saturate(.92)',
    });
  }

  startHouseDialogue() {
    if (this.houseDialogueStarted) return;
    this.houseDialogueStarted = true;
    this.game.dialogueManager.start([
      { speaker: 'Bryan', text: 'Ahí...' },
    ], () => this.beginReturnToBryan());
  }

  beginReturnToBryan() {
    this.state = 'returnFadeOut';
    this.transitionTime = 0;
  }

  restoreBryanView() {
    const player = this.game.player;

    this.backdrop.hidden = false;
    this.backdrop.src = FENCE_OPPOSITE_BACKDROP;
    Object.assign(this.backdrop.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      transformOrigin: '50% 50%',
      transform: 'none',
      filter: 'brightness(.88) contrast(1.04) saturate(.84)',
    });

    this.fence.visible = true;
    player.group.visible = true;
    player.position.set(0.18, 0, -3.15);
    player.previousPosition.copy(player.position);
    player.rotationY = -0.18;
    player.group.rotation.set(0, player.rotationY, 0);
    player.velocity.set(0, 0, 0);
    player.animate(0, true);

    this.camera.position.set(-5.45, 3.35, -7.75);
    this.camera.lookAt(new THREE.Vector3(0.05, 0.55, -2.45));
    this.game.bryanVisual.update(0);
  }

  playGrowlSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const duration = 1.05;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      gain.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(78, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + duration);

      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(24, now);
      modGain.gain.setValueAtTime(12, now);
      mod.connect(modGain);
      modGain.connect(osc.frequency);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);
      filter.Q.setValueAtTime(2.6, now);

      osc.connect(filter);
      filter.connect(gain);

      osc.start(now);
      mod.start(now);
      osc.stop(now + duration);
      mod.stop(now + duration);

      osc.addEventListener('ended', () => ctx.close?.(), { once: true });
    } catch (error) {
      console.warn('Growl sound could not play:', error);
    }
  }

  startGrowlDialogue() {
    if (this.growlDialogueStarted) return;
    this.growlDialogueStarted = true;
    this.playGrowlSound();
    this.game.dialogueManager.start([
      { speaker: '???', text: 'Grrrrrrrr' },
    ], () => this.startBryanReaction());
  }

  startBryanReaction() {
    if (this.bryanReactionStarted) return;
    this.bryanReactionStarted = true;
    this.game.dialogueManager.start([
      { speaker: 'Bryan', text: '¿Qué diablos?' },
    ], () => this.beginCornfieldTransition());
  }

  beginCornfieldTransition() {
    this.state = 'cornfieldFadeOut';
    this.transitionTime = 0;
  }

  setupCornfieldScene() {
    const player = this.game.player;

    this.backdrop.hidden = false;
    this.backdrop.src = CORNFIELD_BACKDROP;
    Object.assign(this.backdrop.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      transformOrigin: '50% 50%',
      transform: 'none',
      filter: 'brightness(.86) contrast(1.08) saturate(.80)',
    });

    // This is a dog-only cinematic shot. Bryan must not appear here.
    this.fence.visible = false;
    player.group.visible = false;
    player.velocity.set(0, 0, 0);

    // Bring the dog much closer to camera so it reads as a real medium-sized dog
    // against the tall corn instead of a tiny distant prop.
    this.dog.visible = true;
    this.dog.scale.setScalar(1.42);
    this.dog.position.set(-1.75, 0.08, -2.85);
    this.dog.rotation.set(0, -Math.PI / 2, 0);
    this.dog.userData.phase = 0;

    this.camera.position.set(0.0, 2.45, 5.15);
    this.camera.lookAt(new THREE.Vector3(0.0, 0.95, -1.35));
  }

  startDogJump() {
    this.state = 'dogJump';
    this.dogJumpTime = 0;
    this.playGrowlSound();
  }

  animateDogRun(dt, intensity = 1) {
    if (!this.dog?.visible) return;
    this.dog.userData.phase += dt * 10.5 * intensity;
    const phase = this.dog.userData.phase;
    const legs = this.dog.userData.legs || [];
    legs.forEach((leg, index) => {
      const offset = index % 2 === 0 ? 0 : Math.PI;
      leg.rotation.z = Math.sin(phase + offset) * 0.72 * intensity;
    });
    this.dog.userData.body.position.y = 0.86 + Math.abs(Math.sin(phase * 2)) * 0.045 * intensity;
    this.dog.userData.head.rotation.z = -0.12 + Math.sin(phase * 2) * 0.06 * intensity;
    this.dog.userData.tail.rotation.z = Math.PI / 2.6 + Math.sin(phase * 1.7) * 0.20;
  }

  updateDogJump(dt) {
    this.dogJumpTime += dt;
    const duration = 0.95;
    const t = THREE.MathUtils.clamp(this.dogJumpTime / duration, 0, 1);
    const eased = THREE.MathUtils.smoothstep(t, 0, 1);

    const start = new THREE.Vector3(-1.75, 0.08, -2.85);
    const end = new THREE.Vector3(0.10, 0.0, -0.72);
    this.dog.position.lerpVectors(start, end, eased);
    this.dog.position.y += Math.sin(Math.PI * t) * 1.28;
    this.dog.rotation.y = -Math.PI / 2;
    this.animateDogRun(dt, 1.15);

    if (t >= 1) {
      this.dog.position.copy(end);
      this.state = 'dogLanding';
      this.dogLandingTime = 0;
    }
  }

  updateDogLanding(dt) {
    this.dogLandingTime += dt;
    this.animateDogRun(dt, 0.25);

    // Hold the landing just long enough for the player to read it, then cut.
    if (this.dogLandingTime >= 0.42) {
      this.state = 'dogCutFadeOut';
      this.transitionTime = 0;
    }
  }

  setupPlayableChaseScene() {
    const player = this.game.player;

    // Return to Bryan's side of the fence. This is gameplay again, not a cutscene.
    this.backdrop.hidden = false;
    this.backdrop.src = FENCE_OPPOSITE_BACKDROP;
    Object.assign(this.backdrop.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      transformOrigin: '50% 50%',
      transform: 'none',
      filter: 'brightness(.88) contrast(1.04) saturate(.84)',
    });

    this.fence.visible = true;
    player.group.visible = true;
    player.position.set(0.18, 0, -3.15);
    player.previousPosition.copy(player.position);
    player.rotationY = -0.18;
    player.group.rotation.set(0, player.rotationY, 0);
    player.velocity.set(0, 0, 0);
    player.animate(0, true);

    this.dog.visible = false;
    this.dog.scale.setScalar(0.58);
    this.biteCount = 0;
    this.biteCooldown = 0;
    this.chaseScene = 'fence';

    this.camera.position.set(-5.45, 3.35, -7.75);
    this.camera.lookAt(new THREE.Vector3(0.05, 0.55, -2.45));

    this.game.playerInputEnabled = true;
    this.game.input.keys.clear();
    this.game.input.clearFrameState();
    this.game.bryanVisual.update(0);
    this.chaseGrace = 0;
  }

  updatePlayableMovement(dt) {
    const player = this.game.player;
    player.update(this.game.input, dt);

    // Each fixed-camera plate has its own invisible fence corridor.
    // On the intermediate trail Bryan must run straight between the visible rails.
    if (this.chaseScene === 'barnPath') {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -0.68, 0.68);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -5.7, 4.0);
    } else {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -2.75, 2.65);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -7.15, 0.65);
    }

    // Crossing the down-screen/red-arrow edge streams the next fixed-camera
    // plate instead of stopping Bryan.
    if (this.chaseScene === 'fence' && player.position.z <= -6.65) {
      this.enterBarnPath();
    } else if (this.chaseScene === 'barnPath' && player.position.z <= -5.15) {
      this.enterBarnClose();
    }
    player.animate(dt, false);
  }

  enterBarnPath() {
    this.chaseScene = 'barnPath';
    this.barnProgress = 0;
    this.fence.visible = false;
    this.backdrop.src = BARN_PATH_PRERENDER;
    Object.assign(this.backdrop.style, {
      inset: '-6%',
      left: '-6%',
      top: '-6%',
      right: 'auto',
      bottom: 'auto',
      width: '112%',
      height: '112%',
      objectFit: 'cover',
      objectPosition: 'center center',
      transformOrigin: '50% 50%',
      transform: 'scale(1)',
      filter: 'brightness(.86) contrast(1.08) saturate(.80)',
    });
    const player = this.game.player;
    player.position.set(0.15, 0, 3.6);
    player.previousPosition.copy(player.position);
    this.camera.position.set(5.8, 3.35, 7.2);
    this.camera.lookAt(new THREE.Vector3(0, 0.75, -1.8));
  }

  enterBarnClose() {
    // Third chase plate: after the intermediate snowy path, the barn finally
    // fills more of the frame. This keeps the geography continuous instead of
    // teleporting Bryan straight from the fence to the barn.
    this.chaseScene = 'barnClose';
    this.backdrop.src = FARM_PRERENDER;
    Object.assign(this.backdrop.style, {
      inset: '-6%',
      left: '-6%',
      top: '-6%',
      right: 'auto',
      bottom: 'auto',
      width: '112%',
      height: '112%',
      objectFit: 'cover',
      objectPosition: '30% 52%',
      transformOrigin: '30% 52%',
      transform: 'scale(1.16)',
      filter: 'brightness(.84) contrast(1.10) saturate(.78)',
    });
    const player = this.game.player;
    player.position.set(0.10, 0, 3.45);
    player.previousPosition.copy(player.position);
    this.camera.position.set(5.15, 3.10, 6.45);
    this.camera.lookAt(new THREE.Vector3(-0.25, 0.78, -1.95));
  }

  showGameOver() {
    if (this.gameOverShown) return;
    this.gameOverShown = true;
    const overlay = document.createElement('div');
    overlay.dataset.role = 'electric-fence-game-over';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '40', display: 'grid',
      placeItems: 'center', background: 'rgba(0,0,0,.72)', opacity: '0',
      transition: 'opacity 900ms ease', pointerEvents: 'none',
    });
    const title = document.createElement('div');
    title.textContent = 'GAME OVER';
    Object.assign(title.style, {
      color: '#8f1010', fontFamily: 'serif', fontWeight: '700',
      fontSize: 'clamp(42px, 9vw, 92px)', letterSpacing: '.12em',
      textShadow: '0 2px 10px #000',
    });
    overlay.append(title);
    this.game.container.append(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    setTimeout(() => window.location.reload(), 3200);
  }

  collapseBryan() {
    this.state = 'collapsed';
    this.game.playerInputEnabled = false;
    this.mobileControls.hide();
    this.collapseTime = 0;
    this.postCollapseLeapTime = 0;
    const player = this.game.player;
    player.velocity.set(0, 0, 0);
    player.group.rotation.x = -Math.PI / 2;
    player.position.y = 0.10;
    player.previousPosition.copy(player.position);
  }

  spawnChaseDog() {
    const player = this.game.player;
    const forward = new THREE.Vector3(0, 0, -1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotationY)
      .normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    this.dog.position.copy(player.position)
      .addScaledVector(forward, -3.15)
      .addScaledVector(right, -0.70);
    this.dog.position.y = 0;
    this.dog.visible = true;
    this.dog.scale.setScalar(0.58);
    this.dog.userData.phase = 0;
    this.playGrowlSound();
  }

  updatePlayableChase(dt) {
    this.updatePlayableMovement(dt);
    if (this.state === 'collapsed') return;

    const player = this.game.player;
    this.biteCooldown = Math.max(0, this.biteCooldown - dt);

    if (this.chaseScene === 'barnPath') {
      // Continue the earlier farm pan visually while Bryan runs toward the same barn.
      this.barnProgress = THREE.MathUtils.clamp(this.barnProgress + Math.max(0, -player.velocity.z) * dt * 0.024, 0, 1);
      // Intermediate trail: keep the barn distant at first and let it grow only
      // gradually. The oversized plate stays beyond both viewport edges so no
      // pale/empty strip can appear on mobile.
      const scale = THREE.MathUtils.lerp(1.0, 1.08, this.barnProgress);
      this.backdrop.style.transform = `scale(${scale})`;
      player.position.x = THREE.MathUtils.clamp(player.position.x, -0.68, 0.68);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -5.7, 4.0);
    } else if (this.chaseScene === 'barnClose') {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -1.85, 1.85);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -5.6, 3.8);
    }

    const toPlayer = player.position.clone().sub(this.dog.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();

    if (distance > 0.001) {
      toPlayer.normalize();
      const dogSpeed = 3.35;
      this.dog.position.addScaledVector(toPlayer, dogSpeed * dt);
      this.dog.rotation.y = Math.atan2(-toPlayer.z, toPlayer.x);
    }

    // Attack reads as a leap/bite, with one hit per contact cooldown.
    if (distance < 0.92) {
      const leap = Math.sin(performance.now() * 0.018);
      this.dog.position.y = Math.max(0, leap) * 0.58;
      if (this.biteCooldown <= 0) {
        this.biteCooldown = 1.05;
        this.biteCount += 1;
        player.group.rotation.z = (this.biteCount % 2 ? -1 : 1) * 0.12;
        setTimeout(() => {
          if (this.state !== 'collapsed') player.group.rotation.z = 0;
        }, 180);
        if (this.biteCount >= 5) {
          this.collapseBryan();
          return;
        }
      }
    } else {
      this.dog.position.y = 0;
    }
    this.animateDogRun(dt, 1.25);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const game = this.game;
    const player = game.player;

    if (this.state === 'arriving') {
      player.previousPosition.copy(player.position);
      const toTarget = STOP.clone().sub(player.position);
      const distance = toTarget.length();

      if (distance > 0.025) {
        const step = Math.min(distance, WALK_SPEED * dt);
        toTarget.normalize();
        player.position.addScaledVector(toTarget, step);
        player.velocity.copy(toTarget).multiplyScalar(WALK_SPEED);
        player.animate(dt);
        this.animateBryan(dt, 'walk');
      } else {
        player.position.copy(STOP);
        player.previousPosition.copy(STOP);
        player.velocity.set(0, 0, 0);
        player.animate(dt, true);
        this.animateBryan(dt, 'idle');
        this.state = 'stopped';
        this.stopTime = 0;
      }
    } else if (this.state === 'shockFadeOut') {
      player.previousPosition.copy(player.position);
      player.velocity.set(0, 0, 0);
      player.animate(dt, true);
      this.animateBryan(dt, 'idle');

      this.transitionTime += dt;
      const fade = THREE.MathUtils.smoothstep(this.transitionTime, 0, 0.48);
      this.blackout.style.opacity = String(fade);

      if (this.transitionTime >= 0.50) {
        this.placeBryanBeyondFence();
        this.state = 'shockFadeIn';
        this.transitionTime = 0;
        this.blackout.style.opacity = '1';
      }
    } else if (this.state === 'shockFadeIn') {
      player.previousPosition.copy(player.position);
      player.velocity.set(0, 0, 0);
      player.animate(dt, true);
      this.animateBryan(dt, 'idle');

      this.transitionTime += dt;
      const reveal = 1 - THREE.MathUtils.smoothstep(this.transitionTime, 0.10, 0.70);
      this.blackout.style.opacity = String(reveal);

      if (this.transitionTime >= 0.72) {
        this.blackout.style.opacity = '0';
        this.state = 'fallenDialogue';
        this.startAfterShockDialogue();
      }
    } else if (this.state === 'gettingUp') {
      this.updateGetUp(dt);
    } else if (this.state === 'farmPan') {
      player.velocity.set(0, 0, 0);
      this.updateFarmPan(dt);
    } else if (this.state === 'farmFadeOut') {
      this.transitionTime += dt;
      const fade = THREE.MathUtils.smoothstep(this.transitionTime, 0, 0.44);
      this.blackout.style.opacity = String(fade);
      if (this.transitionTime >= 0.46) {
        this.blackout.style.opacity = '1';
        this.switchToHouseClose();
      }
    } else if (this.state === 'houseFadeIn') {
      player.velocity.set(0, 0, 0);
      this.transitionTime += dt;
      const reveal = 1 - THREE.MathUtils.smoothstep(this.transitionTime, 0.12, 0.68);
      this.blackout.style.opacity = String(reveal);
      if (this.transitionTime >= 0.70) {
        this.blackout.style.opacity = '0';
        this.state = 'houseDialogue';
        this.startHouseDialogue();
      }
    } else if (this.state === 'returnFadeOut') {
      player.velocity.set(0, 0, 0);
      this.transitionTime += dt;
      const fade = THREE.MathUtils.smoothstep(this.transitionTime, 0, 0.42);
      this.blackout.style.opacity = String(fade);
      if (this.transitionTime >= 0.44) {
        this.blackout.style.opacity = '1';
        this.restoreBryanView();
        this.state = 'returnFadeIn';
        this.transitionTime = 0;
      }
    } else if (this.state === 'returnFadeIn') {
      player.previousPosition.copy(player.position);
      player.velocity.set(0, 0, 0);
      player.animate(dt, true);
      this.transitionTime += dt;
      const reveal = 1 - THREE.MathUtils.smoothstep(this.transitionTime, 0.08, 0.58);
      this.blackout.style.opacity = String(reveal);
      if (this.transitionTime >= 0.60) {
        this.blackout.style.opacity = '0';
        this.state = 'growlDialogue';
        this.startGrowlDialogue();
      }
    } else if (this.state === 'cornfieldFadeOut') {
      player.velocity.set(0, 0, 0);
      this.transitionTime += dt;
      const fade = THREE.MathUtils.smoothstep(this.transitionTime, 0, 0.46);
      this.blackout.style.opacity = String(fade);
      if (this.transitionTime >= 0.48) {
        this.blackout.style.opacity = '1';
        this.setupCornfieldScene();
        this.state = 'cornfieldFadeIn';
        this.transitionTime = 0;
      }
    } else if (this.state === 'cornfieldFadeIn') {
      player.velocity.set(0, 0, 0);
      this.transitionTime += dt;
      const reveal = 1 - THREE.MathUtils.smoothstep(this.transitionTime, 0.12, 0.72);
      this.blackout.style.opacity = String(reveal);
      if (this.transitionTime >= 0.74) {
        this.blackout.style.opacity = '0';
        this.startDogJump();
      }
    } else if (this.state === 'dogJump') {
      player.velocity.set(0, 0, 0);
      this.updateDogJump(dt);
    } else if (this.state === 'dogLanding') {
      player.velocity.set(0, 0, 0);
      this.updateDogLanding(dt);
    } else if (this.state === 'dogCutFadeOut') {
      player.velocity.set(0, 0, 0);
      this.transitionTime += dt;
      const fade = THREE.MathUtils.smoothstep(this.transitionTime, 0, 0.38);
      this.blackout.style.opacity = String(fade);
      if (this.transitionTime >= 0.40) {
        this.blackout.style.opacity = '1';
        this.setupPlayableChaseScene();
        this.state = 'chaseFadeIn';
        this.transitionTime = 0;
      }
    } else if (this.state === 'chaseFadeIn') {
      player.previousPosition.copy(player.position);
      player.velocity.set(0, 0, 0);
      player.animate(dt, true);
      this.transitionTime += dt;
      const reveal = 1 - THREE.MathUtils.smoothstep(this.transitionTime, 0.10, 0.62);
      this.blackout.style.opacity = String(reveal);
      if (this.transitionTime >= 0.64) {
        this.blackout.style.opacity = '0';
        this.state = 'playableGrace';
        this.chaseGrace = 0;
        this.mobileControls.show();
      }
    } else if (this.state === 'playableGrace') {
      this.updatePlayableMovement(dt);
      this.chaseGrace += dt;
      if (this.chaseGrace >= 2.35) {
        this.spawnChaseDog();
        this.state = 'playableChase';
      }
    } else if (this.state === 'playableChase') {
      this.updatePlayableChase(dt);
    } else if (this.state === 'collapsed') {
      player.velocity.set(0, 0, 0);
      player.previousPosition.copy(player.position);
      this.collapseTime += dt;
      this.postCollapseLeapTime += dt;

      // The dog no longer pogo-jumps. It pauses, then makes a short deliberate
      // lunge, lands, and waits before the next one.
      const cycle = 1.75;
      const phase = this.postCollapseLeapTime % cycle;
      if (phase < 0.48) {
        const t = phase / 0.48;
        this.dog.position.y = Math.sin(Math.PI * t) * 0.52;
        this.animateDogRun(dt, 0.72);
      } else {
        this.dog.position.y = 0;
        this.animateDogRun(dt, 0.10);
      }

      if (this.collapseTime >= 2.25) this.showGameOver();
    } else {
      player.velocity.set(0, 0, 0);
      if (this.state !== 'houseDialogue' && this.state !== 'houseHolding') {
        player.previousPosition.copy(player.position);
        player.animate(dt, true);
        this.animateBryan(dt, 'idle');
      }

      if (this.state === 'stopped') {
        this.stopTime += dt;
        if (this.stopTime >= 0.35) this.startDialogue();
      }
    }

    // Player.animate() stores the movement speed; BryanModel consumes it here.
    if (![
      'gettingUp', 'farmPan', 'farmFadeOut', 'houseFadeIn', 'houseDialogue',
      'returnFadeOut', 'cornfieldFadeOut', 'cornfieldFadeIn', 'dogJump',
      'dogLanding', 'dogCutFadeOut',
    ].includes(this.state)) {
      game.bryanVisual.update(dt);
    }
    if (game.dialogueManager.isOpen) game.dialogueManager.update();

    this.render();
    game.input.clearFrameState();
  }

  destroy() {
    this.animateBryan(1, 'idle');

    if (this.originalParent) this.originalParent.add(this.game.player.group);
    this.game.player.position.copy(this.originalPosition);
    this.game.player.previousPosition.copy(this.originalPosition);
    this.game.player.rotationY = this.originalRotation;
    this.game.player.group.rotation.copy(this.originalGroupRotation);
    this.game.player.group.visible = this.originalVisible;
    this.game.player.velocity.set(0, 0, 0);

    this.game.renderer.domElement.style.visibility = this.originalGameCanvasVisibility;
    this.mobileControls?.destroy();
    this.renderer?.dispose();
    this.blackout?.remove();
    this.root?.remove();
  }
}
