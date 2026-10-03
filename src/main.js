import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Combat } from './simulation.js';
import { loadSettings } from './tuning.js';
import { mergeInputs } from './controllers.js';
import { setupPlayControls } from './play-controls.js';
import { createSkeletalCharacter, poseCombatCharacters } from './skeletal-character.js';
import './style.css';

const $ = selector => document.querySelector(selector);
const playControls = setupPlayControls($('.toolbar'));
let padState = { inputs: [{}, {}], start: [false, false] };
const canvas = $('#arena');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#070e1d');
scene.fog = new THREE.FogExp2('#0b1727', .018);
const camera = new THREE.PerspectiveCamera(38, 1, .1, 150);
const fightTarget = new THREE.Vector3(0, 2.15, 0);
camera.position.set(0, 2.15, 13.8); camera.lookAt(fightTarget);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
const environmentMap = pmrem.fromScene(room, .04);
scene.environment = environmentMap.texture; scene.environmentIntensity = .22;
room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight('#819dcb', '#0c1520', .7));
function light(color, intensity, pos, shadow = false) {
  const source = new THREE.DirectionalLight(color, intensity);
  source.position.set(...pos); source.castShadow = shadow;
  if (shadow) {
    source.shadow.mapSize.set(2048, 2048);
    Object.assign(source.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, far: 40 });
    source.shadow.normalBias = .035; source.shadow.bias = -.0002;
  }
  scene.add(source); return source;
}
light('#8aabff', 2.6, [-6, 12, -5], true);
light('#ffd09a', 2.2, [3, 6, 8]); light('#31efbb', 1.8, [0, 4, -5]);
for (const x of [-7, -4, 4, 7]) {
  const lamp = new THREE.PointLight('#ff8b39', 12, 6, 2);
  lamp.position.set(x, 2.25, 4.7); scene.add(lamp);
}
const signLight = new THREE.PointLight('#1affb0', 22, 10, 2);
signLight.position.set(0, 3, -4); scene.add(signLight);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .35, .55, 1.2);
composer.addPass(bloom); composer.addPass(new OutputPass());
const orbit = new OrbitControls(camera, canvas);
orbit.target.copy(fightTarget); orbit.enabled = false; orbit.enableDamping = true;
orbit.minDistance = 5; orbit.maxDistance = 24; orbit.maxPolarAngle = Math.PI * .48;
const fightPosition = camera.position.clone();
let photoMode = false, started = false, loaded = false, paused = false;

// Rain uses one draw call. Environment geometry is imported from Blender.
const rainCount = 1300, rainPositions = new Float32Array(rainCount * 6);
const rainGeometry = new THREE.BufferGeometry();
for (let i = 0; i < rainCount; i++) {
  const n = i * 6;
  rainPositions[n] = Math.random() * 34 - 17;
  rainPositions[n + 1] = Math.random() * 20;
  rainPositions[n + 2] = Math.random() * 24 - 12;
  rainPositions[n + 3] = rainPositions[n] + .04;
  rainPositions[n + 4] = rainPositions[n + 1] + .24;
  rainPositions[n + 5] = rainPositions[n + 2];
}
rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#97b5d0', transparent: true, opacity: .18, depthWrite: false }));
scene.add(rain);
const sparkCount = 80, sparkPositions = new Float32Array(sparkCount * 3);
const sparkGeometry = new THREE.BufferGeometry();
sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
const sparkMaterial = new THREE.PointsMaterial({ color: '#ffe7a0', size: .055, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
const sparkVelocity = Array.from({ length: sparkCount }, () => new THREE.Vector3());
let sparkLife = 0, shake = 0;
function impact(event) {
  const f = simulation.fighters[event.target];
  sparkLife = .3; shake = event.blocked ? .035 : .10; sparks.visible = true;
  for (let i = 0; i < sparkCount; i++) {
    sparkPositions.set([f.x, f.y + 1.55, .3], i * 3);
    sparkVelocity[i].set((Math.random() - .5) * 8, Math.random() * 5, (Math.random() - .5) * 4);
  }
  $('#announcer').textContent = event.blocked ? 'BLOCK' : event.type === 'blueFlame' ? 'BLUE FLAME SPIN' : event.type === 'kick' ? 'KICK' : event.type === 'spinKick' ? 'SPINNING KICK' : event.heavy ? 'HEAVY STRIKE' : 'HIT';
  $('#announcer').classList.remove('pop'); void $('#announcer').offsetWidth; $('#announcer').classList.add('pop');
}
const savedSettings = loadSettings();
const configs = [savedSettings.leonardo, savedSettings.raphael];
const simulation = new Combat(impact, { settings: configs, unlimitedTime: true, rollPlayers: [true,true], kickPlayers: [true,false] }), keys = new Set();
const inputMap = [
  { left: 'KeyA', right: 'KeyD', jump: 'KeyW', strike: 'KeyF', heavy: 'KeyG', block: 'KeyS', crouch: 'KeyC', roll: 'KeyQ', kick: 'KeyE', spinKick: 'KeyR', blueFlame:'KeyT' },
  { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', strike: 'Slash', heavy: 'Period', block: 'ArrowDown', crouch: 'Comma', roll: 'ShiftRight' },
];
const gameKeys = new Set(inputMap.flatMap(input => Object.values(input)));
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement) return;
  if (gameKeys.has(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === 'Escape' && loaded && started) { paused = !paused; $('#pause-indicator').hidden = !paused; }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { keys.clear(); accumulator = 0; });
function inputs() { return inputMap.map((mapping, i) => mergeInputs(Object.fromEntries(Object.entries(mapping).map(([action, code]) => [action, keys.has(code)])), padState.inputs[i])); }
const models = [];
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, count, total) => { $('#load-detail').textContent = `Loading scene assets ${count}/${total}`; };
const loader = new GLTFLoader(manager);
async function load() {
  try {
    const assets = await Promise.all(['midnight-dojo', 'leonardo-skeletal', 'raphael-skeletal'].map(name => loader.loadAsync(`/models/${name}.glb`)));
    scene.add(assets[0].scene);
    assets.slice(1).forEach((gltf, i) => {
      const model = createSkeletalCharacter(gltf);
      scene.add(model.root); models.push(model); model.root.position.x = i ? 3 : -3;
    });
    scene.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = true;
      if (object.material) object.material.envMapIntensity = .45;
    });
    loaded = true; $('#load-detail').textContent = 'MIDNIGHT DOJO / READY';
    $('#start').disabled = false; $('#start').textContent = 'ENTER THE DOJO'; $('#photo').disabled = false;
  } catch (error) {
    console.error('Blender asset loading failed:', error);
    manager.onProgress = () => {};
    $('#load-detail').textContent = 'Blender exports are missing. Install Blender, then run npm run art and reload.';
    $('#start').textContent = 'AWAITING BLENDER ASSETS'; $('#asset-help').hidden = false;
  }
}
load();
$('#start').addEventListener('click', () => {
  started = true; keys.clear(); simulation.reset(); $('#title-screen').classList.add('dismissed'); $('#hud').hidden = false;
});
$('#reset').addEventListener('click', () => {
  simulation.reset(); keys.clear(); paused = false; $('#pause-indicator').hidden = true; $('#winner').hidden = true;
});
$('#play-again').addEventListener('click', () => $('#reset').click());
$('#photo').addEventListener('click', () => {
  photoMode = !photoMode; orbit.enabled = photoMode;
  $('#photo').textContent = photoMode ? 'RETURN TO FIGHT' : 'PHOTO MODE'; $('#hud').hidden = photoMode || !started;
  if (photoMode) { $('#title-screen').classList.add('dismissed'); orbit.target.set(0, 1, 0); }
  else { camera.position.copy(fightPosition); camera.lookAt(fightTarget); if (!started) $('#title-screen').classList.remove('dismissed'); }
});
$('#wireframe').addEventListener('change', event => scene.traverse(object => {
  if (object.isMesh) for (const material of [].concat(object.material)) material.wireframe = event.target.checked;
}));
$('#quality').addEventListener('change', event => {
  const high = event.target.value === 'high';
  renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.6 : 1));
  renderer.shadowMap.enabled = high; bloom.enabled = high; rain.visible = high; resize();
});
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = camera.aspect < 1.3 ? 52 : 38; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas); resize();
let previous = performance.now(), accumulator = 0, elapsed = 0;
const STEP = 1 / 60;
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - previous) / 1000, .1); previous = now; elapsed += dt;
  padState = playControls.poll();
  if (loaded && padState.start.some(Boolean)) {
    if (!started) $('#start').click();
    else if (simulation.winner !== null) $('#reset').click();
    else if (!photoMode) { paused = !paused; $('#pause-indicator').hidden = !paused; }
  }
  if (loaded && started && !paused && !photoMode && simulation.winner === null) {
    accumulator += dt;
    while (accumulator >= STEP && simulation.winner === null) {
      const advanceAnimation = simulation.winner === null && simulation.hitstop <= 0;
      simulation.step(STEP, inputs());
      poseCombatCharacters(models,simulation,advanceAnimation?STEP:0);
      accumulator -= STEP;
    }
  } else accumulator = 0;
  poseCombatCharacters(models,simulation,(!started||simulation.winner!==null)&&!photoMode&&!paused?dt:0);
  for (let i = 0; i < rainCount; i++) {
    const n = i * 6; rainPositions[n + 1] -= dt * 13;
    if (rainPositions[n + 1] < -.5) rainPositions[n + 1] = 20;
    rainPositions[n + 4] = rainPositions[n + 1] + .24;
  }
  rainGeometry.attributes.position.needsUpdate = true;
  if (sparkLife > 0) {
    sparkLife -= dt; sparkMaterial.opacity = Math.max(0, sparkLife / .3);
    for (let i = 0; i < sparkCount; i++) {
      sparkVelocity[i].y -= dt * 12;
      for (let axis = 0; axis < 3; axis++) sparkPositions[i * 3 + axis] += sparkVelocity[i].getComponent(axis) * dt;
    }
    sparkGeometry.attributes.position.needsUpdate = true;
  } else sparks.visible = false;
  if (photoMode) orbit.update();
  else { camera.position.copy(fightPosition); camera.position.x += Math.sin(elapsed * 81) * shake; camera.position.y += Math.cos(elapsed * 67) * shake; camera.lookAt(fightTarget); shake = Math.max(0, shake - dt * .5); }
  simulation.fighters.forEach((fighter, i) => { $(`#p${i + 1}-health`).style.transform = `scaleX(${fighter.health / 100})`; });
  $('#timer').textContent = simulation.unlimitedTime ? '∞' : String(Math.ceil(simulation.time)).padStart(2, '0');
  if (simulation.winner !== null && started) { $('#winner').hidden = photoMode; $('#winner-name').textContent = simulation.winner === 'draw' ? 'DRAW' : simulation.winner === 0 ? 'PLAYER 1 · LEONARDO WINS' : 'PLAYER 2 · RAPHAEL WINS'; }
  composer.render();
});
