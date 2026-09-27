import * as THREE from 'three';
import { LowPolyCharacter } from '../characters/LowPolyCharacter.js';
import { Breathalyzer } from './Breathalyzer.js';
import { POST_IMPACT as STATE } from './PostImpactState.js';

const line = (speaker, text) => ({ speaker, text });
// Cinematic blocking and dialogue only. Actors move continuously between the two parked cars.
export class PoliceStopSequence {
  constructor(drive, onComplete) {
    this.drive = drive; this.game = drive.game; this.scene = drive.road.scene; this.onComplete = onComplete;
    this.car = drive.vehicle.group; this.police = drive.police; this.woman = drive.interior.woman;
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 120);
    this.officer = new LowPolyCharacter({ kind: 'PoliceOfficer', clothing: 0x24334b, trousers: 0x202b3b,
      skin: 0xb59679, hair: 0x292820, accent: 0xb9a269 });
    this.drive.officer = this.officer;
    this.officer.name = 'PoliceOfficer'; this.scene.add(this.officer);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.15, 0.075, 10), new THREE.MeshLambertMaterial({ color: 0x24334b }));
    cap.position.set(0, 0.15, 0); this.officer.head.add(cap);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.025, 6), new THREE.MeshLambertMaterial({ color: 0xb8ae78, side: THREE.DoubleSide }));
    badge.position.set(0.1, 1.28, -0.155); this.officer.add(badge);
    this.breathalyzer = new Breathalyzer(); this.breathalyzer.visible = false; this.scene.add(this.breathalyzer);
    this.driverPoint = this.world(this.car, -1.65, 0, 0.12);
    this.policeExit = this.world(this.police.group, -1.65, 0, 0.1);
    this.passengerPoint = this.world(this.car, 1.7, 0, 0.3);
    this.policeRear = this.world(this.police.group, 1.7, 0, 0.7);
    this.officer.position.copy(this.world(this.police.group, -0.4, 0, 0.1));
    this.officer.visible = false; this.step = 'approach'; this.time = 0; this.audioTime = 0;
    this.drive.transition(STATE.POLICE_PULL_OVER); this.drive.womanInBryanCar = true; this.drive.womanInPoliceCar = false;
    this.setCamera(this.world(this.police.group, -4.5, 2.4, 3), this.policeExit.clone().setY(1));
    this.game.input.keys.clear(); this.game.container.classList.remove('driving-mode');
  }
  world(car, x, y, z) { car.updateMatrixWorld(true); return car.localToWorld(new THREE.Vector3(x, y, z)); }
  setCamera(position, target) { this.camera.position.copy(position); this.camera.lookAt(target); }
  enter(step, state) { this.step = step; this.time = 0; if (state) this.drive.transition(state); }
  say(lines, next) { this.game.dialogueManager.start(lines, next); }
  walk(actor, target, dt, speed = 1.2) {
    const delta = target.clone().sub(actor.position).setY(0), distance = delta.length();
    if (distance < 0.025) return true;
    actor.rotation.set(0, Math.atan2(-delta.x, -delta.z), 0);
    actor.position.addScaledVector(delta, Math.min(distance, dt * speed) / distance); actor.position.y = 0;
    return distance <= dt * speed;
  }
  update(dt) {
    const g = this.game, p = g.player, officer = this.officer, d = g.dialogueManager;
    this.time += dt; this.audioTime -= dt;
    this.police.flash(dt); this.woman.animate(dt, 0); officer.animate(dt, ['approach', 'prepare-transfer', 'transfer', 'return'].includes(this.step) ? 1.1 : 0);
    if (d.isOpen) d.update();
    if (this.step === 'approach') {
      if (this.time < 1.3) {
        this.police.driverDoor.rotation.y = -Math.sin(this.time / 1.3 * Math.PI) * 1.1;
        officer.visible = this.time > 0.25;
        officer.position.lerpVectors(this.world(this.police.group, -0.4, 0, 0.1), this.policeExit, Math.min(1, this.time / 0.9));
      } else {
        if (this.drive.state !== STATE.OFFICER_APPROACH) this.drive.transition(STATE.OFFICER_APPROACH);
        this.police.driverDoor.rotation.y = 0;
        const midpoint = this.policeExit.clone().lerp(this.driverPoint, 0.5);
        this.setCamera(midpoint.clone().add(new THREE.Vector3(-5, 3.2, 1)), midpoint.clone().setY(1));
        if (this.walk(officer, this.driverPoint, dt)) {
          officer.rotation.y = this.car.rotation.y - Math.PI / 2; this.enter('window');
          this.setCamera(this.world(this.car, -3.7, 1.9, -2), this.driverPoint.clone().setY(1.05));
          this.say([
            line('POLICÍA', 'Buenas noches.'), line('POLICÍA', '¿Sabe por qué lo detuve?'),
            line('BRYAN', 'No... ¿pasa algo?'), line('POLICÍA', 'Venía derrapando por toda la carretera.'),
            line('POLICÍA', 'Necesito que salga del vehículo.'), line('BRYAN', 'Mire, oficial... tuve algunos problemas en el camino.'),
            line('POLICÍA', 'Señor, salga del vehículo.'),
          ], () => { this.enter('exit', STATE.BREATHALYZER_TEST); this.exitStart = p.group.getWorldPosition(new THREE.Vector3()); });
        }
      }
    } else if (this.step === 'window') {
      officer.torso.rotation.x = 0.14; officer.head.rotation.x = 0.15;
    } else if (this.step === 'exit') {
      officer.torso.rotation.x = 0;
      const end = this.driverPoint.clone().add(new THREE.Vector3(0, 0, 1.5));
      this.walk(officer, end.clone().add(new THREE.Vector3(0, 0, -0.75)), dt);
      if (!this.unseated) { this.unseated = true; this.drive.interior.unseatBryan(this.scene, this.exitStart); }
      p.position.lerpVectors(this.exitStart, end, Math.min(1, this.time / 1.3)); p.position.y = 0;
      const hinge = g.forestSequence.level.hinge; hinge.rotation.y = -Math.sin(Math.min(1, this.time / 1.6) * Math.PI);
      if (this.time > 1.6) {
        this.enter('test'); this.breathalyzer.visible = true;
        this.setCamera(end.clone().add(new THREE.Vector3(-2.6, 1.9, -1.7)), end.clone().setY(1.25));
        this.say([line('POLICÍA', 'Sople aquí, por favor.')], () => this.enter('blow'));
      }
    } else if (this.step === 'test' || this.step === 'blow') {
      officer.rotation.y = Math.atan2(officer.position.x - p.position.x, officer.position.z - p.position.z);
      p.rotationY = Math.atan2(p.position.x - officer.position.x, p.position.z - officer.position.z); p.group.rotation.y = p.rotationY;
      const mouth = p.position.clone().add(new THREE.Vector3(0, 1.48, -0.27).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY));
      officer.updateMatrixWorld(true);
      const reach = officer.body.worldToLocal(mouth.clone()).sub(officer.arms[1].position).normalize();
      officer.arms[1].quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), reach);
      officer.forearms[1].rotation.set(0, 0, 0); officer.updateMatrixWorld(true);
      this.breathalyzer.position.copy(officer.forearms[1].localToWorld(new THREE.Vector3(0, -0.30, 0)));
      this.breathalyzer.rotation.y = p.rotationY + Math.PI / 2;
      if (this.step === 'blow') {
        p.group.rotation.x = 0.06 + Math.sin(this.time * 3) * 0.004;
        if (this.time > 3) {
          p.group.rotation.x = 0; this.breathalyzer.negative(); this.enter('explain');
          this.say([
            line('POLICÍA', 'No ha bebido.'), line('BRYAN', 'Soy repartidor.'), line('BRYAN', 'Estoy haciendo una entrega.'),
            line('BRYAN', 'Una mujer se atravesó en la carretera.'), line('BRYAN', 'No pude evitar golpearla.'),
            line('POLICÍA', '¿La mujer está en su vehículo?'), line('BRYAN', 'Sí. Está herida.'),
          ], () => {
            this.enter('offer', STATE.OFFICER_ESCORT_OFFER); this.breathalyzer.visible = false;
            this.say([
              line('POLICÍA', 'Voy a escoltarlo hasta que encontremos ayuda.'), line('BRYAN', 'Oficial...'),
              line('BRYAN', '¿Podría llevársela usted?'), line('POLICÍA', '¿Por qué?'), line('BRYAN', 'No sé qué le pasa.'),
              line('BRYAN', 'Y no sabría qué hacer si empeora mientras conduzco.'), line('POLICÍA', '...Está bien.'),
            ], () => this.enter('prepare-transfer', STATE.TRANSFER_WOMAN));
          });
        }
      }
    } else if (this.step === 'offer') {
      officer.head.rotation.y = Math.sin(this.time * 0.5) * 0.09;
    } else if (this.step === 'prepare-transfer') {
      // Both helpers go around the rear of Bryan's car, not through its body.
      const route = [this.world(this.car, -1.9, 0, 3), this.world(this.car, 1.9, 0, 3), this.passengerPoint];
      this.prepIndex ??= 0;
      const ready = this.walk(officer, route[this.prepIndex], dt);
      const bryanReady = this.walk(p.group, route[this.prepIndex].clone().add(new THREE.Vector3(0, 0, 0.8)), dt);
      this.setCamera(this.world(this.car, 5, 2.8, 4), this.world(this.car, 1.2, 0.9, 0.8));
      if (ready && bryanReady && ++this.prepIndex === route.length) {
        this.enter('lift'); this.scene.attach(this.woman); this.womanStart = this.woman.position.clone();
        g.audio?.playCue('door_open');
      }
    } else if (this.step === 'lift') {
      this.drive.interior.passengerDoor.rotation.y = Math.min(1, this.time) * 1.1;
      const t = THREE.MathUtils.smoothstep(this.time, 0.8, 3);
      this.woman.position.lerpVectors(this.womanStart, this.passengerPoint, t); this.woman.scale.setScalar(0.87 + 0.13 * t);
      this.woman.pose = t > 0.5 ? 'injured' : 'seated'; this.woman.rotation.set(0, this.car.rotation.y, 0);
      if (this.time > 3.2) { this.enter('transfer'); this.transferIndex = 0; }
    } else if (this.step === 'transfer') {
      this.drive.interior.passengerDoor.rotation.y = Math.max(0, 1.1 - this.time);
      const route = [this.world(this.car, 2.3, 0, 3), this.world(this.police.group, 2.3, 0, 0.7), this.policeRear];
      const arrived = this.walk(this.woman, route[this.transferIndex], dt, 0.85);
      const side = new THREE.Vector3(0.6, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.woman.rotation.y);
      p.position.copy(this.woman.position).sub(side); officer.position.copy(this.woman.position).add(side);
      p.group.rotation.copy(this.woman.rotation); officer.rotation.copy(this.woman.rotation);
      this.woman.animate(dt, 0.85); this.woman.arms[0].rotation.z = -1.3; this.woman.arms[1].rotation.z = 1.3;
      this.setCamera(this.woman.position.clone().add(new THREE.Vector3(4, 2.6, 4)), this.woman.position.clone().setY(1));
      if (arrived && ++this.transferIndex === route.length) { this.enter('seat'); this.seatStart = this.woman.position.clone(); }
    } else if (this.step === 'seat') {
      this.police.rearDoor.rotation.y = Math.sin(Math.min(1, this.time / 3.5) * Math.PI) * 1.2;
      this.woman.pose = 'seated'; this.woman.rotation.set(0, this.police.group.rotation.y, 0);
      const t = THREE.MathUtils.smoothstep(this.time, 0.7, 2.8);
      this.woman.position.lerpVectors(this.seatStart, this.world(this.police.group, 0.3, 0.04, 0.8), t); this.woman.scale.setScalar(1 - 0.18 * t);
      if (this.time > 3.5) {
        this.police.group.attach(this.woman); this.woman.userData.state = 'WOMAN_IN_POLICE_CAR';
        this.drive.womanInBryanCar = false; this.drive.womanInPoliceCar = true;
        this.enter('return'); g.audio?.playCue('door_close'); this.returnIndex = 0;
      }
    } else if (this.step === 'return') {
      const route = [this.world(this.police.group, 2.1, 0, 3), this.world(this.police.group, -2.1, 0, 3), this.policeExit];
      if (this.returnIndex < route.length && this.walk(officer, route[this.returnIndex], dt)) this.returnIndex++;
      const bryanRoute = [this.world(this.car, 2.1, 0, 3), this.world(this.car, -2.1, 0, 3), this.driverPoint];
      this.bryanReturnIndex ??= 0;
      if (this.bryanReturnIndex < bryanRoute.length && this.walk(p.group, bryanRoute[this.bryanReturnIndex], dt)) this.bryanReturnIndex++;
      this.setCamera(this.world(this.car, -5, 3.6, 7), this.world(this.car, 0, 0.9, 3));
      if (this.returnIndex === route.length && this.bryanReturnIndex === bryanRoute.length) this.enter('boarding');
    } else if (this.step === 'boarding') {
      this.police.driverDoor.rotation.y = -Math.sin(Math.min(1, this.time / 1.6) * Math.PI);
      g.forestSequence.level.hinge.rotation.y = -Math.sin(Math.min(1, this.time / 1.6) * Math.PI);
      officer.position.lerp(this.world(this.police.group, -0.4, 0, 0.1), Math.min(1, dt * 3)); officer.visible = this.time < 1.1;
      p.group.visible = this.time < 1.1;
      if (this.time > 1.6) { this.drive.interior.seatBryan(); this.police.driverDoor.rotation.y = 0; g.forestSequence.level.hinge.rotation.y = 0; this.onComplete(); return; }
    }
    if (this.audioTime <= 0) { this.audioTime = 4; g.audio?.playCue('engine'); g.audio?.playCue('injured_breathing'); }
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    g.objective.textContent = this.drive.state === STATE.TRANSFER_WOMAN ? 'OBJETIVO: Ayuda a trasladar a la mujer.' : 'OBJETIVO: Habla con el oficial.';
    g.bryanVisual.update(); g.input.clearFrameState(); g.renderer.render(this.scene, this.camera);
  }
}
