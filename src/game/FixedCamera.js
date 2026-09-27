import * as THREE from 'three';

export class FixedCamera {
  constructor(initialPosition = new THREE.Vector3(0, 3.2, 7.5), initialLookAt = new THREE.Vector3(0, 1.5, 0)) {
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.copy(initialPosition);
    this.camera.lookAt(initialLookAt);
    this.currentLookAt = initialLookAt.clone();
  }

  setCameraState(position, lookAt) {
    this.camera.position.copy(position);
    this.currentLookAt.copy(lookAt);
    this.camera.lookAt(this.currentLookAt);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
