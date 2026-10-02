import * as THREE from 'three';

const FENCE_BACKDROP = new URL(
  '../../assets/backgrounds/fence/electric_fence_clean.webp',
  import.meta.url,
).href;

const FENCE_OPPOSITE_BACKDROP = new URL(
  '../../assets/backgrounds/fence/electric_fence_opposite.webp',
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

function makeFarmSet() {
  const farm = new THREE.Group();
  farm.name = 'farm-continuity-set';

  const woodDark = new THREE.MeshLambertMaterial({ color: 0x241812, flatShading: true });
  const woodWarm = new THREE.MeshLambertMaterial({ color: 0x4a2e1c, flatShading: true });
  const yellowWood = new THREE.MeshLambertMaterial({ color: 0x8d6a35, flatShading: true });
  const roof = new THREE.MeshLambertMaterial({ color: 0x191d21, flatShading: true });
  const snow = new THREE.MeshLambertMaterial({ color: 0xb9c8cf, flatShading: true });
  const metal = new THREE.MeshLambertMaterial({ color: 0x4b351f, flatShading: true });
  const tire = new THREE.MeshLambertMaterial({ color: 0x111214, flatShading: true });
  const warmGlow = new THREE.MeshBasicMaterial({ color: 0xffc46a });

  // Barn — left side, slightly closer than the house.
  const barn = new THREE.Group();
  barn.name = 'farm-barn';
  const barnBody = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.1, 3.3), woodDark);
  barnBody.position.y = 1.55;
  barnBody.castShadow = true; barnBody.receiveShadow = true;
  barn.add(barnBody);

  const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.7, 4), roof);
  barnRoof.rotation.y = Math.PI / 4;
  barnRoof.scale.z = 0.76;
  barnRoof.position.y = 3.95;
  barnRoof.castShadow = true;
  barn.add(barnRoof);

  const barnDoorLeft = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.35, 0.12), woodWarm);
  barnDoorLeft.position.set(-0.62, 1.18, 1.69);
  barnDoorLeft.rotation.y = -0.24;
  const barnDoorRight = barnDoorLeft.clone();
  barnDoorRight.position.x = 0.72;
  barnDoorRight.rotation.y = 0.58;
  barn.add(barnDoorLeft, barnDoorRight);

  const barnLamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.18), warmGlow);
  barnLamp.position.set(0, 2.78, 1.78);
  barn.add(barnLamp);
  const barnLight = new THREE.PointLight(0xffb75f, 8.5, 7.5, 2);
  barnLight.position.set(0, 2.55, 2.05);
  barn.add(barnLight);

  const barnSnow = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.10, 0.30), snow);
  barnSnow.position.set(0, 4.28, 0.15);
  barnSnow.rotation.z = -0.02;
  barn.add(barnSnow);
  barn.position.set(-5.8, 0, -7.2);
  barn.rotation.y = 0.10;
  farm.add(barn);

  // Old tractor — right foreground, close to Bryan's recovery point.
  const tractor = new THREE.Group();
  tractor.name = 'farm-tractor';
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.58, 1.25), metal);
  chassis.position.y = 0.92;
  chassis.castShadow = true;
  tractor.add(chassis);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.72, 1.02), metal);
  hood.position.set(-0.55, 1.38, 0);
  hood.castShadow = true;
  tractor.add(hood);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.50, 0.55), woodDark);
  seat.position.set(0.58, 1.55, 0);
  tractor.add(seat);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 1.18, 6), tire);
  exhaust.position.set(-0.72, 2.02, -0.34);
  tractor.add(exhaust);
  [[-0.72, 0.58, -0.72], [-0.72, 0.58, 0.72], [0.78, 0.64, -0.78], [0.78, 0.64, 0.78]].forEach(([x,y,z], i) => {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(i < 2 ? 0.52 : 0.70, i < 2 ? 0.52 : 0.70, 0.28, 8),
      tire,
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    tractor.add(wheel);
  });
  tractor.position.set(2.6, 0, -4.25);
  tractor.rotation.y = -0.26;
  farm.add(tractor);

  // Yellow wooden house — farther right and deeper in the field.
  const house = new THREE.Group();
  house.name = 'yellow-farm-house';
  const houseBody = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.6, 3.6), yellowWood);
  houseBody.position.y = 1.8;
  houseBody.castShadow = true; houseBody.receiveShadow = true;
  house.add(houseBody);
  const houseRoof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.0, 4), roof);
  houseRoof.rotation.y = Math.PI / 4;
  houseRoof.scale.z = 0.72;
  houseRoof.position.y = 4.55;
  houseRoof.castShadow = true;
  house.add(houseRoof);

  const porch = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 1.25), woodDark);
  porch.position.set(-0.35, 0.12, 2.05);
  porch.receiveShadow = true;
  house.add(porch);

  const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.15, 0.10), woodDark);
  frontDoor.position.set(-0.45, 1.20, 1.84);
  house.add(frontDoor);

  [[-1.72, 2.30], [1.35, 2.30], [1.35, 1.15]].forEach(([x,y]) => {
    const window = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.92), warmGlow);
    window.position.set(x, y, 1.826);
    house.add(window);
  });
  const porchLamp = new THREE.PointLight(0xffb45e, 6.8, 8, 2);
  porchLamp.position.set(-0.45, 2.25, 2.25);
  house.add(porchLamp);

  house.position.set(6.4, 0, -10.6);
  house.rotation.y = -0.12;
  farm.add(house);

  farm.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return { farm, barn, tractor, house };
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
    this.transitionTime = 0;
    this.panTime = 0;
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

    const farmSet = makeFarmSet();
    this.farm = farmSet.farm;
    this.barn = farmSet.barn;
    this.tractor = farmSet.tractor;
    this.house = farmSet.house;
    this.farm.visible = false;
    this.scene.add(this.farm);

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
    this.farm.visible = true;
    this.game.player.group.visible = false;

    // Start on the open barn door and its lamp.
    this.camera.position.set(-9.6, 3.7, 3.8);
    this.camera.lookAt(new THREE.Vector3(-5.7, 1.8, -7.0));
  }

  updateFarmPan(dt) {
    this.panTime += dt;
    const duration = 5.6;
    const t = THREE.MathUtils.clamp(this.panTime / duration, 0, 1);
    const eased = THREE.MathUtils.smoothstep(t, 0, 1);

    const startPos = new THREE.Vector3(-9.6, 3.7, 3.8);
    const endPos = new THREE.Vector3(9.5, 3.45, 2.0);
    const startLook = new THREE.Vector3(-5.7, 1.8, -7.0);
    const endLook = new THREE.Vector3(6.2, 1.9, -10.4);

    this.camera.position.lerpVectors(startPos, endPos, eased);
    const look = new THREE.Vector3().lerpVectors(startLook, endLook, eased);
    this.camera.lookAt(look);

    if (t >= 1) {
      this.state = 'farmFadeOut';
      this.transitionTime = 0;
    }
  }

  switchToHouseClose() {
    this.state = 'houseFadeIn';
    this.transitionTime = 0;

    // Same yellow house, now framed much closer after the brief blackout.
    this.camera.position.set(9.2, 2.65, -3.6);
    this.camera.lookAt(new THREE.Vector3(6.25, 1.75, -10.45));

    const player = this.game.player;
    player.group.visible = true;
    player.position.set(3.55, 0, -6.55);
    player.previousPosition.copy(player.position);
    player.rotationY = -0.34;
    player.group.rotation.set(0, player.rotationY, 0);
    player.velocity.set(0, 0, 0);
    player.animate(0, true);
    this.game.bryanVisual.update(0);
  }

  startHouseDialogue() {
    if (this.houseDialogueStarted) return;
    this.houseDialogueStarted = true;
    this.game.dialogueManager.start([
      { speaker: 'Bryan', text: 'Ahí...' },
    ], () => {
      this.state = 'houseHolding';
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
      player.previousPosition.copy(player.position);
      player.velocity.set(0, 0, 0);
      player.animate(dt, true);
      this.transitionTime += dt;
      const reveal = 1 - THREE.MathUtils.smoothstep(this.transitionTime, 0.12, 0.68);
      this.blackout.style.opacity = String(reveal);
      if (this.transitionTime >= 0.70) {
        this.blackout.style.opacity = '0';
        this.state = 'houseDialogue';
        this.startHouseDialogue();
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

    // Player.animate() stores the movement speed; BryanModel consumes it here.
    if (this.state !== 'gettingUp') game.bryanVisual.update(dt);
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
    this.renderer?.dispose();
    this.blackout?.remove();
    this.root?.remove();
  }
}
