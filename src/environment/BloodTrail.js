import * as THREE from 'three';

// Broken irregular marks share one draw. Occasional smears sit on fallen branches.
export class BloodTrail extends THREE.Group {
  constructor(points) {
    super(); this.name = 'BloodTrail'; this.points = points;
    const marks = [], branchMarks = [], dummy = new THREE.Object3D();
    const add = (point, size, offset, height = 0.035) => {
      dummy.position.copy(point); dummy.position.y = height; dummy.position.z += offset;
      dummy.rotation.set(-Math.PI / 2, 0, marks.length * 1.7); dummy.scale.set(size, size * 0.57, 1);
      dummy.updateMatrix(); marks.push(dummy.matrix.clone());
    };
    add(points[0], 0.6, 0);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], steps = Math.ceil(a.distanceTo(b) / 0.9);
      for (let j = 1; j <= steps; j++) {
        if ((j + i * 3) % 11 > 7) continue;
        const point = a.clone().lerp(b, j / steps);
        add(point, 0.09 + i / points.length * 0.10 + (j % 3) * 0.025, Math.sin(j * 4.7) * 0.25);
        if (j % 9 === 0) add(point.clone().add(new THREE.Vector3(0.4, 0, 0.3)), 0.08, 0);
      }
      if (i > 1 && i % 3 === 0) {
        const point = a.clone().lerp(b, 0.55); point.z += 0.65;
        branchMarks.push(point); add(point, 0.13, 0, 0.20);
      }
    }
    const mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 7), new THREE.MeshLambertMaterial({ color: 0x652c36, polygonOffset: true, polygonOffsetFactor: -1 }), marks.length);
    marks.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); this.add(mesh);
    const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 1.7, 6), new THREE.MeshLambertMaterial({ color: 0x48463e }), branchMarks.length);
    branchMarks.forEach((point, i) => {
      dummy.position.copy(point); dummy.position.y = 0.10; dummy.rotation.set(0, 0, Math.PI / 2);
      dummy.scale.set(1, 1, 1); dummy.updateMatrix(); branches.setMatrixAt(i, dummy.matrix);
    }); this.add(branches);
  }
}
