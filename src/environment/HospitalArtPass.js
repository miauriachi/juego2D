import * as THREE from 'three';

// Interior dressing only: no colliders, actor transforms, interaction anchors or state.
// Called after each interior is built, never by HospitalExterior's inherited helpers.
export function applyHospitalArtPass(level, emergency = false) {
  const { scene } = level;
  const group = new THREE.Group(); group.name = 'hospital-art-pass'; scene.add(group);
  const matte = color => new THREE.MeshLambertMaterial({ color });
  const trim = matte(0x34443e), metal = matte(0x727e77), paper = matte(0xc7bea2);
  const dark = matte(0x202a28), folder = matte(0x796b4e);
  const box = (size, position, material = trim, parent = group) => level.createBox(size, position, material, parent);
  const texture = (paint, w = 256, h = 256) => {
    const map = level.createCanvasTexture(paint, w, h);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter; map.anisotropy = 1;
    return map;
  };

  // Clone materials locally: exterior helpers and characters keep their own appearance.
  const replacements = new Map();
  scene.traverse(object => {
    if (!object.isMesh || object.parent === group) return;
    for (let parent = object; parent; parent = parent.parent)
      if (parent === level.player.group || parent.name.startsWith('npc:')) return;
    const convert = original => {
      if (!original.isMeshStandardMaterial) return original;
      if (!replacements.has(original)) {
        const copy = original.clone(); copy.roughness = 1; copy.metalness = 0;
        if (copy.map) {
          copy.map = copy.map.clone(); copy.map.magFilter = THREE.NearestFilter;
          copy.map.anisotropy = 1; copy.map.needsUpdate = true;
        }
        replacements.set(original, copy);
      }
      return replacements.get(original);
    };
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
  });

  const wallMap = texture((c, w, h) => {
    // Use low-frequency, non-grid grime. Dense 1px speckles repeated every couple of
    // metres were aliasing at the fixed-camera angles and reading as black lines.
    let seed = 8317;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    c.fillStyle = '#c7c2aa'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#4f705d'; c.fillRect(0, h * .61, w, h * .39);
    c.fillStyle = '#2f493d'; c.fillRect(0, h * .595, w, 7);
    c.fillStyle = '#26352f'; c.fillRect(0, h * .94, w, h * .06);

    // Broad translucent smudges preserve the worn hospital look without moire.
    for (let i = 0; i < 95; i++) {
      const x = random() * w, y = random() * h;
      const rw = 3 + random() * 18, rh = 2 + random() * 14;
      c.fillStyle = i % 3 ? '#233a2b12' : '#fff0c715';
      c.fillRect(x, y, rw, rh);
    }
    for (let i = 0; i < 22; i++) {
      c.fillStyle = '#263d2f1c';
      c.fillRect(4 + random() * (w - 8), h * (.66 + random() * .22), 1 + random() * 2, 7 + random() * 24);
    }
    c.strokeStyle = '#f1dfbf35';
    for (let i = 0; i < 18; i++) {
      const x = 5 + random() * (w - 24), y = h * (.67 + random() * .23);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4 + random() * 11, y + random() * 2); c.stroke();
    }
  }, 512, 512);
  // Walls are viewed at steep angles in several fixed cameras. Linear filtering +
  // a little anisotropy prevents the dirt map from collapsing into dark scan-lines.
  wallMap.magFilter = THREE.LinearFilter;
  wallMap.minFilter = THREE.LinearMipmapLinearFilter;
  wallMap.anisotropy = 4;
  // World-aligned UVs keep the painted band at one height across wall segments
  // and lintels. Clone shared box geometry before editing UVs, never positions.
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || !o.material?.map || !level.wallTexture) return;
    if (o.material.map.source !== level.wallTexture.source) return;
    const map = wallMap.clone();
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.anisotropy = 4;
    const geometry = o.geometry.clone(), uv = geometry.attributes.uv;
    const vertex = new THREE.Vector3(), normal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < uv.count; i++) {
      vertex.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(o.matrixWorld);
      normal.fromBufferAttribute(geometry.attributes.normal, i).applyMatrix3(normalMatrix);
      const horizontal = Math.abs(normal.x) > Math.abs(normal.z) ? vertex.z : vertex.x;
      // One horizontal repeat every ~6 m keeps detail without obvious periodic bands.
      uv.setXY(i, horizontal / 6, vertex.y / 3.2);
    }
    uv.needsUpdate = true; o.geometry = geometry; o.material.map = map;
  });

  const poster = (title, subtitle, position, yaw = 0, width = .7, height = .95, accent = '#496759') => {
    const map = texture((c, w, h) => {
      c.fillStyle = '#c9c4ab'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#655f4a'; c.lineWidth = 3; c.strokeRect(5, 5, w - 10, h - 10);
      c.fillStyle = accent; c.fillRect(12, 13, w - 24, 48);
      c.fillStyle = '#e6dfc7'; c.font = 'bold 20px monospace'; c.textAlign = 'center';
      c.fillText(title, w / 2, 43, w - 35);
      c.fillStyle = accent; c.fillRect(w / 2 - 10, 81, 20, 54); c.fillRect(w / 2 - 27, 98, 54, 20);
      c.fillStyle = '#36453d'; c.font = 'bold 14px monospace'; c.fillText(subtitle, w / 2, 162, w - 28);
      for (let i = 0; i < 5; i++) c.fillRect(25, 181 + i * 9, w - 50 - i % 3 * 18, 2);
      c.fillStyle = '#534b3025'; c.fillRect(8, h - 17, w - 16, 5);
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }));
    mesh.name = 'hospital-poster:' + title; mesh.position.fromArray(position); mesh.rotation.y = yaw; group.add(mesh);
    return mesh;
  };
  const clock = (position, yaw = 0) => {
    const map = texture((c, w, h) => {
      c.fillStyle = '#252f2c'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c5c5b2'; c.beginPath(); c.arc(64, 64, 57, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#303c35'; c.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6; c.beginPath();
        c.moveTo(64 + Math.sin(a) * 47, 64 - Math.cos(a) * 47);
        c.lineTo(64 + Math.sin(a) * 53, 64 - Math.cos(a) * 53); c.stroke();
      }
      c.lineWidth = 5; c.beginPath(); c.moveTo(44, 49); c.lineTo(64, 64); c.lineTo(72, 22); c.stroke();
    }, 128, 128);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.52, .52), new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }));
    mesh.position.fromArray(position); mesh.rotation.y = yaw; group.add(mesh);
  };
  const rail = (x, z, length, yaw = 0) => {
    const assembly = new THREE.Group(); assembly.position.set(x, 0, z); assembly.rotation.y = yaw; group.add(assembly);
    box([length, .11, .045], [0, .92, 0], trim, assembly);
    box([length, .025, .055], [0, .98, 0], metal, assembly);
  };
  const folders = (x, y, z, count = 5) => {
    for (let i = 0; i < count; i++) {
      box([.055, .28 + i % 2 * .02, .22], [x + i * .065, y + .14, z], i % 2 ? folder : trim);
      box([.034, .08, .005], [x + i * .065, y + .17, z - .113], paper);
    }
  };
  const tray = (x, y, z) => {
    box([.32, .025, .25], [x, y, z], metal);
    for (let i = 0; i < 4; i++) box([.25, .008, .20], [x + i * .006, y + .018 + i * .01, z], paper);
  };
  const stainMap = texture((c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 190; i++) {
      c.fillStyle = i % 2 ? '#202b2216' : '#70614310';
      c.fillRect((i * 71 + i * i * 7) % w, (i * 43 + i * i * 3) % h, 1 + i % 5, 1);
    }
  }, 128, 128);
  const wear = (x, z, width, depth) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: stainMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .024, z); group.add(mesh);
  };

  // --- ART PASS 02: use the generated Nano Banana art as real in-game assets. ---
  const loader = new THREE.TextureLoader();
  const imagePanel = (url, position, yaw, width, height, frame = true) => {
    const holder = new THREE.Group();
    holder.position.fromArray(position); holder.rotation.y = yaw; group.add(holder);
    if (frame) {
      box([width + .09, height + .09, .035], [0, 0, .018], dark, holder);
      box([width + .035, height + .035, .018], [0, 0, -.002], paper, holder);
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0xd8d3be, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    plane.position.z = .042; holder.add(plane);
    loader.load(url, map => {
      map.colorSpace = THREE.SRGBColorSpace;
      map.magFilter = THREE.LinearFilter;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.anisotropy = 4;
      mat.map = map; mat.color.setHex(0xffffff); mat.needsUpdate = true;
    });
    return holder;
  };

  // Replace the old very dark green floor with warm grey-beige hospital tiles.
  // This affects the visible plane only; the floor collider/base is untouched.
  const floorMap = texture((c, w, h) => {
    c.fillStyle = '#a9a695'; c.fillRect(0, 0, w, h);
    const tile = w / 4;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const n = ((row * 7 + col * 11) % 5) - 2;
      const base = 174 + n * 3;
      c.fillStyle = `rgb(${base},${base + 1},${base - 9})`;
      c.fillRect(col * tile + 3, row * tile + 3, tile - 6, tile - 6);
      c.strokeStyle = 'rgba(62,67,58,.38)'; c.lineWidth = 2;
      c.strokeRect(col * tile + 2, row * tile + 2, tile - 4, tile - 4);
    }
    for (let i = 0; i < 120; i++) {
      const x = (i * 83 + i * i * 13) % w, y = (i * 47 + i * i * 5) % h;
      c.fillStyle = i % 3 ? 'rgba(55,57,48,.08)' : 'rgba(92,77,54,.07)';
      c.fillRect(x, y, 2 + i % 8, 1 + i % 3);
    }
  }, 512, 512);
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(12, 8);
  floorMap.magFilter = THREE.LinearFilter; floorMap.minFilter = THREE.LinearMipmapLinearFilter; floorMap.anisotropy = 4;
  const tiledFloor = scene.getObjectByName('tiled-floor');
  if (tiledFloor?.material) { tiledFloor.material.map = floorMap; tiledFloor.material.color.setHex(0xffffff); tiledFloor.material.roughness = .94; tiledFloor.material.needsUpdate = true; }
  const emergencyFloor = scene.getObjectByName('tiled-floor-urgencias');
  if (emergencyFloor?.material) {
    const emergencyMap = floorMap.clone(); emergencyMap.repeat.set(11, 19); emergencyMap.needsUpdate = true;
    emergencyFloor.material.map = emergencyMap; emergencyFloor.material.color.setHex(0xffffff); emergencyFloor.material.roughness = .94; emergencyFloor.material.needsUpdate = true;
  }

  const deskWoodMap = texture((c, w, h) => {
    c.fillStyle = '#694f36'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 14) {
      c.fillStyle = x % 28 ? '#765a3c' : '#563f2f'; c.fillRect(x, 0, 2, h);
      c.fillStyle = 'rgba(221,189,132,.10)'; c.fillRect(x + 5, 0, 1, h);
    }
    for (let i = 0; i < 32; i++) {
      c.strokeStyle = i % 2 ? 'rgba(38,28,20,.18)' : 'rgba(211,176,116,.10)';
      c.beginPath(); const y = (i * 37) % h; c.moveTo(0, y); c.bezierCurveTo(w*.25, y+6, w*.65, y-5, w, y+2); c.stroke();
    }
  }, 512, 256);

  if (!emergency) {
    // Keep the original single procedural noticeboard in 3D views. The generated
    // reference board is already baked into the pre-rendered lobby plates, so adding
    // it again here produced the obvious 'board inside a board' effect.
    imagePanel('assets/textures/hospital/organic_samples_poster.png', [-11.84, 1.72, -2.15], Math.PI / 2, .78, .98, true);

    // Give the reception desk a much more readable late-90s wood facade without changing its collider.
    const deskFace = new THREE.Mesh(
      new THREE.PlaneGeometry(6.02, .82),
      new THREE.MeshLambertMaterial({ map: deskWoodMap, side: THREE.DoubleSide })
    );
    deskFace.position.set(-6, .57, .574); deskFace.rotation.y = Math.PI; deskFace.name = 'reception-wood-facade'; group.add(deskFace);
    // Recessed front panels + metal kickplate create the visual depth seen in the references.
    for (const x of [-8.25, -6.75, -5.25, -3.75]) {
      box([1.22, .60, .025], [x, .55, .558], dark);
      const inset = new THREE.Mesh(new THREE.PlaneGeometry(1.10, .49), new THREE.MeshLambertMaterial({ map: deskWoodMap }));
      inset.position.set(x, .55, .542); inset.rotation.y = Math.PI; group.add(inset);
    }
    box([6.10, .12, .06], [-6, .12, .54], metal);

    // Architectural dressing inspired by the generated reception/entrance references.
    // Everything stays wall-mounted or inside existing furniture footprints.
    box([7.05, .18, .28], [-6, 2.95, 2.56], dark);
    box([3.0, .13, .18], [0, 2.72, 7.72], dark);
    box([2.92, .065, .16], [0, 2.60, 7.70], paper);
    for (const x of [-10.9, -8.9, -6.9]) {
      box([1.35, .07, .20], [x, 3.03, 4.95], dark);
      box([1.18, .035, .055], [x, 2.99, 4.95], new THREE.MeshLambertMaterial({ color: 0xe4eee0, emissive: 0xa8c5b7, emissiveIntensity: .75 }));
    }
    // Slightly chunky door trims make the entrances read in the fixed cameras.
    for (const x of [-1.58, 1.58]) box([.11, 2.58, .20], [x, 1.29, 7.79], dark);

    // Thin wall-mounted details and surface dressing leave all navigation clear.
    for (const x of [-1.52, 1.52]) box([.12, 2.48, .19], [x, 1.24, 7.79], metal);
    box([3.2, .13, .2], [0, 2.51, 7.79], trim);
    box([3.08, .035, .18], [0, .035, 7.7], metal);
    for (const x of [-3.85, 3.85]) rail(x, 7.84, 4.3);
    poster('ADMISIÓN', 'INFORMES EN RECEPCIÓN', [2.6, 1.85, 7.85], Math.PI, .72, 1);
    poster('VISITAS', 'RESPETE EL SILENCIO', [-2.65, 1.85, 7.85], Math.PI, .72, 1);
    poster('URGENCIAS', 'ACCESO AUTORIZADO', [5.5, 1.85, -7.85], 0, .65, .9, '#784d3c');
    poster('PREVENCIÓN', 'LAVE SUS MANOS', [-10.05, 1.8, -7.85]);
    poster('DONACIÓN', 'BANCO DE SANGRE', [10.45, 1.8, -7.85], 0, .68, .92, '#794c40');
    clock([-7.75, 2.25, 2.58], Math.PI);
    rail(-5, -7.84, 6.3); rail(9.8, -7.84, 2.8);
    // Archive boxes stay on top of the existing filing cabinets behind the counter.
    for (const x of [-9.1, -8.35]) {
      box([.52, .28, .34], [x, 1.49, 2.28], folder);
      box([.54, .035, .36], [x, 1.645, 2.28], paper);
      box([.20, .09, .006], [x, 1.49, 2.106], paper);
    }
    folders(-4.6, 1.15, 1.19, 5); tray(-7.0, 1.15, 1.32);
    // Keypad and curled cord detail enrich the existing telephone.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++)
      box([.022, .012, .021], [-3.56 + col * .035, 1.219, .78 + row * .03], paper);
    const cord = new THREE.Mesh(new THREE.TorusGeometry(.075, .007, 4, 12), dark);
    cord.rotation.x = Math.PI / 2; cord.position.set(-3.27, 1.16, .94); group.add(cord);
    for (const x of [-8.95, -8.75]) box([.16, .018, .22], [x, .655, 5.24], folder);
    // Counter kickplate and trim use the original desk face, away from interaction anchors.
    box([6.12, .13, .025], [-6, .11, .579], dark);
    box([6.12, .035, .025], [-6, .96, .579], metal);
    wear(0, 6.6, 3, 1.8); wear(-6, -.6, 5.8, 1.4); wear(3.3, -6.5, 2.2, 1.5);
  } else {
    imagePanel('assets/textures/hospital/organic_samples_poster.png', [-10.86, 1.80, -25.5], Math.PI / 2, .78, .98, true);
    for (let row = 0; row < 3; row++) {
      const z = 1 - row * 10;
      for (const side of [-1, 1]) {
        // Rails stop before every doorway. Posters sit flush to existing walls.
        for (const offset of [-3.1, 3.1]) rail(side * 2.36, z + offset, 3.3, Math.PI / 2);
        poster(row === 1 ? 'OBSERVACIÓN' : 'HIGIENE', 'PERSONAL SANITARIO', [side * 2.37, 1.85, z - 3], -side * Math.PI / 2, .60, .8);
        poster('CONTROL', 'REGISTRO DE PACIENTES', [side * 8.6, 1.85, z - 4.87], 0, .65, .88);
        tray(side * 4.4, .90, z - 3.6);
        // Handles / pleats lie within the existing privacy screen footprint.
        if (!(row === 0 && side === 1) && !(row === 2 && side === -1)) {
          for (let i = 0; i < 12; i++) box([.018, 1.52, .01], [side * 7.7 - 1 + i * .18, 1.12, z - 2.463], metal);
        }
        wear(side * 6.6, z, 3.8, 2.7);
      }
    }
    clock([-2, 2.5, -31.86]);
    poster('GUARDIA', 'TURNO NOCTURNO', [6.5, 1.9, -31.86], 0, .8, 1.05);
    folders(4.9, 1.14, -29.45, 5); tray(3, 1.14, -29.5);
    box([.26, .08, .18], [3.55, 1.18, -29.4], dark);
    box([.30, .05, .065], [3.55, 1.245, -29.37], metal);
    const screen = texture((c, w, h) => {
      c.fillStyle = '#122920'; c.fillRect(0, 0, w, h); c.fillStyle = '#72967b';
      c.font = '12px monospace'; c.fillText('CONTROL / 02', 7, 18);
      for (let i = 0; i < 5; i++) c.fillRect(8, 28 + i * 6, 48 + i % 3 * 16, 1);
    }, 128, 64);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(.30, .20), new THREE.MeshBasicMaterial({ map: screen }));
    display.position.set(4.3, 1.33, -29.708); display.rotation.y = Math.PI; group.add(display);
    wear(0, -26.2, 3, 2); wear(0, 4.4, 2.5, 1.4);
  }
}
