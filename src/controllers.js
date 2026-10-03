export const ACTIONS = ['left', 'right', 'jump', 'strike', 'heavy', 'block', 'crouch', 'roll', 'kick', 'spinKick', 'blueFlame'];
export const neutralInput = () => Object.fromEntries(ACTIONS.map(action => [action, false]));
export const DEFAULT_BINDINGS = {
  left: { buttons: [14], axis: 0, sign: -1 }, right: { buttons: [15], axis: 0, sign: 1 },
  jump: { buttons: [0, 12], axis: 1, sign: -1 }, crouch: { buttons: [13], axis: 1, sign: 1 },
  strike: { buttons: [2] }, heavy: { buttons: [3] }, block: { buttons: [4, 6] }, roll: { buttons: [1] }, start: { buttons: [9] },
  kick: { buttons: [5] }, spinKick: { buttons: [7] },
  blueFlame: { buttons: [10] },
};
export function bindingDown(pad, binding, deadzone = .25) {
  if (!pad || !binding) return false;
  const button = binding.buttons?.some(index => Boolean(pad.buttons[index]?.pressed || pad.buttons[index]?.value > .5));
  const value = pad.axes[binding.axis];
  return Boolean(button || (Number.isFinite(value) && (value - (binding.center ?? 0)) * binding.sign > deadzone));
}
export function controllerInput(pad, deadzone = .25, bindings = DEFAULT_BINDINGS) {
  const input = neutralInput();
  if (!pad?.connected) return input;
  for (const action of ACTIONS) input[action] = bindingDown(pad, bindings[action], deadzone);
  return input;
}
export function mergeInputs(...inputs) {
  return Object.fromEntries(ACTIONS.map(action => [action, inputs.some(input => Boolean(input?.[action]))]));
}

export class Controllers {
  constructor(read = () => navigator.getGamepads?.() ?? []) {
    this.read = read; this.slots = [null, null]; this.previousStart = new Map(); this.bindings = Object.create(null); this.error = '';
  }
  poll(active = true) {
    let pads;
    try { pads = Array.from(this.read() ?? []).filter(pad => pad?.connected); this.error = ''; } catch (error) { pads = []; this.error = error.message; }
    const supported = pads;
    this.slots = this.slots.map(index => supported.some(pad => pad.index === index) ? index : null);
    for (const pad of supported) {
      if (this.slots.includes(pad.index)) continue;
      const slot = this.slots.indexOf(null); if (slot >= 0) this.slots[slot] = pad.index;
    }
    const start = [false, false];
    const inputs = this.slots.map((index, slot) => {
      const pad = supported.find(pad => pad.index === index);
      const bindings = this.bindings[pad?.id] ?? DEFAULT_BINDINGS;
      const pressed = bindingDown(pad, bindings.start);
      start[slot] = active && pressed && !this.previousStart.get(index);
      if (pad) this.previousStart.set(index, pressed);
      return active ? controllerInput(pad, .25, bindings) : neutralInput();
    });
    for (const index of this.previousStart.keys()) if (!supported.some(pad => pad.index === index)) this.previousStart.delete(index);
    return { inputs, start, connected: this.slots.map(index => index !== null), unsupported: pads.some(pad => pad.mapping !== 'standard'), pads, error: this.error };
  }
}
