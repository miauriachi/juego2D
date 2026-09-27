import * as THREE from 'three';
import { Interactable } from './Interactable.js';

// One authored delivery scene. Completion survives leaving and re-entering the area.
export class UrgenciasSequence {
  constructor(level, player, interactions, dialogue, onComplete) {
    this.level = level; this.player = player; this.doctor = level.chiefDoctor;
    this.completed = false; this.departing = false;
    this.onComplete = onComplete;
    this.doctor.lookTarget = player.position;
    const interaction = new Interactable({
      id: 'chief-doctor', name: 'Doctor responsable', position: this.doctor.group.position.toArray(),
      label: 'Hablar', radius: 1.8,
      onInteract: () => {
        if (this.completed) {
          dialogue.start([{ speaker: 'DOCTOR', text: 'La entrega ya está con nosotros. Vuelve a recepción.' }]);
          return;
        }
        dialogue.start([
          { speaker: 'BRYAN', text: 'Disculpe, traigo una entrega médica urgente.' },
          { speaker: 'DOCTOR', text: '¿Hasta ahora apareces con eso? ¡No puedes entrar aquí así nada más!' },
          { speaker: 'BRYAN', text: 'Me dijeron que debía entregarla inmediatamente.' },
          { speaker: 'DOCTOR', text: 'Dámela. Nosotros nos encargamos. Sal de aquí y no estorbes.' },
        ], () => this.finish());
      },
    });
    interaction.position = this.doctor.group.position;
    interaction.canInteract = () => !this.departing && !this.completed;
    interactions.register(interaction);
  }

  finish() {
    if (this.completed) return;
    const kit = this.player.model.getObjectByName('medicalKit');
    if (!kit) return;
    this.completed = true;
    this.doctor.model.forearms[0].add(kit);
    kit.position.set(0.335, -1, -0.02);
    kit.getObjectByName('bagStrap').visible = false;
    this.doctor.lookTarget = null;

    this.doctor.paused = true;
    this.doctor.walkSpeed = 0;
    this.doctor.departed = false;
    this.departing = true;
    this.departureStage = 'running';
    this.departureIndex = 1;
    this.departureHold = 0;
    this.departureSpeed = 3.5;
    this.departurePoints = [
      this.doctor.group.position.clone(),
      new THREE.Vector3(1.15, 0, -30.75),
    ];
    this.onComplete();
  }

  update(dt = 0.016) {
    if (!this.departing) return;
    dt = Math.min(Math.max(dt || 0.016, 0.001), 0.05);

    if (this.departureStage === 'waitingAtDoor') {
      this.departureHold += dt;
      this.doctor.model.animate(dt, 0, false, 0);
      if (this.departureHold >= 0.5) {
        this.doctor.departed = true;
        this.doctor.group.visible = false;
        this.departing = false;
      }
      return;
    }

    const target = this.departurePoints[this.departureIndex];
    if (!target) return;
    const dx = target.x - this.doctor.group.position.x;
    const dz = target.z - this.doctor.group.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance <= 0.04) {
      this.doctor.group.position.copy(target);
      this.departureIndex++;
      if (this.departureIndex >= this.departurePoints.length) {
        this.departureStage = 'waitingAtDoor';
        this.departureHold = 0;
      }
      return;
    }

    const step = Math.min(this.departureSpeed * dt, distance);
    this.doctor.group.rotation.y = Math.atan2(-dx, -dz);
    this.doctor.group.position.x += dx / distance * step;
    this.doctor.group.position.z += dz / distance * step;
    this.doctor.model.animate(dt, this.departureSpeed, true, 0);
  }

}
