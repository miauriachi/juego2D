import { Interactable } from './Interactable.js';

// Administrative follow-up after the medical handoff; dialogue/UI stay in their managers.
export class ReceptionDeliverySequence {
  constructor(player, interactions, dialogue, onChange) {
    this.player = player; this.dialogue = dialogue; this.onChange = onChange;
    this.state = 'awaitingMedicalDelivery';
    this.initialDeliveryCompleted = false;
    this.signatureForged = false;
    const document = new Interactable({
      id: 'reception-document', name: 'Comprobante de entrega',
      position: [-6.7, 0, 0.40], radius: 1.25, label: 'Firmar documento',
      onInteract: () => this.forgeSignature(),
    });
    document.canInteract = () => this.state === 'refused' && player.position.z <= 0.1;
    interactions.register(document);
  }

  get isBusy() { return false; }

  get objectiveText() {
    return {
      awaitingSignature: 'OBJETIVO: Consigue la firma de recepción.',
      refused: 'OBJETIVO: Consigue la firma.',
      forged: 'OBJETIVO: Aléjate del mostrador.',
    }[this.state] || '';
  }

  setState(state) { this.state = state; this.onChange(); }

  medicalDelivered() {
    if (this.state === 'awaitingMedicalDelivery') this.setState('awaitingSignature');
  }

  interactReception() {
    if (this.state === 'awaitingMedicalDelivery') return false;
    if (this.state === 'awaitingSignature') {
      this.dialogue.start([
        { speaker: 'BRYAN', text: 'Ya hice la entrega. Necesito la firma.' },
        { speaker: 'RECEPCIONISTA', text: '¿La firma? No, yo no voy a firmar eso. Ya bastante tengo.' },
        { speaker: 'BRYAN', text: 'Solo necesito una firma y me voy.' },
        { speaker: 'RECEPCIONISTA', text: 'No. Si quiere firma, búsquela en otro lado.' },
      ], () => this.setState('refused'));
    } else {
      this.dialogue.start([{ speaker: 'RECEPCIONISTA', text: 'Ya le dije que no voy a firmar.' }]);
    }
    return true;
  }

  forgeSignature() {
    if (this.state !== 'refused' || this.dialogue.isOpen) return;
    this.dialogue.start([
      { speaker: 'BRYAN', text: '...Olvídalo.' },
      { speaker: 'BRYAN', text: 'Yo mismo la haré.' },
    ], () => {
      this.signatureForged = true;
      this.initialDeliveryCompleted = true;
      this.setState('forged');
    });
  }

  update() {}
}
