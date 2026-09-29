import * as THREE from 'three';
import { SnowRoad } from '../levels/SnowRoad.js';
import { PoliceCar } from './PoliceCar.js';
import { TimedConversation } from './TimedConversation.js';
import { POST_IMPACT as STATE } from './PostImpactState.js';
import { PoliceStopSequence } from './PoliceStopSequence.js';
import { PoliceEscortController } from './PoliceEscortController.js';
import { PoliceCrashSequence } from './PoliceCrashSequence.js';

// Return journey uses the unchanged Vehicle controller, including during assisted shots.
export class PassengerDriveSequence {
  constructor(game, interior, setState) {
    Object.assign(this, { game, interior, setState });
    this.road = new SnowRoad({ settings: game.settings, length: 5000 });
    this.road.scene.remove(this.road.vehicle.group);
    this.road.vehicle = game.snowRoad.vehicle; this.road.scene.add(this.road.vehicle.group);
    this.vehicle = this.road.vehicle;

    // The post-impact fixed-camera sequence enlarges only the detailed sedan
    // for composition. Reset that presentation scale before returning to the
    // road; otherwise the interior camera can end up inside the enlarged body.
    this.vehicle.group.visible = true;
    this.vehicle.group.userData.aftermathVisualScale = 1;
    if (this.vehicle.group.userData.detailedVisual) {
      const detailed = this.vehicle.group.userData.detailedVisual;
      detailed.visible = true;
      detailed.scale.setScalar(1);
      detailed.traverse(object => {
        if (object.isMesh || object.isLine || object.isPoints) object.visible = true;
      });
      this.vehicle.group.traverse(object => {
        if (object.userData?.proceduralCarVisual) object.visible = false;
      });
    } else {
      this.vehicle.group.traverse(object => {
        if (object.userData?.proceduralCarVisual) object.visible = true;
      });
    }

    // CarInterior was created while the sedan still belonged to the forest
    // scene. Moving the car to this road keeps the hierarchy, but explicitly
    // restore its presentation nodes so an earlier backplate hide cannot leak
    // into the in-car shot.
    this.interior.group.visible = true;
    this.interior.group.traverse(object => {
      if (object.isMesh || object.isLine || object.isPoints) object.visible = true;
    });
    this.interior.passengerDoor.visible = true;
    this.vehicle.group.updateMatrixWorld(true);

    this.startZ = this.vehicle.position.z;
    this.rejoinTime = 0; this.rejoinStart = this.vehicle.position.clone(); this.rejoinHeading = this.vehicle.heading;
    this.rejoinEnd = new THREE.Vector3(this.road.centerX(-this.startZ + 6), 0, this.startZ - 6);
    this.road.vehicleCamera.initialized = false; this.road.updateCamera();
    this.police = new PoliceCar(this.road.scene);
    this.conversation = new TimedConversation(game.container);
    this.state = STATE.DRIVING_WITH_WOMAN; this.setState(this.state);
    this.time = 0; this.audioTime = 0; this.stopTime = 0;
    this.finalCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 150);
    game.container.classList.add('driving-mode'); game.input.keys.clear(); game.input.clearFrameState();
    game.dialogueManager.setHint('');
  }
  transition(state) { this.state = state; this.time = 0; this.setState(state); }
  get objectiveText() { return [STATE.PULL_OVER, STATE.STOPPED].includes(this.state) ? 'OBJETIVO: Detente.' : 'OBJETIVO: Lleva a la mujer a buscar ayuda.'; }
  assistedInput() {
    const v = this.vehicle, s = -v.position.z;
    const desired = -Math.atan(this.road.tangentX(s + 7)) + (v.position.x - this.road.centerX(s + 4)) * 0.10;
    const error = Math.atan2(Math.sin(desired - v.heading), Math.cos(desired - v.heading)) - v.yawRate * 0.85;
    return { isPressed: key => ({ KeyW: v.speed < 5.8, KeyS: v.speed > 6.8, KeyA: error > 0.04, KeyD: error < -0.04 })[key] || false };
  }
  update(dt) {
    if (this.policeCrash) { this.policeCrash.update(dt); return; }
    if (this.escort) { this.escort.update(dt); return; }
    if (this.policeStop) { this.policeStop.update(dt); return; }
    if (this.state === STATE.STOPPED) {
      this.fade?.remove(); this.fade = null;
      this.policeStop = new PoliceStopSequence(this, () => {
        this.policeStop = null;
        this.escort = new PoliceEscortController(this, () => { this.policeCrash = new PoliceCrashSequence(this); });
      });
      this.policeStop.update(0); return;
    }
    const g = this.game, v = this.vehicle;
    this.time += dt; this.audioTime -= dt;
    const interiorShot = this.state === STATE.WOMAN_AGITATED || this.state === STATE.POLICE_APPROACH;
    // A new, post-rescue parking manoeuvre; the original impact/stop code is untouched.
    if (this.rejoinTime < 4) {
      this.rejoinTime = Math.min(4, this.rejoinTime + dt);
      const t = this.rejoinTime / 4;
      const before = v.position.clone(); v.position.lerpVectors(this.rejoinStart, this.rejoinEnd, t * t * (3 - 2 * t));
      const targetHeading = -Math.atan(this.road.tangentX(-v.position.z));
      v.heading = this.rejoinHeading + Math.atan2(Math.sin(targetHeading - this.rejoinHeading), Math.cos(targetHeading - this.rejoinHeading)) * t;
      v.group.rotation.set(0, v.heading, 0); v.speed = dt > 0 ? before.distanceTo(v.position) / dt : 0;
      if (this.rejoinTime === 4) {
        v.velocity.set(-Math.sin(v.heading), 0, -Math.cos(v.heading)).multiplyScalar(2);
        v.speed = 2; v.yawRate = 0; v.steering = 0; g.input.keys.clear();
      }
    } else if (this.state !== STATE.STOPPED) v.update(interiorShot ? this.assistedInput() : g.input, dt, this.road);
    this.road.snowfall.update(dt, v.position); this.road.updateCamera(dt);
    if (this.state === STATE.DRIVING_WITH_WOMAN && this.startZ - v.position.z > 35) {
      this.transition(STATE.WOMAN_AGITATED);
      this.conversation.start([
        { speaker: 'MUJER', text: '...', duration: 3 },
        { speaker: 'BRYAN', text: 'Tranquila. Ya casi encontramos ayuda.', duration: 5 },
        { speaker: 'BRYAN', text: '¡Hey! ¡¿Qué haces?!', duration: 4 },
      ]);
    }
    if (this.state === STATE.WOMAN_AGITATED && this.time > 12) this.transition(STATE.POLICE_APPROACH);
    if (this.state === STATE.POLICE_APPROACH && this.time > 13) {
      this.transition(STATE.PULL_OVER); g.input.keys.clear();
      this.conversation.start([{ speaker: 'PATRULLA · MEGÁFONO', text: '¡Oríllese y detenga el vehículo!', duration: 4 }]);
    }
    if (this.state === STATE.PULL_OVER) {
      this.stopTime = v.velocity.length() < 0.35 && Math.abs(v.speed) < 0.3 ? this.stopTime + dt : 0;
      if (this.stopTime >= 1.4) {
        this.transition(STATE.STOPPED); v.velocity.set(0, 0, 0); v.speed = 0;
        this.road.driveEnabled = false; g.input.keys.clear(); this.conversation.stop();
        this.finalCamera.position.copy(v.group.localToWorld(new THREE.Vector3(-18, 6, 12)));
        this.finalCamera.lookAt(v.group.localToWorld(new THREE.Vector3(0, 0.9, 9)));
        this.fade = document.createElement('div'); this.fade.style.cssText = 'position:absolute;inset:0;background:black;opacity:1;pointer-events:none;z-index:40'; g.container.append(this.fade);
      }
    }
    const policeActive = [STATE.POLICE_APPROACH, STATE.PULL_OVER, STATE.STOPPED].includes(this.state);
    this.police.update(dt, v, this.road, policeActive);
    const agitation = this.state === STATE.WOMAN_AGITATED ? THREE.MathUtils.smoothstep(this.time, 5, 9) : policeActive ? 0.45 + 0.12 * Math.sin(this.time * 1.5) : 0;
    this.interior.update(dt, agitation);
    // Brief upper-body glance toward the physical mirror; the GLB asset is unchanged.
    if (this.state === STATE.POLICE_APPROACH) g.player.group.rotation.y = Math.sin(Math.min(1, this.time / 2) * Math.PI) * -0.18;
    if (this.audioTime <= 0) {
      this.audioTime = 3; g.audio?.playCue('engine');
      if (Math.abs(v.speed) > 0.5) g.audio?.playCue('tires_snow');
      g.audio?.playCue('injured_breathing');
      if (policeActive) g.audio?.playCue('police_siren');
    }
    this.conversation.update(dt); g.bryanVisual.update();
    g.objective.textContent = this.objectiveText;
    g.dialogueManager.setHint(this.state === STATE.STOPPED ? '' : this.rejoinTime < 4 ? 'Reincorporándose al camino…' : interiorShot ? 'Conducción asistida' : 'W/S · Pedales   A/D · Volante');
    if (this.fade) { this.fade.style.opacity = String(Math.max(0, 1 - this.time / 0.8)); if (this.time > 1) { this.fade.remove(); this.fade = null; } }
    const camera = this.state === STATE.STOPPED ? this.finalCamera : interiorShot ? this.interior.camera : this.road.camera;
    if (interiorShot) this.interior.renderMirror(g.renderer, this.road.scene);
    this.finalCamera.aspect = innerWidth / innerHeight; this.finalCamera.updateProjectionMatrix();
    g.input.clearFrameState(); g.renderer.render(this.road.scene, camera);
  }
}
