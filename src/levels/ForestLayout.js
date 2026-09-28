import * as THREE from 'three';

// Short authored forest maze: one main blood route plus a few brief dead ends.
// It is deliberately compact so the first-person section feels tense, not tedious.
export class ForestLayout {
  constructor(origin) {
    this.origin = origin;
    this.main = [
      [0, 0], [3.5, 0.2], [7, 1.6], [10.5, 4.6], [14.5, 2.8],
      [18.5, 6.5], [22.5, 6.2], [25.5, 1.2], [29, -3.2],
      [33, -2.8], [36.5, 2.4], [40.5, 2.0], [44, -0.8],
    ];
    this.branches = [
      [[10.5, 4.6], [10.8, 11.5], [5.5, 12.0]],
      [[18.5, 6.5], [19.0, 13.5], [24.5, 13.0]],
      [[25.5, 1.2], [23.0, -8.2], [17.5, -9.2]],
      [[33, -2.8], [37.0, -9.8], [42.0, -10.2]],
    ];
    this.routes = [this.main, ...this.branches];
    this.points = this.main.map(([x, z]) => this.point(x, z));
    this.length = this.points.slice(1)
      .reduce((sum, point, i) => sum + point.distanceTo(this.points[i]), 0);
  }

  point(x, z) {
    return new THREE.Vector3(this.origin.x + x, 0, this.origin.z + z);
  }

  distance(x, z) {
    let nearest = Infinity;
    for (const route of this.routes) {
      for (let i = 1; i < route.length; i += 1) {
        const [ax, az] = route[i - 1];
        const [bx, bz] = route[i];
        const dx = bx - ax;
        const dz = bz - az;
        const denom = dx * dx + dz * dz || 1;
        const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / denom, 0, 1);
        nearest = Math.min(nearest, Math.hypot(x - ax - dx * t, z - az - dz * t));
      }
    }
    return nearest;
  }

  build(scene, collision) {
    let seed = 5149;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const batches = {
      trunks: [],
      crowns: [],
      branches: [],
      rocks: [],
      snow: [],
      logs: [],
      shrubs: [],
      canopy: [],
    };

    const dummy = new THREE.Object3D();
    const add = (key, x, y, z, scale, rotation = [0, 0, 0]) => {
      dummy.position.copy(this.point(x, z));
      dummy.position.y = y;
      dummy.scale.set(...scale);
      dummy.rotation.set(...rotation);
      dummy.updateMatrix();
      batches[key].push(dummy.matrix.clone());
    };

    // Dense blocked cells build maze walls from visible trees/rocks rather than
    // invisible corridors. The route clearance stays narrow and claustrophobic.
    for (let x = 6; x <= 47; x += 2.35) {
      for (let z = -13.5; z <= 14.5; z += 2.35) {
        if (this.distance(x, z) < 3.05) continue;

        collision.addCollider({
          minX: this.origin.x + x - 1.18,
          maxX: this.origin.x + x + 1.18,
          minZ: this.origin.z + z - 1.18,
          maxZ: this.origin.z + z + 1.18,
        });

        const mound = random() < 0.38;
        add(mound ? 'snow' : 'rocks', x, mound ? -0.08 : 0.22, z,
          [1.45 + random() * 0.85, mound ? 0.36 : 0.72, 1.45 + random() * 0.95],
          [0, random() * Math.PI * 2, 0]);

        const treeCount = 2 + Math.floor(random() * 3);
        for (let i = 0; i < treeCount; i += 1) {
          const tx = x + (random() - 0.5) * 2.15;
          const tz = z + (random() - 0.5) * 2.15;
          const height = 7 + random() * 8.5;
          const width = 0.95 + random() * 1.25;

          add('trunks', tx, height * 0.5, tz,
            [0.20 + random() * 0.16, height, 0.26 + random() * 0.10],
            [(random() - 0.5) * 0.06, random() * Math.PI * 2, (random() - 0.5) * 0.12]);

          if (random() < 0.72) {
            add('crowns', tx, height * 0.54, tz, [width * 1.20, height * 0.75, width * 1.20]);
            add('crowns', tx, height * 0.80, tz, [width * 0.78, height * 0.57, width * 0.78]);
          } else {
            for (let j = 0; j < 5; j += 1) {
              add('branches',
                tx + (j % 2 ? -0.34 : 0.34),
                height * (0.34 + j * 0.105),
                tz + (random() - 0.5) * 0.35,
                [0.065, 1.7 + random() * 1.0, 0.065],
                [(random() - 0.5) * 0.25, random() * Math.PI * 2, j % 2 ? 0.92 : -0.92]);
            }
          }
        }

        if (random() < 0.28) {
          add('logs', x, 0.42, z, [0.30, 2.6 + random() * 1.9, 0.30],
            [Math.PI / 2, random() * Math.PI * 2, (random() - 0.5) * 0.22]);
        }
      }
    }

    // Low brush/snow along the actual walking route makes the trail feel less
    // like an empty corridor while keeping it navigable.
    for (let i = 1; i < this.main.length - 1; i += 1) {
      const [x, z] = this.main[i];
      for (const side of [-1, 1]) {
        const offset = 2.15 + random() * 0.75;
        add('shrubs', x + side * offset, 0.45, z + (random() - 0.5) * 1.5,
          [0.7 + random() * 0.65, 0.9 + random() * 1.0, 0.7 + random() * 0.65],
          [0, random() * Math.PI * 2, 0]);
        if (i % 2 === 0) {
          add('snow', x + side * (offset + 0.35), -0.10, z + (random() - 0.5) * 1.8,
            [0.8 + random(), 0.22 + random() * 0.20, 0.8 + random() * 1.1],
            [0, random() * Math.PI * 2, 0]);
        }
      }
    }

    // A few high branches cross overhead in first person, closing the sky.
    for (let i = 3; i < this.main.length - 1; i += 2) {
      const [x, z] = this.main[i];
      add('canopy', x, 7.5 + random() * 3.5, z,
        [0.08, 5.0 + random() * 2.6, 0.08],
        [0.1, random() * Math.PI * 2, Math.PI / 2 + (random() - 0.5) * 0.35]);
    }

    const geometry = {
      trunks: new THREE.CylinderGeometry(0.7, 1, 1, 6),
      crowns: new THREE.ConeGeometry(1, 1, 7),
      branches: new THREE.CylinderGeometry(0.5, 1, 1, 5),
      rocks: new THREE.IcosahedronGeometry(1, 0),
      snow: new THREE.IcosahedronGeometry(1, 1),
      logs: new THREE.CylinderGeometry(0.85, 1, 1, 7),
      shrubs: new THREE.ConeGeometry(1, 1, 6),
      canopy: new THREE.CylinderGeometry(0.5, 1, 1, 5),
    };

    const colors = {
      trunks: 0x172125,
      crowns: 0x15292d,
      branches: 0x182329,
      rocks: 0x34424a,
      snow: 0x8295a2,
      logs: 0x20272a,
      shrubs: 0x173037,
      canopy: 0x111a1f,
    };

    for (const key of Object.keys(batches)) {
      const mesh = new THREE.InstancedMesh(
        geometry[key],
        new THREE.MeshLambertMaterial({ color: colors[key], fog: true }),
        batches[key].length,
      );
      batches[key].forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = `maze-${key}`;
      scene.add(mesh);
    }

    this.treeCount = batches.trunks.length;
    collision.bounds = {
      minX: this.origin.x - 8,
      maxX: this.origin.x + 49,
      minZ: this.origin.z - 15,
      maxZ: this.origin.z + 16,
    };
  }
}
