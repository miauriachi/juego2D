import * as THREE from 'three';
import { DEBUG_MODE } from '../config/constants.js';

export class Interactable {
  constructor({
    id,
    name,
    position,
    radius = 2,
    label = 'Interact',
    color = 0x9ce7ff,
    debug = true,
    onInteract = () => {},
  }) {
    this.id = id;
    this.name = name;
    this.position = new THREE.Vector3().fromArray(position);
    this.radius = radius;
    this.label = label;
    this.color = color;
    this.debug = debug;
    this.onInteract = onInteract;

    this.debugMesh = null;
    this.createDebugVisual();
    this.setDebugVisible(DEBUG_MODE && debug);
  }

  createDebugVisual() {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 0.75, 18, 18),
      new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      })
    );
    mesh.position.copy(this.position);
    mesh.position.y = 0.8;
    this.debugMesh = mesh;
  }

  isPlayerNearby(player) {
    const playerPosition = player?.position ?? player?.group?.position ?? player?.mesh?.position ?? player?.object?.position;
    if (!playerPosition) return false;
    return playerPosition.distanceTo(this.position) <= this.radius;
  }

  getHintText() {
    return `[E] ${this.label}`;
  }

  interact() {
    if (typeof this.onInteract === 'function') {
      this.onInteract();
    }
  }

  setDebugVisible(visible) {
    if (this.debugMesh) {
      this.debugMesh.visible = visible;
    }
  }
}
