import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DEBUG_MODE } from '../config/constants.js';\nimport {
  BRYAN_BONES,
  BRYAN_RUN_DYNAMIC_BONES,
  BRYAN_RUN_DURATION,
  BRYAN_RUN_FRAMES,
} from './BryanRigProfile.js';

// Visual adapter only. The procedural model remains the inventory/animation API.
export class BryanModel {
  constructor(player, container, url = new URL('../../assets/models/bryan/source/bryan_original.glb', import.meta.url).href) {
    this.player = player; this.accessories = new Map(); this.loaded = false;
    this.rigBones = []; this.rigRest = []; this.rigTime = 0; this.rigMode = 'idle';
    this.rigHipIndex = BRYAN_BONES.findIndex(bone => bone.name === 'mixamorig:Hips');
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
          this.rigBones = BRYAN_BONES.map(definition => model.getObjectByName(definition.name) || null);
          this.rigRest = this.rigBones.map(bone => bone ? {
            position: bone.position.clone(),
            quaternion: bone.quaternion.clone(),
          } : null);
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
  setRigMotion(mode = 'idle') {
    if (mode !== 'walk' && mode !== 'idle') mode = 'idle';
    if (this.rigMode === mode) return;
    this.rigMode = mode;
    if (mode === 'walk') this.rigTime = 0;
  }

  animateRig(dt, mode = this.rigMode) {
    if (!this.loaded || !this.rigBones.length) return;
    this.rigMode = mode;

    if (mode === 'walk' && BRYAN_RUN_FRAMES.length > 1) {
      // Reuse Bryan's existing rig animation at a slower cadence and reduced
      // amplitude so the run capture reads as a deliberate walk in fixed camera.
      this.rigTime = (this.rigTime + Math.max(0, dt) * 0.62) % BRYAN_RUN_DURATION;
      const frame = (this.rigTime / BRYAN_RUN_DURATION) * BRYAN_RUN_FRAMES.length;
      const a = Math.floor(frame) % BRYAN_RUN_FRAMES.length;
      const b = (a + 1) % BRYAN_RUN_FRAMES.length;
      const alpha = frame - Math.floor(frame);
      const qa = new THREE.Quaternion();
      const qb = new THREE.Quaternion();
      const animated = new THREE.Quaternion();

      BRYAN_RUN_DYNAMIC_BONES.forEach(index => {
        const bone = this.rigBones[index];
        const rest = this.rigRest[index];
        const ra = BRYAN_RUN_FRAMES[a]?.r?.[index];
        const rb = BRYAN_RUN_FRAMES[b]?.r?.[index];
        if (!bone || !rest || !ra || !rb) return;
        qa.set(...ra);
        qb.set(...rb);
        animated.slerpQuaternions(qa, qb, alpha);
        bone.quaternion.copy(rest.quaternion).slerp(animated, 0.52);
      });

      const hip = this.rigBones[this.rigHipIndex];
      const hipRest = this.rigRest[this.rigHipIndex];
      const ha = BRYAN_RUN_FRAMES[a]?.h;
      const hb = BRYAN_RUN_FRAMES[b]?.h;
      if (hip && hipRest && ha && hb) {
        const x = THREE.MathUtils.lerp(ha[0], hb[0], alpha);
        const y = THREE.MathUtils.lerp(ha[1], hb[1], alpha);
        const z = THREE.MathUtils.lerp(ha[2], hb[2], alpha);
        hip.position.set(
          THREE.MathUtils.lerp(hipRest.position.x, x, 0.32),
          THREE.MathUtils.lerp(hipRest.position.y, y, 0.32),
          THREE.MathUtils.lerp(hipRest.position.z, z, 0.32),
        );
      }
      return;
    }

    this.rigTime = 0;
    const blend = THREE.MathUtils.clamp(Math.max(0, dt) * 9, 0, 1);
    this.rigBones.forEach((bone, index) => {
      const rest = this.rigRest[index];
      if (!bone || !rest) return;
      bone.position.lerp(rest.position, blend);
      bone.quaternion.slerp(rest.quaternion, blend);
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
