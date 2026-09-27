import * as THREE from 'three';
import { FirstCombat, createHandgun } from './FirstCombat.js';
import { HouseTitleSequence } from './HouseTitleSequence.js';
import { POST_IMPACT as STATE } from './PostImpactState.js';

const bryan = (text, duration = 3) => ({ speaker: 'BRYAN', text, duration });
const pause = duration => ({ text: '', duration });

// Inspection, radio and narrative transitions; combat and final shot have their own controllers.
export class PatrolAftermathSequence {
  constructor(crash) {
    Object.assign(this, { crash, game: crash.game, drive: crash.drive, scene: crash.road.scene });
    this.woman = this.drive.interior.woman; this.officer = this.drive.officer;
    this.police = this.drive.police; this.time = 0; this.audioTime = 0;
    this.camera = crash.wreckCamera.clone(); this.conversation = this.drive.conversation;
    this.game.input.keys.clear(); this.game.dialogueManager.setHint('');
    this.woman.visible = false; this.drive.womanInPoliceCar = false;
    this.cabinShell = this.police.group.children.filter(o => o.isMesh &&
      ((Math.abs(o.scale.x - 1.8) < 0.001 && Math.abs(o.scale.y - 0.5) < 0.001) ||
       (Math.abs(o.scale.x - 1.83) < 0.001 && Math.abs(o.scale.y - 0.22) < 0.001)));
    this.scene.add(new THREE.HemisphereLight(0x9bb7d5, 0x141b29, 0.28));
    this.police.group.add(this.officer); this.officer.position.set(-0.35, 0.03, -0.05);
    this.officer.scale.setScalar(0.8); this.officer.rotation.set(0, 0, 0); this.officer.pose = 'seated';
    this.officer.animate(0.01, 0); this.officer.head.rotation.x = 0.4; this.officer.torso.rotation.z = -0.16; this.officer.visible = true;
    const seatMaterial = new THREE.MeshLambertMaterial({ color: 0x48515c });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 0.62), seatMaterial);
    bench.position.set(0, 0.55, 0.7); this.police.group.add(bench);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.48, 0.12), seatMaterial);
    back.position.set(0, 0.85, 1.01); this.police.group.add(back);
    for (const x of [-0.43, 0.43]) {
      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), seatMaterial);
      headrest.position.set(x, 1.16, 1); this.police.group.add(headrest);
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.48), new THREE.MeshLambertMaterial({ color: 0x11151a }));
      belt.position.set(x, 0.64, 0.7); belt.rotation.y = 0.25; this.police.group.add(belt);
    }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.9), seatMaterial);
    floor.position.set(0, 0.4, 0.1); this.police.group.add(floor);
    this.cabinLight = new THREE.PointLight(0xb2c5d6, 1.5, 3, 2);
    this.cabinLight.position.set(0, 1.35, 0.3); this.police.group.add(this.cabinLight);
    this.gun = createHandgun(); this.police.group.add(this.gun); this.gun.position.set(-0.68, 0.75, 0.2);
    this.mic = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.04), new THREE.MeshLambertMaterial({ color: 0x24292d }));
    this.police.group.add(this.mic); this.mic.position.set(0, 0.9, -0.6);
    this.hoodPoint = this.drive.vehicle.group.localToWorld(new THREE.Vector3(0.1, 0.923, -1.45));
    this.inspectPosition = this.game.player.position.clone();
    this.enter(STATE.INVESTIGATE_POLICE, [bryan('¡Oficial!', 2), pause(1.5), bryan('¿Está bien?', 2), pause(2), bryan('¿Oficial?', 2), pause(1)]);
  }
  enter(state, lines = []) {
    this.drive.transition(state); this.state = state; this.time = 0;
    // Interior insert shots omit the solid placeholder chassis that otherwise fills the cabin.
    const interior = [STATE.CHECK_OFFICER, STATE.CHECK_BACKSEAT, STATE.TAKE_HANDGUN].includes(state);
    this.cabinShell.forEach(mesh => { mesh.visible = !interior; });
    this.conversation.stop(); if (lines.length) this.conversation.start(lines);
  }
  localCamera(position, target) {
    this.police.group.updateMatrixWorld(true);
    this.camera.position.copy(this.police.group.localToWorld(new THREE.Vector3(...position)));
    this.camera.up.set(0, 1, 0); this.camera.near = 0.025; this.camera.fov = 62;
    this.camera.lookAt(this.police.group.localToWorld(new THREE.Vector3(...target)));
  }
  encounter() {
    const p = this.game.player, road = this.crash.road;
    this.scene.add(this.woman); this.woman.scale.setScalar(1); this.woman.pose = 'injured';
    this.woman.rotation.set(0, 0, 0); this.woman.visible = true;
    this.woman.position.set(road.centerX(this.crash.parkS) - 3.3, 0, -this.crash.parkS - 1.5);
    this.combat = new FirstCombat(this);
    const middle = p.position.clone().lerp(this.drive.vehicle.position, 0.5);
    this.combatCamera = new THREE.PerspectiveCamera(57, innerWidth / innerHeight, 0.1, 150);
    this.combatCamera.position.copy(middle).add(new THREE.Vector3(-1, 10.5, 17));
    this.combatCamera.lookAt(middle.clone().setY(0.5)); this.camera = this.combatCamera;
    this.enter(STATE.FIRST_ENCOUNTER, [pause(2), bryan('¿Usted...?'), pause(3), bryan('¡Atrás!', 2)]);
    p.rotationY = Math.atan2(p.position.x - this.woman.position.x, p.position.z - this.woman.position.z); p.group.rotation.y = p.rotationY;
  }
  update(dt) {
    if (this.title) { this.title.update(dt); return; }
    const g = this.game, p = g.player;
    this.time += dt; this.audioTime -= dt; this.conversation.update(dt); this.police.flash(dt, true);
    if ([STATE.CHECK_OFFICER, STATE.CHECK_BACKSEAT, STATE.TAKE_HANDGUN].includes(this.state))
      this.police.lamps.forEach(lamp => { lamp.light.intensity *= 0.15; });
    if (this.audioTime <= 0) { this.audioTime = 5; g.audio?.playCue('winter_wind'); g.audio?.playCue('police_siren'); }
    p.previousPosition.copy(p.position); p.velocity.set(0, 0, 0);
    g.dialogueManager.setHint('');
    if (this.state === STATE.INVESTIGATE_POLICE) {
      g.objective.textContent = 'OBJETIVO: Revisa la patrulla.';
      if (this.time > 6) this.police.driverDoor.rotation.y = -THREE.MathUtils.smoothstep(this.time, 6, 8) * 1.15;
      if (!this.conversation.active) { this.enter(STATE.CHECK_OFFICER); this.localCamera([-0.05, 1.42, -0.68], [-0.35, 1.08, 0.02]); g.audio?.playCue('door_open'); }
    } else if (this.state === STATE.CHECK_OFFICER && this.time > 4) {
      this.enter(STATE.CHECK_BACKSEAT, [pause(1.5), bryan('¿Dónde está ella...?'), pause(1.5)]);
      this.localCamera([-1.8, 1.7, -0.1], [0, 0.75, 0.75]);
    } else if (this.state === STATE.CHECK_BACKSEAT && !this.conversation.active) {
      this.enter(STATE.USE_POLICE_RADIO, [{ speaker: 'RADIO', text: '— Estática —', duration: 2 },
        bryan('¿Hola?'), bryan('Hay un oficial herido en la carretera.', 4), pause(2),
        bryan('¿Alguien me escucha?'), { speaker: 'RADIO', text: '— Estática —', duration: 3 }, bryan('Necesito ayuda.'), pause(3)]);
      this.camera = this.crash.wreckCamera.clone();
      this.camera.position.copy(p.group.localToWorld(new THREE.Vector3(2, 1.8, -2.3)));
      this.camera.lookAt(p.position.clone().setY(1.2));
      p.group.add(this.mic); this.mic.position.set(0.21, 1.43, -0.26); this.mic.rotation.set(0, 0, 0);
      g.audio?.playCue('radio_static');
    } else if (this.state === STATE.USE_POLICE_RADIO) {
      if (Math.floor(this.time / 4) !== this.lastRadio) { this.lastRadio = Math.floor(this.time / 4); g.audio?.playCue('radio_static'); }
      if (!this.conversation.active) {
        this.police.group.add(this.mic); this.mic.position.set(0, 0.9, -0.6);
        this.enter(STATE.TAKE_HANDGUN, [pause(2), bryan('...Lo siento.'), pause(2)]);
        this.localCamera([-1.5, 1.05, 0.4], [-0.68, 0.75, 0.2]);
      }
    } else if (this.state === STATE.TAKE_HANDGUN) {
      if (this.time > 4 && !this.gunTaken) {
        this.gunTaken = true; p.group.add(this.gun); this.gun.position.set(0.23, 1.12, -0.5);
        this.camera = this.crash.wreckCamera.clone();
        this.camera.position.copy(p.group.localToWorld(new THREE.Vector3(1.8, 1.8, -2.4)));
        this.camera.lookAt(p.position.clone().setY(1.15));
      }
      if (!this.conversation.active) this.encounter();
    }
    else if (this.state === STATE.FIRST_ENCOUNTER) {
      this.woman.animate(dt, 0.3); this.woman.head.rotation.x = 0.25;
      const delta = p.position.clone().sub(this.woman.position).setY(0);
      this.woman.rotation.y = Math.atan2(-delta.x, -delta.z);
      if (delta.length() > 2.5) {
        const previous = this.woman.position.clone(); this.woman.position.addScaledVector(delta.normalize(), dt * 0.4);
        this.crash.collision.resolve({ position: this.woman.position, previousPosition: previous });
      }
      if (this.time > 7 && !this.startledShot) {
        this.startledShot = true; this.combat.accidentalShot();
        this.conversation.start([bryan('¡No se acerque!', 2)]);
      }
      this.combat.update(dt);
      if (this.time > 10) {
        this.enter(STATE.FIRST_COMBAT); this.combat.spawn.copy(this.woman.position); this.combat.start();
        p.rotationY = Math.atan2(p.position.x - this.woman.position.x, p.position.z - this.woman.position.z); p.group.rotation.y = p.rotationY;
        g.audio?.playCue('combat_tension');
      }
    } else if (this.state === STATE.FIRST_COMBAT) {
      g.objective.textContent = 'OBJETIVO: Mantén la distancia. Defiéndete.';
      this.combat.update(dt);
      if (this.combat.completed) { this.enter(STATE.RETURN_TO_CAR); g.input.keys.clear(); }
    } else if (this.state === STATE.RETURN_TO_CAR) {
      g.objective.textContent = 'OBJETIVO: Regresa al auto.';
      p.update(g.input, dt); this.crash.collision.resolve(p);
      const near = p.position.distanceTo(this.crash.exitPosition) < 2;
      g.dialogueManager.setHint(near ? '[E] Arrancar' : '');
      if (near && g.input.isJustPressed('KeyE')) {
        this.enter(STATE.CAR_DISABLED, [pause(2), bryan('Vamos...', 2), pause(4), bryan('¡Mierda!', 2), bryan('Perfecto... simplemente perfecto.', 4)]);
        this.camera = this.crash.exitCamera.clone(); g.input.keys.clear(); this.engineAttempt = -1;
        this.boardStart = p.position.clone(); g.audio?.playCue('door_open');
      }
    } else if (this.state === STATE.CAR_DISABLED) {
      if (this.time < 1.5) {
        const door = this.crash.exitPosition;
        p.position.lerpVectors(this.boardStart, door, Math.min(1, this.time));
        g.forestSequence.level.hinge.rotation.y = -Math.sin(this.time / 1.5 * Math.PI);
      } else if (!this.inCar) { this.inCar = true; this.drive.interior.seatBryan(); g.forestSequence.level.hinge.rotation.y = 0; }
      const attempt = Math.min(2, Math.floor((this.time - 1.5) / 2));
      if (attempt >= 0 && attempt !== this.engineAttempt) { this.engineAttempt = attempt; g.audio?.playCue('engine_fail'); }
      if (this.time > 7) {
        if (!this.outOfCar) { this.outOfCar = true; this.drive.interior.unseatBryan(this.scene, this.crash.exitPosition); g.audio?.playCue('door_open'); }
        const damage = this.damagePoint || this.hoodPoint;
        this.camera.position.copy(damage).add(new THREE.Vector3(-1.2, 1.2, -1.3)); this.camera.lookAt(damage);
        g.objective.textContent = 'El disparo perforó el sistema de encendido.';
      }
      if (!this.conversation.active) { this.title = new HouseTitleSequence(this); this.title.update(0); return; }
    }
    if (this.state !== STATE.FIRST_COMBAT) p.animate(dt, ![STATE.RETURN_TO_CAR].includes(this.state));
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.crash.road.snowfall.update(dt, p.position); g.bryanVisual.update();
    g.input.clearFrameState(); g.renderer.render(this.scene, this.camera);
  }
}
