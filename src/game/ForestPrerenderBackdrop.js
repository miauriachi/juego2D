import * as THREE from 'three';

const ATLAS_URL = 'assets/backgrounds/forest/forest_prerender_atlas.jpg';

const SHOTS = {
  CAM_CRASH_EXIT: { col: 0, row: 0, zoom: 1.03 },
  CAM_BLOOD_TRAIL: { col: 1, row: 0, zoom: 1.03 },
  CAM_FOREST_A: { col: 2, row: 0, zoom: 1.04 },
  CAM_FOREST_B: { col: 0, row: 1, zoom: 1.04 },
  CAM_FOREST_C: { col: 1, row: 1, zoom: 1.04 },
  CAM_FOREST_D: { col: 1, row: 1, zoom: 1.05 },
  CAM_FOREST_BODY: { col: 2, row: 1, zoom: 1.04 },
};

export class ForestPrerenderBackdrop {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.loader = new THREE.TextureLoader();
    this.distance = 32;
    this.cache = new Map();
    this.hidden = new Map();
    this.currentZoneId = null;
    this.ready = false;

    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
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

  preload() {
    if (this.promise) return this.promise;
    this.promise = new Promise(resolve => {
      this.loader.load(ATLAS_URL, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.anisotropy = 4;

        for (const [zoneId, shot] of Object.entries(SHOTS)) {
          const crop = texture.clone();
          crop.colorSpace = THREE.SRGBColorSpace;
          crop.wrapS = THREE.ClampToEdgeWrapping;
          crop.wrapT = THREE.ClampToEdgeWrapping;
          crop.repeat.set((1 / 3) - 0.002, 0.5 - 0.003);
          crop.offset.set(
            shot.col / 3 + 0.001,
            shot.row === 0 ? 0.5015 : 0.0015,
          );
          crop.needsUpdate = true;
          this.cache.set(zoneId, crop);
        }

        this.ready = true;
        resolve(true);
      }, undefined, error => {
        console.warn('Forest prerender atlas failed to load.', error);
        resolve(false);
      });
    });
    return this.promise;
  }

  update(zoneId) {
    if (!SHOTS[zoneId]) {
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
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

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
      if (object.isPoints) return; // keep the live snowstorm over the backplate
      if (!(object.isMesh || object.isSprite || object.isLine)) return;
      if (this.isBryan(object)) return;
      if (object.userData?.preserveForForestBackplate) return;

      this.hidden.set(object.uuid, object.visible);
      object.visible = false;
    });
  }

  isBryan(object) {
    for (let node = object; node; node = node.parent) {
      if (
        node.name === 'player' ||
        node.name === 'bryanModel' ||
        node.name === 'bryan-model' ||
        node.name === 'BryanRiggedMesh'
      ) return true;
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
  }

  onResize() {
    if (this.currentZoneId && this.plane.visible) {
      this.updateTransform(SHOTS[this.currentZoneId]);
    }
  }
}
