// Original synthesized effect, unlocked only by an actual user gesture.
export class GameAudio {
  constructor(settings) {
    this.settings = settings;
    const unlock = () => {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.context ||= new Context();
      this.context.resume().catch(() => {});
    };
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
  }
  playCue(name) {
    const ctx = this.context;
    if (!this.settings.sound || !ctx || ctx.state !== 'running') return () => {};
    name = ({ branches: 'distant_branches', distant_wind: 'winter_wind', injured_breathing: 'injured_breath',
      tires_snow: 'snow_footsteps' })[name] || name;
    if (name === 'title_theme' || name === 'combat_tension') {
      // Original D minor/add9 motif and sparse voicings; no sampled game music.
      const sources = [], tension = name === 'combat_tension';
      const chords = tension ? [[73.42, 77.78]] : [[73.42, 110, 164.81], [65.41, 98, 146.83], [58.27, 87.31, 130.81], [55, 82.41, 116.54]];
      chords.forEach((chord, index) => chord.forEach((frequency, voice) => {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        const start = ctx.currentTime + (tension ? 0 : index * 5), duration = tension ? 12 : 7;
        oscillator.type = voice === 0 ? 'sine' : 'triangle'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(tension ? 0.006 : 0.009 + index * 0.004, start + 2);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + duration);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); }; sources.push(oscillator);
      }));
      return () => sources.forEach(source => { try { source.stop(); } catch {} });
    }
    if (['radio_static', 'handgun_shot', 'enemy_impact', 'metal_hit', 'engine_fail'].includes(name)) {
      const shot = name === 'handgun_shot', radio = name === 'radio_static', engine = name === 'engine_fail';
      const duration = radio ? 2.2 : engine ? 1.8 : shot ? 0.28 : 0.22;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * (shot ? Math.exp(-t * 25) : engine ? (0.4 + 0.6 * Math.sin(t * 46) ** 2) * (1 - t / duration) : Math.sin(Math.PI * t / duration));
      }
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer; filter.type = radio ? 'bandpass' : 'lowpass';
      filter.frequency.value = radio ? 2300 : engine ? 220 : shot ? 4800 : 850;
      gain.gain.value = shot ? 0.30 : radio ? 0.035 : 0.09;
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start();
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      return () => { try { source.stop(); } catch {} };
    }
    if (name === 'police_siren' || name === 'engine') {
      const gain = ctx.createGain(), oscillator = ctx.createOscillator();
      const siren = name === 'police_siren', duration = 3;
      oscillator.type = siren ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(siren ? 540 : 65, ctx.currentTime);
      if (siren) for (let i = 1; i <= 6; i++) oscillator.frequency.linearRampToValueAtTime(i % 2 ? 820 : 540, ctx.currentTime + i * 0.5);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(siren ? 0.045 : 0.018, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(siren ? 0.045 : 0.018, ctx.currentTime + duration - 0.2);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + duration);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      return () => { try { oscillator.stop(); } catch {} };
    }
    if (['winter_wind', 'forest_wind', 'forest_ambient', 'forest_breathing', 'snow_footsteps', 'distant_branches', 'injured_breath', 'engine_start'].includes(name)) {
      const step = name === 'snow_footsteps', branch = name === 'distant_branches';
      const duration = step ? 0.18 : branch ? 0.45 : name === 'injured_breath' || name === 'forest_breathing' ? 1.6 : name === 'engine_start' ? 2 : 7;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / data.length);
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer; filter.type = 'lowpass';
      filter.frequency.value = step ? 1800 : branch ? 650 : name === 'engine_start' ? 130 : 360;
      gain.gain.value = name === 'forest_ambient' || name === 'forest_breathing' ? 0.009 : step ? 0.075 : branch ? 0.022 : 0.055;
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start();
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      return () => { try { source.stop(); } catch {} };
    }
    const ambient = name === 'hospital_ambient', step = name === 'footsteps';
    const duration = ambient ? 10 : step ? 0.09 : 0.4;
    const gain = ctx.createGain(), oscillator = ctx.createOscillator();
    oscillator.type = ambient ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(ambient ? 60 : step ? 130 : name === 'door_open' ? 180 : 90, ctx.currentTime);
    gain.gain.setValueAtTime(ambient ? 0.012 : step ? 0.024 : 0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    return () => { try { oscillator.stop(); } catch {} };
  }
  impact() {
    const ctx = this.context;
    if (!this.settings.sound || !ctx || ctx.state !== 'running') return;
    const gain = ctx.createGain(), oscillator = ctx.createOscillator();
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(90, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + 0.5);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
