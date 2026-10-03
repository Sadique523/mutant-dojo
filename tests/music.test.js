import test from 'node:test';
import assert from 'node:assert/strict';
import { DojoMusic } from '../src/music.js';
test('music scheduler produces a bounded groove and catches up without an audio burst', () => {
  const music = new DojoMusic(), events = [];
  music.context = { currentTime: 0, state: 'running' }; music.enabled = true; music.next = .05;
  music.tone = (note, time) => events.push({ kind: 'tone', note, time });
  music.kick = time => events.push({ kind: 'kick', time });
  music.percussion = time => events.push({ kind: 'drum', time });
  music.schedule();
  assert.ok(events.some(event => event.kind === 'tone') && events.some(event => event.kind === 'kick'));
  assert.ok(events.every(event => event.time >= .05 && event.time < .2));
  events.length = 0; music.context.currentTime = 60; music.schedule();
  assert.ok(events.length < 15); assert.ok(events.every(event => event.time > 60 && event.time < 60.2));
  music.enabled = false; events.length = 0; music.schedule(); assert.equal(events.length, 0);
});
test('music volume stays bounded and a suspended context schedules no notes', () => {
  const music = new DojoMusic(); music.setVolume(4); assert.equal(music.volume, 1);
  music.setVolume(-1); assert.equal(music.volume, 0);
  music.setVolume(NaN); assert.equal(music.volume, 0);
  music.context = { currentTime: 0, state: 'suspended' }; music.enabled = true; music.next = .05;
  music.tone = () => assert.fail('Suspended audio should not queue notes'); music.schedule(); assert.equal(music.step, 0);
});
