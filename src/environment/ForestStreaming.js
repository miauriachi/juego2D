import * as THREE from 'three';
import { FOREST_SIDE_ATLAS } from './ForestArtData.js';

const VARIANT_COUNT = 4;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function makeCutoutMaterial(baseTexture, variant, tint) {
  const texture = baseTexture.clone();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1 / VARIANT_COUNT, 1);
  texture.offset.set(variant / VARIANT_COUNT, 0);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return new THREE.MeshBasicMaterial({
    map: texture,
    color: tint,
    side: THREE.DoubleSide,
    alphaTest: 0.045,
    transparent: false,
    depthWrite: true,
    fog: true,
    toneMapped: false,
  });
}

function sideFrame(road, s) {
  const tangent = new THREE.Vector3(road.tangentX(s), 0, -1).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return { tangent, normal };
}

function hash(value, seed) {
  let n = Math.imul((value | 0) ^ seed, 1664525) + 1013904223;
  n ^= n >>> 16;
  n = Math.imul(n, 2246822519);
  n ^= n >>> 13;
  return (n >>> 0) / 4294967296;
}

function addDenseLayer(group, road, materialSets, options) {
  const {
    name,
    side,
    offsetMin,
    offsetMax,
    widthMin,
    widthMax,
    heightRatio,
    spacing,
    jitter,
    start,
    end,
    seed,
    renderOrder,
  } = options;

  const buckets = Array.from({ length: VARIANT_COUNT }, () => []);
  let slot = 0;

  for (let s = start; s <= end; s += spacing, slot += 1) {
    const r1 = hash(slot * 11 + side * 17, seed);
    const r2 = hash(slot * 17 + side * 29, seed + 7);
    const r3 = hash(slot * 23 + side * 31, seed + 13);
    const r4 = hash(slot * 31 + side * 37, seed + 19);
    const sampleS = s + (r1 - 0.5) * jitter;
    const { tangent, normal } = sideFrame(road, sampleS);
    const offset = offsetMin + r2 * (offsetMax - offsetMin);
    const width = widthMin + r3 * (widthMax - widthMin);
    const height = width * heightRatio;
    const variant = Math.floor(r4 * VARIANT_COUNT) % VARIANT_COUNT;

    buckets[variant].push({
      x: road.centerX(sampleS) + normal.x * offset * side,
      y: height * 0.5 - 0.15,
      z: -sampleS + normal.z * offset * side,
      yaw: Math.atan2(-tangent.z, tangent.x) + (r4 - 0.5) * 0.20,
      width: (slot + (side < 0 ? 1 : 0)) % 2 ? -width : width,
      height,
    });
  }

  const geometry = new THREE.PlaneGeometry(1, 1);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  buckets.forEach((items, variant) => {
    if (!items.length) return;
    const mesh = new THREE.InstancedMesh(geometry, materialSets[variant], items.length);
    mesh.name = `${name}-${side < 0 ? 'left' : 'right'}-${variant}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = renderOrder;

    items.forEach((item, index) => {
      position.set(item.x, item.y, item.z);
      quaternion.setFromAxisAngle(Y_AXIS, item.yaw);
      scale.set(item.width, item.height, 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  });
}

function tuneFallbackForest(forest) {
  if (!forest) return;
  if (forest.crowns) forest.crowns.visible = false;
  if (forest.mounds) forest.mounds.visible = false;
  if (forest.rocks) forest.rocks.visible = false;

  if (forest.trunks?.material?.color) {
    forest.trunks.material.color.set(0x101a20);
    forest.trunks.material.fog = true;
    forest.trunks.visible = true;
  }
  if (forest.branches?.material?.color) {
    forest.branches.material.color.set(0x111c22);
    forest.branches.material.fog = true;
    forest.branches.visible = true;
  }
}

function buildCloseTrunks(road) {
  const group = new THREE.Group();
  group.name = 'forest-close-trunks';

  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.30, 1, 6);
  const branchGeometry = new THREE.CylinderGeometry(0.035, 0.085, 1, 5);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x0c151a, fog: true });
  const branchMaterial = new THREE.MeshLambertMaterial({ color: 0x101b21, fog: true });

  const placements = [];
  const step = 6.5;
  let slot = 0;
  for (let s = -18; s <= road.length + 34; s += step, slot += 1) {
    for (const side of [-1, 1]) {
      const chance = hash(slot * 19 + side * 41, 77371);
      const copies = chance > 0.68 ? 2 : 1;
      for (let copy = 0; copy < copies; copy += 1) {
        const r1 = hash(slot * 31 + copy * 7 + side * 11, 81223);
        const r2 = hash(slot * 37 + copy * 13 + side * 17, 84191);
        const r3 = hash(slot * 43 + copy * 17 + side * 23, 89209);
        placements.push({
          s: s + (r1 - 0.5) * 5.2,
          side,
          offset: 7.2 + r2 * 4.4,
          height: 8.5 + r3 * 10.5,
          radius: 0.48 + r1 * 0.88,
          lean: (r2 - 0.5) * 0.13,
        });
      }
    }
  }

  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, placements.length);
  const branches = new THREE.InstancedMesh(branchGeometry, branchMaterial, placements.length * 3);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let branchIndex = 0;

  placements.forEach((item, index) => {
    const { normal } = sideFrame(road, item.s);
    const x = road.centerX(item.s) + normal.x * item.offset * item.side;
    const z = -item.s + normal.z * item.offset * item.side;

    euler.set(item.lean, 0, item.lean * 0.35);
    quaternion.setFromEuler(euler);
    position.set(x, item.height * 0.5 - 0.05, z);
    scale.set(item.radius, item.height, item.radius);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(index, matrix);

    for (let branch = 0; branch < 3; branch += 1) {
      const sign = branch % 2 ? -1 : 1;
      const r = hash(index * 17 + branch * 29, 93001);
      const length = item.height * (0.17 + r * 0.10);
      euler.set((r - 0.5) * 0.28, r * Math.PI, sign * (0.72 + r * 0.38));
      quaternion.setFromEuler(euler);
      position.set(
        x + sign * item.radius * 0.25,
        item.height * (0.42 + branch * 0.16),
        z + (r - 0.5) * 0.75,
      );
      scale.set(0.86, length, 0.86);
      matrix.compose(position, quaternion, scale);
      branches.setMatrixAt(branchIndex++, matrix);
    }
  });

  trunks.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  trunks.castShadow = false;
  branches.castShadow = false;
  group.add(trunks, branches);
  return group;
}

function buildCanopy(road) {
  const group = new THREE.Group();
  group.name = 'forest-canopy';

  const geometry = new THREE.CylinderGeometry(0.035, 0.075, 1, 5);
  const material = new THREE.MeshLambertMaterial({ color: 0x0a1318, fog: true });
  const branches = [];
  let slot = 0;

  for (let s = 4; s <= road.length + 18; s += 13.5, slot += 1) {
    if (hash(slot * 7, 11939) < 0.18) continue;

    for (const side of [-1, 1]) {
      const r1 = hash(slot * 23 + side * 5, 13591);
      const r2 = hash(slot * 29 + side * 11, 16411);
      const { normal } = sideFrame(road, s);
      const baseX = road.centerX(s) + normal.x * (8.5 + r1 * 2.0) * side;
      const baseZ = -s + normal.z * (8.5 + r1 * 2.0) * side;
      branches.push({
        x: baseX - normal.x * side * (3.0 + r2 * 2.8),
        y: 9.5 + r1 * 5.5,
        z: baseZ - normal.z * side * (3.0 + r2 * 2.8),
        length: 6.5 + r2 * 5.2,
        side,
        twist: (r1 - 0.5) * 0.35,
      });
    }
  }

  const mesh = new THREE.InstancedMesh(geometry, material, branches.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  branches.forEach((branch, index) => {
    euler.set(branch.twist, Math.PI * 0.5, branch.side * 1.18);
    quaternion.setFromEuler(euler);
    position.set(branch.x, branch.y, branch.z);
    scale.set(1, branch.length, 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  return group;
}

export class ForestStreaming {
  constructor(scene, road, fallbackForest = null) {
    this.scene = scene;
    this.road = road;
    this.group = new THREE.Group();
    this.group.name = 'dense-roadside-forest';
    this.canopy = buildCanopy(road);
    this.elapsed = 0;

    const loader = new THREE.TextureLoader();
    const baseTexture = loader.load(
      FOREST_SIDE_ATLAS,
      () => tuneFallbackForest(fallbackForest),
      undefined,
      () => { this.group.visible = false; },
    );

    const materialTints = [
      new THREE.Color(0x465866),
      new THREE.Color(0x536876),
      new THREE.Color(0x657b89),
      new THREE.Color(0x748996),
      new THREE.Color(0x8498a3),
      new THREE.Color(0x91a5af),
    ];
    const materialSets = materialTints.map(tint =>
      Array.from({ length: VARIANT_COUNT }, (_, variant) =>
        makeCutoutMaterial(baseTexture, variant, tint)));

    const layers = [
      { name: 'forest-deep', offsetMin: 34, offsetMax: 46, widthMin: 54, widthMax: 72, heightRatio: 0.58, spacing: 9.0, jitter: 7.0, seed: 11003, renderOrder: -10 },
      { name: 'forest-far', offsetMin: 26, offsetMax: 36, widthMin: 44, widthMax: 60, heightRatio: 0.62, spacing: 7.2, jitter: 6.0, seed: 21019, renderOrder: -9 },
      { name: 'forest-mid', offsetMin: 18, offsetMax: 27, widthMin: 33, widthMax: 47, heightRatio: 0.66, spacing: 5.7, jitter: 5.0, seed: 31013, renderOrder: -8 },
      { name: 'forest-inner', offsetMin: 12, offsetMax: 19, widthMin: 24, widthMax: 36, heightRatio: 0.72, spacing: 4.3, jitter: 4.0, seed: 41011, renderOrder: -7 },
      { name: 'forest-near', offsetMin: 8.3, offsetMax: 13.0, widthMin: 17, widthMax: 27, heightRatio: 0.82, spacing: 3.3, jitter: 3.0, seed: 51001, renderOrder: -6 },
      { name: 'forest-road-edge', offsetMin: 7.1, offsetMax: 9.6, widthMin: 11, widthMax: 18, heightRatio: 0.94, spacing: 2.6, jitter: 2.4, seed: 61001, renderOrder: -5 },
    ];

    layers.forEach((layer, layerIndex) => {
      for (const side of [-1, 1]) {
        addDenseLayer(this.group, road, materialSets[layerIndex], {
          ...layer,
          side,
          start: -44 + (side < 0 ? layerIndex * 1.2 : -layerIndex * 1.4),
          end: road.length + 92,
          seed: layer.seed + (side < 0 ? 97 : 193),
        });
      }
    });

    this.group.add(buildCloseTrunks(road));
    this.group.add(this.canopy);
    scene.add(this.group);
  }

  update(dt = 0) {
    this.elapsed += Math.max(0, dt);
    // Near-overhead dead branches move only a few milliradians, enough to keep
    // the forest from feeling like a completely frozen stage backdrop.
    this.canopy.rotation.z = Math.sin(this.elapsed * 0.42) * 0.0025;
    this.canopy.rotation.x = Math.sin(this.elapsed * 0.31 + 1.4) * 0.0018;
  }
}
