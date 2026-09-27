import { DEBUG_MODE } from '../config/constants.js';

export class InteractionManager {
  constructor(player, input, scene = null) {
    this.player = player;
    this.input = input;
    this.scene = scene;
    this.interactables = [];
    this.current = null;
    this.currentHintText = '';
  }

  register(interactable) {
    this.interactables.push(interactable);
    if (this.scene && interactable.debugMesh) {
      this.scene.add(interactable.debugMesh);
    }
    return interactable;
  }

  update() {
    const nearby = this.interactables.filter((interactable) => interactable.isPlayerNearby(this.player) && (!interactable.canInteract || interactable.canInteract()));
    nearby.sort((a, b) => a.position.distanceToSquared(this.player.position) - b.position.distanceToSquared(this.player.position));
    this.current = nearby.length > 0 ? nearby[0] : null;
    this.currentHintText = this.current ? this.current.getHintText() : '';

    if (this.current && this.input.isJustPressed('KeyE')) {
      this.current.interact();
    }

    this.interactables.forEach((interactable) => {
      interactable.debugMesh?.position.copy(interactable.position).setY(0.8);
      interactable.setDebugVisible(DEBUG_MODE && interactable.debug && !!this.scene);
    });
  }
}
