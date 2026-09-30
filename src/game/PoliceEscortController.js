import * as THREE from 'three';
import { POST_IMPACT as STATE } from './PostImpactState.js';

// Authored road-following lead car. Player physics remain in Vehicle; this owns car-to-car spacing.
export class PoliceEscortController {
  constructor(drive, onCrash) {
    Object.assign(this, { drive, onCrash }); this.game = drive.game; this.road = drive.road;
    this.police = drive.police; this.vehicle = drive.vehicle; this.time = 0; this.followTime = 0; this.unstableTime = 0; this.departing = true;
    this.s = -this.police.group.position.z;
    const vS = -this.vehicle.position.z, side = this.vehicle.position.x < this.road.centerX(vS) ? 1 : -1;
    this.departure = new THREE.CatmullRomCurve3([
      this.police.group.position.clone(), new THREE.Vector3(this.road.centerX(this.s + 3) + side * 3.3, 0, -this.s - 3),
      new THREE.Vector3(this.road.centerX(vS + 5) + side * 3.3, 0, -vS - 5),
      new THREE.Vector3(this.road.centerX(vS + 17), 0, -vS - 17),
    ]);
    this.departureSeconds = this.departure.getLength() / 4;
    this.drive.transition(STATE.FOLLOW_POLICE); this.audioTime = 0; this.speed = 5.8;
    this.game.input.keys.clear(); this.game.container.classList.add('driving-mode');
  }
  update(dt) {
    const g = this.game, v = this.vehicle; this.time += dt; this.audioTime -= dt;
    if (this.departing) {
      const t = Math.min(1, this.time / this.departureSeconds);
      this.police.group.position.copy(this.departure.getPointAt(t));
      const tangent = this.departure.getTangentAt(t); this.police.group.rotation.y = Math.atan2(-tangent.x, -tangent.z);
      if (t === 1) { this.departing = false; this.s = -this.police.group.position.z; g.input.keys.clear(); }
    } else {
      const gap = this.s + v.position.z;
      this.speed = THREE.MathUtils.damp(this.speed, gap > 65 ? 0.8 : gap > 38 ? 2.8 : gap < 12 ? 8 : 6, 1.5, dt);
      this.s += this.speed * dt;
      if (gap < 55 && v.speed > 1) this.followTime += dt;
      let offset = 0;
      if (this.followTime >= 35) {
        if (this.drive.state !== STATE.POLICE_CAR_UNSTABLE) this.drive.transition(STATE.POLICE_CAR_UNSTABLE);
        this.unstableTime += dt; offset = Math.sin(this.unstableTime * 2.5) * Math.min(0.8, this.unstableTime * 0.13);
      }
      this.police.group.position.set(this.road.centerX(this.s) + offset, 0, -this.s);
      this.police.group.rotation.y = -Math.atan(this.road.tangentX(this.s)) + offset * 0.16;
      v.update(g.input, dt, this.road);
      // Swept forward stop line prevents tunnelling into/through the lead vehicle.
      if (-v.position.z > this.s - 6.5) {
        v.position.z = -this.s + 6.5; v.velocity.multiplyScalar(0.8);
        v.velocity.z = Math.max(v.velocity.z, -this.speed); v.speed = Math.min(v.speed, this.speed);
      }
      if (this.unstableTime >= 7) { this.onCrash(); return; }
    }
    this.police.flash(dt); this.road.snowfall.update(dt, v.position); this.road.updateCamera(dt);
    if (this.audioTime <= 0) { this.audioTime = 3; g.audio?.playCue('engine'); if (v.speed > 0.5) g.audio?.playCue('tires_snow'); }
    g.objective.textContent = 'OBJETIVO: Sigue a la patrulla.';
    g.dialogueManager.setHint(this.departing ? 'La patrulla se incorpora al camino…' : 'W/S · Pedales   A/D · Volante');
    g.bryanVisual.update(); g.input.clearFrameState(); g.renderer.render(this.road.scene, this.road.camera);
  }
}
