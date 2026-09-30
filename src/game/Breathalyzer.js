import * as THREE from 'three';

export class Breathalyzer extends THREE.Group {
  constructor() {
    super(); this.name = 'Breathalyzer';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.035), new THREE.MeshLambertMaterial({ color: 0x323d45 })); this.add(body);
    this.display = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.035), new THREE.MeshBasicMaterial({ color: 0x9ec8ae }));
    this.display.position.set(0, 0.026, 0.019); this.add(this.display);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), new THREE.MeshLambertMaterial({ color: 0xe3e8e8 }));
    tube.rotation.z = Math.PI / 2; tube.position.set(0.06, 0.045, 0); this.add(tube);
  }
  negative() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const c = canvas.getContext('2d'); c.fillStyle = '#b7dbc4'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#162d22'; c.font = 'bold 42px monospace'; c.fillText('0.00', 6, 48);
    this.display.material.map = new THREE.CanvasTexture(canvas); this.display.material.needsUpdate = true;
  }
}
