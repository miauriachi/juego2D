import * as THREE from 'three';

// One-shot post-signature encounter. Branch state and package stay outside Game.
export class RaccoonDeliverySequence {
  constructor(player, reception, npcs, dialogue, onChange) {
    Object.assign(this, { player, reception, npcs, dialogue, onChange });
    this.state = 'waitingForSignature';
    this.acceptedRaccoonDelivery = false;
    this.ending = null;
  }

  get resolved() { return this.state === 'accepted' || this.state === 'declined'; }

  get objectiveText() {
    if (this.state === 'accepted') return 'OBJETIVO: Ve a tu auto.';
    if (this.state === 'declined') return 'OBJETIVO: Sal del hospital.';
    if (this.state === 'talking') return 'OBJETIVO: Responde a la enfermera.';
    return '';
  }

  update(area, dt = 0.016) {
    if (area !== 'reception' || !this.reception.signatureForged || this.dialogue.isOpen || this.resolved) return;
    dt = Math.min(Math.max(dt || 0.016, 0.001), 0.05);

    if (this.state === 'waitingForSignature') {
      this.nurse = this.npcs.addNPC({
        name: 'Enfermera de envíos',
        type: 'Nurse',
        walkSpeed: 0,
        waypoints: [{ x: -1.30, z: -5.18 }],
      });
      this.nurse.lookTarget = this.player.position;
      this.raccoonCityPackage = this.createPackage();
      this.nurse.model.body.add(this.raccoonCityPackage);
      this.arrivalTarget = new THREE.Vector3(-0.65, 0, -1.05);
      this.arrivalSpeed = 3.15;
      this.state = 'runningIn';
      this.onChange();
    }

    if (this.state === 'runningIn') {
      const dx = this.arrivalTarget.x - this.nurse.group.position.x;
      const dz = this.arrivalTarget.z - this.nurse.group.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance > 0.08) {
        const step = Math.min(this.arrivalSpeed * dt, distance);
        this.nurse.group.rotation.y = Math.atan2(-dx, -dz);
        this.nurse.group.position.x += dx / distance * step;
        this.nurse.group.position.z += dz / distance * step;
        this.nurse.model.animate(dt, this.arrivalSpeed, true, 0);
        return;
      }

      this.nurse.group.position.copy(this.arrivalTarget);
      this.nurse.lookTarget = this.player.position;
      const toBryanX = this.player.position.x - this.nurse.group.position.x;
      const toBryanZ = this.player.position.z - this.nurse.group.position.z;
      this.nurse.group.rotation.y = Math.atan2(-toBryanX, -toBryanZ);
      this.state = 'talking';
      this.dialogue.input.clearFrameState();
      this.onChange();
      this.dialogue.start([
        { speaker: 'ENFERMERA', text: '¡Espera! ¿Tú eres el mensajero?' },
        { speaker: 'BRYAN', text: 'Sí. ¿Qué pasa?' },
        { speaker: 'ENFERMERA', text: 'Necesito que lleves esto a Raccoon City.' },
        { speaker: 'ENFERMERA', text: 'Tiene que llegar hoy.' },
      ], () => this.firstChoice());
    }
  }

  firstChoice() {
    this.dialogue.choose(['Sí, puedo llevarlo.', 'No, ya terminé.'], index => {
      if (index === 0) this.dialogue.start([
        { speaker: 'BRYAN', text: 'Está bien. Dámelo.' },
      ], () => this.accept());
      else this.dialogue.start([
        { speaker: 'BRYAN', text: 'Perdona, es que esa era mi última entrega.' },
        { speaker: 'BRYAN', text: 'Ya iba de salida.' },
        { speaker: 'ENFERMERA', text: 'Raccoon City está algo lejos...' },
        { speaker: 'ENFERMERA', text: 'Por eso esta entrega se paga al doble.' },
      ], () => this.secondChoice());
    });
  }

  secondChoice() {
    this.dialogue.choose(['Está bien. La llevaré.', 'No, gracias.'], index => {
      if (index === 0) this.dialogue.start([
        { speaker: 'BRYAN', text: '...¿Al doble?' },
        { speaker: 'BRYAN', text: 'Bueno. Está bien.' },
        { speaker: 'ENFERMERA', text: 'Sabía que podríamos contar contigo.' },
      ], () => this.accept());
      else this.dialogue.start([
        { speaker: 'BRYAN', text: 'No, gracias.' },
        { speaker: 'BRYAN', text: 'Hoy ya terminé.' },
        { speaker: 'ENFERMERA', text: 'Está bien. Buscaré a alguien más.' },
      ], () => {
        this.state = 'declined'; this.acceptedRaccoonDelivery = false;
        this.ending = 'LAST_DELIVERY'; this.onChange();
      });
    });
  }

  accept() {
    if (this.resolved) return;
    this.player.model.body.add(this.raccoonCityPackage);
    this.raccoonCityPackage.position.set(-0.36, 0.96, -0.03);
    this.acceptedRaccoonDelivery = true; this.ending = null;
    this.state = 'accepted'; this.onChange();
  }

  createPackage() {
    const parcel = new THREE.Group(); parcel.name = 'raccoonCityPackage';
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.20),
      new THREE.MeshLambertMaterial({ color: 0xa88e64 }));
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.284, 0.204),
      new THREE.MeshLambertMaterial({ color: 0xd8c49e }));
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.085, 0.004),
      new THREE.MeshLambertMaterial({ color: 0xebe8d6 }));
    label.position.set(0, 0.045, -0.104);
    box.castShadow = true; parcel.add(box, tape, label);
    parcel.position.set(-0.34, 1.02, -0.07);
    return parcel;
  }
}
