import * as THREE from 'three';
import { ForestLayout } from './ForestLayout.js';
import { BloodTrail } from '../environment/BloodTrail.js';
import { ForestPrerenderBackdrop } from '../game/ForestPrerenderBackdrop.js';
import { DEBUG_MODE, PLAYER_RADIUS } from '../config/constants.js';

function composeLookAtForScreen(cameraPosition, groundAnchor, fov, ndcX, ndcY) {
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 1000);
  camera.position.copy(cameraPosition);

  const lookAt = groundAnchor.clone().add(new THREE.Vector3(0, 0.9, 0));
  const foot = groundAnchor.clone();
  const aspect = 16 / 9;
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) * 0.5);

  // Iteratively offset the fixed-camera aim until Bryan's feet land on the
  // authored point in the prerender. The player's real Y remains 0.
  for (let i = 0; i < 7; i += 1) {
    camera.lookAt(lookAt);
    camera.updateMatrixWorld(true);

    const projected = foot.clone().project(camera);
    const errorX = ndcX - projected.x;
    const errorY = ndcY - projected.y;
    if (Math.abs(errorX) < 0.002 && Math.abs(errorY) < 0.002) break;

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const distance = Math.max(2, cameraPosition.distanceTo(groundAnchor));

    lookAt.addScaledVector(right, -errorX * distance * tanHalfFov * aspect * 0.82);
    lookAt.addScaledVector(up, -errorY * distance * tanHalfFov * 0.82);
  }

  return lookAt;
}

function groundPointForScreen(cameraPosition, lookAt, fov, ndcX, ndcY) {
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 1000);
  camera.position.copy(cameraPosition);
  camera.lookAt(lookAt);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const rayPoint = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const direction = rayPoint.sub(camera.position).normalize();
  if (Math.abs(direction.y) < 1e-5) return lookAt.clone().setY(0);

  const distance = -camera.position.y / direction.y;
  return camera.position.clone().addScaledVector(direction, distance).setY(0);
}

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
  constructor(road, incident, cameras, collision, actorRoot = null, renderer = null) {
    this.road = road;
    this.scene = road.scene;
    this.actorRoot = actorRoot;
    this.time = 0;

    this.car = road.vehicle.group;
    this.car.userData.preserveForestZones = ['CAM_CRASH_EXIT', 'CAM_BLOOD_TRAIL'];

    // Presentation-only enlargement for the first two fixed-camera shots.
    // The parent vehicle group, physics, steering and collision are untouched.
    this.car.userData.aftermathVisualScale = 1.25;
    if (this.car.userData.detailedVisual) {
      this.car.userData.detailedVisual.scale.setScalar(
        this.car.userData.aftermathVisualScale,
      );
    }

    this.car.updateMatrixWorld(true);

    // The car is rotated after impact, so an axis-aligned world collider creates
    // a huge invisible rectangle around it. Keep collision in CAR LOCAL SPACE
    // instead; this also lets Bryan spawn right beside the driver's door.
    this.carCollisionHalfWidth = 0.96 + PLAYER_RADIUS;
    this.carCollisionHalfLength = 2.30 + PLAYER_RADIUS;

    // Real collision/world spawn: immediately beside the driver's door, feet on
    // y=0. The fixed camera below composes this point onto the baked doorway.
    this.exitPosition = this.car.localToWorld(new THREE.Vector3(-1.58, 0, -0.48));
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
    // The Meshy sedan is a single baked mesh, so a procedural rectangular door
    // would float through its body. Keep the hinge for timing/SFX but hide it.
    this.hinge.visible = false;
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

    // The final prerender is now environment-only. Keep the actual gameplay NPC
    // visible over it and size her for this fixed-camera shot.
    this.woman.userData.preserveForestZones = ['CAM_FOREST_BODY'];
    this.woman.userData.bodyShotScale = 1.48;
    this.woman.scale.setScalar(this.woman.userData.bodyShotScale);
    this.woman.updateMatrixWorld(true);
    this.woman.position.y +=
      0.035 - new THREE.Box3().setFromObject(this.woman).min.y;

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

    // The prerender stays screen-fixed, so these cameras are authored for the
    // live 3D Bryan only. Each room uses a real point on the walkable route and
    // places his FEET on the visible snow path. No per-room model scaling.
    const crashFov = 48;
    const crashCamera = this.exitPosition.clone().add(new THREE.Vector3(-5.6, 3.0, 4.8));
    const crashLook = composeLookAtForScreen(
      crashCamera,
      this.exitPosition,
      crashFov,
      -0.40,
      -0.66,
    );
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
      fov: crashFov,
      color: 0xa4c7df,
    });

    const bloodAnchor = this.layout.points[0].clone();
    const bloodFov = 49;
    const bloodCamera = bloodAnchor.clone().add(new THREE.Vector3(-6.2, 3.5, 7.2));
    const bloodLook = composeLookAtForScreen(
      bloodCamera,
      bloodAnchor,
      bloodFov,
      0.10,
      -0.55,
    );
    cameras.addZone({
      id: 'CAM_BLOOD_TRAIL',
      name: 'CAM_BLOOD_TRAIL',
      cameraPosition: bloodCamera.toArray(),
      lookAt: bloodLook.toArray(),
      minX: this.origin.x - 2.5,
      maxX: this.origin.x + 7.8,
      minZ: this.origin.z - 4.5,
      maxZ: this.origin.z + 5.5,
      priority: 16,
      fov: bloodFov,
      color: 0x92abc0,
    });

    const forestA = this.layout.points[2].clone();
    const forestAFov = 49;
    const forestACamera = forestA.clone().add(new THREE.Vector3(-7.0, 4.2, 8.0));
    const forestALook = composeLookAtForScreen(
      forestACamera,
      forestA,
      forestAFov,
      0.12,
      -0.52,
    );

    // Scene 3 uses a deep straight-looking prerendered path. Its visual
    // direction does not match the old hidden 3D maze bend, which was stopping
    // Bryan around the middle of the image. Give only this shot its own narrow
    // walk lane aligned with the camera's ground-forward direction.
    this.forestAVisualDirection = forestALook.clone()
      .sub(forestACamera)
      .setY(0)
      .normalize();
    this.forestAVisualRight = new THREE.Vector3(
      -this.forestAVisualDirection.z,
      0,
      this.forestAVisualDirection.x,
    );
    this.forestAVisualLength = 18.0;
    this.forestAVisualHalfWidth = 2.35;
    this.forestANextSpawn = this.layout.points[5].clone();
    cameras.addZone({
      id: 'CAM_FOREST_A',
      name: 'CAM_FOREST_A',
      cameraPosition: forestACamera.toArray(),
      lookAt: forestALook.toArray(),
      minX: this.origin.x + 5.0,
      maxX: this.origin.x + 16.5,
      minZ: this.origin.z - 4.8,
      maxZ: this.origin.z + 9.0,
      priority: 20,
      fov: forestAFov,
      color: 0x7f9caf,
    });

    const forestB = this.layout.points[4].clone();
    const forestBFov = 49;
    const forestBCamera = forestB.clone().add(new THREE.Vector3(7.2, 4.4, -8.2));
    const forestBLook = composeLookAtForScreen(
      forestBCamera,
      forestB,
      forestBFov,
      -0.04,
      -0.50,
    );

    // Scene 4's painted trail is visually centered while the old hidden 3D
    // route placed Bryan on the left rock. Calibrate this room directly from
    // screen coordinates: enter near the lower-center trail, then walk toward
    // the upper-left opening marked by the visible path.
    this.forestBVisualStartPoint = groundPointForScreen(
      forestBCamera,
      forestBLook,
      forestBFov,
      -0.22,
      -0.64,
    );
    this.forestBVisualEndPoint = groundPointForScreen(
      forestBCamera,
      forestBLook,
      forestBFov,
      0.00,
      -0.02,
    );
    this.forestBVisualDirection = this.forestBVisualEndPoint.clone()
      .sub(this.forestBVisualStartPoint)
      .setY(0)
      .normalize();
    this.forestBVisualRight = new THREE.Vector3(
      -this.forestBVisualDirection.z,
      0,
      this.forestBVisualDirection.x,
    );
    this.forestBVisualLength = this.forestBVisualStartPoint.distanceTo(
      this.forestBVisualEndPoint,
    );
    this.forestBVisualHalfWidth = 1.48;
    this.forestBNextSpawn = this.layout.points[7].clone()
      .lerp(this.layout.points[8], 0.24);

    cameras.addZone({
      id: 'CAM_FOREST_B',
      name: 'CAM_FOREST_B',
      cameraPosition: forestBCamera.toArray(),
      lookAt: forestBLook.toArray(),
      minX: this.origin.x + 14.0,
      maxX: this.origin.x + 26.5,
      minZ: this.origin.z - 3.0,
      maxZ: this.origin.z + 11.0,
      priority: 21,
      fov: forestBFov,
      color: 0x7692a5,
    });

    const forestC = this.layout.points[6].clone();
    const forestCFov = 49;
    const forestCCamera = forestC.clone().add(new THREE.Vector3(-7.1, 4.3, -8.0));
    const forestCLook = composeLookAtForScreen(
      forestCCamera,
      forestC,
      forestCFov,
      0.10,
      -0.51,
    );

    // Scene 5 has the same mismatch as the previous prerendered room: the
    // hidden 3D route puts Bryan on a rock even though the visible walkable
    // surface is the snowy trail. Anchor this room to the painted path itself.
    this.forestCVisualStartPoint = groundPointForScreen(
      forestCCamera,
      forestCLook,
      forestCFov,
      0.08,
      -0.82,
    );
    this.forestCVisualEndPoint = groundPointForScreen(
      forestCCamera,
      forestCLook,
      forestCFov,
      0.34,
      -0.02,
    );
    this.forestCVisualDirection = this.forestCVisualEndPoint.clone()
      .sub(this.forestCVisualStartPoint)
      .setY(0)
      .normalize();
    this.forestCVisualRight = new THREE.Vector3(
      -this.forestCVisualDirection.z,
      0,
      this.forestCVisualDirection.x,
    );
    this.forestCVisualLength = this.forestCVisualStartPoint.distanceTo(
      this.forestCVisualEndPoint,
    );
    this.forestCVisualHalfWidth = 1.30;

    // Drop into D beyond the old 40.2 boundary so the camera cannot bounce
    // back and forth across the threshold on consecutive frames.
    this.forestCNextSpawn = this.layout.points[9].clone().lerp(
      this.layout.points[10],
      0.12,
    );

    cameras.addZone({
      id: 'CAM_FOREST_C',
      name: 'CAM_FOREST_C',
      cameraPosition: forestCCamera.toArray(),
      lookAt: forestCLook.toArray(),
      minX: this.origin.x + 23.0,
      maxX: this.origin.x + 36.5,
      minZ: this.origin.z - 9.0,
      maxZ: this.origin.z + 7.0,
      priority: 22,
      fov: forestCFov,
      color: 0x6d879a,
    });

    const forestD = this.layout.points[8].clone();
    const forestDFov = 49;
    const forestDCamera = forestD.clone().add(new THREE.Vector3(7.0, 4.2, 7.6));
    const forestDLook = composeLookAtForScreen(
      forestDCamera,
      forestD,
      forestDFov,
      0.08,
      -0.50,
    );
    cameras.addZone({
      id: 'CAM_FOREST_D',
      name: 'CAM_FOREST_D',
      cameraPosition: forestDCamera.toArray(),
      lookAt: forestDLook.toArray(),
      minX: this.origin.x + 31.0,
      maxX: this.origin.x + 42.5,
      minZ: this.origin.z - 7.5,
      maxZ: this.origin.z + 8.0,
      priority: 23,
      fov: forestDFov,
      color: 0x657f91,
    });

    const bodyAnchor = this.bodyPosition.clone();
    const bodyFov = 48;
    const bodyCamera = bodyAnchor.clone().add(new THREE.Vector3(-6.2, 3.8, 7.1));

    // Put the real injured woman low-right in the authored clearing. Bryan gets
    // his own ground-projected entry/approach points, so he cannot float over the
    // baked rocks anymore.
    const bodyLook = composeLookAtForScreen(
      bodyCamera,
      this.bodyPosition,
      bodyFov,
      0.31,
      -0.57,
    );

    this.bodyEntryPoint = groundPointForScreen(
      bodyCamera,
      bodyLook,
      bodyFov,
      -0.18,
      -0.70,
    );
    this.bodyApproachPoint = groundPointForScreen(
      bodyCamera,
      bodyLook,
      bodyFov,
      0.03,
      -0.62,
    );
    this.bodyVisualDirection = this.bodyApproachPoint.clone()
      .sub(this.bodyEntryPoint)
      .setY(0)
      .normalize();
    this.bodyVisualRight = new THREE.Vector3(
      -this.bodyVisualDirection.z,
      0,
      this.bodyVisualDirection.x,
    );
    this.bodyVisualLength = this.bodyEntryPoint.distanceTo(this.bodyApproachPoint);
    this.bodyVisualHalfWidth = 1.25;

    cameras.addZone({
      id: 'CAM_FOREST_BODY',
      name: 'CAM_FOREST_BODY',
      cameraPosition: bodyCamera.toArray(),
      lookAt: bodyLook.toArray(),
      minX: this.origin.x + 39.0,
      maxX: this.origin.x + 49.0,
      minZ: this.origin.z - 7.0,
      maxZ: this.origin.z + 8.0,
      priority: 30,
      fov: bodyFov,
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

    // Full-resolution 1280x720 prerenders, one real image per shot.
    // The live 3D room remains visible until the requested image has decoded.
    this.backdrop = new ForestPrerenderBackdrop(
      this.scene,
      cameras.cameraRig.camera,
      actorRoot,
      renderer,
    );
    this.backdrop.preload();

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

  getCameraZoneId(position, state, examined, lockedProgress = 0) {
    if (!position) return 'CAM_CRASH_EXIT';

    if (state === 'inCar' || state === 'exiting') {
      return 'CAM_CRASH_EXIT';
    }

    if (!examined) {
      const distanceToBlood = position.distanceTo(this.origin);
      return distanceToBlood <= 4.2
        ? 'CAM_BLOOD_TRAIL'
        : 'CAM_CRASH_EXIT';
    }

    const routeProgress = this.layout.progress(position);
    const progress = routeProgress;

    if (progress < 6.5) return 'CAM_BLOOD_TRAIL';

    // Let Bryan travel almost the full visible depth of scene 3 before cutting.
    // At constant model scale, perspective now makes him shrink naturally as he
    // walks away instead of switching shots around the middle of the path.
    if (progress < 21.4) return 'CAM_FOREST_A';
    if (progress < 31.0) return 'CAM_FOREST_B';
    if (progress < 40.2) return 'CAM_FOREST_C';
    if (progress < 45.5) return 'CAM_FOREST_D';
    return 'CAM_FOREST_BODY';
  }

  resolveForestAVisualPath(player, startPosition) {
    const position = player?.position ?? player?.group?.position;
    if (!position || !startPosition || !this.forestAVisualDirection) return 0;

    const delta = position.clone().sub(startPosition);
    const depth = THREE.MathUtils.clamp(
      delta.dot(this.forestAVisualDirection),
      -0.75,
      this.forestAVisualLength,
    );
    const lateral = THREE.MathUtils.clamp(
      delta.dot(this.forestAVisualRight),
      -this.forestAVisualHalfWidth,
      this.forestAVisualHalfWidth,
    );

    position.copy(startPosition)
      .addScaledVector(this.forestAVisualDirection, depth)
      .addScaledVector(this.forestAVisualRight, lateral);

    return depth;
  }

  resolveForestBVisualPath(player, startPosition) {
    const position = player?.position ?? player?.group?.position;
    if (!position || !startPosition || !this.forestBVisualDirection) return 0;

    const delta = position.clone().sub(startPosition);
    const depth = THREE.MathUtils.clamp(
      delta.dot(this.forestBVisualDirection),
      -0.35,
      this.forestBVisualLength,
    );
    const lateral = THREE.MathUtils.clamp(
      delta.dot(this.forestBVisualRight),
      -this.forestBVisualHalfWidth,
      this.forestBVisualHalfWidth,
    );

    position.copy(startPosition)
      .addScaledVector(this.forestBVisualDirection, depth)
      .addScaledVector(this.forestBVisualRight, lateral);

    return depth;
  }

  resolveForestCVisualPath(player, startPosition) {
    const position = player?.position ?? player?.group?.position;
    if (!position || !startPosition || !this.forestCVisualDirection) return 0;

    const delta = position.clone().sub(startPosition);
    const depth = THREE.MathUtils.clamp(
      delta.dot(this.forestCVisualDirection),
      -0.35,
      this.forestCVisualLength,
    );
    const lateral = THREE.MathUtils.clamp(
      delta.dot(this.forestCVisualRight),
      -this.forestCVisualHalfWidth,
      this.forestCVisualHalfWidth,
    );

    position.copy(startPosition)
      .addScaledVector(this.forestCVisualDirection, depth)
      .addScaledVector(this.forestCVisualRight, lateral);

    return depth;
  }

  resolveBodyVisualPath(player, startPosition) {
    const position = player?.position ?? player?.group?.position;
    if (!position || !startPosition || !this.bodyVisualDirection) return 0;

    const delta = position.clone().sub(startPosition);
    const depth = THREE.MathUtils.clamp(
      delta.dot(this.bodyVisualDirection),
      -0.35,
      this.bodyVisualLength,
    );
    const lateral = THREE.MathUtils.clamp(
      delta.dot(this.bodyVisualRight),
      -this.bodyVisualHalfWidth,
      this.bodyVisualHalfWidth,
    );

    position.copy(startPosition)
      .addScaledVector(this.bodyVisualDirection, depth)
      .addScaledVector(this.bodyVisualRight, lateral);

    return depth;
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

    // The GLB can finish loading after the crash sequence starts. Apply the
    // requested post-crash scale as soon as the holder becomes available.
    if (this.car.userData.detailedVisual) {
      const targetScale = this.car.userData.aftermathVisualScale ?? 1;
      if (Math.abs(this.car.userData.detailedVisual.scale.x - targetScale) > 0.001) {
        this.car.userData.detailedVisual.scale.setScalar(targetScale);
      }
    }

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
