import * as THREE from 'three';

export function createHospitalLighting(scene) {
  const ambient = new THREE.AmbientLight(0x9db0b6, 0.32);
  scene.add(ambient);

  const keyLights = [
    { position: [0, 4.2, 0], color: 0xdfeaf0, intensity: 1.4, distance: 18 },
    { position: [-6, 3.8, 4], color: 0xcfe2ec, intensity: 1.1, distance: 12 },
    { position: [6, 3.8, -4], color: 0xcfe2ec, intensity: 1.1, distance: 12 },
  ];

  const lightGroup = [];
  keyLights.forEach(({ position, color, intensity, distance }) => {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(position[0], position[1], position[2]);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    scene.add(light);
    lightGroup.push(light);
  });

  const flickerLight = new THREE.PointLight(0xccdcef, 0.7, 9, 2.2);
  flickerLight.position.set(2.5, 2.4, 3.2);
  scene.add(flickerLight);

  return {
    ambient,
    keyLights: lightGroup,
    flickerLight,
  };
}
