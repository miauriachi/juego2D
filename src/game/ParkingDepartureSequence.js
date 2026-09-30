import * as THREE from 'three';

// Scripted parking departure only. Never steps or changes vehicle physics.
export class ParkingDepartureSequence {
  constructor(container, level, audio, onComplete) {
    Object.assign(this, { level, audio, onComplete });
    this.time = 0;
    this.camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.set(-3, 5.8, 12); this.camera.lookAt(8, 0.7, 0);
    this.fade = document.createElement('div');
    this.fade.style.cssText = 'position:absolute;inset:0;background:black;pointer-events:none;z-index:40;opacity:0';
    container.append(this.fade);
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5, 0, 5), new THREE.Vector3(5, 0, 0),
      new THREE.Vector3(7, 0, -2), new THREE.Vector3(12, 0, -2), new THREE.Vector3(19, 0, -2),
    ]);
    this.lamp = new THREE.SpotLight(0xe0e5db, 0, 25, 0.55, 0.5, 1.4);
    this.lamp.position.set(0, 1, -1.8); this.lamp.target.position.set(0, 0, -14);
    level.car.add(this.lamp, this.lamp.target);
  }
  update(dt) {
    this.time += dt;
    const t = this.time;
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.fade.style.opacity = String(t < 0.8 ? Math.sin(t / 0.8 * Math.PI) : t > 7.4 ? Math.min(1, (t - 7.4) / 0.6) : 0);
    if (t >= 1 && !this.started) { this.started = true; this.audio?.playCue('engine_start'); this.lamp.intensity = 120; }
    const progress = THREE.MathUtils.clamp((t - 1.8) / 6.2, 0, 1);
    const tangent = this.path.getTangentAt(progress);
    this.level.car.position.copy(this.path.getPointAt(progress));
    this.level.car.rotation.y = Math.atan2(-tangent.x, -tangent.z);
    if (progress > 0) for (const wheel of this.level.car.userData.wheels) wheel.tire.rotation.x -= dt * 5;
    this.level.update(dt, { position: this.level.car.position });
    if (t >= 8.1) { this.fade.remove(); this.onComplete(); }
  }
}
