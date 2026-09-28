import * as THREE from 'three';
import { ForestLayout } from './ForestLayout.js';
import { BloodTrail } from '../environment/BloodTrail.js';
import { DEBUG_MODE } from '../config/constants.js';

// Post-impact chapter now stays inside the SAME snowy-road scene. The car,
// distant forest, headlights, storm and roadside dressing therefore never pop
// away when Bryan opens the door.
export class ForestAftermath {
  constructor(road, incident, cameras, collision) {
    this.road = road;
    this.scene = road.scene;
    this.time = 0;

    this.car = road.vehicle.group;
    this.car.updateMatrixWorld(true);

    const carBox = new THREE.Box3().setFromObject(this.car);
    collision.addCollider({
      minX: carBox.min.x,
      maxX: carBox.max.x,
      minZ: carBox.min.z,
      maxZ: carBox.max.z,
    });

    // Driver-side exit stays beside the stopped car in the original scene.
    this.exitPosition = this.car.localToWorld(new THREE.Vector3(-1.9, 0, 0.5));
    this.exitPosition.x = Math.min(this.exitPosition.x, carBox.min.x - 0.65);
    this.exitPosition.y = 0;

    // Blood begins BEHIND the car, then bends into the woods.
    this.origin = this.car.localToWorld(new THREE.Vector3(0.55, 0, 3.25));
    this.origin.y = 0.025;
    this.point = (x, z) => new THREE.Vector3(this.origin.x + x, 0, this.origin.z + z);

    this.hinge = new THREE.Group();
    this.hinge.name = 'aftermath-driver-door-hinge';
    this.hinge.position.set(-0.91, 0.76, -0.8);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.68, 1.35),
      new THREE.MeshLambertMaterial({ color: 0x354451 }),
    );
    door.position.z = 0.67;
    this.hinge.add(door);
    this.car.add(this.hinge);

    // The short maze is added beyond the roadside, but the road/forest/storm
    // underneath remain the exact same objects from the driving sequence.
    this.layout = new ForestLayout(this.origin);
    this.trail = new BloodTrail(this.layout.points);
    this.scene.add(this.trail);

    this.bodyPosition = this.layout.points.at(-1).clone();
    this.woman = incident.woman;
    this.woman.visible = true;
    this.woman.pose = 'lying';
    this.woman.rotation.set(Math.PI / 2, 0, -0.35);
    this.woman.position.copy(this.bodyPosition);
    this.woman.animate(0, 0);
    this.scene.add(this.woman);
    this.woman.updateMatrixWorld(true);
    this.woman.position.y += 0.035 - new THREE.Box3().setFromObject(this.woman).min.y;
    this.woman.userData.state = 'INJURED_LYING';

    const damageShape = new THREE.Shape();
    damageShape.moveTo(-0.08, -0.1);
    damageShape.lineTo(-0.06, 0.09);
    damageShape.lineTo(0.01, 0.05);
    damageShape.lineTo(0.06, 0.1);
    damageShape.lineTo(0.08, -0.06);
    damageShape.lineTo(0, -0.04);

    const damageGeometry = new THREE.ShapeGeometry(damageShape);
    const stain = new THREE.Mesh(
      damageGeometry,
      new THREE.MeshLambertMaterial({ color: 0x663b40, side: THREE.DoubleSide }),
    );
    stain.position.set(-0.04, 1.12, -0.155);
    stain.rotation.z = 0.3;
    this.woman.add(stain);

    const tornCloth = new THREE.Mesh(
      damageGeometry,
      new THREE.MeshLambertMaterial({ color: 0x293038, side: THREE.DoubleSide }),
    );
    tornCloth.position.set(0.12, 0.6, -0.115);
    tornCloth.scale.set(0.65, 0.8, 1);
    this.woman.add(tornCloth);

    this.layout.build(this.scene, collision);

    // Keep the player within the stopped-car / compact-maze region.
    collision.bounds = {
      minX: Math.min(this.origin.x - 8, this.exitPosition.x - 4),
      maxX: this.origin.x + 49,
      minZ: this.origin.z - 15,
      maxZ: this.origin.z + 16,
    };

    // A tiny cold fill keeps Bryan readable near the car without flattening
    // the forest darkness. Road headlights remain the dominant light source.
    this.localFill = new THREE.PointLight(0x9dbed4, 2.2, 10, 2);
    this.localFill.position.copy(this.exitPosition).add(new THREE.Vector3(0, 2.8, 0));
    this.scene.add(this.localFill);

    cameras.scene = this.scene;

    const crashCamera = this.car.localToWorld(new THREE.Vector3(-5.4, 3.0, 4.4));
    const crashLook = this.car.position.clone().lerp(this.origin, 0.42).setY(0.8);
    cameras.addZone({
      id: 'CAM_CRASH_EXIT',
      name: 'CAM_CRASH_EXIT',
      cameraPosition: crashCamera.toArray(),
      lookAt: crashLook.toArray(),
      minX: this.origin.x - 10,
      maxX: this.origin.x + 7.5,
      minZ: this.origin.z - 14,
      maxZ: this.origin.z + 14,
      priority: 10,
      color: 0xa4c7df,
    });

    const bodyCamera = this.bodyPosition.clone().add(new THREE.Vector3(-4.2, 3.4, 4.5));
    cameras.addZone({
      id: 'CAM_FOREST_BODY',
      name: 'CAM_FOREST_BODY',
      cameraPosition: bodyCamera.toArray(),
      lookAt: this.bodyPosition.clone().setY(0.75).toArray(),
      minX: this.origin.x + 7,
      maxX: this.origin.x + 52,
      minZ: this.origin.z - 16,
      maxZ: this.origin.z + 16,
      priority: 18,
      color: 0x94b9d2,
    });

    cameras.setDebugVisibility(DEBUG_MODE);

    if (DEBUG_MODE) {
      const grid = new THREE.GridHelper(60, 60);
      grid.position.copy(this.origin);
      grid.position.y = 0.04;
      this.scene.add(grid);
    }

    // Aliases retained for rescue code, but these are the SAME storm objects
    // used during driving, not replacement particles.
    this.snowfall = road.snowfall;
    this.snowfront = road.snowfront;
    this.groundSnow = road.groundSnow;
  }

  updateStorm(dt, center) {
    this.road.stormTime += Math.max(0, dt);
    const gustA = 0.5 + 0.5 * Math.sin(this.road.stormTime * 0.36);
    const gustB = 0.5 + 0.5 * Math.sin(this.road.stormTime * 0.91 + 1.7);
    this.road.stormGust = THREE.MathUtils.clamp(gustA * 0.62 + gustB * 0.38, 0, 1);
    this.road.updateWeather(dt, center);
  }

  update(dt, player) {
    this.time += dt;
    this.updateStorm(dt, player.position);

    if (this.woman.pose !== 'lying') return;
    this.woman.animate(dt, 0);
    this.woman.arms[0].rotation.x = 0.04 + Math.sin(this.time * 1.7) * 0.024;
    this.woman.head.rotation.x = Math.sin(this.time * 1.1) * 0.022;
    this.woman.torso.scale.z =
      1 + Math.sin(this.time * 2.8 + Math.sin(this.time * 0.9)) * 0.014;
  }
}
