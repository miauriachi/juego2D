import * as THREE from 'three';
import { NPC } from './NPC.js';
import { Interactable } from './Interactable.js';
import { NPCCollisionSystem } from './NPCCollisionSystem.js';
import { NPCAvoidance } from './NPCAvoidance.js';
import { DEBUG_MODE } from '../config/constants.js';

// Owns ambient actors, shared visual resources and authored hospital routes.
// Reads existing walls only to validate routes; it never registers obstacles.
export class NPCManager {
  constructor(scene, collisionSystem, configs = null) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;
    this.npcs = [];
    this.actorCollisions = new NPCCollisionSystem();
    this.avoidance = new NPCAvoidance(collisionSystem, this.actorCollisions);
    this.radius = 0.45;
    this.markerGeometry = DEBUG_MODE ? new THREE.SphereGeometry(1, 8, 6) : null;
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'npc-debug';
    this.debugGroup.visible = DEBUG_MODE;
    this.scene.add(this.debugGroup);
    this.debugLabels = [];
    if (DEBUG_MODE) {
      this.debugMaterial = new THREE.MeshBasicMaterial({ color: 0xe2cf77 });
      this.routeMaterial = new THREE.LineBasicMaterial({ color: 0xe2cf77 });
    }

    if (configs) {
      configs.forEach(config => this.addNPC(config));
      return;
    }
    this.addNPC({
      name: 'Enfermera', type: 'Nurse', walkSpeed: 1.65,
      waypoints: [{ x: -5.3, z: -0.6 }, { x: -1.5, z: -0.6 }, { x: 1.8, z: -4.5 }],
    });
    this.addNPC({
      name: 'Doctor', type: 'Doctor', walkSpeed: 1.55, phase: 1.3,
      waypoints: [{ x: 4.5, z: -3.7 }, { x: 8.8, z: -3.7 }, { x: 10.85, z: -4.9 }],
    });
    this.addNPC({
      name: 'Enfermero', type: 'Orderly', walkSpeed: 0, facing: Math.PI, phase: 2.6,
      // A single waypoint intentionally means a stationary idle actor.
      waypoints: [{ x: -3.8, z: 3.7 }],
    });
    this.addNPC({
      name: 'Doctor de fondo', type: 'Doctor', walkSpeed: 1.45, initialWait: 5, phase: 4,
      // South of the stretcher/wheelchair, leaving their visual footprints clear.
      waypoints: [{ x: -7.8, z: -5.2 }, { x: -3.8, z: -5.2 }, { x: 2, z: -5.2 }, { x: 5.5, z: -5.2 }],
    });
    this.addNPC({
      name: 'Recepcionista', type: 'Receptionist', walkSpeed: 0,
      waypoints: [{ x: -5.9, z: 2.075 }],
    });
    for (const [i, x] of [-9.5, -8.3].entries()) {
      this.addNPC({ name: `Paciente en espera ${i + 1}`, type: 'PatientSitting',
        walkSpeed: 0, phase: i * 2, waypoints: [{ x, z: 7 }] });
    }
  }

  setupInteractions(interactionManager, dialogueManager, player, onReceptionComplete = () => {}, onReceptionInteract = () => false) {
    const conversations = {
      Recepcionista: [
        { speaker: 'BRYAN', text: 'Disculpe. Tengo una entrega médica urgente.' },
        { speaker: 'RECEPCIONISTA', text: '¿Para qué departamento?' },
        { speaker: 'BRYAN', text: 'No lo sé. Solo me dijeron que debía entregarla inmediatamente.' },
        { speaker: 'RECEPCIONISTA', text: 'Pregunte en Urgencias. Quizá puedan ayudarlo.' },
      ],
      Doctor: [{ speaker: 'DOCTOR', text: 'Ahora no puedo ayudarte. Pregunta en recepción.' }],
      Enfermera: [{ speaker: 'ENFERMERA', text: 'Urgencias está al fondo del pasillo.' }],
    };
    this.npcs.forEach(npc => {
      if (!conversations[npc.name]) return;
      const reception = npc.type === 'Receptionist';
      if (reception) npc.lookTarget = player.position;
      const interactable = new Interactable({
        id: npc.name, name: npc.name, position: npc.group.position.toArray(),
        radius: 1.5, label: 'Hablar',
        onInteract: () => {
          if (reception && onReceptionInteract(npc)) return;
          if (dialogueManager.start(conversations[npc.name], () => {
            npc.paused = false;
            if (reception) onReceptionComplete();
          })) npc.paused = true;
        },
      });
      if (reception) {
        // Interaction anchor at the public edge: the solid countertop separates the bodies.
        interactable.position.set(-5.9, 0, 0.45);
        interactable.canInteract = () => true;
      } else {
        interactable.position = npc.group.position;
      }
      interactionManager.register(interactable);
    });
  }

  addNPC(config) {
    this.validateRoute(config);
    const npc = new NPC(config);
    npc.group.position.y = config.elevation || 0;
    this.npcs.push(npc);
    this.scene.add(npc.group);
    if (DEBUG_MODE) this.createDebugVisuals(npc);
    return npc;
  }

  validateRoute({ name, waypoints, walkSpeed = 1.55, supportCollider = null }) {
    if (!Array.isArray(waypoints) || !waypoints.length || !Number.isFinite(walkSpeed) || walkSpeed < 0 || (waypoints.length > 1 && walkSpeed === 0)) {
      throw new Error(`Invalid NPC route or speed: ${name}`);
    }
    const bounds = this.collisionSystem.bounds;
    for (let i = 0; i < waypoints.length; i++) {
      const point = waypoints[i];
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z) ||
        point.x < bounds.minX || point.x > bounds.maxX || point.z < bounds.minZ || point.z > bounds.maxZ) {
        throw new Error(`NPC waypoint outside hospital: ${name}`);
      }
      const previous = waypoints[Math.max(0, i - 1)];
      // Segment vs expanded AABB: check the entire path, not just its endpoints.
      for (const wall of this.collisionSystem.colliders) {
        // A seated/lying actor may occupy its own supporting furniture only.
        if (wall === supportCollider && walkSpeed === 0 && waypoints.length === 1) continue;
        let enter = 0, exit = 1;
        for (const [axis, min, max] of [
          ['x', wall.minX - this.radius, wall.maxX + this.radius],
          ['z', wall.minZ - this.radius, wall.maxZ + this.radius],
        ]) {
          const delta = point[axis] - previous[axis];
          if (Math.abs(delta) < 1e-8) {
            if (previous[axis] < min || previous[axis] > max) { exit = -1; break; }
          } else {
            const a = (min - previous[axis]) / delta, b = (max - previous[axis]) / delta;
            enter = Math.max(enter, Math.min(a, b));
            exit = Math.min(exit, Math.max(a, b));
          }
        }
        if (enter <= exit) throw new Error(`NPC route crosses a wall or reception: ${name}`);
      }
    }
  }

  createDebugVisuals(npc) {
    const points = npc.waypoints.map(p => new THREE.Vector3(p.x, 0.06, p.z));
    this.debugGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.routeMaterial));
    points.forEach(point => {
      const marker = new THREE.Mesh(this.markerGeometry, this.debugMaterial);
      marker.position.copy(point);
      marker.scale.setScalar(0.09);
      this.debugGroup.add(marker);
    });
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#15251e'; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#e2cf77'; ctx.font = '32px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(npc.name, 256, 48);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    label.scale.set(1.8, 0.34, 1);
    label.position.copy(npc.group.position).setY(2.12);
    this.debugGroup.add(label);
    this.debugLabels.push({ npc, label });
    if (npc.walkSpeed > 0) {
      npc.avoidanceArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), npc.group.position.clone(), 0.7, 0x8ae0db);
      this.debugGroup.add(npc.avoidanceArrow);
    }
  }

  update(deltaTime, player = null) {
    this.npcs.forEach(npc => {
      npc.update(deltaTime, (actor, target, step, dt) => this.avoidance.move(actor, target, step, dt, this.npcs, player));
      if (npc.avoidanceArrow && npc.avoidanceDirection) {
        npc.avoidanceArrow.position.copy(npc.group.position).setY(0.15);
        npc.avoidanceArrow.visible = npc.avoidanceDirection.lengthSq() > 0;
        if (npc.avoidanceArrow.visible) npc.avoidanceArrow.setDirection(npc.avoidanceDirection);
      }
    });
    this.debugLabels.forEach(({ npc, label }) => label.position.copy(npc.group.position).setY(2.12));
  }

  resolvePlayer(player) { this.actorCollisions.resolvePlayer(player, this.npcs, this.collisionSystem); }
}
