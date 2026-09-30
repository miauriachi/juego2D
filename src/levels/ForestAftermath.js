import * as THREE from 'three';
import { ForestLayout } from './ForestLayout.js';
import { BloodTrail } from '../environment/BloodTrail.js';
import { Snowfall } from '../environment/Snowfall.js';
import { DEBUG_MODE } from '../config/constants.js';

// A compact clearing at the actual accident coordinates, with an unbroken return route.
export class ForestAftermath {
  constructor(road, incident, cameras, collision) {
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0c1722);
    this.scene.fog = new THREE.Fog(0x0c1722, 5, 22);
    this.origin = incident.impactPosition.clone(); this.origin.y = 0;
    this.point = (x, z) => new THREE.Vector3(this.origin.x + x, 0, this.origin.z + z);
    const o = this.origin;
    collision.bounds = { minX: o.x - 9, maxX: o.x + 30, minZ: o.z - 16, maxZ: o.z + 12 };
    this.car = road.vehicle.group; this.scene.add(this.car);
    this.car.updateMatrixWorld(true);
    const carBox = new THREE.Box3().setFromObject(this.car);
    // Lights' targets do not expand a mesh bounding box.
    collision.addCollider({ minX: carBox.min.x, maxX: carBox.max.x, minZ: carBox.min.z, maxZ: carBox.max.z });
    this.exitPosition = this.car.localToWorld(new THREE.Vector3(-1.9, 0, 0.5));
    this.exitPosition.x = Math.min(this.exitPosition.x, carBox.min.x - 0.65);
    this.exitPosition.y = 0;
    this.hinge = new THREE.Group(); this.hinge.position.set(-0.91, 0.76, -0.8);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.68, 1.35), new THREE.MeshLambertMaterial({ color: 0x354451 }));
    door.position.z = 0.67; this.hinge.add(door); this.car.add(this.hinge);
    const snow = new THREE.MeshLambertMaterial({ color: 0xa8b6c4 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 160, 60, 32), snow);
    floor.rotation.x = -Math.PI / 2; floor.position.copy(this.point(50, -2));
    // Depressions outside the walking clearing supply relief without hovering feet.
    const positions = floor.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setZ(i, -0.035 * Math.abs(Math.sin(positions.getX(i)) * Math.cos(positions.getY(i))));
    floor.geometry.computeVertexNormals(); this.scene.add(floor);
    const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 160), new THREE.MeshLambertMaterial({ color: 0x7d94aa }));
    roadMesh.rotation.x = -Math.PI / 2; roadMesh.position.copy(this.point(road.centerX(-o.z) - o.x, -2)); roadMesh.position.y = 0.006; this.scene.add(roadMesh);
    this.layout = new ForestLayout(o);
    this.trail = new BloodTrail(this.layout.points);
    this.scene.add(this.trail);
    this.bodyPosition = this.layout.points.at(-1).clone();
    this.woman = incident.woman; this.woman.visible = true; this.woman.pose = 'lying';
    this.woman.rotation.set(Math.PI / 2, 0, -0.35); this.woman.position.copy(this.bodyPosition);
    this.woman.animate(0, 0); this.scene.add(this.woman); this.woman.updateMatrixWorld(true);
    this.woman.position.y += 0.035 - new THREE.Box3().setFromObject(this.woman).min.y;
    this.woman.userData.state = 'INJURED_LYING';
    const damageShape = new THREE.Shape();
    damageShape.moveTo(-0.08, -0.1); damageShape.lineTo(-0.06, 0.09); damageShape.lineTo(0.01, 0.05);
    damageShape.lineTo(0.06, 0.1); damageShape.lineTo(0.08, -0.06); damageShape.lineTo(0, -0.04);
    const damageGeometry = new THREE.ShapeGeometry(damageShape);
    const stain = new THREE.Mesh(damageGeometry, new THREE.MeshLambertMaterial({ color: 0x663b40, side: THREE.DoubleSide }));
    stain.position.set(-0.04, 1.12, -0.155); stain.rotation.z = 0.3; this.woman.add(stain);
    const tornCloth = new THREE.Mesh(damageGeometry, new THREE.MeshLambertMaterial({ color: 0x293038, side: THREE.DoubleSide }));
    tornCloth.position.set(0.12, 0.6, -0.115); tornCloth.scale.set(0.65, 0.8, 1); this.woman.add(tornCloth);
    this.layout.build(this.scene, collision);
    this.scene.add(new THREE.HemisphereLight(0xb3c9e1, 0x293744, 0.65));
    const moon = new THREE.DirectionalLight(0xa9c9ef, 0.55); moon.position.set(-5, 15, 9); this.scene.add(moon);
    cameras.scene = this.scene;
    this.scene.updateMatrixWorld(true);
    const solids = [];
    this.scene.traverse(object => { if (object.isMesh && object.visible && !object.material?.wireframe && !object.name.includes('debug')) solids.push(object); });
    const targets = [this.exitPosition.clone().setY(0.9), this.exitPosition.clone().setY(1.6)];
    const candidates = [[-5.5, 3, 4], [-6, 3, -3], [-6.5, 3.6, 6], [-6, 4.2, 0]].map(p => this.car.localToWorld(new THREE.Vector3(...p)));
    candidates.push(this.exitPosition.clone().add(new THREE.Vector3(-4.5, 3, 1)), this.exitPosition.clone().add(new THREE.Vector3(-4, 3.5, -3)));
    this.crashCameraPosition = candidates.find(position => targets.every(target => {
      const direction = target.clone().sub(position), distance = direction.length();
      return new THREE.Raycaster(position, direction.normalize(), 0.05, distance - 0.1).intersectObjects(solids, false).length === 0;
    }));
    this.crashCameraClear = !!this.crashCameraPosition;
    if (!this.crashCameraPosition) this.crashCameraPosition = this.exitPosition.clone().add(new THREE.Vector3(-4, 3, 0));
    const look = this.exitPosition.clone().lerp(this.origin, 0.35).setY(0.8);
    cameras.addZone({ id: 'CAM_CRASH_EXIT', name: 'CAM_CRASH_EXIT', cameraPosition: this.crashCameraPosition.toArray(), lookAt: look.toArray(),
      minX: o.x - 10, maxX: o.x + 8, minZ: o.z - 35, maxZ: o.z + 35, priority: 10, color: 0xa4c7df });
    const bx = this.bodyPosition.x - o.x, bz = this.bodyPosition.z - o.z;
    const zones = [['CAM_FOREST_BODY', 8, 80, [bx - 4, 3.6, bz + 4], [bx, 0.7, bz]]];
    for (const [name, min, max, position, target] of zones) cameras.addZone({ id: name, name,
      cameraPosition: [o.x + position[0], position[1], o.z + position[2]], lookAt: [o.x + target[0], target[1], o.z + target[2]],
      minX: o.x + min, maxX: o.x + max, minZ: o.z - 35, maxZ: o.z + 35, priority: min + 10, color: 0x94b9d2 });
    cameras.setDebugVisibility(DEBUG_MODE);
    if (DEBUG_MODE) { const grid = new THREE.GridHelper(50, 50); grid.position.copy(o); grid.position.y = 0.04; this.scene.add(grid); }
    this.snowfall = new Snowfall(this.scene, 400, 30); this.time = 0;
  }
  update(dt, player) {
    this.time += dt; this.snowfall.update(dt, player.position);
    if (this.woman.pose !== 'lying') return;
    this.woman.animate(dt, 0);
    this.woman.arms[0].rotation.x = 0.04 + Math.sin(this.time * 1.7) * 0.024;
    this.woman.head.rotation.x = Math.sin(this.time * 1.1) * 0.022;
    this.woman.torso.scale.z = 1 + Math.sin(this.time * 2.8 + Math.sin(this.time * 0.9)) * 0.014;
  }
}
