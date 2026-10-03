import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Combat } from './simulation.js';
import { REFERENCE_MOTIONS } from './reference-motions.js';
import { createCharacter, applyAppearance, poseCharacter } from './character.js';
import { loadSettings, defaults, parsePreset, serializePreset, STORAGE_KEY, LIMITS, attackSpec, attackPhase } from './tuning.js';
import './lab.css';
import { mergeInputs } from './controllers.js';
import { setupPlayControls } from './play-controls.js';
import { loadAnimations, capturePose } from './animation-clips.js';
import { setupKeyframeEditor } from './keyframe-editor.js';
import { setupViewportEditor } from './viewport-editor.js';
import { setupPresetBrowser } from './preset-browser.js';
import { sampleClip, applyAuthoredPose } from './animation-clips.js';
import { updateCharacterEffects } from './character-effects.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const playControls = setupPlayControls($('.lab-header'));
let padState = { inputs: [{}, {}], start: [false, false] };
const canvas = $('#lab-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b2a31');
const camera = new THREE.PerspectiveCamera(35, 1, .1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, .04).texture; scene.environmentIntensity = .5;
room.dispose(); pmrem.dispose();
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true; orbit.minDistance = 2.5; orbit.maxDistance = 22;
orbit.maxPolarAngle = Math.PI * .49;
const ambient = new THREE.HemisphereLight('#e1edff', '#324349', 1.2); scene.add(ambient);
function areaLight(color, intensity, x, y, z) {
  const light = new THREE.DirectionalLight(color, intensity); light.position.set(x, y, z); scene.add(light); return light;
}
const key = areaLight('#ffe5c1', 3, 3, 6, 5), fill = areaLight('#95c4ea', 1.5, -5, 3, 3), rim = areaLight('#bbe2d0', 2, 2, 5, -4);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.normalBias = .03;
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#273a40', roughness: .8 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.065; floor.receiveShadow = true; scene.add(floor);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.3, .12, 80), new THREE.MeshStandardMaterial({ color: '#304249', roughness: .55, metalness: .2 }));
pedestal.position.y = -.085; pedestal.receiveShadow = true; scene.add(pedestal);
const grid = new THREE.GridHelper(24, 48, '#59706a', '#30434b'); grid.position.y = -.025; scene.add(grid);
const ring = new THREE.Mesh(new THREE.RingGeometry(2.18, 2.20, 80), new THREE.MeshBasicMaterial({ color: '#869d79', transparent: true, opacity: .4, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = -.018; scene.add(ring);
function guide(color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: .4, depthTest: false }));
  scene.add(mesh); return mesh;
}
const attackGuide = guide('#b4d58e'), targetGuide = guide('#769fbe');
const pivotGeometry = new THREE.BufferGeometry();
const pivotNames = ['Body', 'Head', 'LeftArm', 'RightArm', 'LeftForearm', 'RightForearm', 'LeftLeg', 'RightLeg', 'LeftShin', 'RightShin', 'LeftFoot', 'RightFoot'];
const pivotEdges = [[0, 1], [0, 2], [0, 3], [2, 4], [3, 5], [0, 6], [0, 7], [6, 8], [7, 9], [8, 10], [9, 11]];
const pivotPositions = new Float32Array(pivotEdges.length * 6); pivotGeometry.setAttribute('position', new THREE.BufferAttribute(pivotPositions, 3));
const pivotLines = new THREE.LineSegments(pivotGeometry, new THREE.LineBasicMaterial({ color: '#e0bf82', depthTest: false }));
pivotLines.frustumCulled = false; scene.add(pivotLines);
const pivotMarkers = Array.from({ length: pivotNames.length }, () => {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 8), new THREE.MeshBasicMaterial({ color: '#f2d3a5', depthTest: false })); scene.add(marker); return marker;
});

let settings = loadSettings(), selected = 'leonardo', clip = 'leo-ready', editedAttack = 'strike';
let mode = 'preview', playing = true, loop = true, speed = 1, previewFrame = 0, simTime = 0, accumulator = 0;
let loaded = false, roof = null, roofPromise = null, targetHeal = 0, counterClock = 0, hits = [], timelineType = null;
const models = {}, keys = new Set();
const practiceModels = {};
let presetPreview = null;
let animations = loadAnimations();
const otherName = () => selected === 'leonardo' ? 'raphael' : 'leonardo';
const config = () => settings[selected];
const combat = new Combat(contact, { training: true, settings: [config(), settings[otherName()]] });
const IDLE = { left: false, right: false, jump: false, strike: false, heavy: false, block: false };
function notice(message) { $('#notice').textContent = message; }
function dirty() { $('#save-state').textContent = 'UNSAVED CHANGES'; }
const keyframeEditor = setupKeyframeEditor($('.inspector-content'), {
  library: () => animations, replaceLibrary: value => { animations = value; }, character: () => selected,
  clip: () => clip, frame: () => previewFrame, frames: clipFrames, stance: () => config().pose.stance,
  model: () => models[selected], fighter: previewFighter, preview: () => mode === 'preview' && !presetPreview,
  pause: () => { if (playing) togglePlay(); }, seek: value => { previewFrame = value; accumulator = 0; },
  notify: notice, download, changed: () => { syncModels(); timeline(); notice('Animation changed. Save animations to keep it.'); },
  sampleBase(frame) {
    const model = models[selected], savedFrame = previewFrame, library = model.animations;
    previewFrame = frame; model.animations = null;
    const fighter = previewFighter(); poseCharacter(model, fighter, frame / 60, config());
    const pose = capturePose(model, config().pose.stance, fighter);
    model.animations = library; previewFrame = savedFrame; return pose;
  },
});
const viewportEditor = setupViewportEditor({ scene, camera, canvas, orbit, editor: keyframeEditor, model: () => models[selected], preview: () => mode === 'preview' && !presetPreview, pause: () => { if (playing) togglePlay(); }, notify: notice });
setupPresetBrowser($('.inspector-content'), {
  notify: notice,
  seek(frame) { previewFrame = frame; accumulator = 0; if (playing) togglePlay(); },
  preview(preset, source) {
    if (source !== 'turtle' && !practiceModels[source]) { notice('Practice character is still loading. Try previewing on your turtle, then retry.'); return; }
    setClip(preset.slot); presetPreview = { preset, source }; previewFrame = 0;
    if (!playing) togglePlay(); syncModels(); timeline(); notice(`${preset.label}: preset preview. Apply it to start editing.`);
  },
  apply(preset, slot) {
    const previous = animations[selected][slot] ? structuredClone(animations[selected][slot]) : null;
    animations[selected][slot] = structuredClone(preset.clip); const undo = { character: selected, slot, previous };
    setClip(slot); if (playing) togglePlay(); syncModels(); timeline(); return undo;
  },
  undo(undo) {
    if (undo.previous) animations[undo.character][undo.slot] = undo.previous;
    else delete animations[undo.character][undo.slot];
    presetPreview = null; syncModels(); timeline(); notice('Preset application undone.');
  },
  exit() { presetPreview = null; syncModels(); timeline(); notice('Returned to your character animation.'); },
});
function contact(event) {
  targetHeal = 1.0;
  const move = event.heavy ? 'HEAVY' : 'LIGHT', damage = event.damage;
  const text = `${event.source === 0 ? selected.toUpperCase() : 'DUMMY'} · ${move} · ${event.blocked ? 'BLOCKED / ' : ''}${damage} DAMAGE`;
  hits.unshift(text); hits = hits.slice(0, 6);
  $('#hit-log').replaceChildren(...hits.map(hit => { const p = document.createElement('p'); p.textContent = hit; return p; }));
  $('#contact-info').textContent = text;
}
function syncModels() {
  combat.settings = [config(), settings[otherName()]];
  for (const name of Object.keys(models)) {
    models[name].animations = animations[name];
    applyAppearance(models[name], settings[name], $('#wireframe').checked);
    models[name].root.visible = (name === selected && (!presetPreview || presetPreview.source === 'turtle')) || mode === 'training';
    models[name].showWeapons = $('#weapons').checked;
    models[name].weaponRoots.forEach(root => root.visible = models[name].showWeapons);
  }
  for (const [name, model] of Object.entries(practiceModels)) model.root.visible = mode === 'preview' && presetPreview?.source === name;
  pedestal.visible = ring.visible = mode === 'preview' && $('#environment').value === 'studio';
  $('#dummy-settings').hidden = mode !== 'training';
  $('#view-mode').textContent = presetPreview ? 'PRESET PREVIEW' : mode === 'preview' ? 'MOTION PREVIEW' : 'LIVE CONTACT TEST';
  $('#training').classList.toggle('active', mode === 'training');
  $('#training').textContent = mode === 'training' ? 'RETURN TO PREVIEW' : 'TEST AGAINST DUMMY';
  $('#scrub').disabled = mode === 'training';
  $('#health-info').hidden = mode !== 'training';
  $$('[data-clip]').forEach(button => button.classList.toggle('active', mode === 'preview' && button.dataset.clip === clip));
  $$('[data-clip]').forEach(button => { if (button.dataset.clip.startsWith('leo-')) button.disabled = selected !== 'leonardo'; });
  $('#reference-study').hidden = mode !== 'preview' || !REFERENCE_MOTIONS[clip];
}
function resetTraining() {
  combat.reset(); simTime = 0; accumulator = 0; keys.clear(); targetHeal = 0; counterClock = .9;
  const distance = Math.max(1.2, Math.min(5, Number($('#distance').value) || 1.65)); $('#distance').value = distance;
  combat.fighters[0].x = -distance / 2; combat.fighters[1].x = distance / 2;
  hits = []; $('#hit-log').replaceChildren(Object.assign(document.createElement('p'), { textContent: 'No hits recorded.' }));
  $('#contact-info').textContent = 'NO CONTACT YET';
}
function cameraPreset(view = 'three') {
  const factor = mode === 'training' ? 1.35 : 1;
  const positions = { front: [0, 2.4, 6.8], side: [6.8, 2.4, 0], back: [0, 2.4, -6.8], three: [3.8, 3.0, 6.4] };
  const pos = new THREE.Vector3(...positions[view]);
  if (view !== 'three') pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), config().pose.stance);
  const center = mode === 'training' ? (combat.fighters[0].x + combat.fighters[1].x) / 2 : 0;
  camera.position.copy(pos.multiplyScalar(factor)).add(new THREE.Vector3(center, 0, 0)); orbit.target.set(center, 1.35, 0); orbit.update();
}
cameraPreset();
const descriptors = {
  movement: [['speed', 'Walk speed', .1], ['jumpVelocity', 'Jump impulse', .1], ['gravity', 'Gravity', .5]],
  pose: [['idleBob', 'Breathing amount', .005], ['walkAmplitude', 'Stride angle', .01], ['walkFrequency', 'Cadence', .5], ['stance', 'Facing angle', .01], ['guard', 'Guard height', .01], ['attackArc', 'Strike arc', .05], ['bodyTwist', 'Torso follow-through', .01]],
  appearance: [['headScale', 'Head size', .01], ['bodyWidth', 'Upper body width', .01], ['shellScale', 'Shell size', .01], ['roughness', 'Skin roughness', .01]],
  attacks: [['startupFrames', 'Startup / frames', 1], ['activeFrames', 'Active / frames', 1], ['recoveryFrames', 'Recovery / frames', 1], ['range', 'Reach / metres', .05], ['damage', 'Damage', 1], ['stunFrames', 'Hit stun / frames', 1], ['push', 'Knockback / metres', .05]],
  reference: [['poseIntensity', 'Pose strength', .01], ['elbowOffset', 'Elbow adjustment', .02], ['kneeOffset', 'Knee adjustment', .02], ['leanOffset', 'Torso lean adjustment', .01]],
};
function fields(container, section) {
  for (const [field, label, step] of descriptors[section]) {
    const row = document.createElement('label'); row.className = 'field';
    const [min, max] = LIMITS[field];
    row.innerHTML = `<span class="field-label"><span>${label}</span><input type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}"></span><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label} slider">`;
    const elements = [...row.querySelectorAll('input')];
    function read() { return section === 'attacks' ? config().attacks[editedAttack] : config()[section]; }
    function update() { elements.forEach(input => { input.value = read()[field]; }); }
    elements.forEach(input => input.addEventListener('input', () => {
      if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
      read()[field] = Math.max(min, Math.min(max, /Frames$/.test(field) || field === 'damage' ? Math.round(input.valueAsNumber) : input.valueAsNumber));
      const value = read()[field]; elements.filter(el => el !== input).forEach(el => { el.value = value; });
      dirty(); syncModels(); timeline();
    }));
    elements.forEach(input => input.addEventListener('change', update));
    row.refresh = update; container.append(row); update();
  }
}
fields($('#motion-fields'), 'movement'); fields($('#motion-fields'), 'pose'); fields($('#appearance-fields'), 'appearance'); fields($('#attack-fields'), 'attacks');
fields($('#reference-fields'), 'reference');
function refreshFields() {
  $$('.field').forEach(row => row.refresh()); $('#skin-color').value = config().appearance.skin; $('#mask-color').value = config().appearance.mask;
}
function clipFrames() {
  if (presetPreview) return presetPreview.preset.clip.frames;
  if (animations[selected]?.[clip]) return animations[selected][clip].frames;
  if (REFERENCE_MOTIONS[clip]) return REFERENCE_MOTIONS[clip].frames;
  if (clip === 'strike' || clip === 'heavy') return Math.round(attackSpec(config(), clip).duration * 60);
  if (clip === 'walk' || clip === 'backstep') return Math.round(Math.PI * 2 / config().pose.walkFrequency * 60);
  if (clip === 'jump') return Math.ceil(2 * config().movement.jumpVelocity / config().movement.gravity * 60) + 12;
  return clip === 'hit' ? 36 : 120;
}
function timeline() {
  const type = mode === 'training' ? (combat.fighters[0].attack?.type ?? editedAttack) : clip;
  timelineType = type;
  const track = $('#phase-track');
  if (presetPreview) {
    track.innerHTML = '<span class="active-phase">EDITABLE MOTION PRESET</span>';
    $('#timing-description').textContent = `${clipFrames()} FRAMES · ${presetPreview.preset.label.toUpperCase()} · 60 FPS`;
  } else if (type === 'strike' || type === 'heavy') {
    const move = config().attacks[type], total = move.startupFrames + move.activeFrames + move.recoveryFrames;
    track.innerHTML = `<span class="startup" style="flex:${move.startupFrames}">STARTUP ${move.startupFrames}F</span><span class="active-phase" style="flex:${move.activeFrames}">ACTIVE ${move.activeFrames}F</span><span class="recovery" style="flex:${move.recoveryFrames}">RECOVERY ${move.recoveryFrames}F</span>`;
    $('#timing-description').textContent = `${total} FRAMES · ${(total / 60).toFixed(2)} SEC · ${move.damage} DAMAGE · ${move.range.toFixed(2)} M REACH`;
  } else if (REFERENCE_MOTIONS[type]) {
    track.innerHTML = '<span class="startup">ANTICIPATION</span><span class="active-phase">REFERENCE POSE</span><span class="recovery">RECOVERY</span>';
    $('#timing-description').textContent = `${clipFrames()} FRAMES · SPRITE-INSPIRED BLOCKING · PROVISIONAL TIMING`;
  } else { track.innerHTML = '<span class="startup">MOTION PREVIEW / 60 FPS</span>'; $('#timing-description').textContent = `${clipFrames()} FRAMES · 60 FPS`; }
  $('#scrub').max = clipFrames(); previewFrame = Math.min(previewFrame, clipFrames());
  $('#clip-name').textContent = presetPreview ? presetPreview.preset.label.toUpperCase() : mode === 'training' ? 'CONTACT TEST / KEYBOARD LIVE' : REFERENCE_MOTIONS[clip]?.label.toUpperCase() ?? clip.toUpperCase() + (clip === 'idle' ? ' / GUARD' : '');
  updateReference();
}
function updateReference() {
  const motion = REFERENCE_MOTIONS[clip];
  $('#reference-study').hidden = mode !== 'preview' || !motion;
  if (!motion) return;
  $('#reference-note').textContent = motion.note;
  $('#reference-images').replaceChildren(...motion.images.map(filename => {
    const image = document.createElement('img'); image.src = `/references/leo/${filename}`; image.alt = `${motion.label} source sprite`; return image;
  }));
}
function setClip(value) {
  if (value.startsWith('leo-') && selected !== 'leonardo') return;
  const wasTraining = mode === 'training';
  presetPreview = null;
  clip = value; mode = 'preview'; previewFrame = 0; accumulator = 0; keys.clear();
  $$('[data-clip]').forEach(button => button.classList.toggle('active', button.dataset.clip === clip));
  if (clip === 'strike' || clip === 'heavy') { editedAttack = clip; attackSelection(); }
  timeline(); syncModels();
  if (wasTraining) cameraPreset();
}
function attackSelection() {
  $$('[data-attack]').forEach(button => button.classList.toggle('active', button.dataset.attack === editedAttack)); refreshFields();
}
function togglePlay() { playing = !playing; accumulator = 0; $('#play').textContent = playing ? 'Ⅱ' : '▶'; $('#play').setAttribute('aria-label', playing ? 'Pause playback' : 'Play animation'); }
function previewFighter() {
  const seconds = previewFrame / 60;
  const fighter = { x: 0, y: 0, speed: 0, facing: 1, health: 100, attack: null, blocking: false, stun: 0 };
  if (clip === 'walk') fighter.speed = config().movement.speed;
  if (clip === 'backstep') fighter.speed = -config().movement.speed;
  if (clip === 'jump') fighter.y = Math.max(0, config().movement.jumpVelocity * seconds - .5 * config().movement.gravity * seconds ** 2);
  if (clip === 'strike' || clip === 'heavy') { const spec = attackSpec(config(), clip); const age = animations[selected]?.[clip] ? previewFrame / clipFrames() * spec.duration : seconds; fighter.attack = { ...spec, type: clip, remaining: Math.max(0, spec.duration - age) }; }
  fighter.blocking = clip === 'block'; fighter.stun = clip === 'hit' && seconds < .32 ? .32 - seconds : 0;
  fighter.crouching = clip === 'crouch';
  if (REFERENCE_MOTIONS[clip]) fighter.reference = { id: clip, progress: previewFrame / clipFrames() };
  fighter.animationPlayback = { clip, frame: previewFrame };
  return fighter;
}
function liveInputs() {
  const input = { left: keys.has('KeyA'), right: keys.has('KeyD'), jump: keys.has('KeyW'), strike: keys.has('KeyF'), heavy: keys.has('KeyG'), block: keys.has('KeyS'), crouch: keys.has('KeyC') };
  const dummy = { ...IDLE, block: $('#dummy-mode').value === 'block' };
  counterClock -= 1 / 60;
  if ($('#dummy-mode').value === 'counter' && counterClock <= 0) { dummy.strike = true; counterClock = 1.25; }
  return [mergeInputs(input, padState.inputs[0]), dummy];
}
function advanceOneFrame() {
  if (mode === 'preview') {
    previewFrame += 1;
    if (previewFrame > clipFrames()) {
      if (loop) previewFrame = 0;
      else { previewFrame = clipFrames(); if (playing) togglePlay(); }
    }
  } else {
    const stopped = combat.hitstop > 0; combat.step(1 / 60, liveInputs());
    if (!stopped) simTime += 1 / 60;
    if (targetHeal > 0) { targetHeal -= 1 / 60; if (targetHeal <= 0) combat.fighters.forEach(f => { f.health = 100; }); }
  }
}
function updateGuides(fighter) {
  const move = fighter.attack ?? attackSpec(config(), clip === 'heavy' ? 'heavy' : editedAttack);
  attackGuide.visible = $('#ranges').checked && (mode === 'training' || clip === 'strike' || clip === 'heavy');
  attackGuide.position.set(fighter.x + fighter.facing * move.range / 2, fighter.y + 1.3, 0); attackGuide.scale.set(move.range, 2.2, .7);
  const phase = attackPhase(fighter.attack);
  attackGuide.material.color.set(phase === 'active' ? '#c5f090' : phase === 'startup' ? '#dec185' : '#a2a0cb');
  targetGuide.visible = $('#ranges').checked && mode === 'training';
  const target = combat.fighters[1]; targetGuide.position.set(target.x, target.y + 1.34, 0); targetGuide.scale.set(.9, 2.68, .8);
  const visible = $('#pivots').checked;
  pivotLines.visible = visible; pivotMarkers.forEach(marker => marker.visible = visible);
  if (visible && models[selected]) {
    models[selected].root.updateMatrixWorld(true);
    const points = pivotNames.map(name => models[selected].parts[name]?.object.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3());
    points.forEach((point, i) => pivotMarkers[i].position.copy(point));
    pivotEdges.forEach(([a, b], i) => { pivotPositions.set(points[a].toArray(), i * 6); pivotPositions.set(points[b].toArray(), i * 6 + 3); });
    pivotGeometry.attributes.position.needsUpdate = true;
  }
}

$$('[data-character]').forEach(button => button.addEventListener('click', () => {
  presetPreview = null;
  selected = button.dataset.character; $('#subject-name').textContent = selected.toUpperCase();
  $$('[data-character]').forEach(item => item.classList.toggle('active', item === button));
  if (selected !== 'leonardo' && REFERENCE_MOTIONS[clip]) clip = 'idle';
  resetTraining(); previewFrame = 0; refreshFields(); syncModels(); timeline(); cameraPreset();
}));
$$('[data-clip]').forEach(button => button.addEventListener('click', () => setClip(button.dataset.clip)));
$$('[data-tab]').forEach(button => button.addEventListener('click', () => {
  $$('[data-tab]').forEach(item => item.classList.toggle('active', item === button));
  $$('.panel').forEach(panel => panel.hidden = panel.id !== `panel-${button.dataset.tab}`);
}));
$$('[data-attack]').forEach(button => button.addEventListener('click', () => {
  editedAttack = button.dataset.attack; attackSelection();
  if (mode === 'preview') setClip(editedAttack); else timeline();
}));
$$('[data-camera]').forEach(button => button.addEventListener('click', () => cameraPreset(button.dataset.camera)));
$('#training').addEventListener('click', () => {
  presetPreview = null;
  mode = mode === 'preview' ? 'training' : 'preview'; resetTraining(); syncModels(); timeline(); cameraPreset();
  if (!playing) togglePlay(); if (mode === 'training') canvas.focus({ preventScroll: true });
  notice(mode === 'training' ? 'Live: keyboard or P1 controller. Move, punch, heavy, block, crouch. Target health recovers after contact.' : 'Preview active. Scrub or step through any action.');
});
$('#play').addEventListener('click', togglePlay);
$('#step').addEventListener('click', () => { if (playing) togglePlay(); advanceOneFrame(); });
$('#restart').addEventListener('click', () => { if (mode === 'training') resetTraining(); else previewFrame = 0; });
$('#loop').addEventListener('change', event => { loop = event.target.checked; });
$('#speed').addEventListener('change', event => { speed = Number(event.target.value); accumulator = 0; });
$('#scrub').addEventListener('input', event => { if (playing) togglePlay(); previewFrame = Number(event.target.value); });
$('#reset-target').addEventListener('click', resetTraining);
$('#distance').addEventListener('change', resetTraining);
for (const field of ['skin', 'mask']) $(`#${field}-color`).addEventListener('input', event => { config().appearance[field] = event.target.value; dirty(); syncModels(); });
$('#wireframe').addEventListener('change', syncModels);
$('#weapons').addEventListener('change', syncModels);
$('#reference-frame').addEventListener('click', () => { if (playing) togglePlay(); previewFrame = REFERENCE_MOTIONS[clip]?.contact ?? 0; });
$('#grid').addEventListener('change', () => { grid.visible = $('#grid').checked && $('#environment').value === 'studio'; });
$('#lighting').addEventListener('change', () => {
  const lighting = $('#lighting').value;
  key.color.set(lighting === 'cinematic' ? '#ffd3a3' : '#ffe5c1'); key.intensity = lighting === 'flat' ? 1.3 : 3;
  fill.color.set(lighting === 'cinematic' ? '#5c84ef' : '#b6cee2'); fill.intensity = lighting === 'flat' ? 1.3 : 1.5;
  rim.color.set(lighting === 'cinematic' ? '#32f1b2' : '#dce8df'); rim.intensity = lighting === 'flat' ? 0 : 2;
  ambient.intensity = lighting === 'flat' ? 2 : 1.2; scene.background.set(lighting === 'cinematic' ? '#0c1728' : '#1b2a31');
});
$('#environment').addEventListener('change', async () => {
  const rooftop = $('#environment').value === 'rooftop';
  floor.visible = !rooftop; grid.visible = !rooftop && $('#grid').checked; syncModels();
  if (roof) roof.visible = rooftop;
  if (rooftop && !roof) {
    try {
      notice('Loading rooftop environment...');
      roofPromise ??= new GLTFLoader().loadAsync('/models/midnight-dojo.glb');
      const gltf = await roofPromise;
      if (!roof) { roof = gltf.scene; roof.traverse(obj => { if (obj.isMesh) obj.receiveShadow = true; }); scene.add(roof); }
      roof.visible = $('#environment').value === 'rooftop'; notice('Rooftop loaded. Orbit to compare the silhouette against the stage.');
    } catch { roofPromise = null; $('#environment').value = 'studio'; floor.visible = true; grid.visible = $('#grid').checked; syncModels(); notice('Rooftop export could not load. Studio remains available.'); }
  }
});
$('#save').addEventListener('click', () => {
  try { localStorage.setItem(STORAGE_KEY, serializePreset(settings)); $('#save-state').textContent = 'SAVED TO BROWSER'; notice('Saved both characters. Reload the dojo to use this tuning.'); }
  catch { notice('Browser storage is unavailable. Export JSON to keep this preset.'); }
});
function download(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#export').addEventListener('click', () => { download(new Blob([serializePreset(settings)], { type: 'application/json' }), 'mutant-dojo-tuning.json'); notice('Preset exported for both characters.'); });
$('#import').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 100000) throw new Error('Preset is too large.'); settings = parsePreset(JSON.parse(await file.text())); refreshFields(); resetTraining(); syncModels(); timeline(); dirty(); notice('Preset imported. Save to apply it to the dojo.'); }
  catch (error) { notice(`Import rejected: ${error.message}`); }
  event.target.value = '';
});
$('#defaults').addEventListener('click', () => { settings[selected] = defaults(selected); refreshFields(); resetTraining(); syncModels(); timeline(); dirty(); notice(`${selected.toUpperCase()} reset to default tuning.`); });
$('#capture').addEventListener('click', () => {
  renderer.render(scene, camera); canvas.toBlob(blob => { if (blob) download(blob, `${selected}-${clip}-frame-${Math.round(previewFrame)}.png`); });
});
window.addEventListener('keydown', event => {
  if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName)) return;
  if (['KeyA', 'KeyD', 'KeyW', 'KeyF', 'KeyG', 'KeyS', 'KeyC', 'Space', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Space' && !event.repeat) togglePlay();
  if (event.code === 'ArrowRight' && !playing) advanceOneFrame();
  keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { keys.clear(); accumulator = 0; });
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas); resize(); refreshFields(); timeline(); resetTraining(); syncModels();
const loader = new GLTFLoader();
async function load() {
  try {
    const assets = await Promise.all(['leonardo', 'raphael'].map(name => loader.loadAsync(`/models/${name}.glb`)));
    assets.forEach((asset, i) => { const name = i ? 'raphael' : 'leonardo'; models[name] = createCharacter(asset); scene.add(models[name].root); });
    loaded = true; $('#load-status').hidden = true; syncModels(); notice('Drag to inspect. Choose an action, or enter the live contact test.');
    for (const name of ['practice-scout', 'practice-brute']) {
      loader.loadAsync(`/models/${name}.glb`).then(asset => {
        practiceModels[name] = createCharacter(asset); practiceModels[name].root.visible = false; scene.add(practiceModels[name].root); syncModels();
      }).catch(error => { console.error('Practice character could not load:', name, error); });
    }
  } catch (error) { console.error(error); $('#load-status').textContent = 'Character assets could not load. Run npm run art -- --fighters and reload.'; notice('Character export is missing or invalid.'); }
}
load();
let previous = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - previous) / 1000, .1); previous = now;
  padState = playControls.poll();
  if (loaded && padState.start[0]) {
    if (mode !== 'training') $('#training').click();
    else togglePlay();
  }
  if (loaded && playing) { accumulator += dt * speed; while (accumulator >= 1 / 60) { advanceOneFrame(); accumulator -= 1 / 60; } }
  if (loaded) {
    const fighter = mode === 'preview' ? previewFighter() : combat.fighters[0];
    if (mode === 'training' && (fighter.attack?.type ?? editedAttack) !== timelineType) timeline();
    poseCharacter(models[selected], fighter, mode === 'preview' ? previewFrame / 60 : simTime, config());
    if (presetPreview && mode === 'preview') {
      const model = presetPreview.source === 'turtle' ? models[selected] : practiceModels[presetPreview.source];
      if (model) {
        if (model !== models[selected]) poseCharacter(model, fighter, previewFrame / 60, config());
        applyAuthoredPose(model, sampleClip(presetPreview.preset.clip, previewFrame), fighter, config().pose.stance);
      }
    }
    keyframeEditor.apply(models[selected], fighter); keyframeEditor.update(); viewportEditor.update();
    updateCharacterEffects(models[selected], fighter);
    if (presetPreview?.source !== 'turtle' && practiceModels[presetPreview?.source]) updateCharacterEffects(practiceModels[presetPreview.source], fighter);
    if (mode === 'training') { poseCharacter(models[otherName()], combat.fighters[1], simTime, settings[otherName()]); updateCharacterEffects(models[otherName()], combat.fighters[1]); }
    updateGuides(fighter);
    $('#phase').textContent = fighter.reference ? 'REFERENCE POSE STUDY' : fighter.attack ? attackPhase(fighter.attack).toUpperCase() : fighter.stun > 0 ? 'HIT STUN' : fighter.blocking ? 'BLOCKING' : fighter.y > 0 ? 'AIRBORNE' : Math.abs(fighter.speed) > 0 ? 'WALKING' : 'IDLE';
    const frame = mode === 'preview' ? Math.round(previewFrame) : fighter.attack ? Math.round((fighter.attack.duration - fighter.attack.remaining) * 60) : Math.round(simTime * 60);
    const total = mode === 'preview' ? clipFrames() : fighter.attack ? Math.round(fighter.attack.duration * 60) : 'LIVE';
    $('#frame-display').textContent = `${String(frame).padStart(3, '0')} / ${total}`;
    if (mode === 'preview') $('#scrub').value = previewFrame;
    else $('#health-info').textContent = `SUBJECT ${combat.fighters[0].health} / 100 · DUMMY ${combat.fighters[1].health} / 100`;
  } else { attackGuide.visible = targetGuide.visible = pivotLines.visible = false; pivotMarkers.forEach(marker => marker.visible = false); }
  orbit.update(); renderer.render(scene, camera);
});
