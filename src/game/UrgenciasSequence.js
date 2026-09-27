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
    interaction.canInteract = () => !this.departing;
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
    const config = {
      name: this.doctor.name, walkSpeed: 1.1,
      waypoints: [this.doctor.group.position.clone(), { x: 6.8, z: -27.4 }, { x: 6.8, z: -30 }],
    };
    this.level.npcManager.validateRoute(config);
    this.doctor.waypoints = config.waypoints.map(p => new THREE.Vector3(p.x, 0, p.z));
    this.doctor.walkSpeed = config.walkSpeed; this.doctor.targetIndex = 1;
    this.doctor.direction = 1; this.doctor.waitRemaining = 0;
    this.departing = true;
    this.onComplete();
  }

  update() {
    if (!this.departing) return;
    const destination = this.doctor.waypoints[this.doctor.waypoints.length - 1];
    if (this.doctor.group.position.distanceTo(destination) < 0.01) {
      this.doctor.walkSpeed = 0; this.departing = false;
    }
  }
}
