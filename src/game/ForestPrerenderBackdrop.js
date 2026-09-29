import * as THREE from 'three';

const ATLAS_URL = 'assets/backgrounds/forest/forest_prerender_atlas.jpg';

// The atlas is 3x2. Each shot also carries a small presentation calibration so
// Bryan reads at a believable scale against the baked environment.
const SHOTS = {
  CAM_CRASH_EXIT: {
    col: 0, row: 0, zoom: 1.05, actorScale: 0.94,
  },
  CAM_BLOOD_TRAIL: {
    col: 2, row: 0, zoom: 1.055, actorScale: 0.90,
  },
  CAM_FOREST_A: {
    col: 1, row: 0, zoom: 1.06, actorScale: 0.89,
  },
  CAM_FOREST_B: {
    col: 0, row: 1, zoom: 1.06, actorScale: 0.84,
  },
  CAM_FOREST_C: {
    col: 1, row: 1, zoom: 1.07, actorScale: 0.82,
  },
  CAM_FOREST_D: {
    col: 0, row: 1, zoom: 1.13, actorScale: 0.80, flipX: true, offsetX: -0.22,
  },
  CAM_FOREST_BODY: {
    col: 2, row: 1, zoom: 1.055, actorScale: 0.86,
  },
};

export class ForestPrerenderBackdrop {
  constructor(scene, camera, actorRoot = null) {
    this.scene = scene;
    this.camera = camera;
    this.actorRoot = actorRoot;
    this.loader = new THREE.TextureLoader();
    this.distance = 28;
    this.cache = new Map();
    this.hidden = new Map();
    this.currentZoneId = null;
    this.ready = false;

    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    });

    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.plane.name = 'forest-prerender-backplate';
    this.plane.renderOrder = -10000;
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
        texture => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.magFilter = THREE.LinearFilter;
          texture.minFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;

          const insetX = 0.0015;
          const insetY = 0.0025;
          const tileW = (1 / 3) - insetX * 2;
          const tileH = 0.5 - insetY * 2;

          for (const [zoneId, shot] of Object.entries(SHOTS)) {
            const crop = texture.clone();
            crop.colorSpace = THREE.SRGBColorSpace;
            crop.wrapS = THREE.ClampToEdgeWrapping;
            crop.wrapT = THREE.ClampToEdgeWrapping;
            crop.magFilter = THREE.LinearFilter;
            crop.minFilter = THREE.LinearFilter;
            crop.generateMipmaps = false;

            if (shot.flipX) {
              crop.repeat.set(-tileW, tileH);
              crop.offset.set(
                (shot.col + 1) / 3 - insetX,
                shot.row === 0 ? 0.5 + insetY : insetY,
              );
            } else {
              crop.repeat.set(tileW, tileH);
              crop.offset.set(
                shot.col / 3 + insetX,
                shot.row === 0 ? 0.5 + insetY : insetY,
              );
            }

            crop.needsUpdate = true;
            this.cache.set(zoneId, crop);
          }

          this.ready = true;
          resolve(true);
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
    const scale = this.getActorScale(zoneId);
    actorRoot.scale.setScalar(scale);
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
    if (!texture) return;

    if (this.material.map !== texture) {
      this.material.map = texture;
      this.material.needsUpdate = true;
    }

    this.plane.visible = true;
    this.updateTransform(SHOTS[zoneId]);
    this.applyHide();
  }

  updateTransform(shot) {
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(this.camera.quaternion);

    this.plane.position.copy(this.camera.position)
      .addScaledVector(direction, this.distance)
      .addScaledVector(right, shot.offsetX ?? 0)
      .addScaledVector(up, shot.offsetY ?? 0);
    this.plane.quaternion.copy(this.camera.quaternion);

    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const viewHeight = 2 * Math.tan(fov / 2) * this.distance;
    const viewWidth = viewHeight * this.camera.aspect;
    const imageAspect = 16 / 9;

    let width = viewWidth;
    let height = width / imageAspect;
    if (height < viewHeight) {
      height = viewHeight;
      width = height * imageAspect;
    }

    const zoom = shot.zoom ?? 1;
    this.plane.scale.set(width * zoom, height * zoom, 1);
  }

  applyHide() {
    this.restoreHidden();

    this.scene.traverse(object => {
      if (object === this.plane || !object.visible) return;
      if (object.isPoints) return; // real storm stays animated over the image
      if (!(object.isMesh || object.isSprite || object.isLine)) return;
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
      if (object?.uuid && this.hidden.has(object.uuid)) {
        object.visible = this.hidden.get(object.uuid);
      }
    });
    this.hidden.clear();
  }

  disable() {
    this.currentZoneId = null;
    this.plane.visible = false;
    this.restoreHidden();
    this.resetActorCalibration(this.actorRoot);
  }

  onResize() {
    if (this.currentZoneId && this.plane.visible) {
      this.updateTransform(SHOTS[this.currentZoneId]);
    }
  }
}
