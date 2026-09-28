import * as THREE from 'three';

function createSnowTexture(streak = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 48;
  const ctx = canvas.getContext('2d');

  if (streak) {
    const gradient = ctx.createLinearGradient(12, 6, 36, 42);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.65, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(12, 6);
    ctx.lineTo(36, 42);
    ctx.stroke();
  } else {
    const gradient = ctx.createRadialGradient(24, 24, 1, 24, 24, 20);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 48, 48);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class VehicleSnowEffects {
  constructor(scene, vehicle) {
    this.scene = scene;
    this.vehicle = vehicle;
    this.elapsed = 0;
    this.spawnAccumulator = 0;

    this.buildHeadlightSnow();
    this.buildWheelSpray();
  }

  buildHeadlightSnow() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    this.headlightSeeds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const seed = ((i * 0.618034) % 1);
      this.headlightSeeds[i] = seed;
      positions[i * 3] = (seed - 0.5) * 8.5;
      positions[i * 3 + 1] = 0.35 + ((i * 0.731) % 1) * 5.5;
      positions[i * 3 + 2] = -3.5 - ((i * 0.414214) % 1) * 18;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.headlightSnow = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: createSnowTexture(true),
        color: 0xf8fbff,
        size: 0.20,
        transparent: true,
        opacity: 0.66,
        depthWrite: false,
        fog: false,
        sizeAttenuation: true,
      }),
    );
    this.headlightSnow.name = 'vehicle-headlight-snow';
    this.headlightSnow.frustumCulled = false;
    this.headlightSnow.renderOrder = 22;
    this.vehicle.group.add(this.headlightSnow);
  }

  buildWheelSpray() {
    const count = 320;
    this.sprayPositions = new Float32Array(count * 3);
    this.sprayVelocity = new Float32Array(count * 3);
    this.sprayLife = new Float32Array(count);
    this.sprayMaxLife = new Float32Array(count);
    this.sprayCursor = 0;

    for (let i = 0; i < count; i += 1) {
      this.sprayPositions[i * 3 + 1] = -50;
      this.sprayLife[i] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));

    this.wheelSpray = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: createSnowTexture(false),
        color: 0xe9f0f5,
        size: 0.17,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        fog: true,
        sizeAttenuation: true,
      }),
    );
    this.wheelSpray.name = 'vehicle-wheel-snow-spray';
    this.wheelSpray.frustumCulled = false;
    this.wheelSpray.renderOrder = 16;
    this.scene.add(this.wheelSpray);
  }

  spawnSprayParticle(side, strength) {
    const i = this.sprayCursor;
    this.sprayCursor = (this.sprayCursor + 1) % this.sprayLife.length;

    const heading = this.vehicle.heading;
    const forward = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
    const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));

    const localBack = 1.38 + Math.random() * 0.35;
    const localSide = side * (0.72 + Math.random() * 0.20);
    const spawn = this.vehicle.position.clone()
      .addScaledVector(forward, -localBack)
      .addScaledVector(right, localSide);
    spawn.y = 0.14 + Math.random() * 0.18;

    const base = i * 3;
    this.sprayPositions[base] = spawn.x;
    this.sprayPositions[base + 1] = spawn.y;
    this.sprayPositions[base + 2] = spawn.z;

    const outward = side * (0.7 + Math.random() * 1.5) * strength;
    const backward = (1.6 + Math.random() * 2.8 + Math.abs(this.vehicle.speed) * 0.22) * strength;
    const lateralSlip = THREE.MathUtils.clamp(this.vehicle.slip * 0.25, -2.5, 2.5);

    this.sprayVelocity[base] =
      -forward.x * backward + right.x * (outward + lateralSlip) + this.vehicle.velocity.x * 0.12;
    this.sprayVelocity[base + 1] = (0.55 + Math.random() * 1.7) * strength;
    this.sprayVelocity[base + 2] =
      -forward.z * backward + right.z * (outward + lateralSlip) + this.vehicle.velocity.z * 0.12;

    const life = 0.45 + Math.random() * 0.65;
    this.sprayLife[i] = life;
    this.sprayMaxLife[i] = life;
  }

  updateHeadlightSnow(dt, gust) {
    const a = this.headlightSnow.geometry.attributes.position;
    const speed = Math.abs(this.vehicle.speed);
    const relativeRush = 5.5 + speed * 0.95 + gust * 4.5;

    for (let i = 0; i < a.count; i += 1) {
      let x = a.getX(i);
      let y = a.getY(i);
      let z = a.getZ(i);

      x += dt * (2.8 + gust * 4.0) * (0.75 + (i % 5) * 0.08);
      y -= dt * (1.2 + (i % 3) * 0.25);
      z += dt * relativeRush * (0.78 + (i % 7) * 0.035);

      if (z > 1.4 || y < 0.05 || Math.abs(x) > 5.8) {
        const seed = this.headlightSeeds[i];
        x = (seed - 0.5) * 8.5 - 1.5;
        y = 0.45 + ((i * 0.731) % 1) * 5.8;
        z = -19 - ((i * 0.414214) % 1) * 6.5;
      }

      a.setXYZ(i, x, y, z);
    }

    a.needsUpdate = true;
    this.headlightSnow.material.opacity = 0.50 + gust * 0.30;
    this.headlightSnow.material.size = 0.18 + gust * 0.10;
  }

  updateWheelSpray(dt, gust) {
    const speed = Math.abs(this.vehicle.speed);
    const surfaceBoost = this.vehicle.surface === 'DEEP_SNOW'
      ? 1.55
      : this.vehicle.surface === 'ROAD_SNOW'
        ? 1.0
        : 0.35;
    const slipBoost = 1 + Math.min(Math.abs(this.vehicle.slip) * 0.35, 1.2);
    const strength = THREE.MathUtils.clamp((speed - 1.4) / 8.5, 0, 1) * surfaceBoost * slipBoost;

    if (strength > 0.03) {
      this.spawnAccumulator += dt * (20 + strength * 70);
      const spawnCount = Math.min(18, Math.floor(this.spawnAccumulator));
      this.spawnAccumulator -= spawnCount;

      for (let n = 0; n < spawnCount; n += 1) {
        this.spawnSprayParticle(n % 2 ? -1 : 1, 0.65 + strength * 0.75);
      }
    }

    const positionAttr = this.wheelSpray.geometry.attributes.position;
    for (let i = 0; i < this.sprayLife.length; i += 1) {
      if (this.sprayLife[i] <= 0) continue;

      const base = i * 3;
      this.sprayLife[i] -= dt;

      this.sprayVelocity[base] += dt * (1.1 + gust * 1.8);
      this.sprayVelocity[base + 1] -= dt * 2.6;
      this.sprayVelocity[base + 2] += dt * 0.4;

      this.sprayPositions[base] += this.sprayVelocity[base] * dt;
      this.sprayPositions[base + 1] += this.sprayVelocity[base + 1] * dt;
      this.sprayPositions[base + 2] += this.sprayVelocity[base + 2] * dt;

      if (this.sprayLife[i] <= 0 || this.sprayPositions[base + 1] < 0.02) {
        this.sprayLife[i] = 0;
        this.sprayPositions[base + 1] = -50;
      }
    }

    positionAttr.needsUpdate = true;
    this.wheelSpray.material.opacity = 0.58 + THREE.MathUtils.clamp(strength, 0, 1) * 0.30;
    this.wheelSpray.material.size = 0.15 + THREE.MathUtils.clamp(strength, 0, 1) * 0.12;
  }

  update(dt, gust = 0) {
    this.elapsed += Math.max(0, dt);
    this.updateHeadlightSnow(dt, gust);
    this.updateWheelSpray(dt, gust);
  }
}
