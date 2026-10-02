import * as THREE from 'three';

const FENCE_BACKDROP = new URL(
  '../../assets/backgrounds/forest/forest_crash_clean.jpg',
  import.meta.url,
).href;

const ASPECT = 4 / 3;
const WALK_SPEED = 0.92;
const START = new THREE.Vector3(-0.85, 0, 3.65);
const STOP = new THREE.Vector3(-0.20, 0, -0.35);

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

// Independent fixed-camera capsule.
// The prerendered plate is DOM art; Bryan and the fence are rendered as real 3D
// on a transparent WebGL canvas layered above it.
export class ElectricFenceSequence {
  constructor(game) {
    this.game = game;
    this.state = 'arriving';
    this.stopTime = 0;
    this.dialogueStarted = false;
    this.rigAnimationEnabled = true;

    this.originalParent = game.player.group.parent;
    this.originalPosition = game.player.position.clone();
    this.originalRotation = game.player.rotationY;
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
      filter: 'brightness(.72) contrast(1.08) saturate(.72)',
      userSelect: 'none',
    });
    this.backdrop.addEventListener('error', () => {
      console.error('Electric fence backdrop failed to load:', FENCE_BACKDROP);
      this.backdrop.hidden = true;
    }, { once: true });

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
    ], () => {
      this.state = 'holding';
    });
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
    } else {
      player.previousPosition.copy(player.position);
      player.velocity.set(0, 0, 0);
      player.animate(dt, true);
      this.animateBryan(dt, 'idle');

      if (this.state === 'stopped') {
        this.stopTime += dt;
        if (this.stopTime >= 0.35) this.startDialogue();
      }
    }

    game.bryanVisual.update();
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
    this.game.player.group.rotation.y = this.originalRotation;
    this.game.player.group.visible = this.originalVisible;
    this.game.player.velocity.set(0, 0, 0);

    this.game.renderer.domElement.style.visibility = this.originalGameCanvasVisibility;
    this.renderer?.dispose();
    this.root?.remove();
  }
}
