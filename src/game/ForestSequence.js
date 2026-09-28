import * as THREE from 'three';
import { ForestAftermath } from '../levels/ForestAftermath.js';
import { CollisionSystem } from './CollisionSystem.js';
import { CameraManager } from './CameraManager.js';
import { InteractionManager } from './InteractionManager.js';
import { Interactable } from './Interactable.js';
import { WomanRescueSequence } from './WomanRescueSequence.js';
import { PassengerDriveSequence } from './PassengerDriveSequence.js';
import { POST_IMPACT as STATE } from './PostImpactState.js';

// Post-stop chapter: same road/storm outside the car, then classic fixed-camera forest rooms.
export class ForestSequence {
  constructor(game) {
    this.game = game;
    this.state = 'inCar';
    this.time = 0;
    this.ambientTime = 0;
    this.stepTime = 0;
    this.crouchAmount = 0;
    this.inspectionDialogueStarted = false;
    this.exitNeedsRelease = true;
    this.objectiveTimer = 3.4;

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
    this.objectiveTimer = 3.4;
  }

  startBloodInspection() {
    if (this.state !== 'exploring' || this.examined) return;
    this.state = 'inspectBlood';
    this.time = 0;
    this.crouchAmount = 0;
    this.inspectionDialogueStarted = false;

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
    // Clear, readable RE-style inspect gesture: Bryan lowers his body toward
    // the stain, leans forward, holds briefly, then returns to full height.
    visual.position.set(0, -0.34 * a, -0.08 * a);
    visual.rotation.set(0.30 * a, 0, 0);
    visual.scale.set(1, 1 - 0.08 * a, 1);
  }

  beginRescue() {
    this.level.backdrop?.disable();
    this.level.woman.visible = true;
    this.state = 'rescue';
    this.setNarrativeState(STATE.HELPING_WOMAN);
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
    this.level.backdrop?.update(this.cameras.activeZone?.id);
  }

  ensureBryanVisibleOutsideCar() {
    const g = this.game;
    const p = g.player;

    if (p.group.parent !== this.level.scene) this.level.scene.add(p.group);
    p.group.visible = true;
    p.group.scale.set(1, 1, 1);

    const visual = g.bryanVisual?.group;
    if (visual) {
      visual.visible = true;
      visual.position.set(0, 0, 0);
      visual.rotation.set(0, 0, 0);
      visual.scale.set(1, 1, 1);
    }

    if (g.bryanVisual?.skinnedMesh) g.bryanVisual.skinnedMesh.visible = true;

    if (g.bryanVisual?.loaded) {
      p.model.visible = false;
    } else {
      p.model.visible = true;
    }
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
      g.objective.hidden = false;
      if (g.mode === 'passengerDriving') g.passengerDrive.update(0);
      else g.renderer.render(this.level.scene, this.rescue.camera);
      return;
    }

    this.time += dt;
    this.objectiveTimer = Math.max(0, this.objectiveTimer - dt);
    this.crouchAmount = 0;

    const wasOpen = dialogue.isOpen;
    if (wasOpen) dialogue.update();

    if (this.state === 'inCar') {
      // The last dialogue line also uses E. Require one clean key release
      // before arming the exit so that the dialogue cannot swallow/stick the
      // same E press and leave Bryan trapped in the car.
      if (wasOpen || dialogue.isOpen) {
        this.exitNeedsRelease = true;
        dialogue.setHint('');
      } else {
        if (this.exitNeedsRelease && !input.isPressed('KeyE')) {
          this.exitNeedsRelease = false;
          input.justPressed?.delete('KeyE');
        }

        dialogue.setHint(this.exitNeedsRelease ? '' : '[E] Salir del auto');

        if (!this.exitNeedsRelease && input.isJustPressed('KeyE')) {
          this.state = 'exiting';
          this.time = 0;
          g.audio?.playCue('door_open');
          this.setNarrativeState(STATE.INVESTIGATE_ROAD);

          // Same SnowRoad scene: Bryan appears beside the actual stopped car.
          this.ensureBryanVisibleOutsideCar();
          p.position.copy(this.level.exitPosition);
          p.previousPosition.copy(p.position);
          p.velocity.set(0, 0, 0);
          p.rotationY = g.snowRoad.vehicle.heading;
          p.group.rotation.y = p.rotationY;
          p.animate(0, true);
          g.bryanVisual?.update(0);

          input.keys.delete('KeyE');
          input.justPressed?.delete('KeyE');
        }
      }
    } else if (this.state === 'exiting') {
      const t = this.time;
      this.ensureBryanVisibleOutsideCar();

      this.level.hinge.rotation.y =
        -Math.sin(Math.min(1, t / 1.35) * Math.PI) * 1.15;
      dialogue.setHint('');

      // Hold Bryan at the known-safe exit point during the short door animation.
      p.position.copy(this.level.exitPosition);
      p.previousPosition.copy(p.position);
      p.velocity.set(0, 0, 0);

      if (t >= 1.35) {
        this.state = 'exploring';
        this.time = 0;
        this.level.hinge.rotation.y = 0;
        this.ensureBryanVisibleOutsideCar();
        p.previousPosition.copy(p.position);
        p.velocity.set(0, 0, 0);
        g.audio?.playCue('door_close');
        input.keys.clear();
        input.clearFrameState();
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
      this.level.resolveCarCollision(p);

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
      if (this.state === 'exploring') {
        this.ensureBryanVisibleOutsideCar();
      }

      if (!wasOpen && this.state === 'exploring') this.interactions.update();

      const blocked =
        wasOpen ||
        dialogue.isOpen ||
        this.state !== 'exploring';

      if (!blocked) {
        p.update(input, dt);
        this.collision.resolve(p);
        this.level.resolveCarCollision(p);

        // Bryan must inspect the rear-car blood before entering the maze.
        // Gate against the authored trail entry instead of raw world X, because
        // the crashed car can finish at many different headings.
        const forestGate = this.level.layout.points[2];
        if (
          !this.examined &&
          forestGate &&
          p.position.distanceTo(forestGate) < 3.6
        ) {
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

    // Forest exploration stays on authored fixed cameras, just like the hospital.
    // CameraManager changes shot automatically as Bryan crosses each outdoor room.

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
      else if (this.examined) g.audio?.playCue('forest_breathing');
      if (!quiet && this.examined) g.audio?.playCue('distant_branches');
    }

    // IMPORTANT: pass dt here. The old forest path called update() with no dt,
    // which froze the rigged Bryan locomotion after he left the car.
    g.bryanVisual.update(dt);
    this.applyInspectionPose(this.crouchAmount);

    g.objective.textContent = this.objectiveText;
    // Classic RE framing: objectives appear briefly when the story state changes,
    // then get out of the composition instead of living permanently on screen.
    g.objective.hidden =
      this.objectiveTimer <= 0 ||
      dialogue.isOpen;
    input.clearFrameState();

    this.ensureBryanVisibleOutsideCar();
    g.renderer.render(this.level.scene, g.cameraRig.camera);
  }
}
