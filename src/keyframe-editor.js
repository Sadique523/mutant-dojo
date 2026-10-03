import { JOINTS, ANIMATION_STORAGE, capturePose, applyAuthoredPose, sampleClip, parseAnimations, serializeAnimations } from './animation-clips.js';
import './keyframe-editor.css';

export function setupKeyframeEditor(parent, bridge) {
  const section = document.createElement('section'); section.className = 'keyframe-editor';
  section.innerHTML = '<h2>Keyframe studio</h2><p class="fine">Pause on a frame, pose a joint, then add a key. Saved clips play in the dojo.</p><label class="editor-row"><input data-enabled type="checkbox"> Use authored clip</label><div class="editor-row"><button data-new>CREATE FROM CURRENT MOTION</button><button data-remove>REMOVE CLIP</button></div><label class="editor-row">Length / frames<input data-length type="number" min="1" max="1800" step="1"></label><label class="editor-row">Joint<select data-joint></select></label><div class="transform-fields"></div><label class="editor-row">Interpolation<select data-easing><option value="smooth">Smooth</option><option value="linear">Linear</option><option value="hold">Hold</option></select></label><div class="editor-row"><button data-key>ADD / UPDATE KEY</button><button data-delete>DELETE KEY</button><button data-reset>UNDO POSE EDIT</button></div><div class="key-list" aria-label="Authored keyframes"></div><div class="editor-row"><button data-save>SAVE ANIMATIONS</button><button data-export>EXPORT CLIPS</button><label class="import-button">IMPORT CLIPS<input data-import type="file" accept=".json,application/json" hidden></label></div><p class="editor-state" role="status">No authored clip.</p>';
  parent.prepend(section);
  const $ = selector => section.querySelector(selector), fields = [];
  const plant = document.createElement('label'); plant.className = 'editor-row'; plant.textContent = 'Support foot';
  const support = document.createElement('select'); support.setAttribute('aria-label', 'Planted supporting foot');
  for (const [value, label] of [['', 'FREE'], ['LeftFoot', 'PLANT LEFT'], ['RightFoot', 'PLANT RIGHT']]) support.add(new Option(label, value));
  plant.append(support); $('.transform-fields').after(plant);
  const jointSelect = $('[data-joint]');
  for (const name of ['Root', ...JOINTS, 'LeftWeapon', 'RightWeapon']) jointSelect.add(new Option(name, name));
  let draft = null, draftContext = '', context = '', lastFrame = -1;
  const track = () => bridge.library()[bridge.character()][bridge.clip()];
  const stamp = () => `${bridge.character()}:${bridge.clip()}:${Math.round(bridge.frame())}`;
  function clearDraft() { draft = null; draftContext = ''; }
  function editable() { if (!bridge.model() || !bridge.preview()) { bridge.notify('Choose a preview action before editing keyframes.'); return false; } bridge.pause(); return true; }
  function refreshFields() {
    const model = bridge.model(); if (!model) return;
    const pose = draftContext === stamp() && draft ? draft : capturePose(model, bridge.stance(), bridge.fighter());
    const transform = pose.joints[jointSelect.value];
    if (document.activeElement !== support) support.value = pose.supportFoot ?? '';
    support.disabled = !bridge.preview();
    for (const { input, field, axis } of fields) { input.disabled = !transform || !bridge.preview(); if (transform && document.activeElement !== input) input.value = (transform[field][axis] * (field === 'rotation' ? 180 / Math.PI : 1)).toFixed(field === 'rotation' ? 1 : 3); }
  }
  for (const field of ['rotation', 'position']) {
    const row = document.createElement('div'); row.className = 'editor-transform'; row.append(Object.assign(document.createElement('span'), { textContent: field === 'rotation' ? 'Rotate °' : 'Move m' }));
    for (const [axis, label] of ['X', 'Y', 'Z'].entries()) {
      const input = document.createElement('input'); input.type = 'number'; input.step = field === 'rotation' ? '1' : '.01'; input.setAttribute('aria-label', `${field} ${label}`);
      input.min = field === 'rotation' ? '-3600' : '-20'; input.max = field === 'rotation' ? '3600' : '20';
      const wrapper = document.createElement('label'); wrapper.textContent = label; wrapper.append(input); row.append(wrapper); fields.push({ input, field, axis });
      input.addEventListener('input', () => {
        if (!editable() || !Number.isFinite(input.valueAsNumber) || input.valueAsNumber < Number(input.min) || input.valueAsNumber > Number(input.max)) return;
        if (!draft || draftContext !== stamp()) { draft = capturePose(bridge.model(), bridge.stance(), bridge.fighter()); draftContext = stamp(); }
        if (!draft.joints[jointSelect.value]) return;
        draft.joints[jointSelect.value][field][axis] = input.valueAsNumber * (field === 'rotation' ? Math.PI / 180 : 1);
        $('[data-reset]').disabled = false; $('.editor-state').textContent = 'Pose edited — add a key to keep this frame.';
      });
    }
    $('.transform-fields').append(row);
  }
  function refresh() {
    const clip = track(); $('[data-enabled]').checked = Boolean(clip?.enabled); $('[data-enabled]').disabled = !clip;
    $('[data-length]').value = clip?.frames ?? bridge.frames(); $('[data-length]').disabled = !clip;
    const keys = clip?.keys ?? [];
    $('.key-list').replaceChildren(...keys.map(key => {
      const button = document.createElement('button'); button.textContent = `◆ ${key.frame}F`; button.classList.toggle('selected', key.frame === Math.round(bridge.frame()));
      button.addEventListener('click', () => { if (!editable()) return; clearDraft(); bridge.seek(key.frame); $('[data-easing]').value = key.easing; refresh(); }); return button;
    }));
    $('.editor-state').textContent = clip ? `${keys.length} keys · ${clip.frames} frames · ${clip.enabled ? 'active' : 'disabled'}` : 'No authored clip. Create one to start.';
    refreshFields();
  }
  $('[data-new]').addEventListener('click', () => {
    if (!editable()) return;
    if (track()) { bridge.notify('This action already has a clip. Edit its keys, or remove it to start over.'); return; }
    const frames = bridge.frames(), frame = Math.round(bridge.frame());
    const keys = [...new Set([0, frame, frames])].map(value => ({ frame: value, pose: bridge.sampleBase(value), easing: 'smooth' }));
    bridge.library()[bridge.character()][bridge.clip()] = { frames, enabled: true, keys }; clearDraft(); bridge.changed(); refresh(); bridge.notify('Clip created. Pose joints and add keys at any frame.');
  });
  $('[data-key]').addEventListener('click', () => {
    if (!editable()) return;
    let clip = track();
    if (!clip) { clip = { frames: bridge.frames(), enabled: true, keys: [] }; bridge.library()[bridge.character()][bridge.clip()] = clip; }
    const frame = Math.round(bridge.frame()), pose = draft && draftContext === stamp() ? structuredClone(draft) : capturePose(bridge.model(), bridge.stance(), bridge.fighter());
    clip.keys = clip.keys.filter(key => key.frame !== frame); clip.keys.push({ frame, pose, easing: $('[data-easing]').value }); clip.keys.sort((a, b) => a.frame - b.frame);
    clearDraft(); bridge.changed(); refresh();
  });
  $('[data-delete]').addEventListener('click', () => { const clip = track(); if (!clip || !editable()) return; clip.keys = clip.keys.filter(key => key.frame !== Math.round(bridge.frame())); clearDraft(); bridge.changed(); refresh(); });
  $('[data-remove]').addEventListener('click', () => { if (!editable()) return; delete bridge.library()[bridge.character()][bridge.clip()]; clearDraft(); bridge.changed(); refresh(); });
  $('[data-reset]').addEventListener('click', () => { clearDraft(); refresh(); });
  $('[data-enabled]').addEventListener('change', event => { const clip = track(); if (clip) { clip.enabled = event.target.checked; clearDraft(); bridge.changed(); refresh(); } });
  $('[data-length]').addEventListener('change', event => {
    const clip = track(), frames = event.target.valueAsNumber; if (!clip || !Number.isInteger(frames) || frames < 1 || frames > 1800) { refresh(); return; }
    // Rescale keys so reducing length never silently throws poses away.
    const keys = new Map(clip.keys.map(key => { const frame = Math.round(key.frame / clip.frames * frames); return [frame, { ...key, frame }]; }));
    if (clip.effects) clip.effects = clip.effects.map(effect => { const startFrame = Math.min(frames - 1, Math.round(effect.startFrame / clip.frames * frames)); return { ...effect, startFrame, endFrame: Math.min(frames, Math.max(startFrame + 1, Math.round(effect.endFrame / clip.frames * frames))) }; });
    clip.frames = frames; clip.keys = [...keys.values()].sort((a, b) => a.frame - b.frame); clearDraft(); bridge.changed(); refresh();
  });
  jointSelect.addEventListener('change', refreshFields);
  support.addEventListener('change', () => {
    if (!editable()) return;
    if (!draft || draftContext !== stamp()) { draft = capturePose(bridge.model(), bridge.stance(), bridge.fighter()); draftContext = stamp(); }
    if (support.value) draft.supportFoot = support.value; else delete draft.supportFoot;
    $('.editor-state').textContent = 'Support changed — add a key to keep this frame.';
  });
  $('[data-save]').addEventListener('click', () => {
    if (draft) { bridge.notify('Add a key first to preserve the pose you are editing.'); return; }
    try { localStorage.setItem(ANIMATION_STORAGE, serializeAnimations(bridge.library())); bridge.notify('Animations saved. Reload the dojo to use them.'); } catch (error) { bridge.notify(`Save failed: ${error.message}. Export the clips to keep them.`); }
  });
  $('[data-export]').addEventListener('click', () => { try { bridge.download(new Blob([serializeAnimations(bridge.library())], { type: 'application/json' }), 'mutant-dojo-animation-clips.json'); } catch (error) { bridge.notify(error.message); } });
  $('[data-import]').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > 5000000) throw new Error('Animation file is too large.'); bridge.replaceLibrary(parseAnimations(JSON.parse(await file.text()))); clearDraft(); bridge.changed(); refresh(); bridge.notify('Clips imported. Save animations to use them in the dojo.'); } catch (error) { bridge.notify(`Import rejected: ${error.message}`); } event.target.value = '';
  });
  return {
    get selectedJoint() { return jointSelect.value; },
    selectJoint(name) { if ([...jointSelect.options].some(option => option.value === name)) { jointSelect.value = name; refreshFields(); } },
    beginDirectEdit() {
      if (!editable()) return false;
      context = `${bridge.character()}:${bridge.clip()}:${bridge.preview()}`; lastFrame = Math.round(bridge.frame());
      if (!draft || draftContext !== stamp()) { draft = capturePose(bridge.model(), bridge.stance(), bridge.fighter()); draftContext = stamp(); }
      return true;
    },
    recordDirectEdit() {
      if (!bridge.model() || !bridge.preview()) return;
      draft = capturePose(bridge.model(), bridge.stance(), bridge.fighter()); draftContext = stamp();
      $('.editor-state').textContent = 'Pose edited — add a key to keep this frame.'; refreshFields();
    },
    addKey() { $('[data-key]').click(); },
    save() { $('[data-save]').click(); },
    apply(model, fighter) { if (bridge.preview() && draft && draftContext === stamp()) applyAuthoredPose(model, draft, fighter, bridge.stance()); },
    update() {
      const next = `${bridge.character()}:${bridge.clip()}:${bridge.preview()}`;
      if (context !== next || lastFrame !== Math.round(bridge.frame())) { clearDraft(); context = next; lastFrame = Math.round(bridge.frame()); refresh(); }
      if (!draft) refreshFields();
    },
  };
}
