import { CameraZone } from './CameraZone.js';
import { DEBUG_MODE } from '../config/constants.js';

export class CameraManager {
  constructor(scene, cameraRig) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.zones = [];
    this.activeZone = null;
    this.activeCamera = cameraRig ? cameraRig.camera : null;
    this.debugVisible = DEBUG_MODE;
    this.portal = null;
  }

  // A portal retains its shot across lateral motion, until the depth threshold
  // is crossed. It never changes player position or defines collision geometry.
  setPortal(portal) { this.portal = portal; }

  selectZone(position, candidates) {
    const portal = this.portal;
    if (portal) {
      const inEntrance = position.x >= portal.minX && position.x <= portal.maxX && position.z <= portal.maxZ;
      const entrance = this.zones.find(zone => zone.id === portal.entranceId);
      if (this.activeZone === entrance && inEntrance) {
        if (position.z > portal.exitZ) return entrance;
        return this.zones.find(zone => zone.id === portal.interiorId);
      }
      if (inEntrance && position.z >= portal.returnZ) return entrance;
      candidates = candidates.filter(zone => zone !== entrance);
    }
    return candidates.reduce((selected, current) =>
      !selected || current.priority > selected.priority ? current : selected, null) ?? this.zones[0] ?? null;
  }

  addZone(zoneConfig) {
    const zone = new CameraZone(zoneConfig);
    this.zones.push(zone);
    this.scene.add(zone.debugGroup);
    return zone;
  }

  setActiveZone(zone) {
    if (this.activeZone === zone) {
      return false;
    }

    this.activeZone = zone;
    if (this.cameraRig && zone) {
      this.activeCamera = this.cameraRig.camera;
    }

    if (DEBUG_MODE && zone) {
      console.log(`ENTER ${zone.name}`);
    }

    return true;
  }

  update(player) {
    const position = player?.position ?? player?.group?.position ?? player?.mesh?.position ?? player?.object?.position;

    if (!position) {
      return;
    }

    const candidates = this.zones.filter((zone) => zone.containsPlayer(player));
    const nextZone = this.selectZone(position, candidates);

    if (nextZone && this.activeZone !== nextZone) {
      const changed = this.setActiveZone(nextZone);
      if (changed && DEBUG_MODE) {
        console.log(`Player position: x ${position.x.toFixed(2)}, y ${position.y.toFixed(2)}, z ${position.z.toFixed(2)}`);
      }
      return;
    }

    if (!this.activeZone && this.zones[0]) {
      this.setActiveZone(this.zones[0]);
    }

    if (DEBUG_MODE && this.activeZone && position && this.activeZone !== nextZone) {
      console.log(`Player position: x ${position.x.toFixed(2)}, y ${position.y.toFixed(2)}, z ${position.z.toFixed(2)}`);
    }
  }

  applyToCamera(cameraRig) {
    if (!this.activeZone) return;

    cameraRig.setCameraState(this.activeZone.cameraPosition, this.activeZone.lookAt);
    if (Number.isFinite(this.activeZone.fov) && cameraRig.camera.fov !== this.activeZone.fov) {
      cameraRig.camera.fov = this.activeZone.fov;
      cameraRig.camera.updateProjectionMatrix();
    }
    this.activeCamera = cameraRig.camera;
  }

  setDebugVisibility(visible) {
    this.debugVisible = visible;
    this.zones.forEach((zone) => zone.setDebugVisible(visible));
  }
}
