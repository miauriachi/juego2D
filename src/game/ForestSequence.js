import * as THREE from 'three';
import { ForestAftermath } from '../levels/ForestAftermath.js';
import { CollisionSystem } from './CollisionSystem.js';
import { CameraManager } from './CameraManager.js';
import { InteractionManager } from './InteractionManager.js';
import { Interactable } from './Interactable.js';
import { ForestFirstPerson } from './ForestFirstPerson.js';
import { WomanRescueSequence } from './WomanRescueSequence.js';
import { PassengerDriveSequence } from './PassengerDriveSequence.js';
import { POST_IMPACT as STATE } from './PostImpactState.js';

// Post-stop chapter: same road/storm outside the car, then a short first-person maze.
export class ForestSequence {
  constructor(game) {
    this.game = game;
    this.state = 'inCar';
    this.time = 0;
    this.ambientTime = 0;
    this.stepTime = 0;
    this.crouchAmount = 0;
    this.inspectionDialogueStarted = false;

    this.collision = new CollisionSystem();
    this.cameras = new CameraManager(null, game.cameraRig);
    this.level = new ForestAftermath(
      game.snowRoad,
      game.drivingSequence,
      this.cameras,
      this.collision,
    );

    this.history = [];
    this.setNarrativeState(STATE.IMPACT_OCCURRED);

    this.firstPerson = new ForestFirstPerson(
      game.player,
      game.renderer.domElement,
      game.settings,
    );

    this.interactions = new InteractionManager(game.player, game.input, this.level.scene);

    const register = (id, position, label, enabled, onInteract, radius = 1.8) => {
      const item = new Interactable({
        id,
        name: label,
        position: position.toArray(),
        radius,
        label,
        onInteract,
      });
      item.canInteract = enabled;
      this.interactions.register(item);
    };

    register(
      'blood',
      this.level.origin,
      'Examinar la sangre',
      () => !this.examined && this.state === 'exploring',
      () => this.startBloodInspection(),
      2.2,
    );

    register(
      'injured-person',
      this.level.bodyPosition,
      'Acercarse',
      () => this.examined && !this.encountered,
      () => {
        this.state = 'approaching';
        this.time = 0;
        this.approachStart = game.player.position.clone();
        this.setNarrativeState(STATE.FOUND_WOMAN);
        this.firstPerson.active = false;
        this.approachEnd = this.level.bodyPosition.clone().add(new THREE.Vector3(-0.85, 0, 0.1));
      },
      2.0,
    );

    game.container.classList.remove('driving-mode');
    this.updateCamera(this.level.exitPosition);
  }

  get objectiveText() {
    if (this.state === 'inspectBlood' || this.state === 'inspectDialogue') {
      return 'OBJETIVO: Examina el rastro de sangre.';
    }
    return this.examined
      ? 'OBJETIVO: Sigue el rastro hacia el bosque.'
      : 'OBJETIVO: Investiga qué ocurrió detrás del auto.';
  }

  setNarrativeState(state) {
    if (this.narrativeState === state) return;
    this.narrativeState = state;
    this.history.push(state);
  }

  startBloodInspection() {
    if (this.state !== 'exploring' || this.examined) return;
    this.state = 'inspectBlood';
    this.time = 0;
    this.crouchAmount = 0;
    this.inspectionDialogueStarted = false;
    this.firstPerson.active = false;

    const p = this.game.player;
    const direction = this.level.origin.clone().sub(p.position);
    if (direction.lengthSq() > 0.001) {
      p.rotationY = Math.atan2(-direction.x, -direction.z);
      p.group.rotation.y = p.rotationY;
    }
    p.velocity.set(0, 0, 0);
  }

  applyInspectionPose(amount) {
    const visual = this.game.bryanVisual?.group;
    if (!visual) return;

    const a = THREE.MathUtils.clamp(amount, 0, 1);
    // The rig continues using its real animation underneath. This transform
    // only supplies the short crouch/stand gesture for the blood inspection.
    visual.position.set(0, -0.22 * a, 0);
    visual.rotation.set(0.16 * a, 0, 0);
    visual.scale.set(1, 1 - 0.14 * a, 1);
  }

  beginRescue() {
    this.state = 'rescue';
    this.setNarrativeState(STATE.HELPING_WOMAN);
    this.firstPerson.dispose();
    this.stopAmbient?.();
    this.applyInspectionPose(0);

    this.rescue = new WomanRescueSequence(this.game, this.level, interior => {
      this.setNarrativeState(STATE.WOMAN_IN_CAR);
      this.game.passengerDrive = new PassengerDriveSequence(
        this.game,
        interior,
        state => this.setNarrativeState(state),
      );
      this.game.mode = 'passengerDriving';
    });
  }

  updateCamera(position) {
    this.cameras.update({ position });
    this.cameras.applyToCamera(this.game.cameraRig);
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const dialogue = g.dialogueManager;
    const input = g.input;

    if (this.state === 'rescue') {
      this.rescue.update(dt);
      input.clearFrameState();
      g.objective.textContent = 'OBJETIVO: Ayuda a la mujer a llegar al auto.';
      if (g.mode === 'passengerDriving') g.passengerDrive.update(0);
      else g.renderer.render(this.level.scene, this.rescue.camera);
      return;
    }

    this.time += dt;
    this.crouchAmount = 0;

    const wasOpen = dialogue.isOpen;
    if (wasOpen) dialogue.update();

    if (this.state === 'inCar') {
      dialogue.setHint('[E] Salir del auto');
      if (!wasOpen && input.isJustPressed('KeyE')) {
        this.state = 'exiting';
        this.time = 0;
        g.audio?.playCue('door_open');
        this.setNarrativeState(STATE.INVESTIGATE_ROAD);

        // Same SnowRoad scene: Bryan appears beside the actual stopped car.
        this.level.scene.add(p.group);
        p.position.copy(this.level.exitPosition);
        p.previousPosition.copy(p.position);
        p.velocity.set(0, 0, 0);
        p.rotationY = g.snowRoad.vehicle.heading;
        p.group.rotation.y = p.rotationY;
      }
    } else if (this.state === 'exiting') {
      const t = this.time;
      this.level.hinge.rotation.y =
        -Math.sin(Math.min(1, t / 1.8) * Math.PI) * 1.15;
      p.group.visible = t > 0.6;
      dialogue.setHint('');

      if (t >= 1.8) {
        this.state = 'exploring';
        this.time = 0;
        this.level.hinge.rotation.y = 0;
        g.audio?.playCue('door_close');
        input.keys.clear();
      }
    } else if (this.state === 'inspectBlood') {
      p.previousPosition.copy(p.position);
      p.velocity.set(0, 0, 0);
      dialogue.setHint('');

      const direction = this.level.origin.clone().sub(p.position);
      if (direction.lengthSq() > 0.001) {
        p.rotationY = Math.atan2(-direction.x, -direction.z);
        p.group.rotation.y = p.rotationY;
      }

      // 0-.75s crouch, .75-1.45 hold, 1.45-2.35 stand.
      if (this.time < 0.75) {
        this.crouchAmount = THREE.MathUtils.smoothstep(this.time / 0.75, 0, 1);
      } else if (this.time < 1.45) {
        this.crouchAmount = 1;
      } else {
        const rise = THREE.MathUtils.clamp((this.time - 1.45) / 0.90, 0, 1);
        this.crouchAmount = 1 - THREE.MathUtils.smoothstep(rise, 0, 1);
      }

      if (this.time >= 2.35 && !this.inspectionDialogueStarted) {
        this.inspectionDialogueStarted = true;
        this.state = 'inspectDialogue';
        this.time = 0;
        this.crouchAmount = 0;
        dialogue.start([
          { speaker: 'BRYAN', text: '¿Qué demonios...?' },
          { speaker: 'BRYAN', text: 'Hay un rastro. Se metió al bosque.' },
        ], () => {
          this.examined = true;
          this.state = 'exploring';
          this.time = 0;
          this.setNarrativeState(STATE.FOLLOW_BLOOD);
        });
      }
    } else if (this.state === 'approaching') {
      p.previousPosition.copy(p.position);
      p.position.lerpVectors(
        this.approachStart,
        this.approachEnd,
        Math.min(1, this.time / 1.2),
      );
      this.collision.resolve(p);

      const direction = this.level.bodyPosition.clone().sub(p.position);
      p.rotationY = Math.atan2(-direction.x, -direction.z);
      p.group.rotation.y = p.rotationY;
      dialogue.setHint('');

      if (this.time >= 1.2) {
        this.state = 'found';
        this.encountered = true;
        g.audio?.playCue('injured_breath');
        dialogue.start([
          { speaker: 'BRYAN', text: 'Hey... ¿puedes escucharme?' },
          { speaker: 'MUJER HERIDA', text: '...Ah... hhh...' },
          { speaker: 'BRYAN', text: 'Está bien. Voy a sacarte de aquí.' },
        ], () => this.beginRescue());
      }
    } else {
      if (!wasOpen && this.state === 'exploring') this.interactions.update();

      const blocked =
        wasOpen ||
        dialogue.isOpen ||
        this.state !== 'exploring';

      if (!blocked) {
        p.update(input, dt * (this.firstPerson.active ? 0.68 : 1));
        this.collision.resolve(p);

        // Bryan must inspect the rear-car blood before entering the maze.
        if (!this.examined && p.position.x > this.level.origin.x + 5.5) {
          p.position.copy(p.previousPosition);
          p.velocity.set(0, 0, 0);
        }
      } else {
        p.previousPosition.copy(p.position);
        p.velocity.set(0, 0, 0);
      }

      p.animate(dt, blocked);
      dialogue.setHint(blocked ? '' : this.interactions.currentHintText);

      this.stepTime += dt;
      if (
        !blocked &&
        p.position.distanceTo(p.previousPosition) > 0.001 &&
        this.stepTime > 0.42
      ) {
        this.stepTime = 0;
        g.audio?.playCue('snow_footsteps');
      }
    }

    const cameraPosition = this.state === 'inCar'
      ? this.level.exitPosition
      : p.position;

    this.updateCamera(cameraPosition);

    const insideForest =
      this.examined &&
      p.position.x > this.level.origin.x + (this.firstPerson.active ? 5.2 : 6.2);

    this.firstPerson.active =
      insideForest &&
      this.state === 'exploring';

    if (
      this.firstPerson.active &&
      !dialogue.isOpen &&
      !this.interactions.currentHintText
    ) {
      dialogue.setHint('W/S · Caminar   A/D · Girar   Arrastra el ratón · Mirar');
    }

    if (this.firstPerson.active) {
      this.setNarrativeState(STATE.FOREST_FIRST_PERSON);
    } else if (!insideForest && this.examined && this.state === 'exploring') {
      this.setNarrativeState(STATE.FOLLOW_BLOOD);
    }

    this.firstPerson.update(
      dt,
      p.position.distanceTo(p.previousPosition) > 0.001 && !dialogue.isOpen,
    );

    // Continue the SAME storm/forest while Bryan is on foot.
    this.level.update(dt, { position: cameraPosition });

    const quiet = cameraPosition.distanceTo(this.level.bodyPosition) < 5;
    if (quiet && !this.quiet) {
      this.stopAmbient?.();
      this.ambientTime = 0;
    }

    this.quiet = quiet;
    this.ambientTime -= dt;
    if (this.ambientTime <= 0) {
      this.ambientTime = 7;
      this.stopAmbient = g.audio?.playCue(
        quiet
          ? 'forest_ambient'
          : cameraPosition.x < this.level.origin.x + 6
            ? 'winter_wind'
            : 'forest_wind',
      );

      if (quiet) g.audio?.playCue('injured_breathing');
      else if (this.firstPerson.active) g.audio?.playCue('forest_breathing');
      if (!quiet && this.examined) g.audio?.playCue('distant_branches');
    }

    // IMPORTANT: pass dt here. The old forest path called update() with no dt,
    // which froze the rigged Bryan locomotion after he left the car.
    g.bryanVisual.update(dt);
    this.applyInspectionPose(this.crouchAmount);

    g.objective.textContent = this.objectiveText;
    input.clearFrameState();

    const visible = p.group.visible;
    if (this.firstPerson.active) p.group.visible = false;

    g.renderer.render(
      this.level.scene,
      this.firstPerson.active ? this.firstPerson.camera : g.cameraRig.camera,
    );

    p.group.visible = visible;
  }
}
