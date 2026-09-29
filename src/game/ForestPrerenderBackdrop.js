import * as THREE from 'three';
import scene1 from '../environment/forestShots/forestScene1.js';
import scene2 from '../environment/forestShots/forestScene2.js';
import scene3 from '../environment/forestShots/forestScene3.js';
import scene4 from '../environment/forestShots/forestScene4.js';
import scene5 from '../environment/forestShots/forestScene5.js';
import scene6 from '../environment/forestShots/forestScene6.js';

// Full-resolution individual shots. No atlas crops, no canvas resampling.
// Every texture is a 1280x720 prerender embedded as a data URI.
const BRYAN_WORLD_HEIGHT = 1.72;

const SHOTS = {
  CAM_CRASH_EXIT: {
    key: 'scene1', url: scene1, zoom: 1.025, targetScreenHeight: 0.225,
  },
  CAM_BLOOD_TRAIL: {
    key: 'scene2', url: scene2, zoom: 1.025, targetScreenHeight: 0.210,
  },
  CAM_FOREST_A: {
    key: 'scene3', url: scene3, zoom: 1.03, targetScreenHeight: 0.195,
  },
  CAM_FOREST_B: {
    key: 'scene4', url: scene4, zoom: 1.03, targetScreenHeight: 0.185,
  },
  CAM_FOREST_C: {
    key: 'scene5', url: scene5, zoom: 1.03, targetScreenHeight: 0.180,
  },
  CAM_FOREST_D: {
    key: 'scene5-flip', url: scene5, zoom: 1.08, targetScreenHeight: 0.180, flipX: true,
  },
  CAM_FOREST_BODY: {
    key: 'scene6', url: scene6, zoom: 1.025, targetScreenHeight: 0.195,
  },
};

export class ForestPrerenderBackdrop {
  constructor(scene, camera, actorRoot = null, renderer = null) {
    this.scene = scene;
    this.camera = camera;
    this.actorRoot = actorRoot;
    this.renderer = renderer;
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.pending = new Map();
    this.hidden = new Map();
    this.currentZoneId = null;
    this.currentKey = null;
    this.currentActorScale = 1;
    this.lastScaleZoneId = null;
    this._actorFoot = new THREE.Vector3();
    this._actorHead = new THREE.Vector3();
    this.distance = 36;

    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
    });

    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.plane.name = 'forest-prerender-backplate';
    this.plane.renderOrder = -1000;
    this.plane.frustumCulled = false;
    this.plane.visible = false;
    this.plane.userData.preserveForForestBackplate = true;
    scene.add(this.plane);
  }

  preload(zoneId = null) {
    if (zoneId) return this.loadShot(zoneId);

    const zones = Object.keys(SHOTS);
    return Promise.all(zones.map(id => this.loadShot(id)))
      .then(results => results.some(Boolean));
  }

  loadShot(zoneId) {
    const config = SHOTS[zoneId];
    if (!config) return Promise.resolve(false);

    // A flipped reuse needs its own texture transform.
    const cacheKey = config.key;
    if (this.cache.has(cacheKey)) return Promise.resolve(true);
    if (this.pending.has(cacheKey)) return this.pending.get(cacheKey);

    const promise = new Promise(resolve => {
      this.loader.load(
        config.url,
        texture => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.magFilter = THREE.LinearFilter;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.generateMipmaps = true;

          if (this.renderer?.capabilities?.getMaxAnisotropy) {
            texture.anisotropy = Math.min(
              8,
              this.renderer.capabilities.getMaxAnisotropy(),
            );
          } else {
            texture.anisotropy = 4;
          }

          if (config.flipX) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.repeat.x = -1;
            texture.offset.x = 1;
          }

          texture.needsUpdate = true;
          this.cache.set(cacheKey, texture);
          this.pending.delete(cacheKey);
          resolve(true);
        },
        undefined,
        error => {
          console.warn('Forest prerender failed to load:', zoneId, error);
          this.pending.delete(cacheKey);
          resolve(false);
        },
      );
    });

    this.pending.set(cacheKey, promise);
    return promise;
  }

  hasShot(zoneId) {
    return Boolean(SHOTS[zoneId]);
  }

  getTargetScreenHeight(zoneId) {
    return SHOTS[zoneId]?.targetScreenHeight ?? 0.19;
  }

  getProjectedHeightAtUnitScale(actorRoot) {
    if (!actorRoot || !this.camera) return 0;

    actorRoot.getWorldPosition(this._actorFoot);
    this._actorHead.copy(this._actorFoot);
    this._actorHead.y += BRYAN_WORLD_HEIGHT;

    this.camera.updateMatrixWorld(true);
    this._actorFoot.project(this.camera);
    this._actorHead.project(this.camera);

    return Math.abs(this._actorHead.y - this._actorFoot.y) * 0.5;
  }

  applyActorCalibration(actorRoot, zoneId = this.currentZoneId) {
    if (!actorRoot) return;

    const projected = this.getProjectedHeightAtUnitScale(actorRoot);
    if (!Number.isFinite(projected) || projected < 0.001) {
      actorRoot.scale.setScalar(1);
      return;
    }

    const desired = this.getTargetScreenHeight(zoneId);
    const rawScale = desired / projected;

    // Never let Bryan become a giant or a mouse just because one authored camera
    // happens to sit much closer/farther than another. Perspective still changes
    // naturally inside each shot, but presentation stays within a believable band.
    const targetScale = THREE.MathUtils.clamp(rawScale, 0.88, 1.10);

    if (this.lastScaleZoneId !== zoneId) {
      this.currentActorScale = targetScale;
      this.lastScaleZoneId = zoneId;
    } else {
      this.currentActorScale = THREE.MathUtils.lerp(
        this.currentActorScale,
        targetScale,
        0.24,
      );
    }

    actorRoot.scale.setScalar(this.currentActorScale);
  }

  resetActorCalibration(actorRoot) {
    this.currentActorScale = 1;
    this.lastScaleZoneId = null;
    if (actorRoot) actorRoot.scale.set(1, 1, 1);
  }

  update(zoneId) {
    const config = SHOTS[zoneId];
    if (!config) {
      this.disable();
      return;
    }

    this.currentZoneId = zoneId;
    const texture = this.cache.get(config.key);

    if (!texture) {
      // Do NOT hide the live 3D room until the replacement image has actually
      // loaded. This prevents a black screen on slow/cold loads.
      this.loadShot(zoneId).then(ok => {
        if (ok && this.currentZoneId === zoneId) this.update(zoneId);
      });
      return;
    }

    if (this.currentKey !== config.key || this.material.map !== texture) {
      this.currentKey = config.key;
      this.material.map = texture;
      this.material.needsUpdate = true;
    }

    this.plane.visible = true;
    this.updatePlaneTransform(config);
    this.updatePlaneScale(config);
    this.applyHide();
  }

  updatePlaneTransform(config) {
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(this.camera.quaternion);

    this.plane.position.copy(this.camera.position)
      .addScaledVector(direction, this.distance)
      .addScaledVector(right, config.offsetX ?? 0)
      .addScaledVector(up, config.offsetY ?? 0);
    this.plane.quaternion.copy(this.camera.quaternion);
  }

  updatePlaneScale(config) {
    // Every source shot is 16:9, but use the actual decoded image ratio.
    const image = this.material.map?.image;
    const imageAspect = image?.width && image?.height
      ? image.width / image.height
      : 16 / 9;

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

      // Real storm particles continue over the baked background.
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
    if (!this.currentZoneId || !this.plane.visible) return;
    const config = SHOTS[this.currentZoneId];
    if (!config) return;
    this.updatePlaneTransform(config);
    this.updatePlaneScale(config);
  }
}
