import * as THREE from 'three';
import { SnowRoad } from '../levels/SnowRoad.js';
import { CreditsSequence } from './CreditsSequence.js';
const resultImage = new URL('../../assets/endings/last_delivery.webp', import.meta.url).href;

// Alternate ending. It can either play its legacy road departure or start after
// the shared hospital parking-lot departure animation has already finished.
export class LastDeliveryEnding {
  constructor(container, input, { skipDeparture = false, stats = null } = {}) {
    this.input = input;
    this.stats = stats || {
      timeText: '00:00:00',
      saves: 0,
      healingItemsUsed: 0,
      rank: 'C',
    };
    this.phase = skipDeparture ? 'title' : 'boarding';
    this.time = 0;

    this.overlay = document.createElement('section');
    this.overlay.className = 'ending-overlay';
    this.overlay.style.opacity = skipDeparture ? '1' : '0';
    this.overlay.setAttribute('aria-live', 'polite');
    container.append(this.overlay);

    if (skipDeparture) {
      this.showText(['RE NOCHE CERO', 'FINAL ALTERNATIVO', '«ÚLTIMA ENTREGA»']);
    }

    this.credits = new CreditsSequence(container, input, () => {
      this.phase = 'finished';
      this.overlay.style.opacity = '1';
      this.showResults();
    });
  }

  buildDeparture() {
    this.road = new SnowRoad({ cinematic: true });
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 240);
    this.camera.position.set(16, 8, 24);
    this.camera.lookAt(-2, 1, -24);

    const facade = new THREE.Mesh(
      new THREE.BoxGeometry(14, 6, 8),
      new THREE.MeshLambertMaterial({ color: 0x56656c }),
    );
    facade.position.set(-14, 3, 5);
    this.road.scene.add(facade);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(14.4, 0.22, 8.4),
      new THREE.MeshLambertMaterial({ color: 0xb1c1ce }),
    );
    roof.position.set(-14, 6.1, 5);
    this.road.scene.add(roof);

    const windowGeometry = new THREE.BoxGeometry(1.4, 1.35, 0.06);
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x92a9ae });
    for (const x of [-19, -16, -12, -9]) {
      const window = new THREE.Mesh(windowGeometry, windowMaterial);
      window.position.set(x, 3.6, 9.04);
      this.road.scene.add(window);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#263c43';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#d5e2df';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HOSPITAL', 256, 66);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 1.3),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    sign.position.set(-14, 5.25, 9.05);
    this.road.scene.add(sign);
    this.road.scene.fog.near = 38;
    this.road.scene.fog.far = 105;
  }

  showText(lines) {
    this.overlay.classList.remove('ending-results');
    this.overlay.replaceChildren(...lines.map(text => {
      const line = document.createElement('p');
      line.textContent = text;
      return line;
    }));
  }

  showResults() {
    this.overlay.classList.add('ending-results');

    const image = document.createElement('img');
    image.className = 'ending-results__image';
    image.src = resultImage;
    image.alt = 'Bryan y su pareja en casa durante una noche lluviosa.';

    const info = document.createElement('div');
    info.className = 'ending-results__info';

    const kicker = document.createElement('p');
    kicker.className = 'ending-results__kicker';
    kicker.textContent = 'FINAL ALTERNATIVO';

    const title = document.createElement('h1');
    title.textContent = 'ÚLTIMA ENTREGA';

    const stats = document.createElement('dl');
    stats.className = 'ending-results__stats';

    const rows = [
      ['TIEMPO', this.stats.timeText],
      ['GUARDADOS', String(this.stats.saves)],
      ['OBJETOS CURATIVOS', String(this.stats.healingItemsUsed)],
    ];
    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      stats.append(dt, dd);
    }

    const rankLabel = document.createElement('p');
    rankLabel.className = 'ending-results__rank-label';
    rankLabel.textContent = 'RANGO';

    const rank = document.createElement('strong');
    rank.className = 'ending-results__rank';
    rank.textContent = this.stats.rank;

    const thanks = document.createElement('small');
    thanks.textContent = 'THANK YOU FOR PLAYING';

    info.append(kicker, title, stats, rankLabel, rank, thanks);
    this.overlay.replaceChildren(image, info);
  }

  update(dt) {
    if (this.phase === 'credits') {
      this.credits.update(dt);
      return;
    }
    if (this.phase === 'finished') return;

    this.time += dt;

    if (this.phase === 'boarding') {
      this.overlay.style.opacity = String(Math.min(1, this.time / 1.2));
      if (this.time >= 1.2) {
        this.buildDeparture();
        this.phase = 'departure';
        this.time = 0;
      }
    } else if (this.phase === 'departure') {
      this.overlay.style.opacity = String(
        this.time < 1 ? 1 - this.time : Math.max(0, (this.time - 13) / 1.5),
      );
      const s = 2 + this.time * 4 + this.time * this.time * 0.32;
      const car = this.road.vehicle.group;
      car.position.set(this.road.centerX(s), 0, -s);
      car.rotation.y = -Math.atan(this.road.tangentX(s));
      for (const wheel of car.userData.wheels) {
        wheel.tire.rotation.x -= (4 + this.time * 0.64) * dt / 0.34;
      }
      this.road.snowfall.update(dt, this.camera.position);
      if (this.time >= 14.5) {
        this.phase = 'title';
        this.time = 0;
        this.overlay.style.opacity = '1';
        this.showText(['RE NOCHE CERO', 'FINAL ALTERNATIVO', '«ÚLTIMA ENTREGA»']);
      }
    } else if (this.phase === 'title' && this.time >= 4) {
      this.overlay.replaceChildren();
      this.phase = 'credits';
      this.credits.start();
    }
  }

  render(renderer, exteriorScene, exteriorCamera) {
    if (this.phase === 'boarding') renderer.render(exteriorScene, exteriorCamera);
    else if (this.phase === 'departure') renderer.render(this.road.scene, this.camera);
  }

  onResize() {
    if (this.camera) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }
  }
}
