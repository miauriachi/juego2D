import * as THREE from 'three';

const ATLAS_URL = 'assets/backgrounds/forest/forest_prerender_atlas.jpg';

const SHOTS = {
  CAM_CRASH_EXIT: { col: 0, row: 0, zoom: 1.03, actorScale: 0.94 },
  CAM_BLOOD_TRAIL: { col: 2, row: 0, zoom: 1.03, actorScale: 0.90 },
  CAM_FOREST_A: { col: 1, row: 0, zoom: 1.04, actorScale: 0.89 },
  CAM_FOREST_B: { col: 0, row: 1, zoom: 1.04, actorScale: 0.84 },
  CAM_FOREST_C: { col: 1, row: 1, zoom: 1.04, actorScale: 0.82 },
  CAM_FOREST_D: { col: 0, row: 1, zoom: 1.12, actorScale: 0.80, flipX: true },
  CAM_FOREST_BODY: { col: 2, row: 1, zoom: 1.03, actorScale: 0.86 },
};

function makeShotTexture(image, shot) {
  const cols = 3;
  const rows = 2;
  const tileW = Math.floor(image.width / cols);
  const tileH = Math.floor(image.height / rows);

  const canvas = document.createElement('canvas');
  canvas.width = tileW;
  canvas.height = tileH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.save();
  if (shot.flipX) {
    ctx.translate(tileW, 0);
    ctx.scale(-1, 1);
  }

  const sx = shot.col * tileW;
  // Canvas uses top-left origin. row 0 = top row, row 1 = bottom row.
  const sy = shot.row * tileH;

  ctx.drawImage(
    image,
    sx, sy, tileW, tileH,
    0, 0, tileW, tileH,
  );
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export class ForestPrerenderBackdrop {
  constructor(scene, camera, actorRoot = null) {
    this.scene = scene;
    this.camera = camera;
    this.actorRoot = actorRoot;
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.hidden = new Map();
    this.currentZoneId = null;
    this.currentKey = null;
    this.ready = false;
    this.distance = 36;

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });

    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    this.plane.name = 'forest-prerender-backplate';
    this.plane.renderOrder = -1000;
    this.plane.frustumCulled = false;
    this.plane.visible = false;
    this.plane.userData.preserveForForestBackplate = true;
    scene.add(this.plane);
  }

  preload() {
    if (this.promise) return this.promise;

    this.promise = new Promise(resolve => {
      this.loader.load(
        ATLAS_URL,
        atlas => {
          const image = atlas.image;
          if (!image?.width || !image?.height) {
            console.warn('Forest prerender atlas loaded without image dimensions.');
            resolve(false);
            return;
          }

          for (const [zoneId, shot] of Object.entries(SHOTS)) {
            const texture = makeShotTexture(image, shot);
            if (texture) this.cache.set(zoneId, texture);
          }

          this.ready = this.cache.size > 0;
          resolve(this.ready);
        },
        undefined,
        error => {
          console.warn('Forest prerender atlas failed to load.', error);
          resolve(false);
        },
      );
    });

    return this.promise;
  }

  hasShot(zoneId) {
    return Boolean(SHOTS[zoneId]);
  }

  getActorScale(zoneId) {
    return SHOTS[zoneId]?.actorScale ?? 1;
  }

  applyActorCalibration(actorRoot, zoneId = this.currentZoneId) {
    if (!actorRoot) return;
    actorRoot.scale.setScalar(this.getActorScale(zoneId));
  }

  resetActorCalibration(actorRoot) {
    if (actorRoot) actorRoot.scale.set(1, 1, 1);
  }

  update(zoneId) {
    if (!this.hasShot(zoneId)) {
      this.disable();
      return;
    }

    this.currentZoneId = zoneId;

    if (!this.ready) {
      this.preload().then(ok => {
        if (ok && this.currentZoneId === zoneId) this.update(zoneId);
      });
      return;
    }

    const texture = this.cache.get(zoneId);
    if (!texture) {
      this.disable();
      return;
    }

    if (this.currentKey !== zoneId || this.plane.material.map !== texture) {
      this.currentKey = zoneId;
      this.plane.material.map = texture;
      this.plane.material.needsUpdate = true;
    }

    this.plane.visible = true;
    this.updatePlaneTransform(SHOTS[zoneId]);
    this.updatePlaneScale(SHOTS[zoneId]);
    this.applyHide();
  }

  updatePlaneTransform(config) {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    this.plane.position.copy(this.camera.position)
      .addScaledVector(direction, this.distance)
      .addScaledVector(right, config.offsetX ?? 0)
      .addScaledVector(up, config.offsetY ?? 0);
    this.plane.quaternion.copy(this.camera.quaternion);
  }

  updatePlaneScale(config) {
    const texture = this.plane.material.map;
    if (!texture?.image) return;

    const imageAspect = texture.image.width / texture.image.height;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const viewHeight = 2 * Math.tan(fov / 2) * this.distance;
    const viewWidth = viewHeight * this.camera.aspect;

    let width = viewWidth;
    let height = width / imageAspect;

    if (height < viewHeight) {
      height = viewHeight;
      width = height * imageAspect;
    }

    const zoom = config.zoom ?? 1;
    this.plane.scale.set(width * zoom, height * zoom, 1);
  }

  applyHide() {
    this.restoreHidden();

    this.scene.traverse(object => {
      if (
        !(object.isMesh || object.isSprite || object.isLine || object.isPoints) ||
        object === this.plane ||
        !object.visible
      ) {
        return;
      }

      // Snow stays live over the prerender.
      if (object.isPoints) return;
      if (this.isActor(object)) return;
      if (this.isPreserved(object)) return;

      this.hidden.set(object.uuid, object.visible);
      object.visible = false;
    });
  }

  isActor(object) {
    for (let node = object; node; node = node.parent) {
      if (this.actorRoot && node === this.actorRoot) return true;
      if (
        node.name === 'player' ||
        node.name === 'bryanModel' ||
        node.name === 'bryan-model' ||
        node.name === 'BryanRiggedMesh'
      ) {
        return true;
      }
    }
    return false;
  }

  isPreserved(object) {
    for (let node = object; node; node = node.parent) {
      if (node.userData?.preserveForForestBackplate) return true;
    }
    return false;
  }

  restoreHidden() {
    if (!this.hidden.size) return;

    this.scene.traverse(object => {
      if (!object?.uuid || !this.hidden.has(object.uuid)) return;
      object.visible = this.hidden.get(object.uuid);
    });

    this.hidden.clear();
  }

  disable() {
    this.currentKey = null;
    this.currentZoneId = null;
    this.plane.visible = false;
    this.restoreHidden();
    this.resetActorCalibration(this.actorRoot);
  }

  onResize() {
    if (this.currentZoneId && this.plane.visible) {
      this.updatePlaneTransform(SHOTS[this.currentZoneId]);
      this.updatePlaneScale(SHOTS[this.currentZoneId]);
    }
  }
}
