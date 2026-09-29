import * as THREE from 'three';
// GitHub migration validation checkpoint.
import { Player } from './Player.js';
import { FixedCamera } from './FixedCamera.js';
import { CollisionSystem } from './CollisionSystem.js';
import { InputManager } from './InputManager.js';
import { CameraManager } from './CameraManager.js';
import { NPCManager } from './NPCManager.js';
import { InteractionManager } from './InteractionManager.js';
import { DialogueManager } from './DialogueManager.js';
import { HospitalIntro } from '../levels/HospitalIntro.js';
import { HospitalUrgencias } from '../levels/HospitalUrgencias.js';
import { Interactable } from './Interactable.js';
import { UrgenciasSequence } from './UrgenciasSequence.js';
import { ReceptionDeliverySequence } from './ReceptionDeliverySequence.js';
import { HospitalExterior } from '../levels/HospitalExterior.js';
import { SnowRoad } from '../levels/SnowRoad.js';
import { RaccoonDeliverySequence } from './RaccoonDeliverySequence.js';
import { LastDeliveryEnding } from './LastDeliveryEnding.js';
import { DrivingSequence } from './DrivingSequence.js';
import { BryanModel } from '../characters/BryanModel.js';
import { HospitalOpeningSequence } from './HospitalOpeningSequence.js';
import { ParkingDepartureSequence } from './ParkingDepartureSequence.js';
import { ForestSequence } from './ForestSequence.js';
import { DEBUG_MODE } from '../config/constants.js';
import { PrerenderBackdropManager } from './PrerenderBackdropManager.js';
import { ENTRANCE_CAMERA, ENTRANCE_GATE, ENTRANCE_NAVIGATION, ENTRANCE_ASPECT } from './EntranceConfig.js';
import { WalkMesh } from './WalkMesh.js';
import { receptionWideConfig } from './ReceptionWideConfig.js';
import { corridorConfig } from './CorridorConfig.js';
import { urgenciasConfig } from './UrgenciasConfig.js';
import { exteriorConfig } from './ExteriorConfig.js';
import { SceneNpcAnchors } from './SceneNpcAnchors.js';
import { PrerenderRoom } from './PrerenderRoom.js';
import { PrerenderRoomView } from './PrerenderRoomView.js';
import { GameStats } from './GameStats.js';

// Normal story rules stay enabled. This test checkpoint only changes where a
// new game starts while we calibrate the post-crash forest.
const TEMP_CRASH_CHECKPOINT = true;

export class Game {
  constructor(container, { input = null, settings = { sound: true, cameraMotion: true }, audio = null } = {}) {
    this.container = container;
    this.settings = settings; this.audio = audio;
    this.stats = new GameStats();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1116);
    this.scene.fog = new THREE.Fog(0x0c1116, 18, 38);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.cameraRig = new FixedCamera(
      new THREE.Vector3(8, 7, 10),
      new THREE.Vector3(-4, 1, 0)
    );

    this.input = input || new InputManager();
    this.collisionSystem = new CollisionSystem();
    this.cameraManager = new CameraManager(this.scene, this.cameraRig);
    this.prerenderBackdrop = new PrerenderBackdropManager(this.scene, this.cameraRig.camera);
    this.entranceNavigation = new WalkMesh(ENTRANCE_NAVIGATION);
    this.entranceBackdropReady = Promise.all([
      this.prerenderBackdrop.preload('cam-entrance'), this.prerenderBackdrop.preload('cam05'),
      this.prerenderBackdrop.preload('cam02'),
    ]).then(results => results.every(Boolean));

    this.player = new Player(new THREE.Vector3(0, 0, 5.3));
    this.player.group.name = 'player';
    this.player.rotationY = 0;
    this.player.group.rotation.y = this.player.rotationY;
    this.scene.add(this.player.group);
    this.bryanVisual = new BryanModel(this.player, this.container);
    this.visualReady = this.bryanVisual.ready;

    this.clock = new THREE.Clock();
    this.level = new HospitalIntro(this.scene, this.player, this.cameraManager, this.collisionSystem);

    this.setupLights();
    this.level.build();
    this.npcManager = new NPCManager(this.scene, this.collisionSystem);
    this.dialogueManager = new DialogueManager(this.container, this.input);
    this.interactionManager = new InteractionManager(this.player, this.input, this.scene);
    this.npcManager.setupInteractions(this.interactionManager, this.dialogueManager, this.player, () => {
      this.urgenciasUnlocked = true;
      this.refreshObjective();
    }, npc => this.receptionDelivery?.interactReception(npc) ?? false);
    this.setupCameraZones();
    this.receptionWide = new PrerenderRoom(receptionWideConfig);
    this.receptionWideView = new PrerenderRoomView(this.scene, receptionWideConfig);
    this.corridor = new PrerenderRoom(corridorConfig);
    this.corridorView = new PrerenderRoomView(this.scene, corridorConfig);
    this.prerenderRooms = new Map([[receptionWideConfig.id, this.receptionWide], [corridorConfig.id, this.corridor]]);
    this.prerenderViews = new Map([[receptionWideConfig.id, this.receptionWideView], [corridorConfig.id, this.corridorView]]);
    this.sceneNpcAnchors = new SceneNpcAnchors(this.scene, this.npcManager, [receptionWideConfig, corridorConfig]);
    this.setupUrgencias();
    this.receptionDelivery = new ReceptionDeliverySequence(this.player,
      this.reception.interactions, this.dialogueManager, () => this.refreshObjective());
    this.raccoonDelivery = new RaccoonDeliverySequence(this.player, this.receptionDelivery,
      this.npcManager, this.dialogueManager, () => this.refreshObjective());
    this.reception.interactions.register(new Interactable({
      id: 'hospital-exit', name: 'Salida', position: [0, 0, 7.2], radius: 1.7,
      label: 'Salir del hospital', onInteract: () => {
        if (this.raccoonDelivery.resolved) this.changeArea('exterior');
        else if (this.receptionDelivery.signatureForged) this.dialogueManager.start([
          { speaker: 'BRYAN', text: 'La enfermera quiere hablar conmigo antes de que me vaya.' },
        ]);
        else this.dialogueManager.start([{ speaker: 'BRYAN', text: this.urgenciasSequence.completed
          ? 'Necesito resolver lo de la firma antes de irme.' : 'Todavía tengo una entrega pendiente.' }]);
      },
    }));
    this.cameraManager.setDebugVisibility(DEBUG_MODE);

    if (DEBUG_MODE) {
      const grid = new THREE.GridHelper(24, 24, 0x62d0ff, 0x35536d);
      grid.position.y = 0.01;
      this.scene.add(grid);

      const axes = new THREE.AxesHelper(6);
      this.scene.add(axes);
    }

    this.playerInputEnabled = false; this.mode = 'opening'; this.objective.hidden = true;
    this.openingSequence = new HospitalOpeningSequence(this.scene, this.player, this.level, this.audio, () => {
      this.prepareEntranceFrame();
      this.mode = 'onFoot'; this.playerInputEnabled = true; this.objective.hidden = false;
      this.input.keys.clear(); this.input.clearFrameState(); this.refreshObjective();
    }, this.container, Promise.all([this.visualReady, this.entranceBackdropReady]).then(results => results.every(Boolean)));
    this.ready = Promise.all([
      this.visualReady,
      this.entranceBackdropReady,
      this.openingSequence.ready,
    ]).then(() => {
      if (TEMP_CRASH_CHECKPOINT) this.startCrashCheckpoint();
      return true;
    });
    window.addEventListener('resize', () => this.onResize());
  }

  setupLights(scene = this.scene, urgencias = false) {
    const hemi = new THREE.HemisphereLight(0xd3d8c5, 0x17211b, urgencias ? 0.34 : 0.40);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xc3c7b6, urgencias ? 0.070 : 0.095));

    // The existing lighting setup is the only source of illumination.
    // Two shadow maps for reception/waiting; the corridor uses softer unshadowed fill.
    const fixtures = urgencias ? [
      ...[2, -7, -17, -27].map((z, i) => ({ x: 0, z, intensity: i === 3 ? 28 : 23,
        distance: 11, shadow: i === 0 || i === 3 })),
      ...[1, -9, -19].flatMap(z => [-6.7, 6.7].map(x => ({
        x, z, intensity: z === -9 ? 17 : 21, distance: 8.5, shadow: false,
      }))),
      { x: 3.8, z: -29, intensity: 13, distance: 7, shadow: false },
    ] : [
      { x: -6, z: 0, intensity: 42, distance: 10, shadow: true },
      { x: -9, z: 5.2, intensity: 23, distance: 8, shadow: true },
      { x: 2.5, z: -5.5, intensity: 16, distance: 9, shadow: false },
      { x: 8.5, z: -5.5, intensity: 12, distance: 8, shadow: false },
      { x: 0, z: 6.4, intensity: 30, distance: 8, shadow: false },
      { x: -5.8, z: -2.5, y: 1.9, intensity: 5, distance: 6, shadow: false },
    ];
    fixtures.forEach(({ x, z, y = 2.95, intensity, distance, shadow }) => {
      const light = shadow
        ? new THREE.SpotLight(0xd5dfca, intensity, distance, Math.PI / 3, 0.55, 2)
        : new THREE.PointLight(0xbdcfce, intensity, distance, 2);
      light.position.set(x, y, z);
      light.castShadow = shadow;
      if (shadow) {
        light.target.position.set(x, 0, z);
        scene.add(light.target);
        // Slightly higher-resolution shadows plus gentler bias prevent the
        // dotted/striped self-shadowing that was visible on the long hospital walls.
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.camera.near = 0.15;
        light.shadow.camera.far = distance;
        light.shadow.bias = -0.00015;
        light.shadow.normalBias = 0.05;
      }
      if (urgencias) light.color.setHex(0xb4cbcf);
      scene.add(light);
    });
  }

  setupCameraZones() {
    this.cameraManager.zones = [];

    this.cameraManager.addZone({
      id: 'cam01',
      name: 'CAM 01',
      cameraPosition: [-0.6, 3.35, 6.85],
      lookAt: [-7.0, 1.05, 4.15],
      minX: -12,
      maxX: 0,
      minZ: 0,
      maxZ: 8,
      color: 0x8ecae6,
      priority: 1,
    });

    this.cameraManager.addZone({
      id: 'cam02',
      name: 'CAM 02',
      ...corridorConfig.camera,
      minX: -10,
      maxX: 5,
      minZ: -8,
      maxZ: 1,
      color: 0xf4a261,
      priority: 2,
    });

    this.cameraManager.addZone({
      id: 'cam03',
      name: 'CAM 03',
      cameraPosition: [10.1, 3.25, -2.4],
      lookAt: [7.0, 1.0, -6.3],
      minX: 3,
      maxX: 12,
      minZ: -8,
      maxZ: 0,
      color: 0x90be6d,
      priority: 3,
    });

    // Close reception coverage overrides CAM 02 only along the public counter edge.
    this.cameraManager.addZone({
      id: 'cam04', name: 'CAM 04 - RECEPCIÓN CERCANA',
      cameraPosition: [-4.45, 2.35, -2.65], lookAt: [-5.95, 1.08, 1.05],
      minX: -9.7, maxX: -2.2, minZ: -2.1, maxZ: 0.15,
      color: 0xc4a5df, priority: 4,
    });

    this.cameraManager.setActiveZone(this.cameraManager.zones[0]);
    this.cameraManager.addZone({
      id: 'cam06', name: 'CAM 06 - ACCESO A URGENCIAS',
      cameraPosition: [6.2, 3.05, -3.9], lookAt: [3.3, 1.05, -7.1],
      minX: 1.7, maxX: 5.6, minZ: -8, maxZ: -5.7,
      color: 0xafd2c2, priority: 5,
    });
    this.cameraManager.addZone({
      id: 'cam05', name: 'CAM 05 - LOBBY INTERIOR',
      ...receptionWideConfig.camera,
      minX: -2.25, maxX: 3.5, minZ: 0.9, maxZ: 3.85,
      priority: 8, color: 0xb8d9d5,
    });
    this.cameraManager.addZone({
      id: 'cam-entrance', name: 'CAM_ENTRANCE',
      // IMPORTANT: this plate is viewed from INSIDE the lobby toward the doors.
      // Put the 3D camera on the same side of Bryan as the player-visible room.
      // With the doors behind him (+Z), W (-Z) now brings Bryan toward the camera/
      // deeper into the hospital instead of making him shrink into the doorway.
      ...ENTRANCE_CAMERA,
      minX: -1.8, maxX: 3.5, minZ: 3.6, maxZ: 8.3,
      priority: 9, color: 0xc8d6dc,
    });
    this.cameraManager.setPortal({ ...ENTRANCE_GATE, entranceId: 'cam-entrance', interiorId: 'cam05' });
    this.cameraManager.update(this.player);
    this.cameraManager.applyToCamera(this.cameraRig);
  }

  onResize() {
    this.cameraRig.onResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.snowRoad?.onResize();
    this.lastDeliveryEnding?.onResize();
    this.openingSequence?.onResize();
    this.prerenderBackdrop?.onResize();
    this.exteriorBackdrop?.onResize();
    this.updateEntranceViewport();
    this.updateReceptionViewport();
    this.updateExteriorViewport();
  }

  get activePrerenderRoom() {
    return [...this.prerenderRooms.values()].find(room => room.active && (room.config.area || 'reception') === this.area) || null;
  }

  updateReceptionViewport() {
    const config = this.activePrerenderRoom?.config;
    if (!config) return;
    const width = window.innerWidth, height = window.innerHeight;
    const viewWidth = Math.min(width, height * config.aspect);
    const viewHeight = viewWidth / config.aspect;
    this.renderer.setViewport((width - viewWidth) / 2, (height - viewHeight) / 2, viewWidth, viewHeight);
    this.cameraRig.camera.aspect = config.aspect;
    this.cameraRig.camera.updateProjectionMatrix();
  }

  updateExteriorViewport() {
    if (this.area !== 'exterior') return;
    const width = window.innerWidth, height = window.innerHeight;
    const viewWidth = Math.min(width, height * exteriorConfig.aspect);
    const viewHeight = viewWidth / exteriorConfig.aspect;
    this.renderer.setViewport((width - viewWidth) / 2, (height - viewHeight) / 2, viewWidth, viewHeight);
    this.cameraRig.camera.aspect = exteriorConfig.aspect;
    this.cameraRig.camera.updateProjectionMatrix();
  }

  enterPrerenderRoom(id, fromZone, anchorName) {
    this.prerenderRooms.forEach(room => { room.active = false; });
    const room = this.prerenderRooms.get(id);
    room.enter(this.player, fromZone, anchorName);
    this.cameraManager.setActiveZone(this.cameraManager.zones.find(zone => zone.id === id));
    this.interactionManager.currentHintText = '';
  }

  updateReceptionCamera() {
    const room = this.activePrerenderRoom;
    if (room) {
      const portal = room.crossedPortal(this.player);
      if (portal) {
        if (!this.prerenderBackdrop.isReady(portal.targetZone)) {
          this.player.position.copy(this.player.previousPosition);
          this.player.velocity.set(0, 0, 0);
          return;
        }
        room.leave(this.player, portal);
        if (this.prerenderRooms.has(portal.targetZone)) {
          this.enterPrerenderRoom(portal.targetZone, room.config.id, portal.targetAnchor);
        } else {
          this.cameraManager.setActiveZone(this.cameraManager.zones.find(zone => zone.id === portal.targetZone));
        }
        this.interactionManager.currentHintText = '';
      }
      return;
    }
    this.prerenderRooms.forEach(value => { value.active = false; });
    const fromZone = this.cameraManager.activeZone?.id;
    this.cameraManager.update(this.player);
    const id = this.cameraManager.activeZone?.id;
    if (this.area === 'reception' && this.prerenderRooms.has(id)) this.enterPrerenderRoom(id, fromZone);
  }

  updateRoomInteractions(room) {
    if (room.config.id === 'urgencias_prerender') {
      const exit = this.interactionManager.interactables.find(item => item.id === 'return-reception');
      const p = this.player.position;
      const atLeftExitDoor =
        p.x >= -5.95 && p.x <= -3.20 &&
        p.z >= -1.55 && p.z <= 2.55;
      if (exit && atLeftExitDoor && (!exit.canInteract || exit.canInteract())) {
        this.interactionManager.currentHintText = exit.getHintText();
        if (this.input.isJustPressed('KeyE')) exit.interact();
        return;
      }
    }
    if (room.config.id === 'cam05') {
      const receptionist = this.interactionManager.interactables.find(item => item.id === 'Recepcionista');
      const player = this.player.position;
      const nearCounter = player.x >= -0.75 && player.x <= 1.1 && player.z >= -1.95 && player.z <= 0.85;
      if (receptionist && nearCounter && (!receptionist.canInteract || receptionist.canInteract())) {
        this.interactionManager.currentHintText = receptionist.getHintText();
        if (this.input.isJustPressed('KeyE')) receptionist.interact();
        return;
      }
    }
    const candidates = (room.config.interactionAnchors || []).map(anchor => ({ anchor,
      source: this.interactionManager.interactables.find(item => item.id === anchor.sourceId),
      distance: Math.hypot(this.player.position.x - anchor.position[0], this.player.position.z - anchor.position[2]),
    })).filter(({ anchor, source, distance }) => {
      if (!source || distance > anchor.radius || (source.canInteract && !source.canInteract())) return false;
      const portal = room.portals.find(p => p.sourceId === anchor.sourceId);
      if (!portal?.bounds) return true;
      const b = portal.bounds, p = this.player.position;
      return p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
    });
    candidates.sort((a, b) => a.distance - b.distance);
    const current = candidates[0]?.source;
    this.interactionManager.currentHintText = current?.getHintText() || '';
    if (current && this.input.isJustPressed('KeyE')) current.interact();
  }

  updateEntranceViewport() {
    const width = window.innerWidth, height = window.innerHeight;
    const entrance = this.area === 'reception' && this.cameraManager.activeZone?.id === 'cam-entrance';
    const viewWidth = entrance ? Math.min(width, height * ENTRANCE_ASPECT) : width;
    const viewHeight = entrance ? viewWidth / ENTRANCE_ASPECT : height;
    this.renderer.setViewport((width - viewWidth) / 2, (height - viewHeight) / 2, viewWidth, viewHeight);
    this.cameraRig.camera.aspect = viewWidth / viewHeight;
    this.cameraRig.camera.updateProjectionMatrix();
  }

  prepareEntranceFrame() {
    if (!this.prerenderBackdrop.isReady('cam-entrance')) throw new Error('El fondo de entrada no está listo.');
    this.cameraManager.setActiveZone(this.cameraManager.zones.find(zone => zone.id === 'cam-entrance'));
    this.cameraManager.applyToCamera(this.cameraRig);
    this.updateEntranceViewport();
    this.prerenderBackdrop.update('cam-entrance', 'reception');
    this.bryanVisual.update();
    // Upload the texture and render the complete composition while DOM is black.
    this.renderer.initTexture(this.prerenderBackdrop.plane.material.map);
    this.renderer.render(this.scene, this.cameraRig.camera);
  }

  setupUrgencias() {
    this.area = 'reception';
    this.mode = 'onFoot';
    this.urgenciasUnlocked = false;
    this.objective = document.createElement('div');
    this.objective.className = 'objective';
    this.objective.textContent = 'OBJETIVO: Entrega el paquete médico.';
    this.container.appendChild(this.objective);
    this.reception = {
      scene: this.scene, collision: this.collisionSystem,
      cameras: this.cameraManager, interactions: this.interactionManager,
    };
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b121c);
    scene.fog = new THREE.Fog(0x0b121c, 12, 26);
    const collision = new CollisionSystem();
    const cameras = new CameraManager(scene, this.cameraRig);
    const interactions = new InteractionManager(this.player, this.input, scene);
    this.urgenciasLevel = new HospitalUrgencias(scene, this.player, cameras, collision);
    this.urgenciasLevel.build();
    this.setupLights(scene, true);
    this.urgencias = { scene, collision, cameras, interactions };
    const room = new PrerenderRoom(urgenciasConfig);
    this.prerenderRooms.set(urgenciasConfig.id, room);
    this.prerenderViews.set(urgenciasConfig.id, new PrerenderRoomView(scene, urgenciasConfig));
    this.urgenciasBackdrop = new PrerenderBackdropManager(scene, this.cameraRig.camera, {
      area: 'urgencias', configs: { [urgenciasConfig.id]: urgenciasConfig.background },
    });
    this.urgenciasBackdropReady = this.urgenciasBackdrop.preload(urgenciasConfig.id);
    cameras.addZone({ id: urgenciasConfig.id, name: 'URGENCIAS PRERENDER',
      ...urgenciasConfig.camera, minX: -100, maxX: 100, minZ: -100, maxZ: 100, priority: 100 });
    const anchors = new SceneNpcAnchors(scene, this.urgenciasLevel.npcManager, [urgenciasConfig]);
    this.sceneNpcAnchors.visuals.push(...anchors.visuals);
    this.urgenciasSequence = new UrgenciasSequence(this.urgenciasLevel, this.player,
      interactions, this.dialogueManager, () => {
        this.receptionDelivery.medicalDelivered();
        this.refreshObjective();
      });
    this.interactionManager.register(new Interactable({
      id: 'enter-urgencias', name: 'Urgencias', position: [3.3, 0, -7.2], radius: 1.65,
      label: 'Entrar a Urgencias', onInteract: () => {
        if (this.urgenciasUnlocked) this.changeArea('urgencias');
        else this.dialogueManager.start([{ speaker: 'BRYAN', text: 'Primero debo preguntar en recepción por la entrega.' }]);
      },
    }));
    interactions.register(new Interactable({
      id: 'return-reception', name: 'Recepción', position: [0, 0, 4.9], radius: 1.6,
      label: 'Volver a recepción', onInteract: () => this.changeArea('reception'),
    }));
  }

  changeArea(area) {
    if (this.mode !== 'onFoot' || this.dialogueManager.isOpen || this.receptionDelivery?.isBusy || area === this.area) return;
    if (area === 'exterior' && !this.raccoonDelivery.resolved) return;
    if (area === 'exterior' && !this.exterior) this.setupExterior();
    if (area === 'exterior' && !this.exteriorLevel?.backgroundLoaded) {
      if (!this.exteriorTransitionPending) {
        this.exteriorTransitionPending = true;
        this.exteriorLevel.backgroundReady.then(ok => {
          this.exteriorTransitionPending = false;
          if (ok && this.area !== 'exterior') this.changeArea('exterior');
        });
      }
      return;
    }
    const next = { reception: this.reception, urgencias: this.urgencias, exterior: this.exterior }[area];
    if (!next) return;
    if (area === 'urgencias' && !this.urgenciasBackdrop.isReady(urgenciasConfig.id)) {
      this.urgenciasBackdropReady = this.urgenciasBackdrop.preload(urgenciasConfig.id);
      return;
    }
    const previousArea = this.area;
    if (previousArea === 'exterior' && area !== 'exterior') {
      this.exteriorLevel?.restorePlayerPresentation(this.bryanVisual);
    }
    this.area = area;
    this.scene = next.scene;
    this.collisionSystem = next.collision;
    this.cameraManager = next.cameras;
    this.interactionManager = next.interactions;
    this.scene.add(this.player.group);
    this.player.position.set(...(area === 'urgencias' ? [0, 0, 4.3] : area === 'exterior'
      ? exteriorConfig.spawn.position : previousArea === 'exterior' ? [0, 0, 6.2] : [3.3, 0, -6.6]));
    this.player.previousPosition.copy(this.player.position);
    this.player.rotationY = area === 'exterior'
      ? exteriorConfig.spawn.rotationY
      : area === 'urgencias' || previousArea === 'exterior' ? 0 : Math.PI;
    this.player.group.rotation.y = this.player.rotationY;
    // Keep Bryan upright in the fixed exterior shot.
    this.player.group.rotation.z = 0;
    this.player.group.rotation.x = 0;
    this.player.velocity.set(0, 0, 0);
    this.interactionManager.currentHintText = '';
    this.input.clearFrameState();
    this.refreshObjective();
    this.cameraManager.update(this.player);
    if (area === 'reception' && previousArea === 'urgencias') this.enterPrerenderRoom('cam02', 'urgencias', 'spawnFromUrgenciasReturn');
    if (area === 'urgencias') this.enterPrerenderRoom(urgenciasConfig.id, 'cam02', 'spawnFromCorridor');
    this.cameraManager.applyToCamera(this.cameraRig);
    // Prepare the complete plate before any render can submit the new area.
    this.updateReceptionViewport();
    this.updateExteriorViewport();
    this.urgenciasBackdrop.update(this.cameraManager.activeZone?.id, this.area);
    this.exteriorBackdrop?.update(this.cameraManager.activeZone?.id, this.area);
  }

  refreshObjective() {
    this.objective.textContent = this.mode === 'driving' ? (this.drivingSequence?.objectiveText ?? this.snowRoad.objectiveText)
      : this.area === 'exterior' ? 'OBJETIVO: Ve a tu auto.' : this.raccoonDelivery?.objectiveText || this.receptionDelivery?.objectiveText ||
      (this.area === 'urgencias' ? 'OBJETIVO: Lleva la entrega al doctor de la estación médica'
      : this.urgenciasUnlocked ? 'OBJETIVO: Ve a Urgencias' : 'OBJETIVO: Entrega el paquete médico.');
  }

  setupExterior() {
    const scene = new THREE.Scene(), collision = new CollisionSystem();
    const cameras = new CameraManager(scene, this.cameraRig);
    const interactions = new InteractionManager(this.player, this.input, scene);

    this.exteriorLevel = new HospitalExterior(scene, this.player, cameras, collision);
    this.exteriorLevel.build();

    // Exterior uses scene.background directly. Do not create another backplate
    // plane here; that was the source of the black/blank exterior.
    this.exteriorBackdrop = null;
    this.exteriorBackdropReady = this.exteriorLevel.backgroundReady;

    this.exterior = { scene, collision, cameras, interactions };

    interactions.register(new Interactable({
      id: 'hospital-return',
      name: 'Hospital',
      position: exteriorConfig.spawn.position,
      radius: 0.72,
      label: 'Volver al hospital',
      onInteract: () => this.changeArea('reception'),
    }));

    interactions.register(new Interactable({
      id: 'bryan-car',
      name: 'Auto de Bryan',
      position: exteriorConfig.car.position,
      radius: exteriorConfig.car.interaction.radius,
      label: 'Subir al auto',
      onInteract: () => this.beginDriving(),
    }));
  }

  beginDriving() {
    if (this.area !== 'exterior' || this.mode !== 'onFoot' || this.dialogueManager.isOpen ||
      !this.raccoonDelivery.resolved) return;

    const lastDeliveryEnding =
      this.raccoonDelivery.ending === 'LAST_DELIVERY';

    this.mode = 'parkingDeparture';
    this.player.group.visible = false;
    this.exteriorLevel.car.visible = true;
    this.dialogueManager.setHint('');
    this.objective.hidden = true;
    this.input.keys.clear();
    this.input.clearFrameState();

    this.parkingDeparture = new ParkingDepartureSequence(
      this.container,
      this.exteriorLevel,
      this.audio,
      () => lastDeliveryEnding ? this.startLastDeliveryEnding() : this.startRoad(),
    );
  }

  startLastDeliveryEnding() {
    this.lastDeliveryEnding = new LastDeliveryEnding(this.container, this.input, {
      skipDeparture: true,
      stats: this.stats.finish({ ending: 'LAST_DELIVERY' }),
    });
    this.mode = 'ending';
    this.player.group.visible = false;
    this.objective.hidden = true;
    this.dialogueManager.setHint('');
    this.input.keys.clear();
    this.input.clearFrameState();
  }

  startCrashCheckpoint() {
    // TEMPORARY QA START: begin immediately after the road impact so forest
    // camera/path work can be tested without replaying the hospital and drive.
    // Delete/disable TEMP_CRASH_CHECKPOINT when this pass is finished.
    this.openingSequence?.transition?.remove();
    if (this.openingSequence?.canvas) {
      this.openingSequence.canvas.style.visibility = 'visible';
    }
    this.openingSequence.completed = true;

    this.prerenderBackdrop?.disable();
    this.urgenciasBackdrop?.disable();
    this.exteriorBackdrop?.disable();

    this.snowRoad = new SnowRoad({ settings: this.settings });
    this.drivingSequence = new DrivingSequence(
      this.container,
      this.snowRoad,
      this.audio,
      () => {},
    );

    const road = this.snowRoad;
    const vehicle = road.vehicle;
    const crashS = 628;
    vehicle.position.set(
      road.centerX(crashS) + 0.9,
      0,
      -crashS,
    );
    vehicle.heading = -Math.atan(road.tangentX(crashS)) + 0.46;
    vehicle.velocity.set(0, 0, 0);
    vehicle.speed = 0;
    vehicle.yawRate = 0;
    vehicle.group.rotation.set(0.025, vehicle.heading, 0);

    road.driveEnabled = false;
    road.completed = true;
    road.updateWeather(0, vehicle.position);
    road.updateCamera(0);

    this.drivingSequence.phase = 'aftermath';
    this.drivingSequence.time = 2.6;
    this.drivingSequence.impactPosition = vehicle.position.clone();
    this.drivingSequence.woman.visible = false;
    this.drivingSequence.conversation.stop();

    this.container.classList.add('driving-mode');
    this.player.group.visible = false;
    this.player.velocity.set(0, 0, 0);
    this.dialogueManager.isOpen = false;
    this.dialogueManager.panel.hidden = true;
    this.dialogueManager.setHint('');
    this.objective.hidden = false;
    this.input.keys.clear();
    this.input.clearFrameState();

    this.forestSequence = new ForestSequence(this);
    this.mode = 'forest';
  }

  startRoad() {
    this.objective.hidden = false;
    this.snowRoad = new SnowRoad({ settings: this.settings });
    this.drivingSequence = new DrivingSequence(this.container, this.snowRoad, this.audio, onClose => {
      this.forestSequence = new ForestSequence(this); this.mode = 'forest';
      this.dialogueManager.start([
        { speaker: 'BRYAN', text: '...¿Qué fue eso?' },
        { speaker: 'BRYAN', text: 'Había alguien en la carretera. Tengo que ver qué pasó.' },
      ], onClose);
    });
    this.mode = 'driving';
    this.container.classList.add('driving-mode');
    this.player.group.visible = false;
    this.input.keys.clear(); this.input.clearFrameState();
    this.refreshObjective();
  }

  updateDriving(dt) {
    this.prerenderBackdrop.disable();
    this.urgenciasBackdrop?.disable();
    this.exteriorBackdrop?.disable();
    if (this.dialogueManager.isOpen) {
      this.input.isJustPressed('KeyR');
      this.dialogueManager.update();
    }
    this.snowRoad.update(dt, this.input);
    this.drivingSequence.update(dt);
    if (this.mode === 'forest') { this.forestSequence.update(0); return; }
    this.refreshObjective();
    this.dialogueManager.setHint(this.snowRoad.hintText);
    this.input.clearFrameState();
    this.renderer.render(this.snowRoad.scene, this.snowRoad.camera);
  }

  updateDeparture(dt) {
    this.prerenderBackdrop.disable();
    this.urgenciasBackdrop?.disable();
    this.cameraManager.applyToCamera(this.cameraRig);
    this.updateExteriorViewport();
    this.exteriorBackdrop?.update(exteriorConfig.id, 'exterior');
    this.parkingDeparture.update(dt);
    this.exteriorLevel.update(dt, this.exteriorLevel.car.position);
    this.input.clearFrameState();
    if (this.mode === 'driving') this.updateDriving(0);
    else this.renderer.render(this.exterior.scene, this.parkingDeparture.camera);
  }

  updateEnding(dt) {
    this.prerenderBackdrop.disable();
    this.urgenciasBackdrop?.disable();
    this.exteriorBackdrop?.disable();
    this.lastDeliveryEnding.update(dt);
    this.input.clearFrameState();
    this.lastDeliveryEnding.render(this.renderer, this.scene, this.cameraRig.camera);
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.bryanVisual.update();
    if (this.mode === 'opening') {
      this.openingSequence.update(dt);
      // The door sequence is DOM-only; no original-hospital render is submitted.
      this.input.clearFrameState();
      return;
    }
    if (this.mode === 'parkingDeparture') { this.updateDeparture(dt); return; }
    if (this.mode === 'forest') { this.forestSequence.update(dt); return; }
    if (this.mode === 'passengerDriving') { this.passengerDrive.update(dt); return; }
    if (this.mode === 'driving') { this.updateDriving(dt); return; }
    if (this.mode === 'ending') { this.updateEnding(dt); return; }

    const activeNPCs = this.area === 'reception' ? this.npcManager : this.area === 'urgencias' ? this.urgenciasLevel.npcManager : null;
    activeNPCs?.update(dt, this.player);
    this.openingSequence.updateGameplay(dt, this.dialogueManager.isOpen);
    if (this.area === 'exterior') this.exteriorLevel.update(dt, this.player);
    if (this.area === 'urgencias') this.urgenciasSequence.update(dt);
    this.receptionDelivery.update(dt, this.area);
    this.raccoonDelivery.update(this.area, dt);
    const wasOpen = this.dialogueManager.isOpen;
    if (wasOpen) this.dialogueManager.update();
    else if (!this.receptionDelivery.isBusy) {
      if (this.area === 'exterior') {
        const car = this.interactionManager.interactables.find(item => item.id === 'bryan-car');
        const distanceToCar = this.exteriorLevel?.car
          ? this.player.position.distanceTo(this.exteriorLevel.car.position)
          : Infinity;
        const carRadius = exteriorConfig.car.interaction.radius;
        if (car && distanceToCar <= carRadius) {
          this.interactionManager.current = car;
          this.interactionManager.currentHintText = '[E] Subir al auto';
          if (this.input.isJustPressed('KeyE')) this.beginDriving();
        } else {
          this.interactionManager.update();
        }
      } else if (this.activePrerenderRoom) this.updateRoomInteractions(this.activePrerenderRoom);
      else this.interactionManager.update();
    }
    if (this.mode === 'parkingDeparture') { this.updateDeparture(0); return; }
    if (this.mode === 'driving') { this.updateDriving(0); return; }
    if (this.mode === 'ending') { this.updateEnding(0); return; }
    const blocked = !this.playerInputEnabled || wasOpen || this.dialogueManager.isOpen || this.receptionDelivery.isBusy;
    if (!blocked) {
      this.player.update(this.input, dt);
      const entranceMovement = this.area === 'reception' &&
        (this.entranceNavigation.owns(this.player.previousPosition) || this.entranceNavigation.owns(this.player.position));
      if (this.activePrerenderRoom) this.activePrerenderRoom.navigation.resolve(this.player);
      else if (entranceMovement) this.entranceNavigation.resolve(this.player);
      else {
        this.collisionSystem.resolve(this.player);
        (this.area === 'reception' ? this.npcManager : this.area === 'urgencias' ? this.urgenciasLevel.npcManager : null)?.resolvePlayer(this.player);
      }
    } else {
      this.player.previousPosition.copy(this.player.position);
      this.player.velocity.set(0, 0, 0);
    }
    this.player.animate(dt, blocked);
    this.bryanVisual.update(dt);
    this.dialogueManager.setHint(blocked ? '' : this.interactionManager.currentHintText);
    this.updateReceptionCamera();
    this.cameraManager.applyToCamera(this.cameraRig);
    this.updateEntranceViewport();
    this.updateReceptionViewport();
    this.updateExteriorViewport();
    this.prerenderBackdrop.update(this.cameraManager.activeZone?.id, this.area);
    this.urgenciasBackdrop.update(this.cameraManager.activeZone?.id, this.area);
    this.exteriorBackdrop?.update(this.cameraManager.activeZone?.id, this.area);
    const room = this.activePrerenderRoom;
    this.prerenderViews.forEach((view, id) => view.update(this.player, room?.config.id === id, this.input, {
      activePortal: room?.portals.find(p => p.bounds && this.player.position.x >= p.bounds.minX && this.player.position.x <= p.bounds.maxX && this.player.position.z >= p.bounds.minZ && this.player.position.z <= p.bounds.maxZ)?.id || null,
      dialogueLocked: this.dialogueManager.isOpen,
    }));
    this.sceneNpcAnchors.update(this.activePrerenderRoom?.config.id, this.player);
    if (this.area === 'exterior') {
      this.exteriorLevel.applyPlayerPresentation(
        this.player,
        this.cameraManager.activeCamera || this.cameraRig.camera,
        this.bryanVisual,
      );
    } else {
      this.exteriorLevel?.restorePlayerPresentation(this.bryanVisual);
    }
    this.input.clearFrameState();

    this.renderer.render(this.scene, this.cameraManager.activeCamera || this.cameraRig.camera);
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);
      this.update();
    };

    animate();
  }
}
