import * as THREE from 'three';
import { LowPolyCharacter } from '../characters/LowPolyCharacter.js';
import { TimedConversation } from './TimedConversation.js';

const CALL = [
  { speaker: 'NOVIA', text: 'Bryan... tenemos que hablar.', duration: 3.5 },
  { speaker: 'BRYAN', text: 'Eso nunca empieza bien.', duration: 3.2 },
  { speaker: 'NOVIA', text: 'Estoy embarazada.', duration: 3.2 },
  { text: '', duration: 2 },
  { speaker: 'BRYAN', text: '...¿Qué?', duration: 2.7 },
  { speaker: 'NOVIA', text: 'Necesito saber qué piensas.', duration: 3.2 },
  { speaker: 'NOVIA', text: 'Si realmente queremos tenerlo.', duration: 3.3 },
  { speaker: 'BRYAN', text: 'No sé.', duration: 2.5 },
  { speaker: 'BRYAN', text: 'De verdad no sé qué decir ahora.', duration: 3.7 },
  { speaker: 'NOVIA', text: 'Pues tendremos que decidirlo.', duration: 3.4 },
  { speaker: 'BRYAN', text: '¿Podemos hablar de esto cuando llegue?', duration: 3.8 },
  { speaker: 'NOVIA', text: 'Siempre dices lo mismo.', duration: 3.2 },
];

// Mandatory road event belongs only to the accepted-delivery route.
export class DrivingSequence {
  constructor(container, road, audio, onStopped) {
    Object.assign(this, { road, audio, onStopped });
    this.conversation = new TimedConversation(container);
    this.womanS = 620;
    this.woman = new LowPolyCharacter({ kind: 'RoadWoman', female: true, build: 'slim',
      clothing: 0xb2b5b4, trousers: 0x49545b, skin: 0xbba393, hair: 0x282326, accent: 0x8f999c });
    this.woman.rotation.y = Math.PI;
    road.scene.add(this.woman); this.reset();
  }
  reset() {
    this.version = this.road.restartVersion; this.phase = 'driving'; this.time = 0;
    this.visibleTime = 0; this.callStarted = false; this.impactPosition = null;
    this.woman.visible = false; this.woman.position.set(this.road.centerX(this.womanS) + 0.8, 0, -this.womanS);
    this.conversation.reset();
  }
  get objectiveText() {
    return this.phase === 'aftermath' || this.phase === 'complete'
      ? 'OBJETIVO: Averigua qué pasó.' : this.phase === 'impact' ? '' : 'OBJETIVO: Viaja rumbo a Raccoon City.';
  }
  update(dt) {
    if (this.version !== this.road.restartVersion) this.reset();
    const vehicle = this.road.vehicle, s = -vehicle.position.z;
    if (this.phase === 'driving' || this.phase === 'revealed') {
      if (!this.callStarted && s >= 120) { this.callStarted = true; this.conversation.start(CALL); }
      this.conversation.update(dt);
      if (s >= this.womanS - Math.max(12, vehicle.speed * 1.9) && this.phase === 'driving') {
        this.phase = 'revealed'; this.woman.visible = true;
        this.crossingStart = new THREE.Vector3(this.road.centerX(this.womanS) + 6.1, 0, -this.womanS);
        this.woman.position.copy(this.crossingStart);
      }
      if (this.phase === 'revealed') {
        this.visibleTime += dt;
        // The runner crosses toward the driver's lane, including an attempted swerve.
        const progress = Math.min(1, this.visibleTime / 1.8);
        const old = this.woman.position.clone();
        const remaining = Math.max(0, 1.8 - this.visibleTime);
        const front = new THREE.Vector3(-Math.sin(vehicle.heading) * 2, 0, -Math.cos(vehicle.heading) * 2);
        const intercept = vehicle.position.clone().addScaledVector(vehicle.velocity, remaining).add(front);
        intercept.y = 0;
        this.woman.position.lerpVectors(this.crossingStart, intercept, progress);
        const direction = this.woman.position.clone().sub(old);
        if (direction.lengthSq() > 0.00001) this.woman.rotation.y = Math.atan2(-direction.x, -direction.z);
        this.woman.animate(dt, dt > 0 ? Math.max(2.8, old.distanceTo(this.woman.position) / dt) : 2.8, true);
        if (progress >= 1) {
          this.impactPosition = this.woman.position.clone();
          this.phase = 'impact'; this.time = 0; this.road.driveEnabled = false;
          this.conversation.stop(); this.woman.visible = false;
          this.audio?.impact(); this.road.vehicleCamera.shake = 0.9;
          vehicle.velocity.x += 2.4; vehicle.yawRate = 0.6;
        }
      }
    } else if (this.phase === 'impact') {
      this.time += dt;
      vehicle.velocity.multiplyScalar(Math.exp(-2.1 * dt));
      vehicle.position.addScaledVector(vehicle.velocity, dt);
      const center = this.road.centerX(-vehicle.position.z);
      vehicle.position.x = THREE.MathUtils.clamp(vehicle.position.x, center - 4.2, center + 4.2);
      vehicle.heading += vehicle.yawRate * dt;
      vehicle.yawRate *= Math.exp(-2 * dt);
      vehicle.group.rotation.set(0.035 * Math.exp(-this.time), vehicle.heading, 0);
      vehicle.speed = vehicle.velocity.length();
      if (this.time >= 2.6) {
        vehicle.velocity.set(0, 0, 0); vehicle.speed = 0;
        this.road.completed = true; this.phase = 'aftermath';
        this.onStopped(() => { this.phase = 'complete'; });
      }
    }
  }
}
