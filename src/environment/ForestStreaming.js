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
    makeFarMaterial(baseTexture, variant, 0.50 + variant * 0.045));

  const geometry = new THREE.PlaneGeometry(1, 1);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  for (const side of [-1, 1]) {
    const buckets = Array.from({ length: VARIANT_COUNT }, () => []);
    let slot = 0;

    for (let s = -36; s <= road.length + 90; s += 10.8, slot += 1) {
      const r1 = hash(slot * 17 + side * 11, 14011);
      const r2 = hash(slot * 23 + side * 19, 19001);
      const r3 = hash(slot * 29 + side * 31, 23003);
      const sampleS = s + (r1 - 0.5) * 7;
      const { tangent, normal } = sideFrame(road, sampleS);
      const offset = 42 + r2 * 14;
      const width = 44 + r3 * 20;
      const height = 23 + r1 * 10;
      const variant = (slot + (side < 0 ? 1 : 0)) % VARIANT_COUNT;

      buckets[variant].push({
        x: road.centerX(sampleS) + normal.x * offset * side,
        y: height * 0.5 - 0.65,
        z: -sampleS + normal.z * offset * side,
        yaw: Math.atan2(-tangent.z, tangent.x) + (r3 - 0.5) * 0.13,
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
    { offsetMin: 7.8, offsetMax: 10.6, spacing: 1.72, heightMin: 8.0, heightMax: 14.5, seed: 19121 },
    { offsetMin: 10.8, offsetMax: 14.8, spacing: 1.88, heightMin: 8.8, heightMax: 15.8, seed: 21101 },
    { offsetMin: 15.0, offsetMax: 20.5, spacing: 2.05, heightMin: 9.8, heightMax: 17.5, seed: 31111 },
    { offsetMin: 20.8, offsetMax: 28.0, spacing: 2.25, heightMin: 10.8, heightMax: 18.5, seed: 41113 },
    { offsetMin: 28.5, offsetMax: 38.0, spacing: 2.55, heightMin: 12.0, heightMax: 20.5, seed: 51131 },
  ];

  const placements = [];
  bands.forEach((band, bandIndex) => {
    for (const side of [-1, 1]) {
      let slot = 0;
      for (let s = -20 + bandIndex * 0.55; s <= road.length + 44; s += band.spacing, slot += 1) {
        const r1 = hash(slot * 17 + side * 5 + bandIndex * 13, band.seed);
        const r2 = hash(slot * 29 + side * 7 + bandIndex * 17, band.seed + 91);
        const r3 = hash(slot * 37 + side * 11 + bandIndex * 23, band.seed + 191);
        const sampleS = s + (r1 - 0.5) * band.spacing * 1.8;
        const { normal } = sideFrame(road, sampleS);
        const offset = band.offsetMin + r2 * (band.offsetMax - band.offsetMin);

        placements.push({
          x: road.centerX(sampleS) + normal.x * offset * side,
          z: -sampleS + normal.z * offset * side,
          height: band.heightMin + r3 * (band.heightMax - band.heightMin),
          width: 0.95 + r1 * 1.15,
          pine: r2 > (bandIndex === 0 ? 0.34 : bandIndex === 1 ? 0.28 : 0.20),
          lean: (r3 - 0.5) * 0.12,
          band: bandIndex,
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
    new THREE.MeshLambertMaterial({ color: 0x101a1f, fog: true }),
    placements.length,
  );
  const crownsLow = new THREE.InstancedMesh(
    crownGeometry,
    new THREE.MeshLambertMaterial({ color: 0x132329, fog: true }),
    pineCount,
  );
  const crownsHigh = new THREE.InstancedMesh(
    crownGeometry,
    new THREE.MeshLambertMaterial({ color: 0x182b31, fog: true }),
    pineCount,
  );
  const branches = new THREE.InstancedMesh(
    branchGeometry,
    new THREE.MeshLambertMaterial({ color: 0x101a1f, fog: true }),
    bareCount * 5,
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
      position.set(item.x, item.height * 0.52, item.z);
      scale.set(item.width * 1.30, item.height * 0.80, item.width * 1.30);
      matrix.compose(position, quaternion, scale);
      crownsLow.setMatrixAt(pineIndex, matrix);

      position.set(item.x, item.height * 0.78, item.z);
      scale.set(item.width * 0.88, item.height * 0.62, item.width * 0.88);
      matrix.compose(position, quaternion, scale);
      crownsHigh.setMatrixAt(pineIndex, matrix);
      pineIndex += 1;
    } else {
      for (let branch = 0; branch < 5; branch += 1) {
        const sign = branch % 2 ? -1 : 1;
        const r = hash(index * 23 + branch * 17, 77171);
        euler.set((r - 0.5) * 0.38, r * Math.PI, sign * (0.72 + r * 0.40));
        quaternion.setFromEuler(euler);
        position.set(
          item.x + sign * 0.18,
          item.height * (0.34 + branch * 0.12),
          item.z + (r - 0.5) * 0.75,
        );
        scale.set(0.82, item.height * (0.17 + r * 0.09), 0.82);
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
  for (let s = -12; s <= road.length + 30; s += 3.85, slot += 1) {
    for (const side of [-1, 1]) {
      if (hash(slot * 13 + side * 17, 91201) < 0.10) continue;
      const r1 = hash(slot * 19 + side * 23, 93203);
      const r2 = hash(slot * 29 + side * 31, 97213);
      const { normal } = sideFrame(road, s);
      const offset = 6.25 + r1 * 2.35;
      placements.push({
        x: road.centerX(s) + normal.x * offset * side,
        z: -s + normal.z * offset * side,
        height: 12 + r2 * 11,
        radius: 0.62 + r1 * 0.95,
        side,
      });
    }
  }

  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
  const branchGeometry = new THREE.CylinderGeometry(0.035, 0.08, 1, 5);
  const material = new THREE.MeshLambertMaterial({ color: 0x0a1317, fog: true });
  const trunks = new THREE.InstancedMesh(trunkGeometry, material, placements.length);
  const branches = new THREE.InstancedMesh(branchGeometry, material, placements.length * 4);

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

    for (let branch = 0; branch < 4; branch += 1) {
      const r = hash(index * 31 + branch * 13, 88301);
      const sign = branch % 2 ? -1 : 1;
      euler.set((r - 0.5) * 0.27, r * Math.PI, item.side * sign * (0.77 + r * 0.34));
      quaternion.setFromEuler(euler);
      position.set(
        item.x + sign * item.radius * 0.30,
        item.height * (0.38 + branch * 0.14),
        item.z + (r - 0.5) * 0.8,
      );
      scale.set(0.84, item.height * (0.17 + r * 0.09), 0.84);
      matrix.compose(position, quaternion, scale);
      branches.setMatrixAt(branchIndex++, matrix);
    }
  });

  trunks.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  group.add(trunks, branches);
  return group;
}

function buildForestFloor(road) {
  const group = new THREE.Group();
  group.name = 'forest-floor-detail';

  const shrubGeometry = new THREE.ConeGeometry(1, 1, 6);
  const snowGeometry = new THREE.IcosahedronGeometry(1, 1);
  const logGeometry = new THREE.CylinderGeometry(0.18, 0.24, 1, 6);
  const stumpGeometry = new THREE.CylinderGeometry(0.28, 0.38, 1, 7);

  const shrubMaterial = new THREE.MeshLambertMaterial({ color: 0x15272d, fog: true });
  const twigMaterial = new THREE.MeshLambertMaterial({ color: 0x111b20, fog: true });
  const snowMaterial = new THREE.MeshLambertMaterial({ color: 0x788b98, fog: true });

  const shrubs = [];
  const mounds = [];
  const logs = [];
  const stumps = [];

  let slot = 0;
  for (let s = -16; s <= road.length + 36; s += 1.65, slot += 1) {
    for (const side of [-1, 1]) {
      const r1 = hash(slot * 17 + side * 7, 62119);
      const r2 = hash(slot * 23 + side * 11, 63127);
      const r3 = hash(slot * 31 + side * 13, 64157);
      const { tangent, normal } = sideFrame(road, s);
      const offset = 5.9 + r1 * 12.5;
      const x = road.centerX(s) + normal.x * offset * side;
      const z = -s + normal.z * offset * side;

      shrubs.push({
        x, z,
        y: 0.48 + r2 * 0.35,
        sx: 0.55 + r2 * 1.00,
        sy: 0.85 + r3 * 1.65,
        sz: 0.55 + r1 * 0.95,
        yaw: r3 * Math.PI,
      });

      if (slot % 2 === 0) {
        mounds.push({
          x: x + normal.x * side * (0.35 + r3 * 0.8),
          z: z + normal.z * side * (0.35 + r3 * 0.8),
          sx: 0.7 + r1 * 1.5,
          sy: 0.25 + r2 * 0.35,
          sz: 0.7 + r3 * 1.4,
          yaw: r2 * Math.PI,
        });
      }

      if (slot % 13 === 0 && r2 > 0.25) {
        logs.push({
          x: x + tangent.x * (r1 - 0.5) * 2.0,
          z: z + tangent.z * (r1 - 0.5) * 2.0,
          length: 2.8 + r3 * 3.4,
          radius: 0.65 + r1 * 0.45,
          yaw: Math.atan2(tangent.x, tangent.z) + (r2 - 0.5) * 1.2,
        });
      }

      if (slot % 17 === 0 && r3 > 0.25) {
        stumps.push({
          x: x - normal.x * side * (0.2 + r1 * 0.6),
          z: z - normal.z * side * (0.2 + r1 * 0.6),
          height: 0.55 + r2 * 0.85,
          radius: 0.65 + r3 * 0.55,
          yaw: r1 * Math.PI,
        });
      }
    }
  }

  const makeInstanced = (geometry, material, items, apply) => {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    items.forEach((item, index) => {
      apply(item, position, euler, scale);
      quaternion.setFromEuler(euler);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };

  const shrubMesh = makeInstanced(shrubGeometry, shrubMaterial, shrubs, (item, position, euler, scale) => {
    position.set(item.x, item.y, item.z);
    euler.set(0, item.yaw, 0);
    scale.set(item.sx, item.sy, item.sz);
  });

  const moundMesh = makeInstanced(snowGeometry, snowMaterial, mounds, (item, position, euler, scale) => {
    position.set(item.x, 0.10, item.z);
    euler.set(0, item.yaw, 0);
    scale.set(item.sx, item.sy, item.sz);
  });

  const logMesh = makeInstanced(logGeometry, twigMaterial, logs, (item, position, euler, scale) => {
    position.set(item.x, 0.28, item.z);
    euler.set(Math.PI * 0.5, item.yaw, 0.18);
    scale.set(item.radius, item.length, item.radius);
  });

  const stumpMesh = makeInstanced(stumpGeometry, twigMaterial, stumps, (item, position, euler, scale) => {
    position.set(item.x, item.height * 0.5, item.z);
    euler.set(0, item.yaw, 0);
    scale.set(item.radius, item.height, item.radius);
  });

  shrubMesh.name = 'forest-underbrush';
  moundMesh.name = 'forest-snow-clumps';
  logMesh.name = 'forest-fallen-logs';
  stumpMesh.name = 'forest-stumps';
  group.add(shrubMesh, moundMesh, logMesh, stumpMesh);
  return group;
}

function buildSnags(road) {
  const group = new THREE.Group();
  group.name = 'forest-broken-snags';

  const trunkGeometry = new THREE.CylinderGeometry(0.14, 0.27, 1, 6);
  const branchGeometry = new THREE.CylinderGeometry(0.03, 0.075, 1, 5);
  const material = new THREE.MeshLambertMaterial({ color: 0x0e181d, fog: true });

  const snags = [];
  let slot = 0;
  for (let s = 4; s <= road.length + 22; s += 10.5, slot += 1) {
    for (const side of [-1, 1]) {
      if (hash(slot * 11 + side * 17, 45361) < 0.18) continue;
      const r1 = hash(slot * 17 + side * 23, 46349);
      const r2 = hash(slot * 23 + side * 31, 47351);
      const { normal } = sideFrame(road, s);
      const offset = 8.2 + r1 * 5.0;
      snags.push({
        x: road.centerX(s) + normal.x * offset * side,
        z: -s + normal.z * offset * side,
        height: 6.0 + r2 * 7.0,
        radius: 0.55 + r1 * 0.55,
        side,
      });
    }
  }

  const trunks = new THREE.InstancedMesh(trunkGeometry, material, snags.length);
  const branches = new THREE.InstancedMesh(branchGeometry, material, snags.length * 2);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let branchIndex = 0;

  snags.forEach((item, index) => {
    const r = hash(index * 29, 49363);
    euler.set((r - 0.5) * 0.10, 0, (r - 0.5) * 0.22);
    quaternion.setFromEuler(euler);
    position.set(item.x, item.height * 0.5, item.z);
    scale.set(item.radius, item.height, item.radius);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(index, matrix);

    for (let j = 0; j < 2; j += 1) {
      const sign = j ? -1 : 1;
      euler.set(0.15 * sign, r * Math.PI, item.side * sign * 0.95);
      quaternion.setFromEuler(euler);
      position.set(item.x, item.height * (0.55 + j * 0.18), item.z);
      scale.set(0.85, item.height * (0.22 + r * 0.08), 0.85);
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
  const group = new THREE.Group();
  group.name = 'forest-canopy';

  const branchGeometry = new THREE.CylinderGeometry(0.035, 0.07, 1, 5);
  const twigGeometry = new THREE.CylinderGeometry(0.02, 0.04, 1, 5);
  const material = new THREE.MeshLambertMaterial({ color: 0x091216, fog: true });

  const branches = [];
  const twigs = [];
  let slot = 0;

  for (let s = 4; s <= road.length + 20; s += 6.4, slot += 1) {
    if (hash(slot * 7, 12391) < 0.06) continue;

    for (const side of [-1, 1]) {
      const r1 = hash(slot * 19 + side * 5, 15313);
      const r2 = hash(slot * 23 + side * 7, 17401);
      const { normal } = sideFrame(road, s);
      const offset = 7.2 + r1 * 2.0;
      const branch = {
        x: road.centerX(s) + normal.x * offset * side - normal.x * side * (3.7 + r2 * 3.5),
        y: 8.5 + r1 * 6.0,
        z: -s + normal.z * offset * side - normal.z * side * (3.7 + r2 * 3.5),
        length: 8.0 + r2 * 6.4,
        side,
        twist: (r1 - 0.5) * 0.24,
      };
      branches.push(branch);

      for (let j = 0; j < 3; j += 1) {
        const rr = hash(slot * 31 + side * 13 + j * 17, 18433);
        twigs.push({
          x: branch.x + (rr - 0.5) * 1.4,
          y: branch.y + j * 0.52,
          z: branch.z + (rr - 0.5) * 1.2,
          length: 3.0 + rr * 3.0,
          side: side * (j ? -1 : 1),
          twist: (rr - 0.5) * 0.45,
        });
      }
    }
  }

  const build = (geometry, items, name) => {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    items.forEach((item, index) => {
      euler.set(item.twist, Math.PI * 0.5, item.side * 1.16);
      quaternion.setFromEuler(euler);
      position.set(item.x, item.y, item.z);
      scale.set(1, item.length, 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });

    mesh.name = name;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };

  group.add(
    build(branchGeometry, branches, 'forest-overhead-branches'),
    build(twigGeometry, twigs, 'forest-overhead-twigs'),
  );
  return group;
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

    // Far pre-rendered mass: intentionally distant so it reads as atmosphere.
    this.group.add(buildFarPaintedForest(road, baseTexture));

    // Several real 3D bands make the forest feel physically deep.
    this.group.add(buildMidForest(road));
    this.group.add(buildRoadEdgeTrunks(road));

    // Floor clutter is what was missing: bushes, snow clumps, logs and stumps.
    this.floor = buildForestFloor(road);
    this.group.add(this.floor);
    this.group.add(buildSnags(road));

    // Overhead branches and twigs reduce open sky and strengthen parallax.
    this.canopy = buildCanopy(road);
    this.group.add(this.canopy);

    scene.add(this.group);
  }

  update(dt = 0) {
    this.elapsed += Math.max(0, dt);
    this.canopy.rotation.z = Math.sin(this.elapsed * 0.34) * 0.0018;
    this.canopy.rotation.x = Math.sin(this.elapsed * 0.27 + 1.2) * 0.0012;
    this.floor.rotation.z = Math.sin(this.elapsed * 0.18) * 0.00035;
  }
}
