import * as THREE from 'three';
import { exteriorConfig } from './ExteriorConfig.js';

// Scripted departure on the same fixed prerendered camera.
// The car follows the route marked by the user: parking space -> center aisle -> gate.
export class ParkingDepartureSequence {
  constructor(container, level, audio, onComplete) {
    Object.assign(this, { level, audio, onComplete });
    this.time = 0;

    level.cameraManager.applyToCamera(level.cameraManager.cameraRig);
    this.camera = level.cameraManager.activeCamera;

    this.fade = document.createElement('div');
    this.fade.style.cssText =
      'position:absolute;inset:0;background:black;pointer-events:none;z-index:40;opacity:0';
    container.append(this.fade);

    this.initialHeading = level.car.rotation.y;
    const start = level.car.position.clone();
    const forward = new THREE.Vector3(-Math.sin(this.initialHeading),0,-Math.cos(this.initialHeading));
    this.path = new THREE.CatmullRomCurve3(
      [start, start.clone().addScaledVector(forward,0.7),
        ...exteriorConfig.carPath.map(([x, y, z]) => new THREE.Vector3(x, y, z))],
      false,
      'catmullrom',
      0.34,
    );

    this.lamp = new THREE.SpotLight(0xe8e1c8, 0, 10, 0.5, 0.45, 1.3);
    this.lamp.position.set(0, 0.62, -0.9);
    this.lamp.target.position.set(0, 0.05, -4);
    level.car.add(this.lamp, this.lamp.target);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    // Keep the exact same plate/camera during the whole departure.
    this.level.cameraManager.applyToCamera(this.level.cameraManager.cameraRig);

    this.fade.style.opacity = String(
      t < 0.55 ? Math.sin((t / 0.55) * Math.PI) * 0.12 :
      t > 7.25 ? Math.min(1, (t - 7.25) / 0.75) : 0
    );

    if (t >= 0.65 && !this.started) {
      this.started = true;
      this.audio?.playCue('engine_start');
      this.lamp.intensity = 95;
    }

    const progress = THREE.MathUtils.clamp((t - 1.15) / 6.4, 0, 1);
    const point = this.path.getPointAt(progress);
    const tangent = this.path.getTangentAt(progress);

    this.level.car.position.copy(point);
    // Stay exactly parked throughout the boarding/ignition pause. Ease into
    // the route tangent, avoiding an orientation snap on the first frame.
    if (progress > 0) {
      const target = Math.atan2(-tangent.x, -tangent.z);
      const delta = Math.atan2(Math.sin(target-this.level.car.rotation.y), Math.cos(target-this.level.car.rotation.y));
      this.level.car.rotation.y += delta * Math.min(1,dt*7);
    }

    if (progress > 0) {
      for (const wheel of this.level.car.userData.wheels) {
        wheel.tire.rotation.x -= dt * 7;
      }
    }

    if (t >= 8.05) {
      this.fade.remove();
      this.onComplete();
    }
  }
}
