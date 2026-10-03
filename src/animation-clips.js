import * as THREE from 'three';
export const ANIMATION_STORAGE = 'mutant-dojo:animation-clips:v1';
export const JOINTS = ['Body', 'Head', 'LeftArm', 'RightArm', 'LeftForearm', 'RightForearm', 'LeftLeg', 'RightLeg', 'LeftShin', 'RightShin', 'LeftFoot', 'RightFoot'];
export const CLIPS = ['idle', 'walk', 'backstep', 'jump', 'strike', 'heavy', 'block', 'crouch', 'hit', 'leo-ready', 'leo-overhead', 'leo-knee-slash', 'leo-high-kick', 'leo-airborne', 'leo-grounded'];
const vector = (value, limit) => Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit);
export function validatePose(pose) {
  if (!pose || typeof pose !== 'object' || !pose.joints) throw new Error('Pose requires joint transforms.');
  const result = { joints: {} };
  if (['LeftFoot', 'RightFoot'].includes(pose.supportFoot)) result.supportFoot = pose.supportFoot;
  for (const name of ['Root', ...JOINTS, 'LeftWeapon', 'RightWeapon']) {
    const part = pose.joints[name]; if (!part) continue;
    if (!vector(part.rotation, Math.PI * 20) || !vector(part.position, 20)) throw new Error(`Invalid ${name} transform.`);
    result.joints[name] = { rotation: [...part.rotation], position: [...part.position] };
  }
  return result;
}
export function validateClip(clip) {
  if (!Number.isInteger(clip?.frames) || clip.frames < 1 || clip.frames > 1800 || !Array.isArray(clip.keys) || clip.keys.length > 500) throw new Error('Clip needs 1–1800 frames and at most 500 keys.');
  const keys = new Map();
  for (const key of clip.keys) {
    if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame > clip.frames) throw new Error('Keyframe is outside the clip.');
    keys.set(key.frame, { frame: key.frame, pose: validatePose(key.pose), easing: ['linear', 'smooth', 'hold'].includes(key.easing) ? key.easing : 'smooth' });
  }
  const result = { frames: clip.frames, enabled: clip.enabled !== false, keys: [...keys.values()].sort((a, b) => a.frame - b.frame) };
  if (clip.effects) result.effects = clip.effects.filter(effect => effect.type === 'kickArc' && JOINTS.includes(effect.joint) && Number.isFinite(effect.startFrame) && Number.isFinite(effect.endFrame) && effect.startFrame >= 0 && effect.endFrame > effect.startFrame && effect.endFrame <= clip.frames).slice(0, 8).map(effect => ({ type: effect.type, joint: effect.joint, startFrame: effect.startFrame, endFrame: effect.endFrame }));
  return result;
}
export function parseAnimations(raw) {
  if (raw?.version !== 1 || !raw.characters) throw new Error('Expected a version 1 animation library.');
  const result = { leonardo: {}, raphael: {} };
  for (const name of Object.keys(result)) for (const id of CLIPS) if (raw.characters[name]?.[id]) result[name][id] = validateClip(raw.characters[name][id]);
  return result;
}
export function loadAnimations(storage) {
  try { const value = (storage ?? globalThis.localStorage)?.getItem(ANIMATION_STORAGE); if (value) return parseAnimations(JSON.parse(value)); } catch { /* Start with an empty library. */ }
  return { leonardo: {}, raphael: {} };
}
export function serializeAnimations(characters) { return JSON.stringify({ version: 1, characters: parseAnimations({ version: 1, characters }) }, null, 2); }
export function sampleClip(clip, frame) {
  if (!clip?.keys.length) return null;
  const keys = clip.keys;
  const decorate = pose => {
    const effects = clip.effects?.filter(effect => frame >= effect.startFrame && frame < effect.endFrame).map(effect => ({ ...effect, progress: (frame - effect.startFrame) / (effect.endFrame - effect.startFrame) }));
    if (effects?.length) pose.effects = effects; return pose;
  };
  if (frame <= keys[0].frame) return decorate(structuredClone(keys[0].pose));
  if (frame >= keys.at(-1).frame) return decorate(structuredClone(keys.at(-1).pose));
  const index = keys.findIndex(key => key.frame > frame), a = keys[index - 1], b = keys[index];
  let t = (frame - a.frame) / (b.frame - a.frame);
  if (a.easing === 'hold') t = 0;
  else if (a.easing === 'smooth') t = t * t * (3 - 2 * t);
  const result = { joints: {} };
  if (a.pose.supportFoot) result.supportFoot = a.pose.supportFoot;
  for (const name of new Set([...Object.keys(a.pose.joints), ...Object.keys(b.pose.joints)])) {
    const start = a.pose.joints[name] ?? b.pose.joints[name], end = b.pose.joints[name] ?? start;
    result.joints[name] = Object.fromEntries(['rotation', 'position'].map(field => [field, start[field].map((value, axis) => value + (end[field][axis] - value) * t)]));
  }
  return decorate(result);
}
function weaponPart(model, side) { return model.weaponRoots.find(object => object.parent === model.parts[`${side}Forearm`]?.object); }
export function capturePose(model, stance, fighter = { x: 0, y: 0 }) {
  const pose = { joints: { Root: { rotation: [model.root.rotation.x, model.root.rotation.y - stance, model.root.rotation.z], position: [model.root.position.x - fighter.x, model.root.position.y - fighter.y, model.root.position.z] } } };
  if (model.activeSupportFoot) pose.supportFoot = model.activeSupportFoot;
  for (const [name, part] of Object.entries(model.parts)) pose.joints[name] = { rotation: ['x', 'y', 'z'].map(axis => part.object.rotation[axis] - part.rotation[axis]), position: part.object.position.clone().sub(part.position).toArray() };
  for (const side of ['Left', 'Right']) {
    const weapon = weaponPart(model, side); if (!weapon) continue;
    pose.joints[`${side}Weapon`] = { rotation: [weapon.rotation.x, weapon.rotation.y, weapon.rotation.z], position: weapon.position.toArray() };
  }
  return pose;
}
export function applyAuthoredPose(model, pose, fighter, stance) {
  model.activeSupportFoot = pose?.supportFoot ?? null;
  model.activeEffects = pose?.effects ?? [];
  if (!pose) return;
  const facing = fighter.facing, mirror = values => [values[0], values[1] * facing, values[2] * facing];
  for (const [name, transform] of Object.entries(pose.joints)) {
    if (name === 'Root') {
      model.root.rotation.set(...mirror(transform.rotation), 'XYZ'); model.root.rotation.y += facing * stance;
      model.root.position.set(fighter.x + transform.position[0] * facing, fighter.y + transform.position[1], transform.position[2]);
    } else if (name.endsWith('Weapon')) {
      const object = weaponPart(model, name.replace('Weapon', '')); if (!object) continue;
      object.rotation.set(...mirror(transform.rotation), 'XYZ'); object.position.fromArray(transform.position);
    } else {
      const part = model.parts[name]; if (!part) continue;
      const rotation = mirror(transform.rotation);
      part.object.rotation.set(part.rotation.x + rotation[0], part.rotation.y + rotation[1], part.rotation.z + rotation[2], part.rotation.order);
      part.object.position.copy(part.position).add({ x: transform.position[0], y: transform.position[1], z: transform.position[2] });
    }
  }
  const foot = model.parts[pose.supportFoot]?.object;
  if (foot) {
    model.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(foot);
    if (!bounds.isEmpty()) model.root.position.y += fighter.y - .02 - bounds.min.y;
  }
}
export function authoredMotion(model, fighter, time) {
  const id = fighter.animationPlayback?.clip ?? (fighter.reference?.id || fighter.attack?.type || (fighter.stun > 0 && !fighter.blockStun ? 'hit' : fighter.crouching ? 'crouch' : fighter.blocking ? 'block' : fighter.y > 0 ? 'jump' : Math.abs(fighter.speed) > .1 ? fighter.speed * fighter.facing < 0 ? 'backstep' : 'walk' : 'idle'));
  const clip = model.animations?.[id]; if (!clip?.enabled || !clip.keys.length) return null;
  let frame;
  if (fighter.animationPlayback) frame = fighter.animationPlayback.frame;
  else if (fighter.reference) frame = fighter.reference.progress * clip.frames;
  else if (fighter.attack) frame = (fighter.attack.duration - fighter.attack.remaining) / fighter.attack.duration * clip.frames;
  else frame = time * 60 % clip.frames;
  return sampleClip(clip, frame);
}
