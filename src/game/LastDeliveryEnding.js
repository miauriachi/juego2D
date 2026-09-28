import { CreditsSequence } from './CreditsSequence.js';

const RESULT_ART = new URL('../../assets/endings/last_delivery.webp', import.meta.url).href;

function formatTime(totalSeconds) {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

// Alternate ending AFTER the shared parking-lot departure.
// Flow: ending title -> credits -> supplied artwork + run statistics.
export class LastDeliveryEnding {
  constructor(container, input, runStats) {
    this.input = input;
    this.phase = 'title';
    this.time = 0;
    this.finalStats = runStats.finish();

    this.overlay = document.createElement('section');
    this.overlay.className = 'ending-overlay';
    this.overlay.setAttribute('aria-live', 'polite');
    container.append(this.overlay);
    this.showText(['RE NOCHE CERO', 'FINAL ALTERNATIVO', '«ÚLTIMA ENTREGA»']);

    this.results = document.createElement('section');
    this.results.className = 'ending-results';
    this.results.hidden = true;

    const image = document.createElement('img');
    image.className = 'ending-results__image';
    image.src = RESULT_ART;
    image.alt = 'Bryan y su pareja en casa después de su última entrega.';

    const panel = document.createElement('div');
    panel.className = 'ending-results__panel';

    const title = document.createElement('h2');
    title.textContent = 'RESULTADOS';

    const stats = document.createElement('dl');
    const rows = [
      ['TIEMPO', formatTime(this.finalStats.elapsedSeconds)],
      ['GUARDADOS', String(this.finalStats.saves)],
      ['OBJETOS CURATIVOS', String(this.finalStats.healingItemsUsed)],
    ];
    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      stats.append(dt, dd);
    }

    const rankLabel = document.createElement('p');
    rankLabel.className = 'ending-results__rank-label';
    rankLabel.textContent = 'RANGO';

    const rank = document.createElement('strong');
    rank.className = 'ending-results__rank';
    rank.textContent = this.finalStats.rank;

    const help = document.createElement('small');
    help.textContent = 'Gracias por jugar RE NOCHE CERO';

    panel.append(title, stats, rankLabel, rank, help);
    this.results.append(image, panel);
    container.append(this.results);

    this.credits = new CreditsSequence(container, input, () => this.showResults());
  }

  showText(lines) {
    this.overlay.replaceChildren(...lines.map(text => {
      const line = document.createElement('p');
      line.textContent = text;
      return line;
    }));
  }

  showResults() {
    this.phase = 'results';
    this.overlay.hidden = true;
    this.results.hidden = false;
    this.input.clearFrameState();
  }

  update(dt) {
    if (this.phase === 'credits') {
      this.credits.update(dt);
      return;
    }
    if (this.phase === 'results') return;

    this.time += dt;
    if (this.phase === 'title' && this.time >= 4) {
      this.phase = 'credits';
      this.overlay.hidden = true;
      this.credits.start();
    }
  }

  render() {}

  onResize() {}
}
