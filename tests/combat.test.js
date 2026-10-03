import test from 'node:test';
import assert from 'node:assert/strict';
import { Combat } from '../src/simulation.js';
const idle = () => ({ left: false, right: false, jump: false, strike: false, heavy: false, block: false });
function advance(game, frames, first = {}, second = {}) {
  for (let i = 0; i < frames; i++) game.step(1 / 60, [{ ...idle(), ...first }, { ...idle(), ...second }]);
}
function close(game) { game.fighters[0].x = -.7; game.fighters[1].x = .7; }
test('attacks cannot connect during startup or outside their range', () => {
  const game = new Combat();
  advance(game, 30, { strike: true });
  assert.equal(game.fighters[1].health, 100);
  game.reset(); close(game);
  advance(game, 6, { strike: true });
  assert.equal(game.fighters[1].health, 100);
  advance(game, 8, { strike: true });
  assert.equal(game.fighters[1].health, 92);
});
test('holding strike triggers one attack, release and press triggers another', () => {
  const game = new Combat(); close(game);
  advance(game, 90, { strike: true });
  assert.equal(game.fighters[1].health, 92);
  advance(game, 1); advance(game, 20, { strike: true });
  assert.equal(game.fighters[1].health, 84);
});
test('blocking takes chip damage instead of full heavy damage', () => {
  const game = new Combat(); close(game);
  advance(game, 35, { heavy: true }, { block: true });
  assert.equal(game.fighters[1].health, 99);
});
test('simultaneous strikes trade damage', () => {
  const game = new Combat(); close(game);
  advance(game, 15, { strike: true }, { strike: true });
  assert.equal(game.fighters[0].health, 92);
  assert.equal(game.fighters[1].health, 92);
});
test('a knockout ends the round and reset restores fighters', () => {
  const game = new Combat(); close(game); game.fighters[1].health = 5;
  advance(game, 20, { strike: true });
  assert.equal(game.winner, 0);
  const time = game.time; advance(game, 60);
  assert.equal(game.time, time);
  game.reset(); assert.equal(game.winner, null); assert.equal(game.fighters[1].health, 100);
});
test('collision remains inside arena bounds under sustained movement', () => {
  const game = new Combat();
  advance(game, 900, { right: true }, { right: true });
  assert.ok(game.fighters.every(f => Math.abs(f.x) <= 6));
  assert.ok(Math.abs(game.fighters[1].x - game.fighters[0].x) >= 1.149);
});
test('jump lands without automatically repeating while key is held', () => {
  const game = new Combat();
  advance(game, 15, { jump: true }); assert.ok(game.fighters[0].y > 0);
  advance(game, 90, { jump: true }); assert.equal(game.fighters[0].y, 0);
});
test('held crouch slows movement, prevents jumping, and releases cleanly', () => {
  const game = new Combat();
  game.step(1 / 60, [{ crouch: true, right: true, jump: true }, {}]);
  assert.equal(game.fighters[0].crouching, true);
  assert.equal(game.fighters[0].y, 0);
  assert.ok(Math.abs(game.fighters[0].speed - 3.8 * .45) < 1e-8);
  game.step(1 / 60, [{}, {}]);
  assert.equal(game.fighters[0].crouching, false);
});
test('unlimited round time survives long play but knockouts still end the round', () => {
  const game = new Combat(() => {}, { unlimitedTime: true });
  for (let i = 0; i < 7200; i++) game.step(1 / 60, [{}, {}]);
  assert.equal(game.time, 99); assert.equal(game.winner, null);
  game.fighters[1].health = 0; game.step(1 / 60, [{}, {}]); assert.equal(game.winner, 0);
  game.reset(); assert.equal(game.unlimitedTime, true); assert.equal(game.winner, null);
});
