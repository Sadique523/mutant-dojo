export const STORAGE_KEY = 'mutant-dojo:tuning:v1';
export const CHARACTER_NAMES = ['leonardo', 'raphael'];
export const LIMITS = {
  speed: [1, 8], jumpVelocity: [3, 12], gravity: [8, 35],
  idleBob: [0, .1], walkAmplitude: [0, .9], walkFrequency: [4, 22], stance: [0, 1.57], guard: [0, 1.5], attackArc: [.2, 2.6], bodyTwist: [0, .8],
  headScale: [.7, 1.3], bodyWidth: [.7, 1.3], shellScale: [.7, 1.3], roughness: [.15, 1],
  startupFrames: [1, 40], activeFrames: [1, 60], recoveryFrames: [1, 60], damage: [1, 40], range: [1.2, 3.5], stunFrames: [1, 40], push: [0, 1.5],
  poseIntensity: [.5, 1.4], elbowOffset: [-1, 1], kneeOffset: [-.5, .8], leanOffset: [-.3, .3],
};
export function defaults(name = 'leonardo') {
  return {
    movement: { speed: 3.8, jumpVelocity: 7.2, gravity: 20 },
    pose: { idleBob: .025, walkAmplitude: .38, walkFrequency: 13, stance: .85, guard: .75, attackArc: 1.7, bodyTwist: .35 },
    reference: { poseIntensity: 1, elbowOffset: 0, kneeOffset: 0, leanOffset: 0 },
    appearance: { headScale: 1, bodyWidth: 1, shellScale: 1, roughness: .7, skin: '#729549', mask: name === 'leonardo' ? '#2479cf' : '#bf352c' },
    attacks: {
      strike: { startupFrames: 7, activeFrames: 6, recoveryFrames: 12, damage: 8, range: 1.85, stunFrames: 11, push: .3 },
      heavy: { startupFrames: 17, activeFrames: 8, recoveryFrames: 20, damage: 17, range: 2.2, stunFrames: 19, push: .6 },
      kick: { startupFrames: 12, activeFrames: 7, recoveryFrames: 20, damage: 12, range: 2.05, stunFrames: 16, push: .45 },
      spinKick: { startupFrames: 24, activeFrames: 8, recoveryFrames: 28, damage: 21, range: 2.3, stunFrames: 23, push: .8 },
      blueFlame: { startupFrames: 12, activeFrames: 18, recoveryFrames: 15, damage: 8, range: 2.5, stunFrames: 26, push: .10 },
    },
  };
}
export function normalize(raw, name = 'leonardo') {
  const result = defaults(name);
  function merge(target, input) {
    for (const key of Object.keys(target)) {
      const value = input?.[key];
      if (typeof target[key] === 'object') merge(target[key], value);
      else if (typeof target[key] === 'number' && typeof value === 'number' && Number.isFinite(value)) {
        const [min, max] = LIMITS[key];
        target[key] = Math.max(min, Math.min(max, /Frames$/.test(key) || key === 'damage' ? Math.round(value) : value));
      } else if (typeof target[key] === 'string' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) target[key] = value;
    }
  }
  merge(result, raw); return result;
}
export function parsePreset(raw) {
  if (!raw || raw.version !== 1 || !raw.characters || !CHARACTER_NAMES.every(name => raw.characters[name] && typeof raw.characters[name] === 'object')) throw new Error('Expected a version 1 Mutant Dojo preset containing both characters.');
  return Object.fromEntries(CHARACTER_NAMES.map(name => [name, normalize(raw.characters[name], name)]));
}
export function loadSettings(storage) {
  try { const target = storage ?? globalThis.localStorage; const raw = target?.getItem(STORAGE_KEY); if (raw) return parsePreset(JSON.parse(raw)); } catch { /* Storage may be unavailable or the saved preset may be invalid. */ }
  return Object.fromEntries(CHARACTER_NAMES.map(name => [name, defaults(name)]));
}
export function serializePreset(settings) { return JSON.stringify({ version: 1, characters: Object.fromEntries(CHARACTER_NAMES.map(name => [name, normalize(settings[name], name)])) }, null, 2); }
export function attackSpec(settings, type) {
  const move = settings.attacks[type];
  return { duration: (move.startupFrames + move.activeFrames + move.recoveryFrames) / 60, startup: move.startupFrames / 60, active: move.activeFrames / 60, damage: move.damage, range: move.range, stun: move.stunFrames / 60, push: move.push };
}
export function attackPhase(attack) {
  if (!attack) return 'idle';
  const age = attack.duration - attack.remaining;
  return age + 1e-8 < attack.startup ? 'startup' : age + 1e-8 < attack.startup + attack.active ? 'active' : 'recovery';
}
