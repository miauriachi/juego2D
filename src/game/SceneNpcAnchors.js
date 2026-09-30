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
      this.visuals.push({ zoneId: config.id, group, anchor, source });
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

  update(zoneId) {
    this.visuals.forEach(({ zoneId: shot, group, anchor, source }) => {
      group.visible = shot === zoneId && anchor.visible;
      // Mirror authored handoff props while the logical NPC retains ownership
      // and its original sequence/route. Never move the gameplay object.
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
