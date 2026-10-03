// Original eight-bar rooftop synth groove. No external recordings or downloads.
const STEP = 60 / 112 / 4;
const ROOTS = [40, 40, 36, 36, 43, 43, 38, 38];
const MELODY = [0, null, 7, 10, null, 7, 3, null, 0, 12, null, 10, 7, null, 3, 7];
const hz = note => 440 * 2 ** ((note - 69) / 12);
export class DojoMusic {
  constructor() { this.context = null; this.enabled = false; this.volume = .25; this.timer = null; this.step = 0; }
  initialize() {
    if (this.context) return;
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) throw new Error('Web Audio is unavailable in this browser.');
    this.context = new Context();
    this.master = this.context.createGain(); this.master.gain.value = 0;
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.ratio.value = 4;
    this.master.connect(compressor); compressor.connect(this.context.destination);
    this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
    const samples = this.noise.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < samples.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; samples[i] = seed / 2147483648 - 1; }
  }
  async play() {
    this.initialize(); await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Click Music to enable audio.');
    this.enabled = true; this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .04);
    if (!this.timer) {
      this.next = this.context.currentTime + .05; this.step = 0;
      this.schedule(); this.timer = setInterval(() => this.schedule(), 80);
    }
  }
  stop() {
    this.enabled = false; clearInterval(this.timer); this.timer = null;
    if (this.context) this.master.gain.setTargetAtTime(0, this.context.currentTime, .025);
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.context && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .025);
  }
  tone(note, time, length, level, type = 'triangle', cutoff = 1400) {
    const c = this.context, oscillator = c.createOscillator(), envelope = c.createGain(), filter = c.createBiquadFilter();
    oscillator.type = type; oscillator.frequency.value = hz(note); filter.type = 'lowpass'; filter.frequency.value = cutoff;
    envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(level, time + .01);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + length);
    oscillator.connect(filter); filter.connect(envelope); envelope.connect(this.master);
    oscillator.start(time); oscillator.stop(time + length + .02);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }
  percussion(time, snare = false) {
    const c = this.context, source = c.createBufferSource(), filter = c.createBiquadFilter(), envelope = c.createGain();
    source.buffer = this.noise; filter.type = 'highpass'; filter.frequency.value = snare ? 1000 : 7000;
    envelope.gain.setValueAtTime(snare ? .20 : .05, time); envelope.gain.exponentialRampToValueAtTime(.0001, time + (snare ? .16 : .045));
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master); source.start(time); source.stop(time + .2);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }
  kick(time) {
    const c = this.context, oscillator = c.createOscillator(), envelope = c.createGain();
    oscillator.frequency.setValueAtTime(130, time); oscillator.frequency.exponentialRampToValueAtTime(42, time + .13);
    envelope.gain.setValueAtTime(.45, time); envelope.gain.exponentialRampToValueAtTime(.0001, time + .24);
    oscillator.connect(envelope); envelope.connect(this.master); oscillator.start(time); oscillator.stop(time + .25);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  schedule() {
    const c = this.context;
    if (!this.enabled || c.state !== 'running') return;
    if (this.next < c.currentTime) this.next = c.currentTime + .03;
    while (this.next < c.currentTime + .2) {
      const beat = this.step % 16, root = ROOTS[Math.floor(this.step / 16) % 8], time = this.next;
      if (beat % 4 === 0 || beat === 10) this.kick(time);
      if (beat === 4 || beat === 12) this.percussion(time, true);
      if (beat % 2 === 0) this.percussion(time);
      if (beat % 2 === 0) this.tone(root + (beat === 6 || beat === 14 ? 12 : 0), time, STEP * 1.5, .24, 'sawtooth', 450);
      if (beat === 0) for (const interval of [12, 15, 19]) this.tone(root + interval, time, STEP * 14, .035, 'triangle', 900);
      if (MELODY[beat] !== null) this.tone(root + 24 + MELODY[beat], time, STEP * 1.6, .055, 'square', 1800);
      this.step = (this.step + 1) % 128; this.next += STEP;
    }
  }
}
