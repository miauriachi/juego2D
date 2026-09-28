import * as THREE from 'three';

// Authored fixed-camera forest route. There is one readable path through the
// trees, with dense natural barriers on both sides, like a classic RE exterior
// room rather than a first-person maze.
export class ForestLayout {
  constructor(origin) {
    this.origin = origin;

    this.main = [
      [0, 0],
      [3.8, 0.3],
      [7.6, 1.4],
      [11.6, 3.8],
      [15.8, 2.7],
      [19.9, 5.4],
      [24.1, 4.7],
      [28.0, 1.2],
      [31.8, -2.2],
      [35.8, -1.6],
      [39.8, 1.3],
      [43.5, 0.5],
    ];

    this.routes = [this.main];
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
      banks: [],
      path: [],
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

    // A visible, slightly dirty snow path gives the player a clear route,
    // similar to the readable walkable surfaces in classic fixed-camera rooms.
    for (let i = 1; i < this.main.length; i += 1) {
      const [ax, az] = this.main[i - 1];
      const [bx, bz] = this.main[i];
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;

      add('path', mx, 0.018, mz, [4.7, 0.045, length + 0.9], [0, yaw, 0]);

      // Snow banks and brush define the corridor without invisible walls.
      const nx = -dz / Math.max(0.001, length);
      const nz = dx / Math.max(0.001, length);
      const steps = Math.max(1, Math.ceil(length / 2.2));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const px = THREE.MathUtils.lerp(ax, bx, t);
        const pz = THREE.MathUtils.lerp(az, bz, t);

        for (const side of [-1, 1]) {
          const wobble = (random() - 0.5) * 0.55;
          const edge = 2.55 + random() * 0.40;
          const ex = px + nx * edge * side + wobble;
          const ez = pz + nz * edge * side + wobble;

          add('banks', ex, 0.08, ez,
            [0.70 + random() * 0.75, 0.24 + random() * 0.24, 0.95 + random() * 1.10],
            [0, random() * Math.PI, 0]);

          if (random() < 0.62) {
            add('shrubs', ex + nx * side * 0.30, 0.42, ez + nz * side * 0.30,
              [0.55 + random() * 0.60, 0.80 + random() * 1.05, 0.55 + random() * 0.65],
              [0, random() * Math.PI * 2, 0]);
          }
        }
      }
    }

    // Dense blocked cells form the forest walls. The player sees trees, rocks,
    // logs and snow banks wherever movement is not intended.
    for (let x = 5.5; x <= 47; x += 2.15) {
      for (let z = -12.5; z <= 13.0; z += 2.15) {
        if (this.distance(x, z) < 3.15) continue;

        collision.addCollider({
          minX: this.origin.x + x - 1.08,
          maxX: this.origin.x + x + 1.08,
          minZ: this.origin.z + z - 1.08,
          maxZ: this.origin.z + z + 1.08,
        });

        if (random() < 0.43) {
          add('snow', x, -0.06, z,
            [1.35 + random() * 0.95, 0.30 + random() * 0.28, 1.45 + random() * 1.0],
            [0, random() * Math.PI * 2, 0]);
        } else {
          add('rocks', x, 0.24, z,
            [0.90 + random() * 0.85, 0.55 + random() * 0.55, 0.95 + random() * 0.90],
            [0, random() * Math.PI * 2, 0]);
        }

        const treeCount = 2 + Math.floor(random() * 3);
        for (let i = 0; i < treeCount; i += 1) {
          const tx = x + (random() - 0.5) * 1.95;
          const tz = z + (random() - 0.5) * 1.95;
          const height = 8.0 + random() * 9.5;
          const width = 1.0 + random() * 1.35;

          add('trunks', tx, height * 0.5, tz,
            [0.22 + random() * 0.17, height, 0.28 + random() * 0.11],
            [(random() - 0.5) * 0.07, random() * Math.PI * 2, (random() - 0.5) * 0.13]);

          if (random() < 0.68) {
            add('crowns', tx, height * 0.53, tz,
              [width * 1.28, height * 0.78, width * 1.28]);
            add('crowns', tx, height * 0.80, tz,
              [width * 0.82, height * 0.60, width * 0.82]);
          } else {
            for (let j = 0; j < 5; j += 1) {
              add('branches',
                tx + (j % 2 ? -0.34 : 0.34),
                height * (0.33 + j * 0.11),
                tz + (random() - 0.5) * 0.38,
                [0.065, 1.8 + random() * 1.1, 0.065],
                [(random() - 0.5) * 0.28, random() * Math.PI * 2, j % 2 ? 0.94 : -0.94]);
            }
          }
        }

        if (random() < 0.34) {
          add('logs', x, 0.38, z,
            [0.28, 2.8 + random() * 2.0, 0.28],
            [Math.PI / 2, random() * Math.PI * 2, (random() - 0.5) * 0.20]);
        }
      }
    }

    // High branches close the composition above several bends so fixed cameras
    // can use them as foreground/occlusion, like pre-rendered outdoor rooms.
    for (let i = 2; i < this.main.length - 1; i += 2) {
      const [x, z] = this.main[i];
      add('canopy', x, 7.8 + random() * 3.8, z,
        [0.085, 5.6 + random() * 2.8, 0.085],
        [0.10, random() * Math.PI * 2, Math.PI / 2 + (random() - 0.5) * 0.35]);
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
      banks: new THREE.IcosahedronGeometry(1, 1),
      path: new THREE.BoxGeometry(1, 1, 1),
    };

    const colors = {
      trunks: 0x162126,
      crowns: 0x173038,
      branches: 0x172329,
      rocks: 0x34424a,
      snow: 0x8798a4,
      logs: 0x20272a,
      shrubs: 0x19323a,
      canopy: 0x111a1f,
      banks: 0x91a3ad,
      path: 0x667985,
    };

    for (const key of Object.keys(batches)) {
      const mesh = new THREE.InstancedMesh(
        geometry[key],
        new THREE.MeshLambertMaterial({
          color: colors[key],
          fog: true,
        }),
        batches[key].length,
      );
      batches[key].forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = `forest-room-${key}`;
      if (key === 'path') mesh.receiveShadow = true;
      scene.add(mesh);
    }

    this.treeCount = batches.trunks.length;
    collision.bounds = {
      minX: this.origin.x - 7,
      maxX: this.origin.x + 47,
      minZ: this.origin.z - 13.5,
      maxZ: this.origin.z + 14,
    };
  }
}
