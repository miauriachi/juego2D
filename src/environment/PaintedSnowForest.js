import * as THREE from 'three';
import { FOREST_SIDE_ATLAS } from './ForestArtData.js';

const VARIANT_COUNT = 4;

function createForestMaterial(loader, variant, opacity, onLoaded, onError) {
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
    transparent: true,
    opacity,
    alphaTest: 0.018,
    depthWrite: false,
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
  } = options;

  let seed = initialSeed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let s = -38 + phase;
  let index = 0;
  while (s < road.length + 80) {
    s += spacingMin + random() * (spacingMax - spacingMin);
    const sampleS = s + (random() - 0.5) * 5.5;
    const { tangent, normal } = sideFrame(road, sampleS);
    const offset = offsetMin + random() * (offsetMax - offsetMin);
    const width = widthMin + random() * (widthMax - widthMin);
    const height = width * 0.50;
    const p = new THREE.Vector3(
      road.centerX(sampleS) + normal.x * offset * side,
      height * 0.5 - yInset,
      -sampleS + normal.z * offset * side,
    );

    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    const variant = (index + (side < 0 ? 2 : 0) + Math.floor(random() * VARIANT_COUNT)) % VARIANT_COUNT;
    const panel = new THREE.Mesh(geometry, materials[variant]);
    panel.name = `${name}-${side < 0 ? 'left' : 'right'}-${index}`;
    panel.position.copy(p);
    panel.rotation.y = Math.atan2(-tangent.z, tangent.x) + (random() - 0.5) * yawJitter;
    panel.renderOrder = renderOrder;
    panel.frustumCulled = true;
    if (random() > 0.5) panel.scale.x = -1;
    group.add(panel);
    index += 1;
  }
}

// 2.5D painted roadside forest. Instead of continuous opaque walls, this uses
// overlapping soft-edged art clusters at different depths. Road geometry,
// vehicle physics, camera logic, collisions and narrative remain untouched.
export function buildPaintedSnowForest(scene, road, fallbackForest = null) {
  const group = new THREE.Group();
  group.name = 'painted-snow-forest';

  const loader = new THREE.TextureLoader();
  let loaded = 0;
  let failed = false;
  const expectedLoads = VARIANT_COUNT * 3;
  const onLoaded = () => {
    loaded += 1;
    if (!failed && loaded === expectedLoads) hideProceduralForest(fallbackForest);
  };
  const onError = () => {
    failed = true;
    group.visible = false;
  };

  const farMaterials = Array.from({ length: VARIANT_COUNT }, (_, variant) =>
    createForestMaterial(loader, variant, 0.48, onLoaded, onError));
  const midMaterials = Array.from({ length: VARIANT_COUNT }, (_, variant) =>
    createForestMaterial(loader, variant, 0.74, onLoaded, onError));
  const nearMaterials = Array.from({ length: VARIANT_COUNT }, (_, variant) =>
    createForestMaterial(loader, variant, 0.96, onLoaded, onError));

  for (const side of [-1, 1]) {
    addClusterLayer(group, road, farMaterials, {
      name: 'forest-far', side,
      offsetMin: 23, offsetMax: 31,
      widthMin: 31, widthMax: 40,
      spacingMin: 18, spacingMax: 24,
      phase: side < 0 ? -4 : 7,
      yInset: 0.55,
      yawJitter: 0.14,
      renderOrder: -5,
      seed: side < 0 ? 9173 : 11939,
    });

    addClusterLayer(group, road, midMaterials, {
      name: 'forest-mid', side,
      offsetMin: 16, offsetMax: 22,
      widthMin: 25, widthMax: 33,
      spacingMin: 14, spacingMax: 19,
      phase: side < 0 ? 5 : -7,
      yInset: 0.42,
      yawJitter: 0.18,
      renderOrder: -4,
      seed: side < 0 ? 27811 : 31517,
    });

    addClusterLayer(group, road, nearMaterials, {
      name: 'forest-near', side,
      offsetMin: 11.4, offsetMax: 15.8,
      widthMin: 19, widthMax: 27,
      spacingMin: 11, spacingMax: 16,
      phase: side < 0 ? -2 : 4,
      yInset: 0.30,
      yawJitter: 0.22,
      renderOrder: -3,
      seed: side < 0 ? 44357 : 49991,
    });
  }

  scene.add(group);
  return group;
}