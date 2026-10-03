import * as THREE from 'three';

// Deterministic blocking: stance feet travel opposite the moving root;
// swing feet return with a low clearance. Blender IK clips will replace this.
export function stepTarget(time, speed, cadence, side) {
  const period = Math.PI * 2 / cadence;
  const phase = ((time / period + side * .5) % 1 + 1) % 1;
  const stride = speed * period * .5;
  if (phase < .5) return { x: stride * (.5 - phase * 2), y: 0, support: true };
  const t = (phase - .5) * 2;
  const smooth = t * t * (3 - 2 * t);
  return { x: stride * (smooth - .5), y: Math.sin(t * Math.PI) * .09, support: false };
}

export function applyFootwork(model, fighter, time, settings) {
  if (fighter.y > .001 || fighter.attack || (fighter.stun > 0 && !fighter.blockStun) || fighter.health <= 0 || fighter.reference) return;
  const moving = Math.abs(fighter.speed) > .1;
  for (const [index, side] of ['Left', 'Right'].entries()) {
    const leg = model.parts[`${side}Leg`], shin = model.parts[`${side}Shin`], foot = model.parts[`${side}Foot`];
    if (!leg || !shin || !foot) continue;
    const target = moving ? stepTarget(time, fighter.speed, settings.walkFrequency, index) : { x: 0, y: 0, support: true };
    leg.object.rotation.x -= fighter.crouching ? 0 : .18;
    shin.object.rotation.x += (fighter.crouching ? 0 : .32) + target.y * 2;
    foot.object.rotation.x -= (fighter.crouching ? 0 : .14) + target.y * 2;
    model.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(foot.object);
    if (bounds.isEmpty()) continue;
    const delta = new THREE.Vector3(target.x, -.02 + target.y - bounds.min.y, 0);
    const origin = leg.object.getWorldPosition(new THREE.Vector3());
    const local = leg.object.parent.worldToLocal(origin.clone().add(delta));
    leg.object.position.copy(local);
  }
  if (model.parts.Body) {
    model.parts.Body.object.rotation.y += moving ? Math.sin(time * settings.walkFrequency) * .035 : 0;
    model.parts.Body.object.rotation.z -= fighter.facing * fighter.speed * .008;
  }
}
