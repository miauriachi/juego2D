import * as THREE from 'three';
import { FOREST_SIDE_ATLAS } from './ForestArtData.js';

const VARIANT_COUNT = 4;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function hash(value, seed) {
  let n = Math.imul((value | 0) ^ seed, 1664525) + 1013904223;
  n ^= n >>> 16;
  n = Math.imul(n, 2246822519);
  n ^= n >>> 13;
  return (n >>> 0) / 4294967296;
}

function sideFrame(road, s) {
  const tangent = new THREE.Vector3(road.tangentX(s), 0, -1).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return { tangent, normal };
}

function makeFarMaterial(baseTexture, variant, opacity = 0.55) {
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
    color: 0x667a88,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    alphaTest: 0.03,
    depthWrite: false,
    fog: true,
    toneMapped: false,
  });
}

function hideFallback(forest) {
  if (!forest) return;
  for (const key of ['trunks', 'crowns', 'branches', 'mounds', 'rocks']) {
    if (forest[key]) forest[key].visible = false;
  }
}

function buildFarPaintedForest(road, baseTexture) {
  const group = new THREE.Group();
  group.name = 'forest-far-painted';

  const materials = Array.from({ length: VARIANT_COUNT }, (_, variant) =>
    makeFarMaterial(baseTexture, variant, 0.52 + variant * 0.04));

  const geometry = new THREE.PlaneGeometry(1, 1);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  for (const side of [-1, 1]) {
    const buckets = Array.from({ length: VARIANT_COUNT }, () => []);
    let slot = 0;

    for (let s = -30; s <= road.length + 80; s += 15.5, slot += 1) {
      const r1 = hash(slot * 17 + side * 11, 14011);
      const r2 = hash(slot * 23 + side * 19, 19001);
      const r3 = hash(slot * 29 + side * 31, 23003);
      const sampleS = s + (r1 - 0.5) * 7;
      const { tangent, normal } = sideFrame(road, sampleS);
      const offset = 36 + r2 * 12;
      const width = 34 + r3 * 16;
      const height = 18 + r1 * 8;
      const variant = (slot + (side < 0 ? 1 : 0)) % VARIANT_COUNT;

      buckets[variant].push({
        x: road.centerX(sampleS) + normal.x * offset * side,
        y: height * 0.5 - 0.55,
        z: -sampleS + normal.z * offset * side,
        yaw: Math.atan2(-tangent.z, tangent.x) + (r3 - 0.5) * 0.14,
        width: ((slot + (side < 0 ? 1 : 0)) % 2 ? -1 : 1) * width,
        height,
      });
    }

    buckets.forEach((items, variant) => {
      if (!items.length) return;
      const mesh = new THREE.InstancedMesh(geometry, materials[variant], items.length);
      mesh.name = `forest-far-${side < 0 ? 'left' : 'right'}-${variant}`;
      mesh.frustumCulled = false;
      mesh.renderOrder = -12;

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

  return group;
}

function buildMidForest(road) {
  const group = new THREE.Group();
  group.name = 'forest-mid-3d';

  const bands = [
    { offsetMin: 10.5, offsetMax: 14.0, spacing: 2.5, heightMin: 7.0, heightMax: 12.5, seed: 31111 },
    { offsetMin: 15.0, offsetMax: 20.0, spacing: 2.9, heightMin: 8.5, heightMax: 14.5, seed: 41113 },
    { offsetMin: 21.0, offsetMax: 29.0, spacing: 3.4, heightMin: 10.0, heightMax: 16.5, seed: 51131 },
  ];

  const placements = [];
  bands.forEach((band, bandIndex) => {
    for (const side of [-1, 1]) {
      let slot = 0;
      for (let s = -18 + bandIndex * 0.7; s <= road.length + 40; s += band.spacing, slot += 1) {
        const r1 = hash(slot * 17 + side * 5 + bandIndex * 13, band.seed);
        const r2 = hash(slot * 29 + side * 7 + bandIndex * 17, band.seed + 91);
        const r3 = hash(slot * 37 + side * 11 + bandIndex * 23, band.seed + 191);
        const sampleS = s + (r1 - 0.5) * band.spacing * 1.7;
        const { normal } = sideFrame(road, sampleS);
        const offset = band.offsetMin + r2 * (band.offsetMax - band.offsetMin);
        placements.push({
          x: road.centerX(sampleS) + normal.x * offset * side,
          z: -sampleS + normal.z * offset * side,
          height: band.heightMin + r3 * (band.heightMax - band.heightMin),
          width: 0.85 + r1 * 0.95,
          pine: r2 > 0.22,
          lean: (r3 - 0.5) * 0.10,
        });
      }
    }
  });

  const pineCount = placements.reduce((sum, item) => sum + Number(item.pine), 0);
  const bareCount = placements.length - pineCount;

  const trunkGeometry = new THREE.CylinderGeometry(0.13, 0.22, 1, 6);
  const crownGeometry = new THREE.ConeGeometry(1, 1, 7);
  const branchGeometry = new THREE.CylinderGeometry(0.035, 0.075, 1, 5);

  const trunks = new THREE.InstancedMesh(
    trunkGeometry,
    new THREE.MeshLambertMaterial({ color: 0x111b20, fog: true }),
    placements.length,
  );
  const crownsLow = new THREE.InstancedMesh(
    crownGeometry,
    new THREE.MeshLambertMaterial({ color: 0x14252b, fog: true }),
    pineCount,
  );
  const crownsHigh = new THREE.InstancedMesh(
    crownGeometry,
    new THREE.MeshLambertMaterial({ color: 0x182c32, fog: true }),
    pineCount,
  );
  const branches = new THREE.InstancedMesh(
    branchGeometry,
    new THREE.MeshLambertMaterial({ color: 0x111b20, fog: true }),
    bareCount * 4,
  );

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let pineIndex = 0;
  let bareIndex = 0;

  placements.forEach((item, index) => {
    euler.set(item.lean, 0, item.lean * 0.4);
    quaternion.setFromEuler(euler);
    position.set(item.x, item.height * 0.5, item.z);
    scale.set(1, item.height, 1);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(index, matrix);

    if (item.pine) {
      position.set(item.x, item.height * 0.58, item.z);
      scale.set(item.width * 1.15, item.height * 0.78, item.width * 1.15);
      matrix.compose(position, quaternion, scale);
      crownsLow.setMatrixAt(pineIndex, matrix);

      position.set(item.x, item.height * 0.82, item.z);
      scale.set(item.width * 0.78, item.height * 0.56, item.width * 0.78);
      matrix.compose(position, quaternion, scale);
      crownsHigh.setMatrixAt(pineIndex, matrix);
      pineIndex += 1;
    } else {
      for (let branch = 0; branch < 4; branch += 1) {
        const sign = branch % 2 ? -1 : 1;
        const r = hash(index * 23 + branch * 17, 77171);
        euler.set((r - 0.5) * 0.35, r * Math.PI, sign * (0.72 + r * 0.35));
        quaternion.setFromEuler(euler);
        position.set(
          item.x + sign * 0.18,
          item.height * (0.40 + branch * 0.13),
          item.z + (r - 0.5) * 0.65,
        );
        scale.set(0.82, item.height * (0.18 + r * 0.08), 0.82);
        matrix.compose(position, quaternion, scale);
        branches.setMatrixAt(bareIndex++, matrix);
      }
    }
  });

  trunks.instanceMatrix.needsUpdate = true;
  crownsLow.instanceMatrix.needsUpdate = true;
  crownsHigh.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;

  group.add(trunks, crownsLow, crownsHigh, branches);
  return group;
}

function buildRoadEdgeTrunks(road) {
  const group = new THREE.Group();
  group.name = 'forest-road-edge-trunks';

  const placements = [];
  let slot = 0;
  for (let s = -10; s <= road.length + 28; s += 6.1, slot += 1) {
    for (const side of [-1, 1]) {
      if (hash(slot * 13 + side * 17, 91201) < 0.18) continue;
      const r1 = hash(slot * 19 + side * 23, 93203);
      const r2 = hash(slot * 29 + side * 31, 97213);
      const { normal } = sideFrame(road, s);
      const offset = 6.9 + r1 * 2.2;
      placements.push({
        x: road.centerX(s) + normal.x * offset * side,
        z: -s + normal.z * offset * side,
        height: 11 + r2 * 8,
        radius: 0.55 + r1 * 0.75,
        side,
      });
    }
  }

  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
  const branchGeometry = new THREE.CylinderGeometry(0.035, 0.08, 1, 5);
  const material = new THREE.MeshLambertMaterial({ color: 0x0b1418, fog: true });
  const trunks = new THREE.InstancedMesh(trunkGeometry, material, placements.length);
  const branches = new THREE.InstancedMesh(branchGeometry, material, placements.length * 3);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let branchIndex = 0;

  placements.forEach((item, index) => {
    const lean = (hash(index * 11, 71171) - 0.5) * 0.12;
    euler.set(lean, 0, lean * 0.4);
    quaternion.setFromEuler(euler);
    position.set(item.x, item.height * 0.5 - 0.05, item.z);
    scale.set(item.radius, item.height, item.radius);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(index, matrix);

    for (let branch = 0; branch < 3; branch += 1) {
      const r = hash(index * 31 + branch * 13, 88301);
      const sign = branch % 2 ? -1 : 1;
      euler.set((r - 0.5) * 0.25, r * Math.PI, item.side * sign * (0.80 + r * 0.30));
      quaternion.setFromEuler(euler);
      position.set(
        item.x + sign * item.radius * 0.28,
        item.height * (0.46 + branch * 0.15),
        item.z + (r - 0.5) * 0.7,
      );
      scale.set(0.84, item.height * (0.18 + r * 0.08), 0.84);
      matrix.compose(position, quaternion, scale);
      branches.setMatrixAt(branchIndex++, matrix);
    }
  });

  trunks.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  group.add(trunks, branches);
  return group;
}

function buildCanopy(road) {
  const geometry = new THREE.CylinderGeometry(0.035, 0.07, 1, 5);
  const material = new THREE.MeshLambertMaterial({ color: 0x091216, fog: true });
  const branches = [];
  let slot = 0;

  for (let s = 8; s <= road.length + 18; s += 11.5, slot += 1) {
    if (hash(slot * 7, 12391) < 0.16) continue;
    for (const side of [-1, 1]) {
      const r1 = hash(slot * 19 + side * 5, 15313);
      const r2 = hash(slot * 23 + side * 7, 17401);
      const { normal } = sideFrame(road, s);
      const offset = 7.8 + r1 * 1.8;
      branches.push({
        x: road.centerX(s) + normal.x * offset * side - normal.x * side * (3.5 + r2 * 2.8),
        y: 9.0 + r1 * 5.0,
        z: -s + normal.z * offset * side - normal.z * side * (3.5 + r2 * 2.8),
        length: 7.5 + r2 * 5.5,
        side,
        twist: (r1 - 0.5) * 0.24,
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
    euler.set(branch.twist, Math.PI * 0.5, branch.side * 1.16);
    quaternion.setFromEuler(euler);
    position.set(branch.x, branch.y, branch.z);
    scale.set(1, branch.length, 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export class ForestStreaming {
  constructor(scene, road, fallbackForest = null) {
    this.group = new THREE.Group();
    this.group.name = 'dense-roadside-forest';
    this.elapsed = 0;

    const loader = new THREE.TextureLoader();
    const baseTexture = loader.load(
      FOREST_SIDE_ATLAS,
      () => hideFallback(fallbackForest),
      undefined,
      () => { this.group.visible = false; },
    );

    // 1) painted art only in the far distance
    this.group.add(buildFarPaintedForest(road, baseTexture));

    // 2) a very dense low-poly forest occupies the middle distance
    this.group.add(buildMidForest(road));

    // 3) close dark trunks break silhouettes and create strong parallax
    this.group.add(buildRoadEdgeTrunks(road));

    // 4) overhead dead branches close the visible sky
    this.canopy = buildCanopy(road);
    this.group.add(this.canopy);

    scene.add(this.group);
  }

  update(dt = 0) {
    this.elapsed += Math.max(0, dt);
    this.canopy.rotation.z = Math.sin(this.elapsed * 0.34) * 0.0018;
    this.canopy.rotation.x = Math.sin(this.elapsed * 0.27 + 1.2) * 0.0012;
  }
}
