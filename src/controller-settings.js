import { ACTIONS, DEFAULT_BINDINGS } from './controllers.js';
const KEY = 'mutant-dojo:controllers:v1';
export function loadBindings(storage = globalThis.localStorage) {
  const result = Object.create(null);
  try {
    const saved = JSON.parse(storage.getItem(KEY) ?? '{}');
    for (const [id, profile] of Object.entries(saved)) {
      if (!profile || typeof profile !== 'object') continue;
      const bindings = structuredClone(DEFAULT_BINDINGS);
      for (const action of [...ACTIONS, 'start']) {
        const value = profile[action]; if (!value || typeof value !== 'object') continue;
        const binding = { buttons: Array.isArray(value.buttons) ? value.buttons.filter(index => Number.isInteger(index) && index >= 0 && index < 64) : [] };
        if (Number.isInteger(value.axis) && value.axis >= 0 && value.axis < 16 && [-1, 1].includes(value.sign)) {
          binding.axis = value.axis; binding.sign = value.sign; binding.center = Number.isFinite(value.center) ? Math.max(-1, Math.min(1, value.center)) : 0;
        }
        if (binding.buttons.length || binding.axis !== undefined) bindings[action] = binding;
      }
      result[id] = bindings;
    }
  } catch { /* Missing storage or invalid JSON uses defaults. */ }
  return result;
}
export function saveBindings(bindings) { try { localStorage.setItem(KEY, JSON.stringify(bindings)); } catch { /* Bindings still apply for this session. */ } }

export function setupControllerSettings(panel, controllers) {
  try { controllers.bindings = loadBindings(); } catch { controllers.bindings = Object.create(null); }
  const button = document.createElement('button'); button.textContent = 'CONTROLLERS'; button.type = 'button'; panel.append(button);
  const dialog = document.createElement('dialog'); dialog.className = 'controller-dialog';
  dialog.innerHTML = '<div class="controller-heading"><h2>Controller setup</h2><button type="button" data-close>Close</button></div><p>Click the game and press a controller button. If it appears below, use the default layout or bind its controls.</p><label>Player <select aria-label="Controller player"><option value="0">P1</option><option value="1">P2</option></select></label><pre class="pad-diagnostics" aria-label="Live controller diagnostics"></pre><p class="bind-message" role="status">Choose an action, then press its button or move its stick.</p><div class="bind-actions"></div><button type="button" data-defaults>Restore default layout</button><p class="controller-help">No device listed? Open this page directly in Chrome or Edge at localhost, reconnect USB/Bluetooth, then press a button. A controller recognized by Windows may still be unavailable to the browser.</p>';
  document.body.append(dialog);
  const select = dialog.querySelector('select'), message = dialog.querySelector('.bind-message'), diagnostics = dialog.querySelector('pre');
  let currentState, capture = null, lastUpdate = 0;
  const currentPad = () => currentState?.pads.find(pad => pad.index === controllers.slots[Number(select.value)]);
  function cancelCapture() { capture = null; }
  button.addEventListener('click', () => { cancelCapture(); dialog.showModal(); });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', cancelCapture); select.addEventListener('change', cancelCapture);
  for (const action of [...ACTIONS, 'start']) {
    const bind = document.createElement('button'); bind.type = 'button'; bind.textContent = action === 'strike' ? 'Punch' : action;
    dialog.querySelector('.bind-actions').append(bind);
    bind.addEventListener('click', () => {
      const pad = currentPad();
      if (!pad) { message.textContent = 'No controller for this player is visible to the browser. Press a button on the device first.'; return; }
      capture = { id: pad.id, action, axes: Array.from(pad.axes), ready: false };
      message.textContent = `Release controller buttons, center the stick, then press or move the control for ${action}.`;
    });
  }
  dialog.querySelector('[data-defaults]').addEventListener('click', () => {
    const pad = currentPad(); if (!pad) return;
    delete controllers.bindings[pad.id]; saveBindings(controllers.bindings); cancelCapture(); message.textContent = 'Default layout restored.';
  });
  return {
    get open() { return dialog.open; },
    update(state) {
      currentState = state;
      if (!dialog.open) return;
      const pad = currentPad();
      if (capture && pad?.id === capture.id) {
        const pressed = pad.buttons.findIndex(value => value.pressed || value.value > .5);
        if (!capture.ready) { if (pressed < 0) { capture.ready = true; capture.axes = Array.from(pad.axes); } }
        else {
          const axis = pad.axes.findIndex((value, index) => Math.abs(value - (capture.axes[index] ?? 0)) > .6);
          const binding = pressed >= 0 ? { buttons: [pressed] } : axis >= 0 ? { buttons: [], axis, sign: Math.sign(pad.axes[axis] - capture.axes[axis]), center: capture.axes[axis] } : null;
          if (binding) {
            controllers.bindings[pad.id] ??= structuredClone(DEFAULT_BINDINGS);
            controllers.bindings[pad.id][capture.action] = binding; saveBindings(controllers.bindings);
            message.textContent = `${capture.action} bound to ${pressed >= 0 ? `button ${pressed}` : `axis ${axis}`}. Saved for this controller.`;
            cancelCapture();
          }
        }
      }
      const now = performance.now(); if (now - lastUpdate < 100) return; lastUpdate = now;
      let info = `Gamepad API: ${typeof navigator.getGamepads === 'function' ? 'available' : 'unavailable'}\nPage focus: ${document.hasFocus() ? 'yes' : 'no'}\n`;
      if (state.error) info += `Browser error: ${state.error}\n`;
      if (!state.pads.length) info += 'No controller exposed by the browser yet.\n';
      for (const device of state.pads) {
        const slot = controllers.slots.indexOf(device.index);
        info += `\n${slot >= 0 ? `P${slot + 1}` : 'Extra pad'}: ${device.id}\nLayout: ${device.mapping || 'raw / custom'} · ${device.buttons.length} buttons · ${device.axes.length} axes\n`;
        info += `Pressed: ${device.buttons.map((value, index) => value.pressed || value.value > .5 ? index : null).filter(value => value !== null).join(', ') || 'none'}\nAxes: ${device.axes.map((value, index) => `${index}:${value.toFixed(2)}`).join(' ')}\n`;
        const bindings = controllers.bindings[device.id] ?? DEFAULT_BINDINGS;
        info += `Bindings: ${Object.entries(bindings).map(([action, binding]) => `${action}=${binding.buttons?.join('+') || ''}${binding.axis !== undefined ? `/axis${binding.axis}${binding.sign > 0 ? '+' : '-'}` : ''}`).join(' ')}\n`;
      }
      diagnostics.textContent = info;
    },
  };
}
