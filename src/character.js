import * as THREE from 'three';
import { defaults } from './tuning.js';
import { applyReference } from './reference-motions.js';
import { applyFootwork } from './footwork.js';
import { applyCombatPose } from './combat-poses.js';
import { authoredMotion, applyAuthoredPose } from './animation-clips.js';

export function createCharacter(gltf) {
  const root = new THREE.Group(); root.add(gltf.scene);
  const parts = {};
  for (const name of ['Body', 'Head', 'LeftArm', 'RightArm', 'LeftForearm', 'RightForearm', 'LeftLeg', 'RightLeg', 'LeftShin', 'RightShin', 'LeftFoot', 'RightFoot']) {
    const object = gltf.scene.getObjectByName(name);
    if (object) parts[name] = { object, rotation: object.rotation.clone(), position: object.position.clone(), scale: object.scale.clone() };
  }
  const surfaces = [], weaponRoots = [];
  gltf.scene.traverse(object => {
    if (object.name.startsWith('WeaponGrip')) { weaponRoots.push(object); object.userData.restGripRotation = object.quaternion.clone(); object.userData.restGripPosition = object.position.clone(); }
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    object.material = object.material.clone();
    surfaces.push({ object, scale: object.scale.clone(), position: object.position.clone(), color: object.material.color.clone(), roughness: object.material.roughness });
  });
  const name = surfaces.some(surface => surface.object.material.name.includes('raphael')) ? 'raphael' : 'leonardo';
  return { root, parts, surfaces, name, weaponRoots };
}
export function applyAppearance(model, config, wireframe = false) {
  const reference = defaults(model.name).appearance;
  const skinTint = new THREE.Color(config.appearance.skin), maskTint = new THREE.Color(config.appearance.mask);
  for (const [tint, base] of [[skinTint, new THREE.Color(reference.skin)], [maskTint, new THREE.Color(reference.mask)]]) {
    tint.r /= base.r; tint.g /= base.g; tint.b /= base.b;
  }
  for (const { object, scale, position, color, roughness } of model.surfaces) {
    const material = object.material, name = material.name;
    material.wireframe = wireframe;
    material.color.copy(color); material.roughness = roughness;
    if (name.startsWith('Skin')) { material.color.multiply(skinTint); material.roughness = config.appearance.roughness; }
    if (name.startsWith('Bandana')) material.color.multiply(maskTint);
    object.scale.copy(scale);
    object.position.copy(position);
    if (name.startsWith('Shell')) {
      object.scale.multiplyScalar(config.appearance.shellScale);
      const center = new THREE.Vector3(0, .48, -.35);
      object.position.sub(center).multiplyScalar(config.appearance.shellScale).add(center);
    }
  }
}
export function poseCharacter(model, fighter, time, config) {
  const { root, parts } = model, settings = config.pose;
  root.position.set(fighter.x, fighter.y, 0); root.rotation.set(0, fighter.facing * settings.stance, 0);
  for (const part of Object.values(parts)) { part.object.rotation.copy(part.rotation); part.object.position.copy(part.position); part.object.scale.copy(part.scale); }
  for (const weapon of model.weaponRoots) { weapon.quaternion.copy(weapon.userData.restGripRotation); weapon.position.copy(weapon.userData.restGripPosition); }
  if (parts.Head) parts.Head.object.scale.multiplyScalar(config.appearance.headScale);
  if (parts.Body) parts.Body.object.scale.x *= config.appearance.bodyWidth;
  const swing = Math.abs(fighter.speed) > .1 ? Math.sin(time * settings.walkFrequency) * settings.walkAmplitude * .15 : 0;
  if (parts.Body) { parts.Body.object.position.y += Math.sin(time * 3) * settings.idleBob; parts.Body.object.rotation.z -= fighter.facing * fighter.speed * .012; }
  if (parts.LeftArm) parts.LeftArm.object.rotation.x -= settings.guard + swing * .4;
  if (parts.RightArm) parts.RightArm.object.rotation.x -= settings.guard + .15 - swing * .4;
  if (parts.LeftForearm) parts.LeftForearm.object.rotation.x -= 1.25;
  if (parts.RightForearm) parts.RightForearm.object.rotation.x -= 1.25;
  if (fighter.attack && fighter.attack.type !== 'strike') {
    const a = fighter.attack, age = a.duration - a.remaining;
    let arc;
    if (age < a.startup) arc = -.22 * Math.sin(age / a.startup * Math.PI / 2);
    else if (age <= a.startup + a.active) arc = -.22 + 1.22 * (age - a.startup) / a.active;
    else arc = Math.max(0, 1 - (age - a.startup - a.active) / (a.duration - a.startup - a.active));
    if (parts.RightArm) { parts.RightArm.object.rotation.x -= arc * settings.attackArc; parts.RightArm.object.rotation.z -= arc * .7; }
    if (parts.Body) parts.Body.object.rotation.y += arc * settings.bodyTwist;
  }
  applyCombatPose(model, fighter, settings);
  if (fighter.stun > 0 && !fighter.blockStun && parts.Body) parts.Body.object.rotation.z += fighter.facing * .2;
  if (fighter.health <= 0 && parts.Body) parts.Body.object.rotation.z += fighter.facing * .75;
  applyFootwork(model, fighter, time, settings);
  if (fighter.reference) applyReference(model, fighter.reference.id, fighter.reference.progress, config);
  applyAuthoredPose(model, authoredMotion(model, fighter, time), fighter, settings.stance);
}
