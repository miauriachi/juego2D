import * as THREE from 'three';

// Ring profiles keep silhouettes intentional without a skeleton or dense geometry.
const geometries = new Map();
const materials = new Map();
const textures = new Map();
function profile(rings, segments = 16) {
  const key = JSON.stringify([rings, segments]);
  if (geometries.has(key)) return geometries.get(key);
  const positions = [], uv = [], indices = [];
  const bottom = rings[0][0], height = rings[rings.length - 1][0] - bottom;
  rings.forEach(([y, width, depth, offsetZ = 0], row) => {
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments - 0.5) * Math.PI * 2;
      positions.push(Math.sin(angle) * width, y, -Math.cos(angle) * depth + offsetZ);
      uv.push(i / segments, (y - bottom) / height);
      if (row < rings.length - 1 && i < segments) {
        const a = row * (segments + 1) + i, b = a + segments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
  for (const row of [0, rings.length - 1]) {
    const center = positions.length / 3;
    positions.push(0, rings[row][0], rings[row][3] || 0); uv.push(0.5, row === 0 ? 0 : 1);
    for (let i = 0; i < segments; i++) {
      const a = row * (segments + 1) + i;
      if (row === 0) indices.push(center, a, a + 1);
      else indices.push(center, a + 1, a);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  // Weld the radial shading seam without changing UVs.
  const normals = geometry.attributes.normal;
  for (let row = 0; row < rings.length; row++) {
    const a = row * (segments + 1), b = a + segments;
    const n = new THREE.Vector3().fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
  }
  geometries.set(key, geometry);
  return geometry;
}

function paintedTexture(color, style) {
  const key = color + ':' + style;
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = style.startsWith('face') ? 128 : 64;
  const ctx = canvas.getContext('2d'), size = canvas.width;
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, size, size);
  if (style.startsWith('face')) {
    const receptionist = style === 'face-receptionist';
    ctx.fillStyle = 'rgba(35,20,15,0.12)'; ctx.fillRect(0, 101, size, 27);
    // Facial features are fitted planes; this map supplies restrained cheek/jaw shading.
    ctx.fillStyle = receptionist ? 'rgba(43,25,21,.14)' : 'rgba(60,44,31,.10)';
    ctx.fillRect(50, 59, 9, 2); ctx.fillRect(69, 59, 9, 2);
    ctx.fillStyle = 'rgba(217,161,140,0.12)';
    ctx.fillRect(51, 63, 5, 4); ctx.fillRect(73, 63, 5, 4);
  } else if (style === 'knit') {
    for (let x = 0; x < size; x += 4) {
      ctx.fillStyle = 'rgba(205,209,210,0.12)'; ctx.fillRect(x, 0, 1, size);
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x + 2, 0, 1, size);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 48, size, 2);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fillRect(0, 58, size, 3);
    ctx.fillRect(31, 4, 1, 51);
    ctx.fillStyle = 'rgba(235,233,215,0.08)'; ctx.fillRect(33, 4, 1, 51);
    for (const [x, y, length] of [[15, 41, 8], [43, 46, 7], [12, 18, 5], [48, 23, 6]]) {
      ctx.strokeStyle = 'rgba(20,25,28,0.12)';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y - 2); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  textures.set(key, texture);
  return texture;
}

function material(color, style = '', flat = false) {
  const key = color + ':' + style + ':' + flat;
  if (!materials.has(key)) materials.set(key, new THREE.MeshLambertMaterial({
    color: style ? 0xffffff : color,
    map: style ? paintedTexture(color, style) : null,
    flatShading: flat,
  }));
  return materials.get(key);
}

function part(parent, geometry, mat, position = [0, 0, 0], name = '') {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name; mesh.position.set(...position);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Small tailored cloth panels, not solid blocks. Vertices follow the garment surface.
function panel(parent, points, color, name = '') {
  const key = 'panel:' + JSON.stringify(points);
  if (!geometries.has(key)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    const indices = [];
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i + 1, i);
    geometry.setIndex(indices); geometry.computeVertexNormals();
    geometries.set(key, geometry);
  }
  const mesh = part(parent, geometries.get(key), material(color), [0, 0, 0], name);
  // Panels are small and can be seen from either side during joint animation.
  const matKey = 'panel-material:' + color;
  if (!materials.has(matKey)) {
    const mat = material(color).clone(); mat.side = THREE.DoubleSide; materials.set(matKey, mat);
  }
  mesh.material = materials.get(matKey);
  return mesh;
}

export class LowPolyCharacter extends THREE.Group {
  constructor({ kind, clothing, trousers = 0x343f43, skin = 0xb7a08b, hair = 0x39312c,
    build = 'average', female = false, accent = 0xcbd4cb, pose = 'normal' }) {
    super();
    this.name = kind;
    this.phase = 0; this.elapsed = 0; this.blend = 0;
    this.receptionist = kind === 'Receptionist';
    this.protagonist = kind === 'Bryan';
    this.pose = pose;
    this.patient = kind.startsWith('Patient');
    const doctor = kind === 'Doctor' || kind === 'ChiefDoctor' || kind === 'LaboratoryDoctor';
    if (pose === 'lying') this.rotation.x = Math.PI / 2;
    this.userData.characterProfile = { kind, build, female, skin, pose };
    const robust = build === 'robust', slim = build === 'slim';
    const shoulder = robust ? 0.30 : this.protagonist ? 0.285 : slim ? 0.235 : 0.26;
    this.shoulderHeight = robust ? 1.31 : 1.37;
    this.headHeight = robust ? 1.585 : 1.64;
    const cloth = material(clothing, 'cloth'), pants = material(trousers, 'cloth');
    const skinMat = material(skin), hairMat = material(hair, '', true);
    this.body = new THREE.Group(); this.add(this.body);
    this.torso = new THREE.Group(); this.torso.name = 'torso'; this.body.add(this.torso);

    const torsoRings = robust ? [
      [0.76, 0.275, 0.18], [0.86, 0.293, 0.205], [1.02, 0.268, 0.205, -0.008],
      [1.16, 0.282, 0.225, -0.025], [1.25, 0.278, 0.21, -0.022],
      [1.34, 0.248, 0.15], [1.405, 0.105, 0.085],
    ] : [
      [0.79, shoulder * 0.8, 0.135], [0.88, shoulder * 0.85, 0.15],
      [1.03, shoulder * (this.protagonist ? 0.9 : 0.76), 0.15],
      [1.22, shoulder * 0.91, this.protagonist ? 0.18 : 0.16],
      [1.34, shoulder * 0.94, 0.145], [1.41, shoulder * 0.76, 0.105], [1.445, 0.09, 0.075],
    ];
    part(this.torso, profile(torsoRings, this.protagonist ? 24 : 20), cloth, [0, 0, 0], 'tailoredTorso');
    // Project detail patches onto the garment instead of intersecting its curved chest.
    const surface = (x, y, lift = 0.014) => {
      let lower = torsoRings[0], upper = torsoRings[torsoRings.length - 1];
      for (let i = 1; i < torsoRings.length; i++) {
        if (y <= torsoRings[i][0]) { lower = torsoRings[i - 1]; upper = torsoRings[i]; break; }
      }
      const t = THREE.MathUtils.clamp((y - lower[0]) / (upper[0] - lower[0]), 0, 1);
      const width = THREE.MathUtils.lerp(lower[1], upper[1], t);
      const depth = THREE.MathUtils.lerp(lower[2], upper[2], t);
      const z = THREE.MathUtils.lerp(lower[3] || 0, upper[3] || 0, t);
      return [x, y, z - depth * Math.sqrt(Math.max(0, 1 - (x / width) ** 2)) - lift];
    };
    const patch = (outline, color, name) => {
      const lift = name === 'badgeStripe' ? 0.022 : 0.014;
      const center = outline.reduce((sum, p) => [sum[0] + p[0] / outline.length, sum[1] + p[1] / outline.length], [0, 0]);
      const points = [surface(...center, lift)];
      outline.forEach((p, i) => {
        const next = outline[(i + 1) % outline.length];
        points.push(surface(...p, lift), surface((p[0] + next[0]) / 2, (p[1] + next[1]) / 2, lift));
      });
      points.push(points[1]);
      return panel(this.torso, points, color, name);
    };
    const hip = robust ? 0.278 : female ? 0.22 : 0.205;
    part(this.body, profile([[0.72, hip * 0.86, 0.12], [0.79, hip, robust ? 0.18 : 0.14], [0.88, hip * 0.93, 0.145]]), pants);
    part(this.body, profile([[-0.025, 0.082, 0.068], [0.02, 0.063, 0.059], [0.11, 0.066, 0.063]], 12), skinMat,
      [0, robust ? 1.395 : 1.43, 0], 'neck');

    this.head = new THREE.Group(); this.head.name = 'head';
    this.head.position.y = this.headHeight; this.body.add(this.head);
    this.head.scale.setScalar(0.86);
    const headWidth = robust ? 0.163 : slim ? 0.139 : 0.146;
    const headDepth = robust ? 0.15 : 0.142;
    const headRings = [
      [-0.17, headWidth * 0.46, 0.078, -0.018],
      [-0.135, headWidth * (robust ? 0.83 : 0.72), 0.108, -0.005],
      [-0.095, headWidth * 0.87, headDepth * 0.92, -0.008],
      [-0.055, headWidth * 0.93, headDepth * 0.96],
      [0.005, headWidth, headDepth], [0.045, headWidth * 0.96, headDepth * 0.95],
      [0.075, headWidth * 0.95, headDepth * 0.98],
      [0.13, headWidth * 0.83, headDepth * 0.85, 0.006],
      [0.18, headWidth * 0.5, 0.079, 0.01], [0.195, 0.025, 0.03, 0.01],
    ];
    part(this.head, profile(headRings, this.protagonist ? 24 : 20), material(skin, robust ? 'face-receptionist' : 'face'), [0, 0, 0], 'face');
    // Painted shading plus small fitted facial planes remain legible at fixed-camera scale.
    const facePatch = (outline, color, name) => panel(this.head, outline.map(([x, y]) => {
      let a = headRings[0], b = headRings[1];
      for (let i = 1; i < headRings.length; i++) if (y <= headRings[i][0]) { a = headRings[i - 1]; b = headRings[i]; break; }
      const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
      const w = THREE.MathUtils.lerp(a[1], b[1], t), d = THREE.MathUtils.lerp(a[2], b[2], t);
      const lift = name === 'iris' ? 0.008 : name === 'eye' ? 0.006 : 0.004;
      return [x, y, THREE.MathUtils.lerp(a[3] || 0, b[3] || 0, t) - d * Math.sqrt(Math.max(0, 1 - (x / w) ** 2)) - lift];
    }), color, name);
    for (const side of [-1, 1]) {
      const x = side * 0.052;
      facePatch([[x - 0.026, 0.037], [x, 0.043], [x + 0.026, 0.037], [x + 0.020, 0.026], [x - 0.020, 0.026]], 0x55463c, 'eyelid');
      facePatch([[x - 0.019, 0.035], [x + 0.019, 0.035], [x + 0.014, 0.029], [x - 0.014, 0.029]], 0xc3bcaa, 'eye');
      facePatch([[x - 0.004, 0.036], [x + 0.004, 0.036], [x + 0.004, 0.028], [x - 0.004, 0.028]], 0x2b302b, 'iris');
      facePatch([[x - 0.025, 0.059], [x + 0.024, 0.061], [x + 0.022, 0.055], [x - 0.023, 0.052]], hair, 'eyebrow');
    }
    facePatch([[-0.032, -0.083], [0, -0.077], [0.032, -0.083], [0.023, -0.090], [-0.023, -0.090]], robust ? 0x704b43 : 0x936c5b, 'lips');
    part(this.head, profile([[-0.041, 0.016, 0.01, -headDepth - 0.005],
      [-0.018, 0.024, 0.019, -headDepth - 0.012], [0.032, 0.01, 0.006, -headDepth + 0.003]], 8),
      skinMat, [0, 0, 0], 'nose');
    for (const side of [-1, 1]) {
      const ear = part(this.head, profile([[-0.04, 0.018, 0.028], [0, 0.025, 0.033], [0.04, 0.017, 0.022]], 8), skinMat,
        [side * headWidth * 0.96, -0.012, 0.005], 'ear');
      ear.rotation.z = side * 0.09;
    }

    // A fitted crown and a few tapered locks, with a gathered style for hospital staff.
    part(this.head, profile([[0.066, headWidth * 0.98, headDepth * 0.97, 0.012],
      [0.14, headWidth * 0.9, headDepth * 0.89, 0.015], [0.19, headWidth * 0.59, 0.084, 0.015],
      [0.205, 0.018, 0.025, 0.012]], 12), hairMat, [0, 0, 0], 'hairCrown');
    const lockCount = this.protagonist ? 11 : female ? 4 : 6;
    for (let i = 0; i < lockCount; i++) {
      const angle = female ? [-1.4, -1.08, 1.08, 1.4][i] : -0.95 + i * 1.9 / (lockCount - 1);
      const tip = this.protagonist && (i === 0 || i === lockCount - 1) ? -0.09 : female ? -0.065 : -0.008;
      const lock = part(this.head, profile([[tip, 0.005, 0.005], [0.005, 0.028, 0.018], [0.065, 0.024, 0.023]], 5),
        hairMat, [Math.sin(angle) * headWidth * 0.94, 0.092 + (i % 2) * 0.012, -Math.cos(angle) * headDepth * 0.94], 'hairLock');
      lock.rotation.z = angle * 0.32;
    }
    if (female) {
      part(this.head, profile([[-0.06, 0.025, 0.025], [-0.035, 0.065, 0.058],
        [0.03, 0.068, 0.06], [0.065, 0.022, 0.025]], 10), hairMat, [0, 0.02, 0.146], 'gatheredHair');
    }

    this.arms = []; this.legs = []; this.forearms = []; this.calves = []; this.feet = [];
    for (const [side, name] of [[-1, 'left'], [1, 'right']]) {
      const arm = new THREE.Group(); arm.name = name + 'Arm';
      arm.position.set(side * shoulder, this.shoulderHeight, 0); this.body.add(arm);
      const upperWidth = robust ? 0.103 : this.protagonist ? 0.09 : slim ? 0.066 : 0.076;
      const bareForearms = kind === 'Nurse' || kind === 'Orderly' || this.patient;
      part(arm, profile([[-0.29, upperWidth * 0.7, 0.063], [-0.245, upperWidth * 0.87, 0.076],
        [-0.15, upperWidth * 0.94, 0.08], [-0.075, upperWidth, 0.086],
        [-0.015, upperWidth * 0.93, 0.084], [0.03, upperWidth * 0.75, 0.061],
        [0.055, upperWidth * 0.38, 0.036]], 16), cloth, [0, 0, 0], 'upperArm');
      const forearm = new THREE.Group(); forearm.name = 'forearm'; forearm.position.y = -0.285; arm.add(forearm);
      part(forearm, profile([[-0.255, 0.047, 0.043], [-0.2, upperWidth * 0.65, 0.049],
        [-0.12, upperWidth * 0.76, 0.059], [-0.04, upperWidth * 0.79, 0.065], [0.008, upperWidth * 0.72, 0.063]], 14),
        bareForearms ? skinMat : cloth);
      part(forearm, profile([[-0.25, 0.051, 0.046], [-0.225, 0.055, 0.05]], 12),
        this.patient ? material(0xc5c6b3, 'cloth') : material(accent, 'cloth'), [0, 0, 0], 'cuff');
      const handMat = this.protagonist ? material(0x303333, 'cloth') : skinMat;
      const hand = new THREE.Group(); hand.name = 'hand'; hand.position.y = -0.267; forearm.add(hand);
      part(hand, profile([[-0.071, 0.037, 0.021], [-0.045, 0.046, 0.025],
        [-0.025, 0.044, 0.03], [0.014, 0.034, 0.028]], 12), handMat);
      for (let finger = 0; finger < 4; finger++) {
        const length = finger === 0 || finger === 3 ? 0.046 : 0.058;
        part(hand, profile([[-length, 0.006, 0.010], [-length + 0.012, 0.009, 0.012],
          [0, 0.010, 0.014]], 6), handMat, [-0.03 + finger * 0.02, -0.060, -0.006], 'finger');
      }
      const thumb = part(hand, profile([[-0.052, 0.013, 0.015], [-0.018, 0.019, 0.019], [0, 0.017, 0.017]], 6),
        handMat, [-side * 0.043, -0.017, -0.018], 'thumb');
      thumb.rotation.z = -side * 0.4;
      this.arms.push(arm); this.forearms.push(forearm);

      const leg = new THREE.Group(); leg.name = name + 'Leg';
      leg.position.set(side * (robust ? 0.143 : 0.115), 0.8, 0); this.body.add(leg);
      const thighWidth = robust ? 0.119 : slim ? 0.088 : 0.098;
      part(leg, profile([[-0.375, thighWidth * 0.76, 0.077], [-0.32, thighWidth * 0.86, 0.084],
        [-0.23, thighWidth * 0.96, 0.095], [-0.12, thighWidth, robust ? 0.125 : 0.106], [0.035, thighWidth, 0.105]], 16), pants, [0, 0, 0], 'thigh');
      const calf = new THREE.Group(); calf.name = 'calf'; calf.position.y = -0.36; leg.add(calf);
      part(calf, profile([[-0.355, 0.065, 0.068], [-0.29, 0.074, 0.079],
        [-0.20, thighWidth * 0.87, 0.088, 0.012], [-0.10, thighWidth * 0.8, 0.082, 0.006], [0.01, thighWidth * 0.75, 0.075]], 14), pants);
      const foot = new THREE.Group(); foot.name = 'foot'; calf.add(foot);
      const boot = this.protagonist;
      const shoeMat = material(boot ? 0x383b3b : 0x303737, 'cloth');
      part(foot, profile([[-0.433, 0.069, 0.13, -0.045], [-0.411, 0.083, 0.152, -0.049],
        [-0.373, 0.079, 0.144, -0.045], [-0.335, 0.069, 0.105, -0.021],
        [boot ? -0.215 : -0.315, 0.071, 0.074, 0.006]], 16), shoeMat);
      part(foot, profile([[-0.438, 0.077, 0.145, -0.047], [-0.413, 0.084, 0.154, -0.049]], 10), material(0x202626), [0, 0, 0], 'sole');
      if (boot) {
        for (const y of [-0.32, -0.28, -0.24]) {
          panel(foot, [[-0.034, y, -0.074], [0.034, y - 0.008, -0.074],
            [0.034, y - 0.015, -0.077], [-0.034, y - 0.007, -0.077]], 0x707675, 'bootLace');
        }
      }
      this.legs.push(leg); this.calves.push(calf); this.feet.push(foot);
    }
    [this.leftArm, this.rightArm] = this.arms;
    [this.leftLeg, this.rightLeg] = this.legs;

    if (this.receptionist) {
      // A shallow blouse neckline and short placket, distinct from a doctor's lapels.
      patch([[-0.086, 1.383], [0.086, 1.383], [0.063, 1.317], [0, 1.287], [-0.063, 1.317]], accent, 'blouseNeckline');
      patch([[-0.007, 1.285], [0.007, 1.285], [0.007, 1.07], [-0.007, 1.07]], 0x647e79, 'blousePlacket');
      for (const y of [1.24, 1.17, 1.10]) {
        patch([[-0.014, y], [0.014, y], [0.014, y - 0.018], [-0.014, y - 0.018]], 0xb3b8a8, 'blouseButton');
      }
      for (const side of [-1, 1]) {
        part(this.head, profile([[-0.016, 0.008, 0.008], [0.016, 0.008, 0.008]], 6),
          material(0xbfa879), [side * 0.16, -0.05, -0.005], 'earring');
      }
    } else if (kind === 'Nurse' || kind === 'Orderly' || this.patient) {
      for (const side of [-1, 1]) {
        patch([[side * 0.085, 1.42], [side * 0.11, 1.412], [side * 0.015, 1.28], [0, 1.3]], accent, 'scrubNeckBinding');
      }
    } else {
      patch([[-0.063, 1.423], [0.063, 1.423], [0.038, 1.21], [-0.038, 1.21]], doctor ? 0x566d78 : 0x29323a, 'undershirt');
      for (const side of [-1, 1]) {
        patch([[side * 0.066, 1.426], [side * 0.145, 1.35], [side * 0.085, 1.22], [side * 0.035, 1.33]], accent, 'collar');
      }
    }
    if (doctor) {
      panel(this.torso, [[-0.18, 0.92, 0.105], [0.18, 0.92, 0.105],
        [0.21, 0.61, 0.13], [-0.21, 0.61, 0.13]], clothing, 'coatBack');
      // Split coat tails let the thighs move without a solid cylindrical skirt.
      for (const side of [-1, 1]) {
        panel(this.torso, [[side * 0.015, 0.93, -0.148], [side * 0.203, 0.94, -0.095],
          [side * 0.23, 0.59, -0.125], [side * 0.055, 0.61, -0.161]], clothing, 'coatTail');
        patch([[side * 0.1, 1.12], [side * 0.181, 1.11], [side * 0.17, 1.0], [side * 0.1, 1.01]], 0xb7c3c1, 'coatPocket');
      }
    }
    if (this.protagonist) this.addBryanDetails(patch);
    else if (!this.patient) {
      patch([[-0.17, 1.25], [-0.088, 1.25], [-0.088, 1.15], [-0.17, 1.15]], 0xd4d8c7, 'staffBadge');
      patch([[-0.16, 1.22], [-0.1, 1.22], [-0.1, 1.205], [-0.16, 1.205]], 0x4f696d, 'badgeStripe');
    }
    if (this.patient) {
      part(this.head, profile([[0.082, headWidth * 1.01, headDepth * 1.01],
        [0.112, headWidth * 0.98, headDepth * 0.98]], 20), material(0xc7c6b1, 'cloth'), [0, 0, 0], 'bandage');
    }
    if (doctor) {
      for (const side of [-1, 1]) {
        patch([[side * 0.078, 1.40], [side * 0.092, 1.40], [side * 0.125, 1.10], [side * 0.106, 1.09]], 0x343f43, 'stethoscopeTube');
      }
      part(this.torso, profile([[-0.012, 0.022, 0.022], [0.012, 0.022, 0.022]], 12), material(0x9ba6a2), [0.112, 1.09, -0.14], 'stethoscope');
    }
    this.animate(0.001);
  }

  addBryanDetails(patch) {
    const knit = material(0x30333c, 'knit');
    part(this.head, profile([[0.106, 0.153, 0.145], [0.15, 0.16, 0.154],
      [0.207, 0.148, 0.145], [0.247, 0.099, 0.10], [0.258, 0.018, 0.027]], 12), knit, [0, 0, 0], 'knittedCap');
    part(this.head, profile([[0.087, 0.155, 0.149], [0.099, 0.165, 0.158],
      [0.137, 0.165, 0.158], [0.146, 0.157, 0.15]], 12), knit, [0, 0, 0], 'capCuff');
    part(this.torso, profile([[1.4, 0.115, 0.11], [1.445, 0.122, 0.118], [1.5, 0.1, 0.096]], 12),
      material(0x923c43, 'knit'), [0, 0, 0], 'scarfWrap');
    panel(this.torso, [[0.015, 1.445, -0.127], [0.12, 1.435, -0.128],
      [0.123, 1.19, -0.197], [0.092, 1.10, -0.184], [0.019, 1.12, -0.178]], 0x8b3540, 'scarfTail');
    for (const side of [-1, 1]) {
      patch([[side * 0.09, 1.12], [side * 0.20, 1.10], [side * 0.19, 0.94], [side * 0.09, 0.95]], 0x48515a, 'jacketPocket');
      patch([[side * 0.08, 1.13], [side * 0.20, 1.11], [side * 0.195, 1.085], [side * 0.085, 1.105]], 0x6b7271, 'pocketFlap');
      part(this.torso, profile([[1.375, 0.018, 0.022], [1.415, 0.028, 0.028], [1.45, 0.014, 0.018]], 8),
        material(0x4b5965, 'cloth'), [side * 0.097, 0, 0.01], 'raisedJacketCollar');
    }
    panel(this.torso, [[-0.21, 1.29, 0.148], [0.21, 1.29, 0.148],
      [0.19, 1.18, 0.178], [-0.19, 1.18, 0.178]], 0x424e5a, 'jacketBackYoke');
    patch([[-0.009, 1.36], [0.009, 1.36], [0.009, 0.88], [-0.009, 0.88]], 0x7e8583, 'zipper');
    this.medicalKit = new THREE.Group(); this.medicalKit.name = 'medicalKit'; this.body.add(this.medicalKit);
    part(this.medicalKit, profile([[0.745, 0.09, 0.058], [0.77, 0.116, 0.078],
      [0.965, 0.116, 0.078], [0.99, 0.092, 0.059]], 8), material(0x516c55, 'cloth'), [-0.335, 0, 0.02], 'medicalBag');
    panel(this.medicalKit, [[-0.441, 0.963, -0.061], [-0.23, 0.963, -0.061],
      [-0.245, 0.892, -0.064], [-0.422, 0.892, -0.064]], 0x698166, 'bagFlap');
    panel(this.medicalKit, [[0.164, 1.393, -0.147], [0.192, 1.38, -0.146],
      [-0.327, 0.92, -0.196], [-0.356, 0.932, -0.196]], 0x505849, 'bagStrap');
    panel(this.medicalKit, [[-0.453, 0.905, -0.005], [-0.453, 0.905, 0.025],
      [-0.453, 0.805, 0.025], [-0.453, 0.805, -0.005]], 0xd7d9c3, 'medicalCross');
    panel(this.medicalKit, [[-0.454, 0.869, -0.038], [-0.454, 0.869, 0.058],
      [-0.454, 0.843, 0.058], [-0.454, 0.843, -0.038]], 0xd7d9c3);
  }

  // Stable interface used by Player and NPC; only presentation changes here.
  startSigning(duration = 2) { this.signingRemaining = duration; }

  animate(dt, speed = 0, running = false, headYaw = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    this.phase += speed * dt * (running ? 3.8 : 5.4);
    this.blend = THREE.MathUtils.damp(this.blend, speed > 0.01 ? 1 : 0, 10, dt);
    const swing = Math.sin(this.phase) * this.blend;
    const amplitude = running ? 0.58 : 0.34;
    const breath = Math.sin(this.elapsed * 1.7);
    this.arms[0].rotation.x = -swing * amplitude * 0.85;
    this.arms[1].rotation.x = swing * amplitude * 0.85;
    this.legs[0].rotation.x = swing * amplitude;
    this.legs[1].rotation.x = -swing * amplitude;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      this.arms[i].position.y = this.shoulderHeight + breath * 0.0025;
      this.arms[i].rotation.z = side * (0.045 + (1 - this.blend) * breath * 0.003);
      const restingElbow = this.receptionist ? 0.65 : 0.12;
      this.forearms[i].rotation.x = restingElbow * (1 - this.blend) + (running ? 0.65 : 0.24) * this.blend;
      this.calves[i].rotation.x = -Math.max(0, i === 0 ? -swing : swing) * (running ? 0.65 : 0.4);
      this.feet[i].rotation.x = -this.calves[i].rotation.x * 0.22;
    }
    this.body.position.y = Math.abs(Math.sin(this.phase)) * (running ? 0.023 : 0.012) * this.blend;
    this.torso.scale.y = 1 + breath * 0.003;
    this.torso.scale.z = 1 + breath * 0.004;
    this.torso.rotation.y = swing * 0.035;
    this.head.rotation.y = THREE.MathUtils.damp(this.head.rotation.y, headYaw + Math.sin(this.elapsed * 0.48) * 0.035, 5, dt);
    this.head.rotation.x = Math.sin(this.elapsed * 0.72) * 0.012 + (this.receptionist ? 0.015 : 0);
    this.head.position.y = this.headHeight + breath * 0.0015;
    if (this.signingRemaining > 0) {
      this.signingRemaining = Math.max(0, this.signingRemaining - dt);
      this.arms[0].rotation.x = 1.12;
      this.forearms[0].rotation.x = 0.50 + Math.sin(this.elapsed * 15) * 0.035;
      this.forearms[0].rotation.z = Math.sin(this.elapsed * 19) * 0.055;
      this.head.rotation.x = -0.22;
    } else {
      this.forearms[0].rotation.z = 0;
    }
    if (this.pose === 'seated') {
      this.body.position.y = -0.27;
      this.torso.rotation.x = -0.065;
      this.head.position.z = -0.09; this.head.rotation.x = -0.09 + breath * 0.012;
      for (let i = 0; i < 2; i++) {
        this.arms[i].position.z = -0.08;
        this.arms[i].rotation.x = 0.22; this.forearms[i].rotation.x = 0.50;
        this.legs[i].rotation.x = Math.PI / 2; this.calves[i].rotation.x = -Math.PI / 2;
        this.calves[i].scale.y = 1.2; this.feet[i].rotation.x = 0;
      }
    } else if (this.pose === 'lying') {
      this.body.position.y = 0; this.torso.rotation.y = 0;
      this.head.rotation.y = Math.sin(this.elapsed * 0.2) * 0.018;
      this.head.rotation.x = 0;
      this.torso.scale.z = 1 + breath * 0.006;
      for (let i = 0; i < 2; i++) {
        this.arms[i].rotation.x = 0.04; this.forearms[i].rotation.x = 0.12;
        this.legs[i].rotation.x = 0; this.calves[i].rotation.x = 0; this.feet[i].rotation.x = -0.06;
      }
    } else if (this.pose === 'injured') {
      this.torso.rotation.x = -0.055;
      this.head.position.z = -0.06; this.head.rotation.x = -0.1;
      this.arms[0].rotation.x = 0.4; this.arms[0].rotation.z = -0.18;
      this.forearms[0].rotation.x = 1.3;
      this.body.position.y -= Math.abs(swing) * 0.018;
    }
  }
}
