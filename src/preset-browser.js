import { MOTION_PRESETS } from './motion-presets.js';
import './preset-browser.css';
export function setupPresetBrowser(parent, bridge) {
  const panel = document.createElement('section'); panel.className = 'preset-browser';
  panel.innerHTML = '<h2>Motion presets</h2><p class="fine">Preview original motions on a low-poly mannequin or your turtle, then copy a preset into an action slot.</p><label class="editor-row">Preview model<select data-model><option value="turtle">MY TURTLE</option><option value="practice-scout">LOW-POLY SCOUT</option><option value="practice-brute">LOW-POLY BRUTE</option></select></label><label class="editor-row">Category<select data-category><option value="all">ALL MOTIONS</option></select></label><div class="motion-preset-list"></div><p class="preset-description"></p><label class="editor-row">Apply to action<select data-slot></select></label><div class="editor-row"><button data-apply>APPLY TO MY CHARACTER</button><button data-exit>EXIT PREVIEW</button><button data-undo disabled>UNDO APPLY</button></div><p class="fine">Presets are editable blocking. Specials use existing attack slots; applying them changes animation, not combat mechanics.</p>';
  parent.prepend(panel);
  const $ = selector => panel.querySelector(selector);
  const references = document.createElement('div'); references.className = 'preset-references'; references.hidden = true;
  $('.preset-description').after(references);
  function showReferences(preset) {
    references.hidden = !preset.references;
    references.replaceChildren(...(preset.references ?? []).map(reference => {
      const button = document.createElement('button'); button.type = 'button';
      const image = document.createElement('img'); image.src = reference.image; image.alt = `Leo kick: ${reference.label}`;
      const label = document.createElement('span'); label.textContent = `${reference.label} · ${reference.frame}F`; button.append(image, label);
      button.addEventListener('click', () => { bridge.preview(preset, $('[data-model]').value); bridge.seek(reference.frame); }); return button;
    }));
  }
  let selected = MOTION_PRESETS.find(preset => preset.id === 'straight-punch'), undo = null;
  for (const category of new Set(MOTION_PRESETS.map(preset => preset.category))) $('[data-category]').add(new Option(category, category));
  for (const slot of ['idle', 'walk', 'backstep', 'jump', 'strike', 'heavy', 'block', 'crouch', 'hit']) $('[data-slot]').add(new Option(slot === 'strike' ? 'Light / punch' : slot, slot));
  function list() {
    $('.motion-preset-list').replaceChildren(...MOTION_PRESETS.filter(preset => $('[data-category]').value === 'all' || preset.category === $('[data-category]').value).map(preset => {
      const button = document.createElement('button'); button.textContent = preset.label; button.classList.toggle('active', preset === selected);
      button.addEventListener('click', () => { selected = preset; $('[data-slot]').value = preset.slot; $('.preset-description').textContent = `${preset.clip.frames} frames · ${preset.note}`; showReferences(preset); list(); bridge.preview(preset, $('[data-model]').value); }); return button;
    }));
  }
  $('[data-slot]').value = selected.slot; $('.preset-description').textContent = 'Choose a motion to start its preview.'; list();
  $('[data-category]').addEventListener('change', list);
  $('[data-model]').addEventListener('change', () => bridge.preview(selected, $('[data-model]').value));
  $('[data-apply]').addEventListener('click', () => {
    undo = bridge.apply(selected, $('[data-slot]').value); $('[data-undo]').disabled = false;
    bridge.notify(`${selected.label} copied to your character. Click its body to refine the keys; Save Animations keeps it.`);
  });
  $('[data-undo]').addEventListener('click', () => { if (undo) bridge.undo(undo); undo = null; $('[data-undo]').disabled = true; });
  $('[data-exit]').addEventListener('click', () => bridge.exit());
}
