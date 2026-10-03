import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { inspectRig, compatibleClip, inPlaceClip } from './skeletal-clips.js';
import { gameplayClips } from './skeletal-character.js';
import { createBlueFlame } from './blue-flame.js';
import './skeletal-workbench.css';

const $ = id => document.getElementById(id), canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a2a32');
const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, .04).texture; room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight('#e8f4ff', '#485c51', 2));
const light = new THREE.DirectionalLight('#ffe5c1', 3); light.position.set(4, 6, 4); scene.add(light);
scene.add(new THREE.GridHelper(12, 24, '#67877d', '#344953'));
const camera = new THREE.PerspectiveCamera(35, 1, .01, 1000); camera.position.set(4, 2.5, 5);
const orbit = new OrbitControls(camera, canvas); orbit.target.set(0, 1, 0); orbit.enableDamping = true;
let model, wrapper, helper, mixer, action, flame, clips = [], playing = true, current = 0, busy = false;
const status = message => { $('status').textContent = message; };
const approved = document.createElement('section');
approved.innerHTML = '<h2>Approved for Leo</h2><p class="hint">Motion references selected for the skeletal rig pass.</p>';
for (const [label, name] of [['Game idle', 'Combat_Idle'], ['Game block', 'Combat_Guard'], ['Front kick', 'Combat_FrontKick'], ['Spinning kick', 'Combat_SpinKick'], ['Blue flame special', 'Combat_BlueFlameSpin'], ['Sword attack', 'Sword_Attack'], ['Crouch', 'Crouch_Idle_Loop'], ['Crouch walk', 'Crouch_Fwd_Loop'], ['Roll', 'Roll'], ['Roll with travel', 'Roll_RM']]) {
  const button = document.createElement('button'); button.textContent = label;
  button.style.margin = '0 6px 8px 0';
  button.onclick = () => {
    const index = clips.findIndex(clip => clip.name === name);
    if (index < 0) return status('Load the Quaternius library to preview this reference.');
    if (name === 'Roll_RM') $('in-place').checked = false;
    selectClip(index); playing = true; $('play').textContent = 'PAUSE';
    status(`${label}: ${name.startsWith('Combat_') ? 'same clip used in gameplay' : 'motion reference'}.`);
  };
  approved.append(button);
}
document.querySelector('aside').insertBefore(approved, document.querySelector('.upload'));
const leoButton = document.createElement('button'); leoButton.textContent = 'PREVIEW RIGGED LEO';
const leoNote = document.createElement('p'); leoNote.className = 'hint';
leoNote.textContent = 'Leo: library motions, captured kicks and the Blender-authored Blue flame special. The special holds one extended leg through two full spins before landing; gameplay has three hit windows. Flame is a runtime effect, not part of GLB export.';
approved.before(leoButton, leoNote);
const motionCredits=document.createElement('a');motionCredits.href='/motions/accad/CREDITS.md';motionCredits.textContent='Kick motion capture: ACCAD / Ohio State — CC BY 3.0';leoNote.append(document.createElement('br'),motionCredits);
const raphButton=document.createElement('button');raphButton.textContent='PREVIEW RIGGED RAPHAEL';
leoNote.after(raphButton);

async function loadFiles(files) {
  const urls = new Map();
  for (const file of files) {
    if (urls.has(file.name)) throw new Error(`Duplicate filename: ${file.name}`);
    urls.set(file.name, URL.createObjectURL(file));
  }
  const manager = new THREE.LoadingManager();
  let loading = false, finishLoading;
  manager.onStart = () => { loading = true; };
  manager.onLoad = () => { loading = false; finishLoading?.(); };
  manager.setURLModifier(url => {
    const name = decodeURIComponent(url.split(/[\\/]/).pop());
    if (urls.has(name)) return urls.get(name);
    if (/^(blob:|data:)/.test(url)) return url;
    throw new Error(`Missing dependency ${name}. Select it together with the model.`);
  });
  try {
    const assets = [];
    for (const file of files.filter(f => /\.(glb|gltf|fbx)$/i.test(f.name))) {
      const url = urls.get(file.name);
      if (/\.fbx$/i.test(file.name)) {
        const object = await new FBXLoader(manager).loadAsync(url); assets.push({ root: object, clips: object.animations, name: file.name });
      } else {
        const gltf = await new GLTFLoader(manager).loadAsync(url); assets.push({ root: gltf.scene, clips: gltf.animations, name: file.name });
      }
    }
    if (!assets.length) throw new Error('Select an FBX, GLB or glTF file.');
    if (loading) await new Promise(resolve => { finishLoading = resolve; });
    return assets;
  } finally { for (const url of urls.values()) URL.revokeObjectURL(url); }
}

function dispose(root) {
  const textures = new Set(), materials = new Set(), geometries = new Set();
  root?.traverse(node => { if (node.geometry) geometries.add(node.geometry); for (const mat of [].concat(node.material || [])) { materials.add(mat); for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value); } });
  textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
}
function selectClip(index, preserveTime = 0) {
  current = index; mixer?.stopAllAction();
  action = null;
  if (!clips[index]) return;
  const clip = $('in-place').checked ? inPlaceClip(clips[index], model) : clips[index];
  action = mixer.clipAction(clip); action.play(); action.time = Math.min(preserveTime, clip.duration); mixer.update(0);
  $('scrub').max = clip.duration; $('clips').value = index;
}
function updateList() {
  $('clips').replaceChildren(...clips.map((clip, i) => new Option(clip.name || `Clip ${i + 1}`, i)));
  const rig = inspectRig(model); $('stats').textContent = `${rig.skins} skinned meshes · ${rig.bones.length} bones · ${clips.length} clips`;
}
function installAsset(asset) {
  flame=null;
  const rig = inspectRig(asset.root);
      if (!rig.skins || !rig.bones.length) throw new Error('This model has no skinned skeleton. Export an armature with skin weights from Blender.');
      mixer?.stopAllAction(); if (model) mixer.uncacheRoot(model);
      scene.remove(wrapper, helper); dispose(model); helper?.dispose();
      model = asset.root; wrapper = new THREE.Group(); wrapper.add(model); scene.add(wrapper);
      // Normalize in a parent group, leaving the skeleton and animation tracks intact.
      const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const scale = 2.6 / Math.max(size.y, .001); wrapper.scale.setScalar(scale); wrapper.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      helper = new THREE.SkeletonHelper(model); helper.visible = $('bones').checked; scene.add(helper);
      clips = asset.clips.filter(c => compatibleClip(model, c).valid); mixer = new THREE.AnimationMixer(model);
      camera.position.set(4, 2.7, 5); orbit.target.set(0, 1.3, 0); orbit.update();
      updateList(); selectClip(0); status(`Loaded ${asset.name}. ${clips.length ? 'Choose a clip and inspect the movement.' : 'Rig ready. Add animations in step 2.'}`);
}
async function importFiles(input, character) {
  if (busy || !input.files.length) return;
  busy = true; status('Reading local assets…');
  let assets = [];
  try {
    assets = await loadFiles([...input.files]);
    if (character) {
      if (assets.length !== 1) throw new Error('Load one character model at a time. Add animation files in step 2.');
      installAsset(assets[0]);
    } else {
      if (!model) throw new Error('Load a rigged character first.');
      const accepted = [], rejected = [];
      for (const asset of assets) for (const original of asset.clips) {
        const result = compatibleClip(model, original);
        if (!result.valid) { rejected.push(`${original.name || asset.name}: ${result.missing.length} unmatched tracks`); continue; }
        const clip = original.clone(); clip.name = `${asset.name.replace(/\.[^.]+$/, '')} / ${clip.name || 'Animation'}`; accepted.push(clip);
      }
      const first = clips.length; clips.push(...accepted); updateList(); if (accepted.length) selectClip(first);
      status(`Added ${accepted.length} clips.${rejected.length ? ` Rejected incompatible clips: ${rejected.join('; ')}. Retarget these in Blender first.` : ''}${!accepted.length && !rejected.length ? ' No animation clips found.' : ''}`);
    }
  } catch (error) { status(error.message); }
  finally { if (!character || assets[0]?.root !== model) assets.forEach(a => dispose(a.root)); busy = false; input.value = ''; }
}
$('character').onchange = event => importFiles(event.target, true);
$('animations').onchange = event => importFiles(event.target, false);
$('clips').onchange = () => selectClip(Number($('clips').value));
$('in-place').onchange = () => selectClip(current, action?.time || 0);
$('bones').onchange = () => { if (helper) helper.visible = $('bones').checked; };
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'PAUSE' : 'PLAY'; };
$('reset').onclick = () => selectClip(current);
$('scrub').oninput = () => { if (!action) return; playing = false; $('play').textContent = 'PLAY'; action.time = Number($('scrub').value); mixer.update(0); };
$('export').onclick = async () => {
  if (!model || busy) return status('Load a rigged character first.');
  busy = true;
  const wasTime = action?.time || 0;
  try {
    mixer.stopAllAction(); model.traverse(n => { if (n.isSkinnedMesh) n.skeleton.pose(); });
    const data = await new GLTFExporter().parseAsync(model, { binary: true, animations: clips, onlyVisible: false });
    const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
    const link = document.createElement('a'); link.href = url; link.download = 'rigged-character-clips.glb'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Exported original rig and clips. In-place preview changes are not baked into this export.');
  } catch (error) { status(`Export failed: ${error.message}`); }
  finally { selectClip(current, wasTime); busy = false; }
};
let last = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - last) / 1000, .05); last = now;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) { renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  if (mixer && playing && !busy) mixer.update(dt * Number($('speed').value));
  if (action) { $('scrub').value = action.time; $('time').textContent = `${action.time.toFixed(2)}s / ${action.getClip().duration.toFixed(2)}s`;flame?.update(action.getClip().name==='Combat_BlueFlameSpin'?action.time/action.getClip().duration:null,action.time,playing&&!busy?dt:0); }
  orbit.update(); renderer.render(scene, camera);
});

async function loadSample(character = null) {
  if (busy) return; busy = true; status(character ? `Loading skeletal ${character}...` : 'Loading Quaternius animation library...');
  try {
    const gltf = await new GLTFLoader().loadAsync(character ? `/models/${character}-skeletal.glb` : '/motions/quaternius/AnimationLibrary_Godot_Standard.gltf');
    if(character) gltf.animations.push(...gameplayClips(gltf.scene,gltf.animations));
    installAsset({ root: gltf.scene, clips: gltf.animations, name: character ? `${character} skeletal binding study` : 'Quaternius Standard / CC0' });
    flame=character==='leonardo'?createBlueFlame(model):null;
    const idle = clips.findIndex(c => c.name === (character ? 'Combat_Idle' : 'Idle_Loop')); selectClip(Math.max(0, idle));
  } catch (error) { status('Library load failed: ' + error.message); }
  finally { busy = false; }
}
leoButton.onclick = () => loadSample('leonardo');
raphButton.onclick = () => loadSample('raphael');
$('sample').onclick = () => loadSample();
loadSample('leonardo');
