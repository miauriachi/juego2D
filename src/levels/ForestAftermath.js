import * as THREE from 'three';
import { ForestLayout } from './ForestLayout.js';
import { BloodTrail } from '../environment/BloodTrail.js';
import { DEBUG_MODE, PLAYER_RADIUS } from '../config/constants.js';

function buildForegroundFrame(scene, cameraPosition, lookAt, name, flip = 1) {
  const group = new THREE.Group();
  group.name = name;

  const forward = lookAt.clone().sub(cameraPosition).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const bark = new THREE.MeshLambertMaterial({ color: 0x071014, fog: true });
  const barkNear = new THREE.MeshBasicMaterial({ color: 0x030709, fog: false });
  const snow = new THREE.MeshLambertMaterial({ color: 0x8ea0aa, fog: true });

  const trunkGeometry = new THREE.CylinderGeometry(0.34, 0.52, 1, 6);
  const branchGeometry = new THREE.CylinderGeometry(0.045, 0.095, 1, 5);

  const addTrunk = (side, distance, height, radius, lean) => {
    const base = cameraPosition.clone()
      .addScaledVector(forward, distance)
      .addScaledVector(right, side);

    const trunk = new THREE.Mesh(trunkGeometry, distance < 2.8 ? barkNear : bark);
    trunk.position.set(base.x, height * 0.5 - 0.15, base.z);
    trunk.scale.set(radius, height, radius);
    trunk.rotation.z = lean;
    trunk.renderOrder = 30;
    group.add(trunk);

    for (let i = 0; i < 3; i += 1) {
      const branch = new THREE.Mesh(branchGeometry, barkNear);
      branch.position.set(
        base.x + (i % 2 ? -0.15 : 0.15),
        height * (0.44 + i * 0.16),
        base.z + (i - 1) * 0.12,
      );
      branch.scale.set(1, 2.5 + i * 0.7, 1);
      branch.rotation.set((i - 1) * 0.13, Math.atan2(forward.x, forward.z), flip * (i % 2 ? 1.08 : -1.02));
      branch.renderOrder = 31;
      group.add(branch);

      if (i === 1) {
        const snowCap = new THREE.Mesh(branchGeometry, snow);
        snowCap.position.copy(branch.position).add(new THREE.Vector3(0, 0.07, 0));
        snowCap.scale.set(1.22, branch.scale.y * 0.92, 1.22);
        snowCap.rotation.copy(branch.rotation);
        snowCap.renderOrder = 29;
        group.add(snowCap);
      }
    }
  };

  // Intentionally asymmetric: classic fixed-camera compositions use foreground
  // silhouettes to frame the playable area rather than centering everything.
  addTrunk(3.15 * flip, 2.35, 12.5, 1.0, -0.055 * flip);
  addTrunk(-4.05 * flip, 3.15, 10.5, 0.78, 0.07 * flip);

  scene.add(group);
  return group;
}

// Post-impact chapter now stays inside the SAME snowy-road scene. The car,
// distant forest, headlights, storm and roadside dressing therefore never pop
// away when Bryan opens the door.
export class ForestAftermath {
  constructor(road, incident, cameras, collision, actorRoot = null) {
    this.road = road;
    this.scene = road.scene;
    this.actorRoot = actorRoot;
    this.time = 0;

    this.car = road.vehicle.group;
    this.car.updateMatrixWorld(true);

    // The car is rotated after impact, so an axis-aligned world collider creates
    // a huge invisible rectangle around it. Keep collision in CAR LOCAL SPACE
    // instead; this also lets Bryan spawn right beside the driver's door.
    this.carCollisionHalfWidth = 0.91 + PLAYER_RADIUS;
    this.carCollisionHalfLength = 2.08 + PLAYER_RADIUS;

    // Car body is ~1.8 m wide. Bryan's center sits just outside the left side,
    // leaving only a small visual gap instead of throwing him meters away.
    this.exitPosition = this.car.localToWorld(new THREE.Vector3(-1.62, 0, -0.62));
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

    // The authored forest route is added beyond the roadside, while the original
    // road, car, headlights, forest and storm remain in the same scene.
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

    // Character separation: Bryan gets a restrained cold edge light while the
    // headlights remain the dominant source. This prevents him from becoming a
    // black cutout without flattening the night scene.
    this.localFill = new THREE.PointLight(0x9dbed4, 3.6, 8.5, 2);
    this.localFill.position.copy(this.exitPosition).add(new THREE.Vector3(0, 2.35, 0));

    this.rearRim = new THREE.PointLight(0xc7d9e4, 2.7, 7.5, 2);
    this.rearRim.position.copy(this.origin).add(new THREE.Vector3(0, 1.65, 0));

    this.scene.add(this.localFill, this.rearRim);

    // A tiny moving fill plus a soft contact shadow are essential when a live
    // 3D character is composited over a prerendered background. They keep Bryan
    // readable and visually planted on the snow without changing gameplay.
    this.actorFill = new THREE.PointLight(0xa9c3d5, 1.35, 5.4, 2);
    this.actorFill.position.copy(this.exitPosition).add(new THREE.Vector3(0, 2.35, 0.7));
    this.scene.add(this.actorFill);

    if (actorRoot) {
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 20),
        new THREE.MeshBasicMaterial({
          color: 0x020507,
          transparent: true,
          opacity: 0.30,
          depthWrite: false,
          depthTest: false,
          fog: false,
        }),
      );
      shadow.name = 'forest-bryan-contact-shadow';
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(1.0, 0.56, 1);
      shadow.position.set(0, 0.018, 0.04);
      shadow.renderOrder = -5;
      shadow.userData.preserveForForestBackplate = true;
      actorRoot.add(shadow);
      this.actorShadow = shadow;
    }

    cameras.scene = this.scene;

    // Fixed-camera forest rooms. Each bend gets its own authored composition
    // so the entire on-foot section keeps the same visual language as the hospital.
    const crashCamera = this.car.localToWorld(new THREE.Vector3(-4.05, 2.25, 3.35));
    const crashLook = this.exitPosition.clone().lerp(this.origin, 0.48).setY(0.92);
    cameras.addZone({
      id: 'CAM_CRASH_EXIT',
      name: 'CAM_CRASH_EXIT',
      cameraPosition: crashCamera.toArray(),
      lookAt: crashLook.toArray(),
      minX: this.origin.x - 10,
      maxX: this.origin.x + 5.0,
      minZ: this.origin.z - 12,
      maxZ: this.origin.z + 12,
      priority: 10,
      fov: 52,
      color: 0xa4c7df,
    });

    const bloodCamera = this.car.localToWorld(new THREE.Vector3(-2.65, 1.72, 5.10));
    const bloodLook = this.origin.clone().setY(0.34);
    cameras.addZone({
      id: 'CAM_BLOOD_TRAIL',
      name: 'CAM_BLOOD_TRAIL',
      cameraPosition: bloodCamera.toArray(),
      lookAt: bloodLook.toArray(),
      minX: this.origin.x - 2.5,
      maxX: this.origin.x + 3.8,
      minZ: this.origin.z - 3.2,
      maxZ: this.origin.z + 3.2,
      priority: 16,
      fov: 48,
      color: 0x92abc0,
    });

    const forestA = this.layout.points[3];
    const forestACamera = forestA.clone().add(new THREE.Vector3(-5.8, 4.1, 6.6));
    const forestALook = this.layout.points[4].clone().setY(0.72);
    cameras.addZone({
      id: 'CAM_FOREST_A',
      name: 'CAM_FOREST_A',
      cameraPosition: forestACamera.toArray(),
      lookAt: forestALook.toArray(),
      minX: this.origin.x + 4.5,
      maxX: this.origin.x + 15.8,
      minZ: this.origin.z - 4.8,
      maxZ: this.origin.z + 8.5,
      priority: 20,
      fov: 50,
      color: 0x7f9caf,
    });

    const forestB = this.layout.points[5];
    const forestBCamera = forestB.clone().add(new THREE.Vector3(4.8, 4.7, -7.2));
    const forestBLook = this.layout.points[6].clone().setY(0.78);
    cameras.addZone({
      id: 'CAM_FOREST_B',
      name: 'CAM_FOREST_B',
      cameraPosition: forestBCamera.toArray(),
      lookAt: forestBLook.toArray(),
      minX: this.origin.x + 14.0,
      maxX: this.origin.x + 26.0,
      minZ: this.origin.z - 2.5,
      maxZ: this.origin.z + 10.5,
      priority: 21,
      fov: 49,
      color: 0x7692a5,
    });

    const forestC = this.layout.points[8];
    const forestCCamera = forestC.clone().add(new THREE.Vector3(-5.4, 3.75, -6.8));
    const forestCLook = this.layout.points[9].clone().setY(0.72);
    cameras.addZone({
      id: 'CAM_FOREST_C',
      name: 'CAM_FOREST_C',
      cameraPosition: forestCCamera.toArray(),
      lookAt: forestCLook.toArray(),
      minX: this.origin.x + 24.0,
      maxX: this.origin.x + 36.5,
      minZ: this.origin.z - 8.5,
      maxZ: this.origin.z + 6.0,
      priority: 22,
      fov: 50,
      color: 0x6d879a,
    });

    const forestD = this.layout.points[10];
    const forestDCamera = forestD.clone().add(new THREE.Vector3(5.0, 4.0, 6.4));
    const forestDLook = this.layout.points[11].clone().setY(0.68);
    cameras.addZone({
      id: 'CAM_FOREST_D',
      name: 'CAM_FOREST_D',
      cameraPosition: forestDCamera.toArray(),
      lookAt: forestDLook.toArray(),
      minX: this.origin.x + 34.0,
      maxX: this.origin.x + 44.8,
      minZ: this.origin.z - 6.5,
      maxZ: this.origin.z + 7.0,
      priority: 23,
      fov: 48,
      color: 0x657f91,
    });

    const bodyCamera = this.bodyPosition.clone().add(new THREE.Vector3(-4.1, 2.65, 4.8));
    const bodyLook = this.bodyPosition.clone().setY(0.58);
    cameras.addZone({
      id: 'CAM_FOREST_BODY',
      name: 'CAM_FOREST_BODY',
      cameraPosition: bodyCamera.toArray(),
      lookAt: bodyLook.toArray(),
      minX: this.origin.x + 40.0,
      maxX: this.origin.x + 48.5,
      minZ: this.origin.z - 6.0,
      maxZ: this.origin.z + 7.0,
      priority: 30,
      fov: 46,
      color: 0x94b9d2,
    });

    this.crashForeground = buildForegroundFrame(
      this.scene,
      crashCamera,
      crashLook,
      'foreground-crash-frame',
      1,
    );
    this.forestAForeground = buildForegroundFrame(
      this.scene,
      forestACamera,
      forestALook,
      'foreground-forest-a',
      -1,
    );
    this.forestBForeground = buildForegroundFrame(
      this.scene,
      forestBCamera,
      forestBLook,
      'foreground-forest-b',
      1,
    );
    this.forestCForeground = buildForegroundFrame(
      this.scene,
      forestCCamera,
      forestCLook,
      'foreground-forest-c',
      -1,
    );
    this.bodyForeground = buildForegroundFrame(
      this.scene,
      bodyCamera,
      bodyLook,
      'foreground-body-frame',
      1,
    );

    // The previous forest atlas only supplied ~320x180 pixels per shot and was
    // being stretched over the viewport. Keep the authored fixed cameras but use
    // the full 3D road/forest/storm until full-resolution individual backplates
    // are committed. This prevents the giant mosaic/pixel blocks.
    this.backdrop = null;

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

  resolveCarCollision(player) {
    const position = player?.position ?? player?.group?.position;
    if (!position) return;

    const local = this.car.worldToLocal(position.clone());
    const halfW = this.carCollisionHalfWidth;
    const halfL = this.carCollisionHalfLength;

    if (Math.abs(local.x) >= halfW || Math.abs(local.z) >= halfL) return;

    const pushX = halfW - Math.abs(local.x);
    const pushZ = halfL - Math.abs(local.z);

    if (pushX < pushZ) {
      local.x = (local.x < 0 ? -1 : 1) * (halfW + 0.015);
    } else {
      local.z = (local.z < 0 ? -1 : 1) * (halfL + 0.015);
    }

    const world = this.car.localToWorld(local);
    position.x = world.x;
    position.z = world.z;
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

    if (this.actorFill) {
      this.actorFill.position.set(
        player.position.x - 0.35,
        player.position.y + 2.25,
        player.position.z + 0.85,
      );
      this.actorFill.intensity = 1.05 + this.road.stormGust * 0.45;
    }

    if (this.woman.pose !== 'lying') return;
    this.woman.animate(dt, 0);
    this.woman.arms[0].rotation.x = 0.04 + Math.sin(this.time * 1.7) * 0.024;
    this.woman.head.rotation.x = Math.sin(this.time * 1.1) * 0.022;
    this.woman.torso.scale.z =
      1 + Math.sin(this.time * 2.8 + Math.sin(this.time * 0.9)) * 0.014;
  }
}
