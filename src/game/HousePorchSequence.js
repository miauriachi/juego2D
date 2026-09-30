import * as THREE from 'three';

const PORCH_BACKDROP = new URL(
  '../../assets/backgrounds/house/house_porch_ps1.jpg',
  import.meta.url,
).href;

// Self-contained fixed-camera capsule for the yellow wooden house porch.
// It intentionally owns only presentation, local movement bounds and rendering,
// so it can be moved to a later chapter without touching the hospital/road flow.
export class HousePorchSequence {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020304);
    this.ready = false;

    const loader = new THREE.TextureLoader();
    loader.load(
      PORCH_BACKDROP,
      texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture = texture;
        this.scene.background = texture;
        this.ready = true;
      },
      undefined,
      error => console.warn('House porch backdrop failed to load:', error),
    );

    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 40);
    this.camera.position.set(0.05, 2.35, 7.2);
    this.camera.lookAt(new THREE.Vector3(0, 1.0, 0));

    this.scene.add(new THREE.HemisphereLight(0xd6c4a0, 0x111720, 1.0));
    const porchLight = new THREE.PointLight(0xffc56f, 10, 10, 2);
    porchLight.position.set(0.2, 3.3, 2.2);
    this.scene.add(porchLight);

    const moonFill = new THREE.DirectionalLight(0x7791ad, 0.75);
    moonFill.position.set(-4, 6, 4);
    this.scene.add(moonFill);

    const p = game.player;
    p.group.removeFromParent();
    this.scene.add(p.group);
    p.group.scale.setScalar(0.94);
    p.position.set(-1.55, 0, 0.65);
    p.previousPosition.copy(p.position);
    p.velocity.set(0, 0, 0);
    p.rotationY = 0.12;
    p.group.rotation.y = p.rotationY;
    p.group.visible = true;

    this.spawn = p.position.clone();
    this.doorPoint = new THREE.Vector3(0.05, 0, -1.0);
    this.bounds = {
      minX: -2.75,
      maxX: 2.75,
      minZ: -1.25,
      maxZ: 1.45,
    };

    game.container.classList.remove('driving-mode');
    game.objective.hidden = false;
    game.objective.textContent = 'OBJETIVO: Explora la entrada de la casa.';
    game.dialogueManager.setHint('');
  }

  onResize() {
    this.camera.aspect = 16 / 9;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    const g = this.game;
    const p = g.player;

    p.update(g.input, dt);

    p.position.x = THREE.MathUtils.clamp(
      p.position.x,
      this.bounds.minX,
      this.bounds.maxX,
    );
    p.position.z = THREE.MathUtils.clamp(
      p.position.z,
      this.bounds.minZ,
      this.bounds.maxZ,
    );

    p.animate(dt);
    g.bryanVisual.update(dt);

    const nearDoor = p.position.distanceTo(this.doorPoint) < 1.05;
    g.objective.textContent = 'OBJETIVO: Explora la entrada de la casa.';
    g.dialogueManager.setHint(
      nearDoor
        ? '[E] Examinar la puerta'
        : 'W/S · Caminar   A/D · Girar   Shift · Correr',
    );

    // Keep the capsule non-destructive for now. The interaction is only a QA
    // marker until the later house chapter is connected.
    if (nearDoor && g.input.isJustPressed('KeyE')) {
      g.dialogueManager.setHint('La puerta está cerrada.');
      g.audio?.playCue('door_locked');
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const viewWidth = Math.min(width, height * (16 / 9));
    const viewHeight = viewWidth / (16 / 9);
    const x = (width - viewWidth) / 2;
    const y = (height - viewHeight) / 2;

    g.renderer.setScissorTest(false);
    g.renderer.setViewport(0, 0, width, height);
    g.renderer.setClearColor(0x000000, 1);
    g.renderer.clear();

    g.renderer.setViewport(x, y, viewWidth, viewHeight);
    g.renderer.setScissor(x, y, viewWidth, viewHeight);
    g.renderer.setScissorTest(true);
    g.renderer.render(this.scene, this.camera);
    g.renderer.setScissorTest(false);

    g.input.clearFrameState();
  }
}
