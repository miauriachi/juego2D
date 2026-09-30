import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DEBUG_MODE } from '../config/constants.js';

// Visual adapter only. The procedural model remains the inventory/animation API.
export class BryanModel {
  constructor(player, container, url = new URL('../../assets/models/bryan/source/bryan_original.glb', import.meta.url).href) {
    this.player = player; this.accessories = new Map(); this.loaded = false;
    this.ready = new Promise(resolve => {
      const failed = error => { console.error('Bryan GLB load failed:', error?.message || error); resolve(false); };
      new GLTFLoader().load(url, gltf => {
        try {
          const visual = new THREE.Group(); visual.name = 'bryanModel';
          const model = gltf.scene;
          const raw = new THREE.Box3().setFromObject(model), size = raw.getSize(new THREE.Vector3());
          if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Altura GLB inválida.');
          this.detectedHeight = size.y; this.scale = 1.78 / size.y;
          model.scale.multiplyScalar(this.scale);
          // This asset faces +Z; tank movement faces -Z.
          model.rotation.y += Math.PI; model.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3());
          model.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z));
          model.traverse(o => { if (o.isMesh) {
            o.visible = true; o.castShadow = true; o.receiveShadow = true;
            o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
          } });
          visual.add(model); visual.updateMatrixWorld(true);
          const localBox = new THREE.Box3().setFromObject(visual);
          player.group.add(visual); this.group = visual;
          player.model.visible = false; this.loaded = true;
          if (DEBUG_MODE) {
            this.box = new THREE.Box3Helper(localBox, 0x65d9ff); player.group.add(this.box);
            this.debug = document.createElement('div');
            this.debug.style.cssText = 'position:fixed;left:24px;top:70px;color:#8be0ff;font:12px monospace;pointer-events:none';
            this.debug.textContent = `Bryan GLB: ${size.y.toFixed(4)} m → 1.7800 m · escala ${this.scale.toFixed(6)}`;
            container.append(this.debug);
          }
          this.update();
          console.info('Bryan GLB loaded', { url, detectedHeight: size.y, scale: this.scale, height: 1.78, feetY: 0 });
          resolve(true);
        } catch (error) { player.model.visible = true; if (this.group) player.group.remove(this.group); this.loaded = false; failed(error); }
      }, event => console.info('Bryan GLB progress', event.loaded, '/', event.total || '?'), failed);
    });
  }
  update() {
    if (!this.loaded) return;
    const player = this.player;
    player.group.updateMatrixWorld(true);
    // Visual copies follow the existing objects, including their removal on handoff.
    for (const name of ['medicalKit', 'raccoonCityPackage']) {
      const source = player.model.getObjectByName(name), previous = this.accessories.get(name);
      if (!source) {
        if (previous) { player.group.remove(previous.copy); this.accessories.delete(name); }
        continue;
      }
      let entry = previous;
      if (!entry || entry.source !== source) {
        if (entry) player.group.remove(entry.copy);
        const copy = source.clone(true); copy.name = `${name}-visual`; copy.matrixAutoUpdate = false;
        player.group.add(copy); entry = { source, copy }; this.accessories.set(name, entry);
      }
      entry.copy.matrix.copy(player.group.matrixWorld).invert().multiply(source.matrixWorld);
      entry.copy.matrixWorldNeedsUpdate = true;
    }
    if (this.debug) this.debug.hidden = !player.group.visible;
  }
}
