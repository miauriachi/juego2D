import * as THREE from 'three';
import { FOREST_SIDE_ATLAS } from './ForestArtData.js';

const VARIANT_COUNT = 4;

function makeMaterial(baseTexture, variant, opacity, cropStart = 0, cropWidth = 1) {
  const texture = baseTexture.clone();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(cropWidth / VARIANT_COUNT, 1);
  texture.offset.set((variant + cropStart) / VARIANT_COUNT, 0);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    alphaTest: 0.025,
    depthWrite: false,
    fog: true,
    toneMapped: false,
  });
}

function makeMaterialSet(baseTexture, opacity, cropStart = 0, cropWidth = 1) {
  return Array.from({ length: VARIANT_COUNT }, (_, variant) =>
    makeMaterial(baseTexture, variant, opacity, cropStart, cropWidth));
}

function hideProceduralForest(fallbackForest) {
  if (!fallbackForest) return;
  for (const key of ['trunks', 'crowns', 'branches', 'mounds', 'rocks']) {
    if (fallbackForest[key]) fallbackForest[key].visible = false;
  }
}

function sideFrame(road, s) {
  const tangent = new THREE.Vector3(road.tangentX(s), 0, -1).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return { tangent, normal };
}

function addClusterLayer(group, road, materials, options) {
  const {
    name,
    side,
    offsetMin,
    offsetMax,
    widthMin,
    widthMax,
    spacingMin,
    spacingMax,
    phase,
    yInset,
    yawJitter,
    renderOrder,
    seed: initialSeed,
    heightRatio = 0.5,
  } = options;

  let seed = initialSeed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const buckets = Array.from({ length: materials.length }, () => []);
  let s = -46 + phase;
  let index = 0;

  while (s < road.length + 96) {
    s += spacingMin + random() * (spacingMax - spacingMin);
    const sampleS = s + (random() - 0.5) * 6;
    const { tangent, normal } = sideFrame(road, sampleS);
    const offset = offsetMin + random() * (offsetMax - offsetMin);
    const width = widthMin + random() * (widthMax - widthMin);
    const height = width * heightRatio;
    const materialIndex =
      (index + Math.floor(random() * materials.length) + (side < 0 ? 1 : 0)) % materials.length;

    buckets[materialIndex].push({
      position: new THREE.Vector3(
        road.centerX(sampleS) + normal.x * offset * side,
        height * 0.5 - yInset,
        -sampleS + normal.z * offset * side,
      ),
      yaw: Math.atan2(-tangent.z, tangent.x) + (random() - 0.5) * yawJitter,
      width,
      height,
      mirror: random() > 0.5 ? -1 : 1,
    });
    index += 1;
  }

  const geometry = new THREE.PlaneGeometry(1, 1);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  buckets.forEach((items, materialIndex) => {
    if (!items.length) return;
    const mesh = new THREE.InstancedMesh(geometry, materials[materialIndex], items.length);
    mesh.name = `${name}-${side < 0 ? 'left' : 'right'}-${materialIndex}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = renderOrder;

    items.forEach((item, itemIndex) => {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.yaw);
      scale.set(item.width * item.mirror, item.height, 1);
      matrix.compose(item.position, quaternion, scale);
      mesh.setMatrixAt(itemIndex, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  });
}

function buildRoadsideThicket(road) {
  let seed = 73421;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const placements = [];
  for (let s = -14; s <= road.length + 28;) {
    s += 5.2 + random() * 4.8;
    for (const side of [-1, 1]) {
      const copies = random() > 0.48 ? 2 : 1;
      for (let copy = 0; copy < copies; copy += 1) {
        placements.push({
          s: s + (random() - 0.5) * 5.5,
          side,
          offset: 7.6 + random() * 4.1,
          height: 7.5 + random() * 8.5,
          radius: 0.40 + random() * 0.72,
          leanX: (random() - 0.5) * 0.10,
          leanZ: (random() - 0.5) * 0.15,
        });
      }
    }
  }

  const group = new THREE.Group();
  group.name = 'forest-roadside-thicket';

  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
  const branchGeometry = new THREE.CylinderGeometry(0.035, 0.085, 1, 5);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x111c22, fog: true });
  const branchMaterial = new THREE.MeshLambertMaterial({ color: 0x16232a, fog: true });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, placements.length);
  const branches = new THREE.InstancedMesh(branchGeometry, branchMaterial, placements.length * 3);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  let branchIndex = 0;

  placements.forEach((item, index) => {
    const { normal } = sideFrame(road, item.s);
    const p = new THREE.Vector3(
      road.centerX(item.s) + normal.x * item.offset * item.side,
      0,
      -item.s + normal.z * item.offset * item.side,
    );

    euler.set(item.leanX, 0, item.leanZ);
    quaternion.setFromEuler(euler);
    matrix.compose(
      new THREE.Vector3(p.x, item.height * 0.5 - 0.08, p.z),
      quaternion,
      new THREE.Vector3(item.radius, item.height, item.radius),
    );
    trunks.setMatrixAt(index, matrix);

    for (let j = 0; j < 3; j += 1) {
      const sideSign = j % 2 ? -1 : 1;
      const length = item.height * (0.18 + random() * 0.10);
      const branchY = item.height * (0.42 + j * 0.15);
      euler.set(
        (random() - 0.5) * 0.34,
        random() * Math.PI,
        sideSign * (0.78 + random() * 0.34),
      );
      quaternion.setFromEuler(euler);
      matrix.compose(
        new THREE.Vector3(
          p.x + sideSign * item.radius * 0.32,
          branchY,
          p.z + (random() - 0.5) * 0.75,
        ),
        quaternion,
        new THREE.Vector3(0.82, length, 0.82),
      );
      branches.setMatrixAt(branchIndex++, matrix);
    }
  });

  trunks.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  trunks.castShadow = false;
  branches.castShadow = false;
  trunks.name = 'forest-near-trunks';
  branches.name = 'forest-near-branches';
  group.add(trunks, branches);
  return group;
}

// Dense 2.5D winter forest. The painted art provides the mass of the woods,
// while a restrained set of dark foreground trunks breaks the billboard read.
// Gameplay, road geometry, collisions, vehicle physics and story are untouched.
export function buildPaintedSnowForest(scene, road, fallbackForest = null) {
  const group = new THREE.Group();
  group.name = 'painted-snow-forest';

  const loader = new THREE.TextureLoader();
  let failed = false;
  const baseTexture = loader.load(
    FOREST_SIDE_ATLAS,
    () => {
      if (!failed) hideProceduralForest(fallbackForest);
    },
    undefined,
    () => {
      failed = true;
      group.visible = false;
    },
  );
  baseTexture.colorSpace = THREE.SRGBColorSpace;

  const deep = makeMaterialSet(baseTexture, 0.46);
  const far = makeMaterialSet(baseTexture, 0.63);
  const mid = makeMaterialSet(baseTexture, 0.82);
  const denseLeft = makeMaterialSet(baseTexture, 0.94, 0.00, 0.62);
  const denseRight = makeMaterialSet(baseTexture, 0.98, 0.38, 0.62);

  for (const side of [-1, 1]) {
    addClusterLayer(group, road, deep, {
      name: 'forest-deep', side,
      offsetMin: 30, offsetMax: 39,
      widthMin: 44, widthMax: 58,
      spacingMin: 13, spacingMax: 18,
      phase: side < 0 ? -3 : 6,
      yInset: 0.70,
      yawJitter: 0.12,
      renderOrder: -8,
      seed: side < 0 ? 8101 : 9923,
      heightRatio: 0.50,
    });

    addClusterLayer(group, road, far, {
      name: 'forest-far', side,
      offsetMin: 23, offsetMax: 31,
      widthMin: 35, widthMax: 48,
      spacingMin: 10, spacingMax: 14,
      phase: side < 0 ? 5 : -5,
      yInset: 0.58,
      yawJitter: 0.14,
      renderOrder: -7,
      seed: side < 0 ? 17159 : 19447,
      heightRatio: 0.51,
    });

    addClusterLayer(group, road, mid, {
      name: 'forest-mid', side,
      offsetMin: 16, offsetMax: 23,
      widthMin: 28, widthMax: 39,
      spacingMin: 8, spacingMax: 11,
      phase: side < 0 ? -7 : 3,
      yInset: 0.45,
      yawJitter: 0.17,
      renderOrder: -6,
      seed: side < 0 ? 28151 : 32771,
      heightRatio: 0.53,
    });

    addClusterLayer(group, road, side < 0 ? denseRight : denseLeft, {
      name: 'forest-inner', side,
      offsetMin: 10.2, offsetMax: 15.0,
      widthMin: 18, widthMax: 27,
      spacingMin: 5.8, spacingMax: 8.4,
      phase: side < 0 ? 2 : -2,
      yInset: 0.30,
      yawJitter: 0.22,
      renderOrder: -5,
      seed: side < 0 ? 45137 : 49801,
      heightRatio: 0.78,
    });

    addClusterLayer(group, road, side < 0 ? denseLeft : denseRight, {
      name: 'forest-near', side,
      offsetMin: 8.0, offsetMax: 11.4,
      widthMin: 13, widthMax: 20,
      spacingMin: 4.6, spacingMax: 6.8,
      phase: side < 0 ? -1 : 1,
      yInset: 0.24,
      yawJitter: 0.28,
      renderOrder: -4,
      seed: side < 0 ? 61231 : 66959,
      heightRatio: 0.84,
    });
  }

  group.add(buildRoadsideThicket(road));
  scene.add(group);
  return group;
}
