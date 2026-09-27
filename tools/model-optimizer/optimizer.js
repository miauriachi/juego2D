import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptSimplifier } from 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.24.0/meshopt_simplifier.module.js';

const MODEL_URL = new URL('../../assets/models/bryan/source/bryan_original.glb', import.meta.url);
export const TARGETS = [10000, 5000, 2500, 1500];
const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
const meshList = root => { const list = []; root.traverse(o => { if (o.isMesh) list.push(o); }); return list; };
const materialsOf = mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
const textureEntries = material => Object.entries(material).filter(([, value]) => value?.isTexture);
const triangles = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;

export function statistics(root) {
  const meshes = meshList(root), materials = new Set(), textures = new Set(), images = new Set(), sizes = new Set();
  let vertices = 0, faces = 0;
  for (const mesh of meshes) {
    vertices += mesh.geometry.attributes.position.count; faces += triangles(mesh.geometry);
    for (const material of materialsOf(mesh)) {
      materials.add(material);
      for (const [, texture] of textureEntries(material)) {
        textures.add(texture); images.add(texture.source);
        const image = texture.image;
        sizes.add(`${image?.width || 0} × ${image?.height || 0}`);
      }
    }
  }
  return { meshes: meshes.length, vertices, triangles: faces, materials: materials.size, textures: textures.size, images: images.size, resolution: [...sizes].join(', ') || 'Sin texturas' };
}

function floatAttribute(attribute) {
  if (attribute.itemSize > 4) throw new Error('Atributo con más de cuatro componentes no compatible.');
  const data = new Float32Array(attribute.count * attribute.itemSize);
  const getters = ['getX', 'getY', 'getZ', 'getW'];
  for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) data[i * attribute.itemSize + c] = attribute[getters[c]](i);
  if (!data.every(Number.isFinite)) throw new Error('Atributos con valores no finitos.');
  return data;
}

// Index-only simplification: surviving vertices retain their original positions/UVs.
// Meshes are never joined. Unsupported geometry is retained explicitly with a warning.
export function simplifyGeometry(mesh, budget) {
  const source = mesh.geometry;
  if (mesh.isSkinnedMesh || mesh.isInstancedMesh || Object.keys(source.morphAttributes).length) throw new Error('Rig, instancias o morph targets: se conserva la geometría original.');
  if (Array.isArray(mesh.material) || source.groups.length > 1 || source.drawRange.start !== 0 || Number.isFinite(source.drawRange.count)) throw new Error('Grupos de material o drawRange especiales: se conserva la geometría original.');
  if (triangles(source) <= budget) return source.clone();
  const attributes = Object.fromEntries(Object.entries(source.attributes).map(([key, attr]) => [key, floatAttribute(attr)]));
  const count = source.attributes.position.count;
  const indices = source.index ? Uint32Array.from(source.index.array) : Uint32Array.from({ length: count }, (_, i) => i);
  if (indices.length % 3 || indices.some(i => i >= count)) throw new Error('Índices inválidos.');
  const uv = attributes.uv;
  const [reduced, error] = uv
    ? MeshoptSimplifier.simplifyWithAttributes(indices, attributes.position, 3, uv, 2, [0.1, 0.1], null, budget * 3, 0.1)
    : MeshoptSimplifier.simplify(indices, attributes.position, 3, budget * 3, 0.1);
  if (!reduced.length || reduced.length % 3 || !Number.isFinite(error)) throw new Error('Resultado vacío o inválido.');
  const remap = new Map(), used = [];
  const compact = Uint32Array.from(reduced, index => {
    if (index >= count) throw new Error('Índice de salida fuera de rango.');
    if (!remap.has(index)) { remap.set(index, used.length); used.push(index); }
    return remap.get(index);
  });
  const result = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(attributes)) {
    const size = source.attributes[name].itemSize, data = new Float32Array(used.length * size);
    used.forEach((old, next) => data.set(values.subarray(old * size, old * size + size), next * size));
    result.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  result.setIndex(new THREE.BufferAttribute(compact, 1));
  result.computeBoundingBox(); result.computeBoundingSphere();
  const before = new THREE.Box3().setFromBufferAttribute(source.attributes.position).getSize(new THREE.Vector3());
  const after = result.boundingBox.getSize(new THREE.Vector3());
  if (['x', 'y', 'z'].some(axis => before[axis] > 1e-5 && after[axis] < before[axis] * 0.75)) {
    result.dispose(); throw new Error('La reducción perdió más del 25% de una dimensión; se conserva la malla.');
  }
  result.name = source.name; result.userData.simplificationError = error;
  return result;
}

function textureCopy(texture, resolution, cache) {
  if (cache.has(texture)) return cache.get(texture);
  const image = texture.image;
  if (!image?.width || !image?.height || texture.isCompressedTexture || texture.isDataTexture) throw new Error('Textura no compatible con Canvas; se conserva su imagen.');
  const factor = Math.min(1, resolution / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * factor)); canvas.height = Math.max(1, Math.round(image.height * factor));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D no disponible.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.getImageData(0, 0, 1, 1); // Detect a tainted canvas before claiming success.
  const copy = texture.clone();
  // Texture.clone shares Source: assigning copy.image would mutate the original Source!
  copy.source = new THREE.Source(canvas);
  copy.magFilter = THREE.NearestFilter; copy.minFilter = THREE.NearestFilter;
  copy.generateMipmaps = false; copy.needsUpdate = true;
  cache.set(texture, copy); return copy;
}

export async function createVariant(original, target, resolution, retro, progress = () => {}, simple = false) {
  await MeshoptSimplifier.ready;
  if (!MeshoptSimplifier.supported) throw new Error('WebAssembly no disponible.');
  const root = original.clone(true), sources = meshList(original), copies = meshList(root);
  const total = statistics(original).triangles, warnings = [], textures = new Map(), materialCopies = new Map();
  let remaining = target;
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i], copy = copies[i], name = source.name || `Mesh ${i + 1}`;
    const budget = Math.max(4, Math.floor(target * triangles(source.geometry) / total));
    const allocation = i === sources.length - 1 ? Math.max(4, remaining) : budget;
    remaining -= allocation;
    progress(`${target.toLocaleString()} · ${name} (${i + 1}/${sources.length})`); await tick();
    try { copy.geometry = simplifyGeometry(source, allocation); }
    catch (error) { copy.geometry = source.geometry.clone(); warnings.push(`${name}: ${error.message}`); }
    const list = materialsOf(source).map(material => {
      if (materialCopies.has(material)) return materialCopies.get(material);
      const next = material.clone();
      for (const [slot, texture] of textureEntries(material)) {
        try { next[slot] = textureCopy(texture, resolution, textures); }
        catch (error) { next[slot] = texture.clone(); warnings.push(`${name}/${slot}: ${error.message}`); }
      }
      if (retro) next.flatShading = true;
      if (simple) {
        for (const slot of ['normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'displacementMap']) if (slot in next) next[slot] = null;
        if ('metalness' in next) next.metalness = 0;
        if ('roughness' in next) next.roughness = 1;
      }
      next.needsUpdate = true; materialCopies.set(material, next); return next;
    });
    copy.material = Array.isArray(source.material) ? list : list[0];
    // Export actual faceted normals, since flatShading itself isn't a glTF material feature.
    if (retro && !source.isSkinnedMesh && !Object.keys(source.geometry.morphAttributes).length) {
      const previous = copy.geometry; copy.geometry = previous.toNonIndexed();
      if (copy.geometry !== previous) previous.dispose();
      copy.geometry.deleteAttribute('tangent'); copy.geometry.computeVertexNormals();
    }
  }
  const stats = statistics(root);
  if (simple) warnings.push('Material simple activado: se exporta el mapa de color y se omiten los mapas PBR en esta copia. El original conserva todos sus mapas.');
  if (stats.triangles > target) warnings.push(`Objetivo ${target}: alcanzados ${stats.triangles} triángulos. Se respetaron costuras/topología; no se forzó una reducción destructiva.`);
  if (target <= 2500) warnings.push('Reducción fuerte: revisa rostro, dedos y costuras UV antes de elegir esta versión.');
  return { root, target, resolution, retro, simple, stats, warnings };
}

export async function exportVariant(variant) {
  // Export a clone with wireframe disabled, regardless of the preview toggle.
  const root = variant.root.clone(true);
  root.traverse(o => { if (o.isMesh) { const list = materialsOf(o).map(m => { const copy = m.clone(); copy.wireframe = false; return copy; }); o.material = Array.isArray(o.material) ? list : list[0]; } });
  try { return await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: Infinity }); }
  finally { root.traverse(o => { if (o.isMesh) materialsOf(o).forEach(m => m.dispose()); }); }
}

function disposeVariant(variant) {
  const materials = new Set(), textures = new Set();
  variant.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); materialsOf(o).forEach(m => materials.add(m)); } });
  materials.forEach(m => { textureEntries(m).forEach(([, t]) => textures.add(t)); m.dispose(); });
  textures.forEach(t => t.dispose());
}

export class OptimizerApp {
  constructor() {
    this.variants = new Map(); this.selected = 'original'; this.busy = true;
    this.viewport = document.querySelector('#viewport');
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x656b70);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.viewport.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x454a54, 2));
    const key = new THREE.DirectionalLight(0xfff5e8, 2.4); key.position.set(2, 4, 3); this.scene.add(key);
    this.grid = new THREE.GridHelper(4, 20, 0x39494d, 0x535b60); this.scene.add(this.grid);
    document.querySelector('#generate').onclick = () => this.generate();
    document.querySelector('#export').onclick = () => this.download();
    document.querySelectorAll('[data-version]').forEach(b => { b.onclick = () => this.select(b.dataset.version); });
    document.querySelector('#grid').onchange = e => { this.grid.visible = e.target.checked; };
    document.querySelector('#wireframe').onchange = () => this.applyWireframe();
    document.querySelector('#frame').onclick = () => this.frame();
    for (const id of ['resolution', 'retro', 'simple']) document.querySelector(`#${id}`).onchange = () => { document.querySelector('#settings-note').textContent = 'Ajustes cambiados. Pulsa Generar para actualizar las cuatro copias.'; };
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.viewport);
    this.renderer.setAnimationLoop(() => { this.controls.update(); this.renderer.render(this.scene, this.camera); });
  }
  status(text) { document.querySelector('#status').textContent = text; }
  async load() {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL.href);
    this.original = gltf.scene;
    if (!meshList(this.original).length) throw new Error('El GLB no contiene mallas.');
    this.variants.set('original', { root: this.original, stats: statistics(this.original), warnings: [], target: null });
    this.busy = false; this.select('original'); this.frame(); this.buttons();
    this.status('Original cargado. Genera las copias para comparar.');
  }
  resize() {
    const w = this.viewport.clientWidth, h = this.viewport.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  frame() {
    if (!this.original) return;
    const bounds = new THREE.Box3().setFromObject(this.original), center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()), radius = size.length() / 2;
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.max(1, 1 / this.camera.aspect) * 1.15;
    this.camera.position.copy(center).add(new THREE.Vector3(0, radius * 0.15, distance));
    this.camera.near = Math.max(radius / 1000, 0.001); this.camera.far = Math.max(distance * 20, 10); this.camera.updateProjectionMatrix();
    this.controls.target.copy(center); this.controls.update(); this.grid.position.y = bounds.min.y - 0.002;
  }
  buttons() {
    document.querySelector('#generate').disabled = this.busy || !this.original;
    document.querySelector('#export').disabled = this.busy || this.selected === 'original';
    for (const id of ['resolution', 'retro', 'simple']) document.querySelector(`#${id}`).disabled = this.busy;
    document.querySelectorAll('[data-version]').forEach(b => { b.disabled = this.busy || !this.variants.has(b.dataset.version); b.setAttribute('aria-pressed', String(b.dataset.version === this.selected)); });
  }
  select(key) {
    if (!this.variants.has(key)) return;
    if (this.current) this.scene.remove(this.current);
    this.selected = key; const variant = this.variants.get(key); this.current = variant.root; this.scene.add(this.current);
    this.applyWireframe(); this.buttons();
    const stats = variant.stats;
    document.querySelector('#summary').textContent = `Triangles: ${stats.triangles.toLocaleString()} · Texture resolution: ${stats.resolution}${variant.retro ? ' · PS1' : ''}`;
    document.querySelector('#stats').replaceChildren(...Object.entries({ Meshes: stats.meshes, 'Vértices almacenados': stats.vertices, Triángulos: stats.triangles, Materiales: stats.materials, Texturas: stats.textures, Imágenes: stats.images }).flatMap(([label, value]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value.toLocaleString(); return [dt, dd];
    }));
    document.querySelector('#warnings').replaceChildren(...variant.warnings.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  }
  applyWireframe() {
    // Only the draw property is toggled; restore original on every switch to avoid affecting copies.
    for (const variant of this.variants.values()) variant.root.traverse(o => { if (o.isMesh) materialsOf(o).forEach(m => { m.wireframe = variant.root === this.current && document.querySelector('#wireframe').checked; }); });
  }
  async generate() {
    if (this.busy || !this.original) return;
    this.busy = true; this.buttons();
    const resolution = Number(document.querySelector('#resolution').value), retro = document.querySelector('#retro').checked;
    const simple = document.querySelector('#simple').checked;
    try {
      for (const target of TARGETS) {
        const variant = await createVariant(this.original, target, resolution, retro, message => this.status('Procesando ' + message), simple);
        const key = String(target), old = this.variants.get(key);
        if (old) { if (this.current === old.root) this.scene.remove(old.root); disposeVariant(old); }
        this.variants.set(key, variant);
        document.querySelector('#results').replaceChildren(...TARGETS.filter(t => this.variants.has(String(t))).map(t => {
          const v = this.variants.get(String(t)), row = document.createElement('div'); row.textContent = `${t.toLocaleString()} → ${v.stats.triangles.toLocaleString()} triángulos · ${v.stats.resolution}${v.warnings.length ? ' · revisar avisos' : ' · OK'}`; return row;
        }));
      }
      this.select('10000'); this.status('Copias listas. Compara silueta y texturas antes de exportar.');
      document.querySelector('#settings-note').textContent = `Copias a ${resolution}px · ${retro ? 'caras planas' : 'normales originales'} · ${simple ? 'solo color pintado' : 'todos los mapas'}.`;
    } catch (error) { this.status('No se completó la generación: ' + error.message); this.select('original'); }
    finally { this.busy = false; this.buttons(); }
  }
  async download() {
    if (this.busy || this.selected === 'original') return;
    this.busy = true; this.buttons(); this.status('Empaquetando geometría y texturas…');
    try {
      const variant = this.variants.get(this.selected), buffer = await exportVariant(variant);
      const url = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }));
      const link = document.createElement('a'); link.href = url; link.download = `bryan_${variant.target}.glb`; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      this.status(`Descarga preparada: bryan_${variant.target}.glb · ${variant.stats.triangles.toLocaleString()} triángulos.`);
    } catch (error) { this.status('No se pudo exportar: ' + error.message); }
    finally { this.busy = false; this.buttons(); }
  }
}
