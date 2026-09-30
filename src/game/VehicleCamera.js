import * as THREE from 'three';

// Damped chase camera, completely independent of hospital camera zones.
export class VehicleCamera {
  constructor(settings = {}) {
    this.settings = settings; this.elapsed = 0; this.shake = 0;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 240);
    this.aim = new THREE.Vector3(); this.initialized = false;
  }
  update(dt, vehicle, road) {
    this.elapsed += dt; this.shake = Math.max(0, this.shake - dt);
    const p = vehicle.position, s = -p.z;
    const roadHeading = -Math.atan(road.tangentX(s));
    const relative = Math.atan2(Math.sin(vehicle.heading - roadHeading), Math.cos(vehicle.heading - roadHeading));
    const heading = roadHeading + THREE.MathUtils.clamp(relative, -0.5, 0.5) * 0.3;
    const target = new THREE.Vector3(p.x + Math.sin(heading) * 9, 4.2, p.z + Math.cos(heading) * 9);
    const aim = new THREE.Vector3(road.centerX(s + 14) * 0.65 + p.x * 0.35, 0.7, p.z - 14);
    const blend = !this.initialized || dt <= 0 ? 1 : 1 - Math.exp(-4 * dt);
    this.camera.position.lerp(target, blend); this.aim.lerp(aim, blend);
    const motion = this.settings.cameraMotion !== false;
    const vibration = motion ? Math.sin(this.elapsed * 27) * Math.min(Math.abs(vehicle.speed) / 16, 1) * 0.012 : 0;
    this.camera.lookAt(this.aim.x + (motion ? Math.sin(this.elapsed * 37) * this.shake * 0.18 : 0), this.aim.y + vibration, this.aim.z);
    this.initialized = true;
  }
  onResize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }
}
