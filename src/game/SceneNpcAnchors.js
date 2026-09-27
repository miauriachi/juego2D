import * as THREE from 'three';

// Reuse an existing NPC's visual meshes without moving its logical actor/routes.
// Each shot owns isolated materials, so counter occlusion never leaks to other NPCs.
export class SceneNpcAnchors {
  constructor(scene, npcManager, configs) {
    this.visuals = [];
    for (const config of configs) for (const [id, anchor] of Object.entries(config.npcAnchors || {})) {
      const source = npcManager.npcs.find(npc => npc.name === anchor.sourceName);
      if (!source) throw new Error(`NPC anchor source missing: ${anchor.sourceName}`);
      const group = new THREE.Group();
      group.name = `shot-npc:${config.id}:${id}`;
      const model = new THREE.Group().copy(source.model, false);
      source.model.children.forEach(child => model.add(child.clone(true)));
      model.traverse(object => {
        if (!object.isMesh) return;
        const adapt = material => {
          const copy = material.clone();
          if (anchor.occlusionPolygon) this.applyOcclusion(copy, anchor.occlusionPolygon, config);
          return copy;
        };
        object.material = Array.isArray(object.material) ? object.material.map(adapt) : adapt(object.material);
        object.userData.preserveForBackplate = true;
      });
      // Ground the complete static pose, including seated feet. Occlusion only
      // changes presentation; it never lifts or truncates the model geometry.
      model.scale.multiplyScalar(anchor.scale ?? 1);
      model.updateMatrixWorld(true);
      model.position.y += (anchor.supportHeight ?? 0) - new THREE.Box3().setFromObject(model).min.y;
      group.add(model);
      group.position.set(...anchor.position);
      group.rotation.y = anchor.rotationY;
      group.visible = false;
      scene.add(group);
      const sourceNodes = [];
      const modelNodes = [];
      source.model.traverse(node => sourceNodes.push(node));
      model.traverse(node => modelNodes.push(node));
      this.visuals.push({
        zoneId: config.id, group, model, anchor, source, sourceNodes, modelNodes,
        sourceStartPosition: source.group.position.clone(),
        sourceStartRotationY: source.group.rotation.y,
      });
    }
  }

  applyOcclusion(material, polygon, config) {
    // Mask in plate coordinates, so the painted counter occludes the entire NPC
    // silhouette correctly, independently of its world-space height.
    const height = 72 * Math.tan(THREE.MathUtils.degToRad(config.camera.fov / 2));
    const zoom = config.background.zoom ?? 1;
    const points = polygon.map(([u, v]) => new THREE.Vector2(
      0.5 + (u - 0.5) * zoom + (config.background.offsetX ?? 0) / (height * config.aspect),
      0.5 + (v - 0.5) * zoom - (config.background.offsetY ?? 0) / height));
    material.customProgramCacheKey = () => `shot-occlusion-${points.length}`;
    material.onBeforeCompile = shader => {
      shader.uniforms.shotMask = { value: points };
      shader.vertexShader = 'varying vec4 shotClipPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nshotClipPosition = gl_Position;');
      shader.fragmentShader = `varying vec4 shotClipPosition;\nuniform vec2 shotMask[${points.length}];\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
        #include <clipping_planes_fragment>
        vec2 shotUV = vec2(0.5) + vec2(0.5, -0.5) * shotClipPosition.xy / shotClipPosition.w;
        bool behindCounter = false;
        for (int i = 0; i < ${points.length}; i++) {
          vec2 a = shotMask[i];
          vec2 b = shotMask[(i + 1) % ${points.length}];
          if ((a.y > shotUV.y) != (b.y > shotUV.y)) {
            float crossing = a.x + (b.x - a.x) * (shotUV.y - a.y) / (b.y - a.y);
            if (shotUV.x < crossing) behindCounter = !behindCounter;
          }
        }
        if (behindCounter) discard;
      `);
    };
  }

  update(zoneId, player = null) {
    this.visuals.forEach((visual) => {
      const { zoneId: shot, group, anchor, source, sourceNodes, modelNodes,
        sourceStartPosition, sourceStartRotationY } = visual;
      group.visible = shot === zoneId && anchor.visible && !source.departed;
      if (!group.visible) return;

      const count = Math.min(sourceNodes.length, modelNodes.length);
      for (let i = 1; i < count; i++) {
        const from = sourceNodes[i], to = modelNodes[i];
        to.position.copy(from.position);
        to.quaternion.copy(from.quaternion);
        to.scale.copy(from.scale);
      }

      group.position.set(...anchor.position);
      group.position.y += anchor.presentationYOffset ?? 0;

      if (anchor.followSourceMotion) {
        const motionScale = anchor.motionScale ?? 1;
        const movedX = (source.group.position.x - sourceStartPosition.x) * motionScale;
        const movedZ = (source.group.position.z - sourceStartPosition.z) * motionScale;
        group.position.x += movedX;
        group.position.z += movedZ;
        const hasMoved = Math.hypot(movedX, movedZ) > 0.03;
        if (hasMoved) {
          group.rotation.y = source.group.rotation.y;
        } else if (anchor.facePlayerWhenIdle && player) {
          const dx = player.position.x - group.position.x;
          const dz = player.position.z - group.position.z;
          group.rotation.y = Math.atan2(-dx, -dz);
        } else {
          group.rotation.y = anchor.rotationY;
        }
      } else if (anchor.lookAtPlayer && player) {
        const dx = player.position.x - group.position.x;
        const dz = player.position.z - group.position.z;
        group.rotation.y = Math.atan2(-dx, -dz);
      } else {
        group.rotation.y = anchor.rotationY;
      }

      for (const prop of anchor.attachedProps || []) {
        const original = source.model.getObjectByName(prop.name);
        let copy = group.getObjectByName(`${prop.name}-shot`);
        if (!original) { if (copy) copy.removeFromParent(); continue; }
        if (!copy) {
          copy = original.clone(true); copy.name = `${prop.name}-shot`;
          copy.traverse(mesh => { mesh.userData.preserveForBackplate = true; });
          group.getObjectByName(prop.parent)?.add(copy);
        }
      }
    });
  }

}
