import * as THREE from 'three';

// One authored route graph drives the trail, rescue route and natural obstructions.
export class ForestLayout {
  constructor(origin) {
    this.origin = origin;
    this.main = [[0, 0], [7, 0], [14, 3], [20, 10], [32, 10], [32, -9],
      [46, -9], [46, 14], [64, 14], [64, -12], [82, -12], [82, 11], [97, 11]];
    this.branches = [[[20, 10], [20, 23], [10, 23]], [[32, -9], [26, -21]],
      [[46, 14], [46, 26], [60, 26]], [[64, -12], [56, -23]],
      [[82, 11], [72, 5], [72, -1]], [[82, -12], [94, -20], [102, -15]]];
    const compact = ([x, z]) => [x <= 7 ? x : 7 + (x - 7) * 0.65, z * 0.65];
    this.main = this.main.map(compact); this.branches = this.branches.map(route => route.map(compact));
    this.routes = [this.main, ...this.branches];
    this.points = this.main.map(([x, z]) => this.point(x, z));
    this.length = this.points.slice(1).reduce((sum, p, i) => sum + p.distanceTo(this.points[i]), 0);
  }
  point(x, z) { return new THREE.Vector3(this.origin.x + x, 0, this.origin.z + z); }
  distance(x, z) {
    let nearest = Infinity;
    for (const route of this.routes) for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1], [bx, bz] = route[i];
      const t = THREE.MathUtils.clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
      nearest = Math.min(nearest, Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t));
    }
    return nearest;
  }
  build(scene, collision) {
    let seed = 5149;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const batches = { trunks: [], crowns: [], branches: [], rocks: [], snow: [], logs: [] };
    const dummy = new THREE.Object3D();
    const add = (key, x, y, z, scale, rotation = [0, 0, 0]) => {
      dummy.position.copy(this.point(x, z)); dummy.position.y = y; dummy.scale.set(...scale);
      dummy.rotation.set(...rotation); dummy.updateMatrix(); batches[key].push(dummy.matrix.clone());
    };
    // Irregular clusters occupy blocked cells. Every collider has a visible rock/snow/log mass.
    for (let x = 9; x <= 76; x += 3) for (let z = -23; z <= 25; z += 3) {
      if (this.distance(x, z) < 4.1) continue;
      collision.addCollider({ minX: this.origin.x + x - 1.5, maxX: this.origin.x + x + 1.5,
        minZ: this.origin.z + z - 1.5, maxZ: this.origin.z + z + 1.5 });
      const rock = random() < 0.65;
      add(rock ? 'rocks' : 'snow', x, rock ? 0.25 : -0.15, z, [2, rock ? 0.85 : 0.45, 2], [0, random() * 6, 0]);
      const count = 2 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const tx = x + (random() - 0.5) * 2.5, tz = z + (random() - 0.5) * 2.5;
        const h = 4.5 + random() * 5, width = 0.8 + random() * 0.9;
        add('trunks', tx, h / 2, tz, [0.18 + random() * 0.15, h, 0.24], [0, random() * 6, (random() - 0.5) * 0.1]);
        if (random() < 0.76) {
          add('crowns', tx, h * 0.6, tz, [width, h * 0.7, width]);
          add('crowns', tx, h * 0.83, tz, [width * 0.65, h * 0.5, width * 0.65]);
        } else for (let j = 0; j < 4; j++) add('branches', tx + (j % 2 ? -0.4 : 0.4), h * (0.35 + j * 0.12), tz,
          [0.07, 1.7, 0.07], [0.2, random() * 6, j % 2 ? 0.9 : -0.9]);
      }
      if (random() < 0.25) add('logs', x, 0.65, z, [0.35, 3.7, 0.35], [Math.PI / 2, 0, random() * 6]);
    }
    const geometry = {
      trunks: new THREE.CylinderGeometry(0.7, 1, 1, 6), crowns: new THREE.ConeGeometry(1, 1, 7),
      branches: new THREE.CylinderGeometry(0.5, 1, 1, 5), rocks: new THREE.IcosahedronGeometry(1, 0),
      snow: new THREE.IcosahedronGeometry(1, 1), logs: new THREE.CylinderGeometry(0.85, 1, 1, 7),
    };
    const colors = { trunks: 0x3c4546, crowns: 0x263e3c, branches: 0x495153, rocks: 0x5b6a75, snow: 0x91a6b6, logs: 0x3b3935 };
    for (const key of Object.keys(batches)) {
      const mesh = new THREE.InstancedMesh(geometry[key], new THREE.MeshLambertMaterial({ color: colors[key] }), batches[key].length);
      batches[key].forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.name = `maze-${key}`; scene.add(mesh);
    }
    this.treeCount = batches.trunks.length;
    collision.bounds = { minX: this.origin.x - 9, maxX: this.origin.x + 74, minZ: this.origin.z - 21, maxZ: this.origin.z + 23 };
    // Shallow roadside deposits only; no new wall of snow across the driven lane.
    for (const x of [-7.5, 7.5]) for (const z of [-13, -9, -5, 4, 8]) {
      const mound = new THREE.Mesh(geometry.snow, new THREE.MeshLambertMaterial({ color: colors.snow }));
      mound.position.copy(this.point(x, z)); mound.position.y = -0.08;
      mound.scale.set(0.65 + random() * 0.3, 0.22 + random() * 0.13, 1.1 + random() * 0.5); scene.add(mound);
    }
    const ridge = new THREE.Mesh(geometry.snow, new THREE.MeshLambertMaterial({ color: colors.snow }));
    ridge.position.copy(this.point(-11, -1)); ridge.position.y = -0.15; ridge.scale.set(2.3, 0.6, 13); scene.add(ridge);
    collision.addCollider({ minX: this.origin.x - 14, maxX: this.origin.x - 8.8, minZ: this.origin.z - 14, maxZ: this.origin.z + 12 });
  }
}
