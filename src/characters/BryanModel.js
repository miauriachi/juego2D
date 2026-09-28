import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DEBUG_MODE } from '../config/constants.js';
import {
  BRYAN_RIG_SOURCE_HEIGHT,
  BRYAN_GEOMETRY_SCALE,
  BRYAN_GEOMETRY_OFFSET,
  BRYAN_BONES,
  BRYAN_RUN_DYNAMIC_BONES,
  BRYAN_RUN_DURATION,
  BRYAN_RUN_FRAMES,
} from './BryanRigProfile.js';

const ROOT_BONE = 27;

function distanceToSegment(point, a, b) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const lengthSq = ab.lengthSq();
  const t = lengthSq > 1e-10
    ? THREE.MathUtils.clamp(new THREE.Vector3().subVectors(point, a).dot(ab) / lengthSq, 0, 1)
    : 0;
  const closest = new THREE.Vector3().copy(a).addScaledVector(ab, t);
  return { distance: point.distanceTo(closest), t };
}

// Visual adapter only. Movement, collision, story state, interactions and inventory
// remain owned by Player/Game exactly as before. If the reconstructed rig fails,
// Bryan automatically falls back to the previous rigid GLB presentation.
export class BryanModel {
  constructor(player, container, url = new URL('../../assets/models/bryan/source/bryan_original.glb', import.meta.url).href) {
    this.player = player;
    this.accessories = new Map();
    this.loaded = false;
    this.rigged = false;
    this.phase = 0;
    this.motionBlend = 0;
    this._qa = new THREE.Quaternion();
    this._qb = new THREE.Quaternion();
    this._sample = new THREE.Quaternion();
    this._final = new THREE.Quaternion();
    this._idle = new THREE.Quaternion();

    this.ready = new Promise(resolve => {
      const failed = error => {
        console.error('Bryan GLB load failed:', error?.message || error);
        resolve(false);
      };

      new GLTFLoader().load(url, gltf => {
        const visual = new THREE.Group();
        visual.name = 'bryanModel';
        player.group.add(visual);
        this.group = visual;

        try {
          this.setupRiggedPresentation(gltf.scene, visual);
          this.loaded = true;
          this.rigged = true;
          player.model.visible = false;
          this.setupDebug(container, 'RIG WALK/RUN');
          this.update();
          console.info('Bryan rigged locomotion enabled', {
            source: 'user Mixamo rig profile',
            bones: this.bones.length,
            walk: true,
            run: true,
            fallback: 'bryan_original.glb',
          });
          resolve(true);
        } catch (rigError) {
          console.warn('Bryan rig reconstruction failed; keeping previous rigid presentation.', rigError);
          visual.clear();
          try {
            this.setupRigidFallback(gltf.scene, visual);
            this.loaded = true;
            this.rigged = false;
            player.model.visible = false;
            this.setupDebug(container, 'RIG FALLBACK');
            this.update();
            resolve(true);
          } catch (error) {
            player.model.visible = true;
            player.group.remove(visual);
            this.group = null;
            this.loaded = false;
            failed(error);
          }
        }
      }, event => console.info('Bryan GLB progress', event.loaded, '/', event.total || '?'), failed);
    });
  }

  setupRiggedPresentation(model, visual) {
    let sourceMesh = null;
    model.traverse(object => {
      if (!sourceMesh && object.isMesh && object.geometry?.getAttribute('position')) sourceMesh = object;
    });
    if (!sourceMesh) throw new Error('El GLB base de Bryan no contiene una malla utilizable.');

    const geometry = sourceMesh.geometry.clone();
    const position = geometry.getAttribute('position');
    if (!position || position.count < 1000) throw new Error('Geometría base inesperada para Bryan.');

    // The uploaded rigged Bryan uses the same vertex topology as our current
    // Bryan. Map those original vertices into the rig's bind coordinate space.
    const [ox, oy, oz] = BRYAN_GEOMETRY_OFFSET;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i) * BRYAN_GEOMETRY_SCALE + ox;
      const y = position.getY(i) * BRYAN_GEOMETRY_SCALE + oy;
      const z = position.getZ(i) * BRYAN_GEOMETRY_SCALE + oz;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        throw new Error('La malla contiene una posición no finita.');
      }
      position.setXYZ(i, x, y, z);
    }
    position.needsUpdate = true;

    this.bones = BRYAN_BONES.map((definition, index) => {
      const bone = new THREE.Bone();
      bone.name = definition.name;
      bone.userData.rigIndex = index;
      bone.position.fromArray(definition.t);
      bone.quaternion.fromArray(definition.r).normalize();
      bone.scale.set(1, 1, 1);
      return bone;
    });
    BRYAN_BONES.forEach((definition, index) => {
      definition.children.forEach(child => this.bones[index].add(this.bones[child]));
    });

    this.bindQuaternions = BRYAN_BONES.map(definition =>
      new THREE.Quaternion().fromArray(definition.r).normalize());
    this.bindHipPosition = new THREE.Vector3().fromArray(BRYAN_BONES[ROOT_BONE].t);

    // Build world-space bind locations before assigning skin influences.
    const bindRoot = new THREE.Group();
    bindRoot.add(this.bones[ROOT_BONE]);
    bindRoot.updateMatrixWorld(true);
    const bindPositions = this.bones.map(bone => bone.getWorldPosition(new THREE.Vector3()));

    const segments = [
      // torso / neck / head
      [27,16,0.26,'all'], [16,15,0.25,'all'], [15,14,0.25,'all'],
      [14,3,0.21,'upper'], [3,2,0.18,'upper'], [2,0,0.19,'head'],
      // left arm and hand
      [14,8,0.16,'leftArm'], [8,7,0.16,'leftArm'], [7,6,0.15,'leftArm'],
      [6,5,0.14,'leftArm'], [5,4,0.13,'leftArm'],
      // right arm and hand
      [14,13,0.16,'rightArm'], [13,12,0.16,'rightArm'], [12,11,0.15,'rightArm'],
      [11,10,0.14,'rightArm'], [10,9,0.13,'rightArm'],
      // legs / feet
      [27,21,0.19,'leftLeg'], [21,20,0.19,'leftLeg'], [20,19,0.18,'leftLeg'],
      [19,18,0.18,'leftLeg'], [18,17,0.17,'leftLeg'],
      [27,26,0.19,'rightLeg'], [26,25,0.19,'rightLeg'], [25,24,0.18,'rightLeg'],
      [24,23,0.18,'rightLeg'], [23,22,0.17,'rightLeg'],
    ];

    const skinIndices = new Uint16Array(position.count * 4);
    const skinWeights = new Float32Array(position.count * 4);
    const point = new THREE.Vector3();

    const allowed = (region, p) => {
      if (region === 'all') return true;
      if (region === 'upper') return p.y > 1.12;
      if (region === 'head') return p.y > 1.38;
      if (region === 'leftArm') return p.x > 0.035 && p.y > 0.70;
      if (region === 'rightArm') return p.x < -0.035 && p.y > 0.70;
      if (region === 'leftLeg') return p.x > -0.025 && p.y < 1.02;
      if (region === 'rightLeg') return p.x < 0.025 && p.y < 1.02;
      return false;
    };

    for (let i = 0; i < position.count; i += 1) {
      point.set(position.getX(i), position.getY(i), position.getZ(i));
      const choices = [];
      for (const [a, b, radius, region] of segments) {
        if (!allowed(region, point)) continue;
        const hit = distanceToSegment(point, bindPositions[a], bindPositions[b]);
        const score = hit.distance / radius;
        choices.push({ a, b, t: hit.t, score });
      }
      choices.sort((left, right) => left.score - right.score);

      // Two nearest segments -> up to four bone influences. This keeps coat,
      // shoulders and joints smooth instead of snapping to one rigid bone.
      const selected = choices.slice(0, 2);
      const accumulated = new Map();
      selected.forEach(choice => {
        const influence = 1 / (0.04 + choice.score * choice.score);
        accumulated.set(choice.a, (accumulated.get(choice.a) || 0) + influence * (1 - choice.t));
        accumulated.set(choice.b, (accumulated.get(choice.b) || 0) + influence * choice.t);
      });

      let weights = [...accumulated.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      if (!weights.length) weights = [[ROOT_BONE, 1]];
      const total = weights.reduce((sum, entry) => sum + entry[1], 0) || 1;
      for (let slot = 0; slot < 4; slot += 1) {
        const entry = weights[slot];
        skinIndices[i * 4 + slot] = entry ? entry[0] : ROOT_BONE;
        skinWeights[i * 4 + slot] = entry ? entry[1] / total : 0;
      }
    }

    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    if (!Number.isFinite(geometry.boundingSphere?.radius)) {
      throw new Error('Bounding sphere inválida al reconstruir el rig.');
    }

    const rigRoot = new THREE.Group();
    rigRoot.name = 'bryanRigRoot';
    rigRoot.scale.setScalar(1.78 / BRYAN_RIG_SOURCE_HEIGHT);
    // Same authored forward axis as the previous Bryan asset.
    rigRoot.rotation.y = Math.PI;

    // Re-parent root bone from the temporary bind root into the real rig root.
    bindRoot.remove(this.bones[ROOT_BONE]);
    rigRoot.add(this.bones[ROOT_BONE]);

    const material = Array.isArray(sourceMesh.material)
      ? sourceMesh.material.map(item => item.clone())
      : sourceMesh.material.clone();
    const skinned = new THREE.SkinnedMesh(geometry, material);
    skinned.name = 'BryanRiggedMesh';
    skinned.castShadow = true;
    skinned.receiveShadow = true;
    skinned.frustumCulled = false;
    rigRoot.add(skinned);

    visual.add(rigRoot);
    visual.updateMatrixWorld(true);
    rigRoot.updateMatrixWorld(true);

    const skeleton = new THREE.Skeleton(this.bones);
    skinned.bind(skeleton);
    skinned.normalizeSkinWeights();

    this.rigRoot = rigRoot;
    this.skinnedMesh = skinned;
    this.skeleton = skeleton;

    // Return to exact bind pose before the first rendered frame.
    this.applyLocomotionPose(0, 0, false);
  }

  setupRigidFallback(model, visual) {
    const raw = new THREE.Box3().setFromObject(model);
    const size = raw.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Altura GLB inválida.');

    this.detectedHeight = size.y;
    this.scale = 1.78 / size.y;
    model.scale.multiplyScalar(this.scale);
    model.rotation.y += Math.PI;
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z));
    model.traverse(object => {
      if (!object.isMesh) return;
      object.visible = true;
      object.castShadow = true;
      object.receiveShadow = true;
      object.geometry.computeBoundingBox();
      object.geometry.computeBoundingSphere();
    });
    visual.add(model);
  }

  setupDebug(container, mode) {
    if (!DEBUG_MODE) return;
    this.debug = document.createElement('div');
    this.debug.style.cssText =
      'position:fixed;left:24px;top:70px;color:#8be0ff;font:12px monospace;pointer-events:none';
    this.debug.textContent = `Bryan GLB: ${mode}`;
    container.append(this.debug);
  }

  applyLocomotionPose(dt, speed, running) {
    if (!this.rigged || !this.bones?.length) return;

    const moving = speed > 0.05;
    const targetBlend = moving ? (running ? 0.70 : 0.42) : 0;
    const smooth = dt > 0 ? 1 - Math.exp(-7.5 * dt) : 1;
    this.motionBlend = THREE.MathUtils.lerp(this.motionBlend, targetBlend, smooth);

    if (moving && dt > 0) {
      const cycle = running ? Math.max(0.82, BRYAN_RUN_DURATION * 1.16) : 1.24;
      this.phase = (this.phase + dt / cycle) % 1;
    }

    const count = BRYAN_RUN_FRAMES.length;
    const frameFloat = this.phase * count;
    const index = Math.floor(frameFloat) % count;
    const next = (index + 1) % count;
    const alpha = frameFloat - Math.floor(frameFloat);
    const frameA = BRYAN_RUN_FRAMES[index];
    const frameB = BRYAN_RUN_FRAMES[next];
    const idleA = BRYAN_RUN_FRAMES[0];
    const idleB = BRYAN_RUN_FRAMES[Math.floor(count / 2)];

    for (let i = 0; i < this.bones.length; i += 1) {
      const bind = this.bindQuaternions[i];
      const idleLeft = idleA.r[i];
      const idleRight = idleB.r[i];
      const isArm = [5, 6, 7, 8, 10, 11, 12, 13].includes(i);
      const isTorso = [2, 3, 14, 15, 16].includes(i);

      this._idle.copy(bind);
      if ((isArm || isTorso) && idleLeft && idleRight) {
        this._qa.fromArray(idleLeft).normalize();
        this._qb.fromArray(idleRight).normalize();
        this._sample.slerpQuaternions(this._qa, this._qb, 0.5);
        this._idle.slerp(this._sample, isArm ? 0.62 : 0.12);
      }

      const a = frameA.r[i];
      const b = frameB.r[i];
      if (BRYAN_RUN_DYNAMIC_BONES.includes(i) && a && b) {
        this._qa.fromArray(a).normalize();
        this._qb.fromArray(b).normalize();
        this._sample.slerpQuaternions(this._qa, this._qb, alpha);
        const runWeight = isArm ? 0.78 : isTorso ? 0.55 : 0.82;
        this._final.slerpQuaternions(this._idle, this._sample, this.motionBlend * runWeight);
        this.bones[i].quaternion.copy(this._final);
      } else {
        this.bones[i].quaternion.copy(this._idle);
      }
    }

    const hipY = THREE.MathUtils.lerp(frameA.h[1], frameB.h[1], alpha);
    const hip = this.bones[ROOT_BONE];
    hip.position.copy(this.bindHipPosition);
    hip.position.y = THREE.MathUtils.lerp(
      this.bindHipPosition.y,
      hipY,
      this.motionBlend * (running ? 0.62 : 0.34),
    );
    if (!moving && dt > 0) {
      hip.position.y += Math.sin(performance.now() * 0.0018) * 0.0015;
    }

    this.rigRoot?.updateMatrixWorld(true);
  }

  update(dt = 0) {
    if (!this.loaded) return;

    if (this.rigged) {
      this.applyLocomotionPose(
        dt,
        this.player.animationSpeed || 0,
        Boolean(this.player.animationRunning),
      );
    }

    const player = this.player;
    player.group.updateMatrixWorld(true);

    // Existing delivery props remain untouched and follow the same source objects.
    for (const name of ['medicalKit', 'raccoonCityPackage']) {
      const source = player.model.getObjectByName(name);
      const previous = this.accessories.get(name);
      if (!source) {
        if (previous) {
          player.group.remove(previous.copy);
          this.accessories.delete(name);
        }
        continue;
      }

      let entry = previous;
      if (!entry || entry.source !== source) {
        if (entry) player.group.remove(entry.copy);
        const copy = source.clone(true);
        copy.name = `${name}-visual`;
        copy.matrixAutoUpdate = false;
        player.group.add(copy);
        entry = { source, copy };
        this.accessories.set(name, entry);
      }
      entry.copy.matrix.copy(player.group.matrixWorld).invert().multiply(source.matrixWorld);
      entry.copy.matrixWorldNeedsUpdate = true;
    }

    if (this.debug) this.debug.hidden = !player.group.visible;
  }
}
