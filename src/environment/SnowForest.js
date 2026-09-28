import * as THREE from 'three';

// Deterministic irregular forest: hundreds of trees in a handful of instanced draws.
export function buildSnowForest(scene, road) {
  let seed = 913;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const count = Math.ceil(road.length * 0.9), pines = Math.floor(count * 0.72), bare = count - pines;
  const wood = new THREE.MeshLambertMaterial({ color: 0x263239 });
  const needles = new THREE.MeshLambertMaterial({ color: 0x1e343c });
  const snow = new THREE.MeshLambertMaterial({ color: 0x788995 });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1, 6), wood, count);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), needles, pines * 2);
  const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.085, 1, 5), wood, bare * 4);
  const mounds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), snow, Math.ceil(count / 4));
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x485760 }), Math.ceil(count / 12));
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1);
  const set = (mesh, i, x, y, z, sx, sy, sz, angle = 0) => {
    rotation.setFromAxisAngle(axis, angle);
    matrix.compose(new THREE.Vector3(x, y, z), rotation, new THREE.Vector3(sx, sy, sz)); mesh.setMatrixAt(i, matrix);
  };
  for (let i = 0; i < count; i++) {
    const s = road.cinematic ? 25 + random() * (road.length - 25) : -5 + random() * (road.length + 20);
    const side = i % 2 ? -1 : 1;
    const offset = 9 + random() * 24, x = road.centerX(s) + side * offset;
    const height = 4.2 + random() * 5.5, width = 1.1 + random() * 0.9;
    set(trunks, i, x, height / 2, -s, 1, height, 1);
    if (i < pines) {
      set(crowns, i * 2, x, height * 0.55, -s, width, height * 0.75, width);
      set(crowns, i * 2 + 1, x, height * 0.82, -s, width * 0.7, height * 0.55, width * 0.7);
    } else for (let j = 0; j < 4; j++) {
      const direction = j % 2 ? 1 : -1;
      set(branches, (i - pines) * 4 + j, x + direction * 0.45, height * (0.45 + j * 0.1), -s + (j - 1.5) * 0.18,
        1, height * 0.27, 1, direction * -0.8);
    }
  }
  for (const [mesh, size] of [[mounds, 1.6], [rocks, 0.7]]) for (let i = 0; i < mesh.count; i++) {
    const s = random() * road.length, side = i % 2 ? -1 : 1;
    set(mesh, i, road.centerX(s) + side * (8.5 + random() * 8), 0.05, -s, size * (1 + random()), size * 0.5, size);
  }
  trunks.name = 'forest-trunks';
  crowns.name = 'forest-pines';
  branches.name = 'forest-bare-branches';
  mounds.name = 'forest-snow-mounds';
  rocks.name = 'forest-rocks';
  scene.add(trunks, crowns, branches, mounds, rocks);
  return { count, trunks, crowns, branches, mounds, rocks };
}