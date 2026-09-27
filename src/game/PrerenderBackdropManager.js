import * as THREE from 'three';
import { receptionWideConfig } from './ReceptionWideConfig.js';
import { corridorConfig } from './CorridorConfig.js';

export class PrerenderBackdropManager {
  constructor(scene, camera, { area = 'reception', configs = null } = {}) {
    this.area = area;
    this.scene = scene;
    this.camera = camera;
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.pending = new Map();
    this.currentKey = null;
    this.hidden = new Map();
    this.actorVisibility = new Map();
    this.distance = 36;
    this.aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;

    this.configs = configs || {
      cam01: {
        key: 'reception-wide',
        url: 'assets/references/hospital/reception_wide.png',
        zoom: 1.05,
        offsetX: 0.0,
        offsetY: 0.05,
      },
      'cam-entrance': {
        key: 'entrance-hall',
        url: 'assets/references/hospital/entrance.png',
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      },
      cam05: receptionWideConfig.background,
      cam02: corridorConfig.background,
      cam04: {
        key: 'reception-closeup',
        url: 'assets/references/hospital/reception_closeup.png',
        zoom: 1.06,
        offsetX: 0.0,
        offsetY: 0.0,
      },
    };

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });

    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    this.plane.name = 'prerender-backplate';
    this.plane.renderOrder = -1000;
    this.plane.frustumCulled = false;
    this.plane.visible = false;
    this.scene.add(this.plane);
  }

  preload(zoneId) {
    const config = this.configs[zoneId];
    if (!config) return Promise.resolve(false);
    if (this.cache.has(config.key)) return Promise.resolve(true);
    if (this.pending.has(config.key)) return this.pending.get(config.key);

    const promise = new Promise(resolve => {
      this.loader.load(config.url, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.anisotropy = 4;
        this.cache.set(config.key, texture);
        this.pending.delete(config.key);
        resolve(true);
      }, undefined, () => {
        this.pending.delete(config.key);
        resolve(false);
      });
    });
    this.pending.set(config.key, promise);
    return promise;
  }

  isReady(zoneId) {
    const config = this.configs[zoneId];
    return !!config && this.cache.has(config.key);
  }

  onResize() {
    this.aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : this.aspect;
    if (this.currentKey) this.updatePlaneScale(this.configs[this.currentZoneId]);
  }

  update(zoneId, area = 'reception') {
    if (area !== this.area) {
      this.disable();
      return;
    }

    const config = this.configs[zoneId];
    if (!config) {
      this.disable();
      return;
    }

    if (this.currentKey !== config.key) {
      this.setTexture(config);
      this.currentKey = config.key;
    }

    this.currentZoneId = zoneId;
    this.plane.visible = true;
    this.updatePlaneTransform(config);
    this.updatePlaneScale(config);
    this.applyHide();
    this.applyActorPolicy(zoneId);
  }

  disable() {
    this.currentKey = null;
    this.currentZoneId = null;
    this.plane.visible = false;
    this.restoreHidden();
    this.restoreActors();
  }

  setTexture(config) {
    const cached = this.cache.get(config.key);
    if (cached) {
      this.applyTexture(cached, config);
      return;
    }
    const zoneId = Object.keys(this.configs).find(id => this.configs[id].key === config.key);
    this.preload(zoneId).then(() => {
      const texture = this.cache.get(config.key);
      if (texture && this.currentZoneId && this.configs[this.currentZoneId]?.key === config.key) {
        this.applyTexture(texture, config);
      }
    });
  }

  applyTexture(texture, config) {
    this.plane.material.map = texture;
    this.plane.material.needsUpdate = true;
    this.updatePlaneScale(config);
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
    // Pure pre-render mode: while a backplate is active, render only actors over
    // the image. The 3D hospital remains in memory for collisions/interactions,
    // but its visible meshes are temporarily hidden so it cannot slice through
    // the background (the issue seen in the first prototype).
    this.restoreHidden();
    this.scene.traverse(object => {
      if (!(object.isMesh || object.isSprite || object.isLine || object.isPoints) || object === this.plane) return;
      if (!object.visible) return;
      if (this.isCharacter(object)) return;
      if (object.userData?.preserveForBackplate) return;

      this.hidden.set(object.uuid, object.visible);
      object.visible = false;
    });
  }


  applyActorPolicy(zoneId) {
    this.restoreActors();
    const npcGroups = this.scene.children.filter(child => child?.name?.startsWith('npc:'));

    // The pre-rendered entrance and wide lobby plates already contain their own
    // chairs/desks. Showing world-space NPCs there makes them float against doors.
    // Keep them simulated for gameplay, but hide their presentation in these shots.
    const hideAllNPCs = ['cam-entrance', 'cam05', 'cam02', 'cam01'];
    if (hideAllNPCs.includes(zoneId) || this.configs[zoneId]?.hideOriginalNPCs) {
      npcGroups.forEach(group => this.setActorVisible(group, false));
      return;
    }

    // Close reception shot: only the receptionist belongs visually behind the desk.
    if (zoneId === 'cam04') {
      npcGroups.forEach(group => {
        const isReceptionist = group.name === 'npc:Recepcionista';
        this.setActorVisible(group, isReceptionist);
      });
    }
  }

  setActorVisible(group, visible) {
    if (!this.actorVisibility.has(group.uuid)) this.actorVisibility.set(group.uuid, group.visible);
    group.visible = visible;
  }

  restoreActors() {
    if (!this.actorVisibility.size) return;
    this.scene.children.forEach(child => {
      if (!child?.uuid || !this.actorVisibility.has(child.uuid)) return;
      child.visible = this.actorVisibility.get(child.uuid);
    });
    this.actorVisibility.clear();
  }

  restoreHidden() {
    if (!this.hidden.size) return;
    this.scene.traverse(object => {
      if (!object?.uuid || !this.hidden.has(object.uuid)) return;
      object.visible = this.hidden.get(object.uuid);
    });
    this.hidden.clear();
  }

  isCharacter(object) {
    for (let node = object; node; node = node.parent) {
      if (node.name === 'player' || node.name === 'bryanModel' || node.name === 'bryan-model' || node.name?.startsWith('npc:')) return true;
    }
    return false;
  }
}
