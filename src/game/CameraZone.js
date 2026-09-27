import * as THREE from 'three';
import { DEBUG_MODE } from '../config/constants.js';

export class CameraZone {
  constructor({ id, name, cameraPosition, lookAt, minX, maxX, minZ, maxZ, color = 0x8ecae6, priority = 0, fov = 70 }) {
    this.id = id;
    this.name = name;
    this.cameraPosition = new THREE.Vector3().fromArray(cameraPosition);
    this.lookAt = new THREE.Vector3().fromArray(lookAt);
    this.minX = minX;
    this.maxX = maxX;
    this.minZ = minZ;
    this.maxZ = maxZ;
    this.color = color;
    this.priority = priority;
    this.fov = fov;
    this.debugGroup = null;
    this.createDebugVisual();
    this.setDebugVisible(DEBUG_MODE);
  }

  containsPlayer(player) {
    const position = player?.position ?? player?.group?.position ?? player?.mesh?.position ?? player?.object?.position;

    if (!position) {
      return false;
    }

    return (
      position.x >= this.minX &&
      position.x <= this.maxX &&
      position.z >= this.minZ &&
      position.z <= this.maxZ
    );
  }

  createDebugVisual() {
    const width = this.maxX - this.minX;
    const depth = this.maxZ - this.minZ;

    const debugBox = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.5, depth),
      new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    debugBox.position.set((this.minX + this.maxX) / 2, 0.2, (this.minZ + this.maxZ) / 2);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 12),
      new THREE.MeshBasicMaterial({ color: this.color })
    );
    marker.position.copy(this.cameraPosition).setY(0.4);

    this.debugGroup = new THREE.Group();
    this.debugGroup.add(debugBox, marker);

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(7, 10, 16, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#dfe8ee';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
      ctx.fillStyle = '#dfe8ee';
      ctx.font = 'bold 52px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.name, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });

      const label = new THREE.Sprite(labelMaterial);
      label.position.set((this.minX + this.maxX) / 2, 2.5, (this.minZ + this.maxZ) / 2);
      label.scale.set(3.8, 1.8, 1);
      this.debugGroup.add(label);
    }
  }

  setDebugVisible(visible) {
    if (this.debugGroup) {
      this.debugGroup.visible = visible;
    }
  }
}
