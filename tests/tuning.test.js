import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaults, normalize, parsePreset, serializePreset, loadSettings, attackSpec, attackPhase } from '../src/tuning.js';
import { Combat } from '../src/simulation.js';
import { createCharacter, applyAppearance, poseCharacter } from '../src/character.js';

test('imported tuning clamps unsafe ranges and ignores invalid values', () => {
  const raw = defaults(); raw.movement.speed = 999; raw.movement.gravity = NaN;
  raw.attacks.strike.activeFrames = 0; raw.attacks.strike.startupFrames = 4.8; raw.appearance.skin = '<script>';
  const result = normalize(raw);
  assert.equal(result.movement.speed, 8); assert.equal(result.movement.gravity, 20);
  assert.equal(result.attacks.strike.activeFrames, 1); assert.equal(result.attacks.strike.startupFrames, 5);
  assert.equal(result.appearance.skin, defaults().appearance.skin);
});
test('export/import preserves independent character tuning', () => {
  const characters = { leonardo: defaults(), raphael: defaults('raphael') };
  characters.leonardo.attacks.heavy.damage = 22; characters.raphael.movement.speed = 5;
  const result = parsePreset(JSON.parse(serializePreset(characters)));
  assert.equal(result.leonardo.attacks.heavy.damage, 22); assert.equal(result.raphael.movement.speed, 5);
  assert.equal(result.leonardo.movement.speed, 3.8);
  assert.throws(() => parsePreset({ version: 2, characters }));
});
test('corrupt or unavailable browser storage falls back to defaults', () => {
  assert.equal(loadSettings({ getItem: () => 'not JSON' }).leonardo.movement.speed, 3.8);
  assert.equal(loadSettings({ getItem: () => { throw new Error('blocked'); } }).raphael.attacks.heavy.damage, 17);
});
test('phase boundaries contain exactly the authored number of active frames', () => {
  const config = defaults(), spec = attackSpec(config, 'strike');
  const phases = Array.from({ length: 25 }, (_, frame) => attackPhase({ ...spec, remaining: spec.duration - frame / 60 }));
  assert.equal(phases.filter(phase => phase === 'startup').length, 7);
  assert.equal(phases.filter(phase => phase === 'active').length, 6);
  assert.equal(phases.filter(phase => phase === 'recovery').length, 12);
});
test('saved attack and movement settings affect the shared combat simulation', () => {
  const config = defaults(); config.movement.speed = 6; config.attacks.strike.damage = 23;
  const game = new Combat(() => {}, { settings: [config, defaults('raphael')] });
  game.step(1 / 60, [{ right: true }, {}]); assert.ok(Math.abs(game.fighters[0].x + 2.9) < 1e-8);
  game.fighters[0].x = -.7; game.fighters[1].x = .7;
  for (let i = 0; i < 10; i++) game.step(1 / 60, [{ strike: true }, {}]);
  assert.equal(game.fighters[1].health, 77);
});
test('training remains interactive after a knockout and does not expire', () => {
  const game = new Combat(() => {}, { training: true });
  game.fighters[0].x = -.7; game.fighters[1].x = .7; game.fighters[1].health = 1;
  for (let i = 0; i < 20; i++) game.step(1 / 60, [{ strike: true }, {}]);
  assert.equal(game.fighters[1].health, 0); assert.equal(game.winner, null); assert.equal(game.time, 99);
  const previous = game.fighters[0].x;
  for (let i = 0; i < 60; i++) game.step(1 / 60, [{ left: true }, {}]);
  assert.ok(game.fighters[0].x < previous);
});
function fixture() {
  const scene = new THREE.Group(), body = new THREE.Group(); body.name = 'Body'; scene.add(body);
  for (const name of ['Head', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg']) { const part = new THREE.Group(); part.name = name; body.add(part); }
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff' }); material.name = 'Skin_leonardo';
  body.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
  return { scene };
}
test('default palette preserves source colors and repeated poses do not accumulate transforms', () => {
  const model = createCharacter(fixture()), config = defaults();
  applyAppearance(model, config); assert.equal(model.surfaces[0].object.material.color.getHex(), 0xffffff);
  config.appearance.bodyWidth = 1.2;
  const fighter = { x: 0, y: 0, speed: 0, facing: 1, health: 100, attack: null, blocking: false, stun: 0 };
  poseCharacter(model, fighter, 0, config); poseCharacter(model, fighter, 0, config);
  assert.equal(model.parts.Body.object.scale.x, 1.2);
  assert.ok(Math.abs(model.parts.RightArm.object.rotation.x + config.pose.guard + .15) < 1e-8);
});
