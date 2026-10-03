import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { validateClip, parseAnimations, sampleClip, serializeAnimations, loadAnimations, authoredMotion, capturePose, applyAuthoredPose } from '../src/animation-clips.js';
import { createCharacter, poseCharacter } from '../src/character.js';
import { defaults, attackSpec } from '../src/tuning.js';
const pose = x => ({ joints: { RightArm: { rotation: [x, .2, .1], position: [0, 0, 0] }, Root: { rotation: [0, 0, 0], position: [0, .1, 0] } } });
const clip = easing => validateClip({ frames: 60, enabled: true, keys: [{ frame: 0, pose: pose(0), easing }, { frame: 60, pose: pose(1), easing }] });
test('authored clips interpolate, hold and clamp endpoints', () => {
  assert.equal(sampleClip(clip('linear'), 30).joints.RightArm.rotation[0], .5);
  assert.equal(sampleClip(clip('hold'), 30).joints.RightArm.rotation[0], 0);
  assert.equal(sampleClip(clip('smooth'), 15).joints.RightArm.rotation[0], .15625);
  assert.equal(sampleClip(clip('linear'), -10).joints.RightArm.rotation[0], 0);
  assert.equal(sampleClip(clip('linear'), 80).joints.RightArm.rotation[0], 1);
});
test('animation imports reject invalid transforms and preserve independent libraries', () => {
  const library = { leonardo: { strike: clip('linear') }, raphael: { block: clip('hold') } };
  assert.deepEqual(parseAnimations(JSON.parse(serializeAnimations(library))), library);
  assert.throws(() => validateClip({ frames: 0, keys: [] }));
  assert.throws(() => validateClip({ frames: 60, keys: [{ frame: 61, pose: pose(0) }] }));
  assert.throws(() => validateClip({ frames: 60, keys: [{ frame: 0, pose: pose(Infinity) }] }));
  assert.deepEqual(loadAnimations({ getItem: () => 'bad json' }), { leonardo: {}, raphael: {} });
});
test('attack clips follow combat duration and disabled tracks fall back', () => {
  const model = { animations: { strike: clip('linear') } }, attack = { type: 'strike', duration: .5, remaining: .25 };
  assert.equal(authoredMotion(model, { attack }, 900).joints.RightArm.rotation[0], .5);
  assert.equal(authoredMotion(model, { animationPlayback: { clip: 'strike', frame: 15 } }, 900).joints.RightArm.rotation[0], .25);
  model.animations.strike.enabled = false; assert.equal(authoredMotion(model, { attack }, 900), null);
});
test('authored poses mirror facing, preserve physical motion and reset weapons', () => {
  const scene = new THREE.Group(), body = new THREE.Group(); body.name = 'Body'; scene.add(body); body.position.y = 1.28;
  const arm = new THREE.Group(); arm.name = 'RightArm'; body.add(arm);
  const forearm = new THREE.Group(); forearm.name = 'RightForearm'; arm.add(forearm);
  const weapon = new THREE.Group(); weapon.name = 'WeaponGrip'; weapon.rotation.x = Math.PI * .75; weapon.position.y = -.45; forearm.add(weapon);
  const model = createCharacter({ scene }), config = defaults(), fighter = { x: 2, y: .7, facing: 1, speed: 0, health: 100, stun: 0 };
  poseCharacter(model, fighter, 0, config);
  assert.equal(capturePose(model, config.pose.stance, fighter).joints.Root.position[1], 0);
  const authored = pose(.5); authored.joints.Root.rotation[0] = .4; authored.joints.RightWeapon = { rotation: [.5, .2, .3], position: [0, -1, 0] };
  applyAuthoredPose(model, authored, { ...fighter, facing: -1 }, config.pose.stance);
  assert.equal(model.parts.RightArm.object.rotation.y, -.2); assert.ok(Math.abs(model.root.position.y - .8) < 1e-8);
  assert.equal(weapon.position.y, -1);
  poseCharacter(model, fighter, 0, config); assert.equal(weapon.position.y, -.45); assert.equal(model.root.rotation.x, 0);
  assert.ok(weapon.quaternion.angleTo(weapon.userData.restGripRotation) < 1e-7);
  const spec = attackSpec(config, 'strike'); model.animations = { strike: clip('linear') };
  poseCharacter(model, { ...fighter, attack: { ...spec, type: 'strike', remaining: spec.duration * .5 } }, 0, config);
  assert.equal(arm.rotation.x, .5);
});
