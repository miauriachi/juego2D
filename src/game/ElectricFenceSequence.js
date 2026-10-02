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
    new THREE.MeshBasicMaterial({ map: makeWarningTexture(), transparent: false }),
  );
  warning.position.set(0, 0.84, fenceZ + 0.102);
  warning.rotation.z = -0.035;
  fence.add(warning);

  return fence;
}

// Isolated fixed-camera capsule. Background is a prerendered plate; Bryan and the
// cattle fence remain real Three.js layers so this sequence can be moved later.
export class ElectricFenceSequence {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09111b);
    this.scene.fog = new THREE.Fog(0x0b1420, 16, 38);
    this.state = 'arriving';
    this.stopTime = 0;
    this.dialogueStarted = false;

    this.originalParent = game.player.group.parent;
    this.originalPosition = game.player.position.clone();
    this.originalRotation = game.player.rotationY;
    this.originalVisible = game.player.group.visible;

    game.playerInputEnabled = false;
    game.objective.hidden = true;
    game.dialogueManager.setHint('');
    game.container.classList.remove('driving-mode');
    game.input.keys.clear();
    game.input.clearFrameState();

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

    this.scene.add(new THREE.HemisphereLight(0x8ea9c2, 0x10151b, 1.45));
    this.scene.add(new THREE.AmbientLight(0x6e7e90, 0.34));

    const moon = new THREE.DirectionalLight(0xaec8df, 2.35);
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
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    shadowGround.rotation.x = -Math.PI / 2;
    shadowGround.position.y = 0.005;
    shadowGround.receiveShadow = true;
    this.scene.add(shadowGround);

    this.fence = makeFence();
    this.scene.add(this.fence);

    const loader = new THREE.TextureLoader();
    loader.load(FENCE_BACKDROP, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.LinearFilter;
      this.scene.background = texture;
    }, undefined, error => {
      console.error('Electric fence backdrop failed to load:', FENCE_BACKDROP, error);
    });

    game.bryanVisual?.setRigMotion?.('walk');
    this.onResize();
  }

  onResize() {
    this.camera.aspect = ASPECT;
    this.camera.updateProjectionMatrix();
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
        game.bryanVisual?.setRigMotion?.('walk');
        game.bryanVisual?.animateRig?.(dt, 'walk');
      } else {
        player.position.copy(STOP);
        player.previousPosition.copy(STOP);
        player.velocity.set(0, 0, 0);
        player.animate(dt, true);
        game.bryanVisual?.setRigMotion?.('idle');
        game.bryanVisual?.animateRig?.(dt, 'idle');
        this.state = 'stopped';
        this.stopTime = 0;
      }
    } else {
      player.previousPosition.copy(player.position);
      player.velocity.set(0, 0, 0);
      player.animate(dt, true);
      game.bryanVisual?.setRigMotion?.('idle');
      game.bryanVisual?.animateRig?.(dt, 'idle');

      if (this.state === 'stopped') {
        this.stopTime += dt;
        if (this.stopTime >= 0.35) this.startDialogue();
      }
    }

    game.bryanVisual.update();

    if (game.dialogueManager.isOpen) game.dialogueManager.update();

    const width = window.innerWidth;
    const height = window.innerHeight;
    const viewWidth = Math.min(width, height * ASPECT);
    const viewHeight = viewWidth / ASPECT;
    const viewX = (width - viewWidth) / 2;
    const viewY = (height - viewHeight) / 2;

    game.renderer.setScissorTest(false);
    game.renderer.setViewport(0, 0, width, height);
    game.renderer.setClearColor(0x000000, 1);
    game.renderer.clear(true, true, true);
    game.renderer.setViewport(viewX, viewY, viewWidth, viewHeight);
    game.renderer.setScissor(viewX, viewY, viewWidth, viewHeight);
    game.renderer.setScissorTest(true);
    game.renderer.render(this.scene, this.camera);
    game.renderer.setScissorTest(false);

    game.input.clearFrameState();
  }

  destroy() {
    this.game.bryanVisual?.setRigMotion?.('idle');
    this.game.bryanVisual?.animateRig?.(1, 'idle');
    if (this.originalParent) this.originalParent.add(this.game.player.group);
    this.game.player.position.copy(this.originalPosition);
    this.game.player.previousPosition.copy(this.originalPosition);
    this.game.player.rotationY = this.originalRotation;
    this.game.player.group.rotation.y = this.originalRotation;
    this.game.player.group.visible = this.originalVisible;
    this.game.player.velocity.set(0, 0, 0);
  }
}
