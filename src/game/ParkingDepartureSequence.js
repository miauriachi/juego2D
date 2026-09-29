import * as THREE from 'three';
import { exteriorConfig } from './ExteriorConfig.js';

// Scripted departure on the SAME fixed prerendered hospital camera.
// The car leaves the bay, joins the central aisle and follows the user's
// red-marked route toward the upper-left guard booth / exit barrier.
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
    const authoredPath = exteriorConfig.carPath
      .map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const firstTarget = authoredPath[0] ?? start.clone().add(new THREE.Vector3(0, 0, -1));
    const forward = firstTarget.clone().sub(start).setY(0).normalize();

    // The parked car is intentionally facing the opposite direction in the
    // prerender. Pull toward the authored aisle instead of blindly following
    // that parked heading, so the scripted departure still starts cleanly.
    const points = [
      start,
      start.clone().addScaledVector(forward, 0.55),
      start.clone().addScaledVector(forward, 1.05),
      ...authoredPath,
    ];
    this.path = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.28);

    this.lamp = new THREE.SpotLight(0xe8e1c8, 0, 10, 0.5, 0.45, 1.3);
    this.lamp.position.set(0, 0.62, -0.9);
    this.lamp.target.position.set(0, 0.05, -4);
    level.car.add(this.lamp, this.lamp.target);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    // Never leave this camera/plate until the car reaches the exit.
    this.level.cameraManager.applyToCamera(this.level.cameraManager.cameraRig);

    // Brief ignition pause, then a long visible drive across the parking lot.
    if (t >= 0.55 && !this.started) {
      this.started = true;
      this.audio?.playCue('engine_start');
      this.lamp.intensity = 92;
    }

    const progress = THREE.MathUtils.clamp((t - 1.0) / 8.25, 0, 1);
    const point = this.path.getPointAt(progress);
    const tangent = this.path.getTangentAt(progress);

    this.level.car.position.copy(point);

    if (progress > 0) {
      const targetHeading = Math.atan2(-tangent.x, -tangent.z);
      const delta = Math.atan2(
        Math.sin(targetHeading - this.level.car.rotation.y),
        Math.cos(targetHeading - this.level.car.rotation.y),
      );
      this.level.car.rotation.y += delta * Math.min(1, dt * 5.2);

      for (const wheel of this.level.car.userData.wheels) {
        wheel.tire.rotation.x -= dt * 6.5;
      }
    }

    // Only fade once the car is at the booth/exit end of the marked route.
    const fade = t > 9.05 ? THREE.MathUtils.clamp((t - 9.05) / 0.75, 0, 1) : 0;
    this.fade.style.opacity = String(fade);

    if (t >= 9.82) {
      this.fade.remove();
      this.onComplete();
    }
  }
}
