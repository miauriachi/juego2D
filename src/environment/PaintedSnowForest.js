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

function hideProceduralTrees(fallbackForest) {
  if (!fallbackForest) return;
  for (const key of ['trunks', 'crowns', 'branches']) {
    if (fallbackForest[key]) fallbackForest[key].visible = false;
  }
}

// Painted roadside forest art pass. It changes presentation only: the road,
// vehicle physics, camera, collisions and narrative timing remain untouched.
// The original procedural forest stays alive as a safe fallback until the
// embedded painted atlas has loaded successfully.
export function buildPaintedSnowForest(scene, road, fallbackForest = null) {
  const group = new THREE.Group();
  group.name = 'painted-snow-forest';

  const loader = new THREE.TextureLoader();
  let loaded = 0;
  let failed = false;
  const onLoaded = () => {
    loaded += 1;
    if (!failed && loaded === VARIANT_COUNT) hideProceduralTrees(fallbackForest);
  };
  const onError = () => { failed = true; };
  const materials = Array.from({ length: VARIANT_COUNT }, (_, variant) =>
    createForestMaterial(loader, variant, onLoaded, onError));

  const panelWidth = 27;
  const panelHeight = 11.45;
  const panelStep = 22.5;
  const sideOffset = 13.4;
  const geometry = new THREE.PlaneGeometry(panelWidth, panelHeight, 1, 1);

  let panelIndex = 0;
  for (let s = -8; s <= road.length + 28; s += panelStep, panelIndex++) {
    const tangent = new THREE.Vector3(road.tangentX(s), 0, -1).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const yaw = Math.atan2(-tangent.z, tangent.x);

    for (const side of [-1, 1]) {
      const materialIndex = (panelIndex + (side < 0 ? 2 : 0)) % materials.length;
      const panel = new THREE.Mesh(geometry, materials[materialIndex]);
      panel.name = `painted-forest-${side < 0 ? 'left' : 'right'}-${panelIndex}`;
      panel.position.set(
        road.centerX(s) + normal.x * sideOffset * side,
        panelHeight * 0.5 - 0.18,
        -s + normal.z * sideOffset * side,
      );
      panel.rotation.y = yaw;

      // Alternate mirroring so distinctive painted landmarks do not reveal repetition.
      if ((panelIndex + (side < 0 ? 1 : 0)) % 2) panel.scale.x = -1;
      group.add(panel);
    }
  }

  scene.add(group);
  return group;
}