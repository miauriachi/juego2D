import * as THREE from 'three';

function createFlakeTexture(streak = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 48;
  const ctx = canvas.getContext('2d');

  if (streak) {
    const gradient = ctx.createLinearGradient(10, 8, 38, 40);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.65, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(37, 40);
    ctx.stroke();
  } else {
    const gradient = ctx.createRadialGradient(24, 24, 1, 24, 24, 20);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 48, 48);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// One draw call per snow layer. Options allow a light snowfall or a dense,
// wind-driven blizzard without changing the rest of the game.
export class Snowfall {
  constructor(scene, count = 650, range = 24, options = {}) {
    this.range = range;
    this.height = options.height ?? 12;
    this.windX = options.windX ?? 1.7;
    this.windZ = options.windZ ?? 0.8;
    this.fallSpeed = options.fallSpeed ?? 2.0;
    this.windVariance = options.windVariance ?? 0.35;

    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = ((i * 0.618034) % 1 - 0.5) * range * 2;
      positions[i * 3 + 1] = (i * 0.731) % this.height;
      positions[i * 3 + 2] = ((i * 0.414214) % 1 - 0.5) * range * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      map: createFlakeTexture(Boolean(options.streak)),
      color: options.color ?? 0xc7d6e6,
      size: options.size ?? 0.12,
      transparent: true,
      opacity: options.opacity ?? 0.75,
      depthWrite: false,
      fog: true,
      sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = options.renderOrder ?? 10;
    scene.add(this.points);
  }

  update(dt, center) {
    const a = this.points.geometry.attributes.position;
    const range = this.range;

    for (let i = 0; i < a.count; i++) {
      const variance = 1 + (i % 7) * this.windVariance * 0.1;
      let x = a.getX(i) + dt * this.windX * variance;
      let y = a.getY(i) - dt * (this.fallSpeed + (i % 5) * 0.25);
      let z = a.getZ(i) + dt * this.windZ * (0.85 + (i % 3) * 0.1);

      x = center.x + THREE.MathUtils.euclideanModulo(x - center.x + range, range * 2) - range;
      z = center.z + THREE.MathUtils.euclideanModulo(z - center.z + range, range * 2) - range;
      if (y < 0) y += this.height;
      if (y > this.height) y -= this.height;
      a.setXYZ(i, x, y, z);
    }

    a.needsUpdate = true;
  }
}
