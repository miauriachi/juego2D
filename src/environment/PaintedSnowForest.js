import * as THREE from 'three';
import { FOREST_SIDE_ATLAS } from './ForestArtData.js';

const VARIANT_COUNT = 4;

function createForestMaterial(loader, variant, onLoaded, onError) {
  const texture = loader.load(FOREST_SIDE_ATLAS, onLoaded, undefined, onError);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1 / VARIANT_COUNT, 1);
  texture.offset.set(variant / VARIANT_COUNT, 0);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false,
  });
}

function hideProceduralForest(fallbackForest) {
  if (!fallbackForest) return;
  for (const key of ['trunks', 'crowns', 'branches', 'mounds', 'rocks']) {
    if (fallbackForest[key]) fallbackForest[key].visible = false;
  }
}

function sidePoint(road, s, side, offset) {
  const tangent = new THREE.Vector3(road.tangentX(s), 0, -1).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return new THREE.Vector3(
    road.centerX(s) + normal.x * offset * side,
    0,
    -s + normal.z * offset * side,
  );
}

function buildCurtain(road, materials, {
  name,
  side,
  offset,
  height,
  segmentLength,
  phase = 0,
  bottom = -0.35,
  variantOffset = 0,
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();
  let segmentIndex = 0;

  for (let s0 = -42 + phase; s0 < road.length + 92; s0 += segmentLength, segmentIndex++) {
    const s1 = Math.min(road.length + 92, s0 + segmentLength);
    const p0 = sidePoint(road, s0, side, offset);
    const p1 = sidePoint(road, s1, side, offset);
    const base = positions.length / 3;

    positions.push(
      p0.x, bottom, p0.z,
      p1.x, bottom, p1.z,
      p0.x, height, p0.z,
      p1.x, height, p1.z,
    );

    const mirrored = (segmentIndex + (side < 0 ? 1 : 0) + variantOffset) % 2 === 1;
    if (mirrored) uvs.push(1, 0, 0, 0, 1, 1, 0, 1);
    else uvs.push(0, 0, 1, 0, 0, 1, 1, 1);

    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    geometry.addGroup(indices.length - 6, 6,
      (segmentIndex + variantOffset + (side < 0 ? 2 : 0)) % materials.length);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = name;
  mesh.frustumCulled = true;
  mesh.renderOrder = offset > 20 ? -3 : -2;
  return mesh;
}

function buildForegroundSilhouettes(road) {
  let seed = 197709;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const group = new THREE.Group();
  group.name = 'painted-forest-foreground';
  const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.26, 1, 6);
  const branchGeometry = new THREE.CylinderGeometry(0.035, 0.075, 1, 5);
  const material = new THREE.MeshLambertMaterial({ color: 0x16232b, fog: true });

  const placements = [];
  for (let s = -8; s <= road.length + 20;) {
    s += 11 + random() * 10;
    for (const side of [-1, 1]) {
      if (random() < 0.25) continue;
      placements.push({
        s: s + (random() - 0.5) * 5,
        side,
        offset: 8.4 + random() * 3.1,
        height: 7.5 + random() * 7.5,
        radius: 0.65 + random() * 1.05,
        lean: (random() - 0.5) * 0.16,
      });
    }
  }

  const trunks = new THREE.InstancedMesh(trunkGeometry, material, placements.length);
  const branches = new THREE.InstancedMesh(branchGeometry, material, placements.length * 2);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  let branchIndex = 0;

  placements.forEach((item, index) => {
    const p = sidePoint(road, item.s, item.side, item.offset);
    euler.set(item.lean, 0, item.lean * 0.55);
    quaternion.setFromEuler(euler);
    matrix.compose(
      new THREE.Vector3(p.x, item.height * 0.5 - 0.05, p.z),
      quaternion,
      new THREE.Vector3(item.radius, item.height, item.radius),
    );
    trunks.setMatrixAt(index, matrix);

    for (let j = 0; j < 2; j++) {
      const branchHeight = item.height * (0.48 + j * 0.19);
      const length = item.height * (0.22 + random() * 0.08);
      const outward = item.side * (j ? -1 : 1);
      euler.set(0.12 * (j ? -1 : 1), random() * Math.PI, outward * (0.78 + random() * 0.28));
      quaternion.setFromEuler(euler);
      matrix.compose(
        new THREE.Vector3(
          p.x + outward * item.radius * 0.35,
          branchHeight,
          p.z + (random() - 0.5) * 0.7,
        ),
        quaternion,
        new THREE.Vector3(0.75, length, 0.75),
      );
      branches.setMatrixAt(branchIndex++, matrix);
    }
  });

  trunks.name = 'painted-forest-near-trunks';
  branches.name = 'painted-forest-near-branches';
  trunks.castShadow = false;
  branches.castShadow = false;
  group.add(trunks, branches);
  return group;
}

// Painted roadside forest art pass. This only changes the presentation layer:
// road geometry, vehicle physics, collision, camera logic and narrative timing stay untouched.
export function buildPaintedSnowForest(scene, road, fallbackForest = null) {
  const group = new THREE.Group();
  group.name = 'painted-snow-forest';

  const loader = new THREE.TextureLoader();
  let loaded = 0;
  let failed = false;
  const onLoaded = () => {
    loaded += 1;
    if (!failed && loaded === VARIANT_COUNT) hideProceduralForest(fallbackForest);
  };
  const onError = () => {
    failed = true;
    group.visible = false;
  };
  const materials = Array.from({ length: VARIANT_COUNT }, (_, variant) =>
    createForestMaterial(loader, variant, onLoaded, onError));

  // Far curtain: tall enough that its top edge never enters the chase-camera frame.
  for (const side of [-1, 1]) {
    group.add(buildCurtain(road, materials, {
      name: `painted-forest-far-${side < 0 ? 'left' : 'right'}`,
      side,
      offset: 24.5,
      height: 24,
      segmentLength: 30,
      phase: 0,
      variantOffset: 1,
    }));
  }

  // Mid curtain: closer, slightly shorter and phase-shifted so the two layers never
  // expose the same vertical join at the same place.
  for (const side of [-1, 1]) {
    group.add(buildCurtain(road, materials, {
      name: `painted-forest-mid-${side < 0 ? 'left' : 'right'}`,
      side,
      offset: 16.2,
      height: 18.5,
      segmentLength: 24,
      phase: -9,
      variantOffset: 3,
    }));
  }

  group.add(buildForegroundSilhouettes(road));
  scene.add(group);
  return group;
}