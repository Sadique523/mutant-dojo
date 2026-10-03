const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function punchProgress(attack) {
  const age = Math.max(0, attack.duration - attack.remaining);
  if (age < attack.startup) return { extension: 0, chamber: smooth(age / attack.startup) };
  if (age < attack.startup + attack.active) return { extension: smooth((age - attack.startup) / (attack.active * .35)), chamber: 0 };
  const recovery = attack.duration - attack.startup - attack.active;
  return { extension: 1 - smooth((age - attack.startup - attack.active) / recovery), chamber: 0 };
}

export function applyCombatPose(model, fighter, settings) {
  const { parts } = model;
  function rotate(name, x, y = 0, z = 0) {
    const part = parts[name];
    if (part) part.object.rotation.set(part.rotation.x + x, part.rotation.y + y, part.rotation.z + z, part.rotation.order);
  }
  const punching = fighter.attack?.type === 'strike';
  for (const weapon of model.weaponRoots) {
    weapon.visible = model.showWeapons !== false;
  }
  if (fighter.blocking && !fighter.attack && (fighter.stun <= 0 || fighter.blockStun)) {
    // Elbows stay below the fists; forearms cover the head and chest.
    rotate('LeftArm', -.35, 0, -.22);
    rotate('RightArm', -.45, 0, .22);
    rotate('LeftForearm', -1.9);
    rotate('RightForearm', -1.8);
    rotate('Body', .06, -.08);
    rotate('Head', .08);
  } else if (punching) {
    const { extension, chamber } = punchProgress(fighter.attack);
    rotate('RightArm', -.7 + chamber * .12, 0, .1);
    rotate('RightForearm', -1.25 * (1 - extension) - chamber * .12);
    rotate('LeftArm', -.4, 0, -.16);
    rotate('LeftForearm', -1.75);
    rotate('Body', 0, extension * settings.bodyTwist - chamber * .08);
    rotate('Head', 0, -extension * settings.bodyTwist * .5);
    // Aim in fighting space, independent of the model's diagonal idle facing.
    model.root.updateMatrixWorld(true);
    const arm = parts.RightArm?.object;
    if (arm) {
      const world = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, fighter.facing * Math.PI / 2, 0, 'YXZ'));
      const local = arm.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world);
      arm.quaternion.slerp(local, extension);
    }
    model.root.updateMatrixWorld(true);
    for (const weapon of model.weaponRoots) {
      if (weapon.parent !== parts.RightForearm?.object) continue;
      // Exported blades extend along local +Y. Correct the grip's rest tilt.
      const world = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(fighter.facing, 0, 0));
      const local = weapon.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world);
      weapon.quaternion.slerp(local, extension);
    }
  }
  if (fighter.crouching && fighter.y <= .001 && !fighter.attack) {
    if (parts.Body) parts.Body.object.position.y -= .45;
    for (const side of ['Left', 'Right']) {
      if (parts[`${side}Leg`]) parts[`${side}Leg`].object.position.y -= .45;
      rotate(`${side}Leg`, -.8);
      rotate(`${side}Shin`, 1.4);
      rotate(`${side}Foot`, -.6);
    }
    if (parts.Body) parts.Body.object.rotation.x += .12;
  }
}
import * as THREE from 'three';
