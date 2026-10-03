import test from 'node:test';
import assert from 'node:assert/strict';
import { Controllers, controllerInput, mergeInputs } from '../src/controllers.js';
import { loadBindings } from '../src/controller-settings.js';
const pad = (index = 0, mapping = 'standard') => ({ index, connected: true, mapping, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
test('standard controller maps face buttons, triggers, D-pad and stick deadzone', () => {
  const p = pad(); p.axes = [.2, -.2];
  assert.ok(Object.values(controllerInput(p)).every(value => !value));
  p.axes = [-.6, .7]; p.buttons[2].pressed = true; p.buttons[6].value = .8;
  let input = controllerInput(p); assert.ok(input.left && input.crouch && input.strike && input.block); assert.equal(input.jump, false);
  p.buttons[0].pressed = true; p.buttons[3].pressed = true; p.buttons[15].pressed = true;
  input = controllerInput(p); assert.ok(input.jump && input.heavy && input.right);
  const raw = pad(0, ''); raw.buttons[2].pressed = true;
  assert.equal(controllerInput(raw).strike, true);
});
test('sparse controllers retain player slots on disconnect and safely release controls', () => {
  const a = pad(2), b = pad(5); let pads = [null, null, a, null, null, b];
  const manager = new Controllers(() => pads);
  a.buttons[2].pressed = true;
  assert.equal(manager.poll().inputs[0].strike, true);
  pads = [null, null, null, null, null, b];
  const state = manager.poll(); assert.deepEqual(state.connected, [false, true]); assert.equal(state.inputs[0].strike, false);
  const c = pad(7); pads.push(c); manager.poll(); assert.deepEqual(manager.slots, [7, 5]);
});
test('Start fires on press edges, background polling suppresses input, keyboard merges', () => {
  const p = pad(), manager = new Controllers(() => [p]);
  p.buttons[9].pressed = true; p.buttons[2].pressed = true;
  assert.equal(manager.poll().start[0], true); assert.equal(manager.poll().start[0], false);
  p.buttons[9].pressed = false; manager.poll(); p.buttons[9].pressed = true;
  const background = manager.poll(false); assert.equal(background.start[0], false); assert.equal(background.inputs[0].strike, false);
  assert.equal(manager.poll().start[0], false);
  assert.ok(mergeInputs({ crouch: true }, controllerInput(p)).crouch);
  assert.ok(mergeInputs({}, controllerInput(p)).strike);
});
test('missing Gamepad API access is a neutral keyboard fallback', () => {
  const manager = new Controllers(() => { throw new Error('unavailable'); });
  assert.deepEqual(manager.poll().connected, [false, false]);
});

test('raw mappings are detected and custom buttons and axes drive actions', () => {
  const raw = pad(3, ''); raw.id = 'Generic USB'; raw.buttons[1].pressed = true; raw.axes[3] = -.9;
  const manager = new Controllers(() => [raw]);
  manager.bindings[raw.id] = { strike: { buttons: [1] }, left: { buttons: [], axis: 3, sign: -1 }, start: { buttons: [8] } };
  const state = manager.poll(); assert.equal(state.connected[0], true); assert.equal(state.unsupported, true);
  assert.ok(state.inputs[0].strike && state.inputs[0].left);
  raw.buttons[8].pressed = true; assert.equal(manager.poll().start[0], true);
});

test('saved controller bindings validate indices and fall back safely', () => {
  const profiles = loadBindings({ getItem: () => JSON.stringify({ USB: { strike: { buttons: [1, -1, 200] }, crouch: { buttons: [], axis: 3, sign: 1, center: -1 }, heavy: { buttons: [999] } } }) });
  assert.deepEqual(profiles.USB.strike.buttons, [1]); assert.deepEqual(profiles.USB.heavy.buttons, [3]);
  const raw = pad(0, ''); raw.axes[3] = 0; raw.buttons[1].pressed = true;
  assert.ok(controllerInput(raw, .25, profiles.USB).crouch);
  assert.ok(controllerInput(raw, .25, profiles.USB).strike);
  assert.equal(Object.keys(loadBindings({ getItem: () => '{invalid' })).length, 0);
});
