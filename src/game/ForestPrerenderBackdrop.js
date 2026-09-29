import * as THREE from 'three';

const ATLAS_URL = 'assets/backgrounds/forest/forest_prerender_atlas.jpg';

// Atlas layout: 3 columns x 2 rows.
// Each camera has its own crop and actor presentation scale.
const SHOTS = {
  CAM_CRASH_EXIT: {
    col: 0, row: 0, zoom: 1.02, actorScale: 0.94,
  },
  CAM_BLOOD_TRAIL: {
    col: 2, row: 0, zoom: 1.02, actorScale: 0.90,
  },
  CAM_FOREST_A: {
    col: 1, row: 0, zoom: 1.03, actorScale: 0.89,
  },
  CAM_FOREST_B: {
    col: 0, row: 1, zoom: 1.03, actorScale: 0.84,
  },
  CAM_FOREST_C: {
    col: 1, row: 1, zoom: 1.03, actorScale: 0.82,
  },
  CAM_FOREST_D: {
    col: 0, row: 1, zoom: 1.12, actorScale: 0.80, flipX: true,
  },
  CAM_FOREST_BODY: {
    col: 2, row: 1, zoom: 1.02, actorScale: 0.86,
  },
};

export class ForestPrerenderBackdrop {
  constructor(scene, camera, actorRoot = null) {
    this.scene = scene;
    this.camera = camera;
    this.actorRoot = actorRoot;
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.hidden = new Map();
    this.currentZoneId = null;
    this.ready = false;
    this.originalBackground = scene.background;
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
            crop.center.set(0.5, 0.5);

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

            // Scene.background is much more reliable here than a world-space
            // plane: it cannot end up behind the camera, outside the frustum or
            // hidden by depth sorting. The live storm and Bryan still render on top.
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
    if (!texture) return;

    // Use the prerender directly as the scene background.
    // This fixes the all-black failure seen when the 3D background plane was
    // being hidden/clipped while the snow particles continued to render.
    this.scene.background = texture;
    this.applyHide();
  }

  applyHide() {
    this.restoreHidden();

    this.scene.traverse(object => {
      if (!object.visible) return;
      if (object.isPoints) return; // keep live snowfall and wheel snow
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
    this.restoreHidden();
    this.scene.background = this.originalBackground;
    this.resetActorCalibration(this.actorRoot);
  }

  onResize() {
    // Scene.background automatically follows the renderer/camera aspect.
  }
}
