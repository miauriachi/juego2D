import * as THREE from 'three';

// One draw call for the storm; flakes wrap around a finite world-space volume.
export class Snowfall {
  constructor(scene, count = 650, range = 24) {
    this.range = range;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = ((i * 0.618034) % 1 - 0.5) * range * 2;
      positions[i * 3 + 1] = (i * 0.731) % 12;
      positions[i * 3 + 2] = ((i * 0.414214) % 1 - 0.5) * range * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(canvas), color: 0xc7d6e6,
      size: 0.12, transparent: true, opacity: 0.75, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt, center) {
    const a = this.points.geometry.attributes.position, range = this.range;
    for (let i = 0; i < a.count; i++) {
      let x = a.getX(i) + dt * (1.7 + i % 3 * 0.15);
      let y = a.getY(i) - dt * (2.0 + i % 5 * 0.2);
      let z = a.getZ(i) + dt * 0.8;
      x = center.x + THREE.MathUtils.euclideanModulo(x - center.x + range, range * 2) - range;
      z = center.z + THREE.MathUtils.euclideanModulo(z - center.z + range, range * 2) - range;
      if (y < 0) y += 12;
      a.setXYZ(i, x, y, z);
    }
    a.needsUpdate = true;
  }
}
