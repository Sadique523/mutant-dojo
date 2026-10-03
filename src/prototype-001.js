import * as THREE from 'three';
import './style.css';

// A canvas is the display surface. The renderer draws our scene into it.
const canvas = document.querySelector('#arena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#253b46');
scene.fog = new THREE.Fog('#253b46', 23, 55);
// Orthographic projection keeps distant objects the same apparent size.
const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, .1, 100);
camera.position.set(12, 13, 18);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight('#fff3cc', '#364b67', 2.2));
const sun = new THREE.DirectionalLight('#ffe2ac', 3);
sun.position.set(-6, 14, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15 });
scene.add(sun);

const materials = [];
function material(color) { const m = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }); materials.push(m); return m; }
const stone = material('#495a66'), sand = material('#d8c997'), trim = material('#375f56');
function box(parent, size, position, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
box(scene, [14, 1, 7], [0, -0.7, 0], stone);
box(scene, [13.6, .15, 6.6], [0, -.125, 0], sand);
for (const z of [-3.35, 3.35]) box(scene, [14, .2, .16], [0, 0, z], trim);
for (const x of [-6.9, 6.9]) box(scene, [.16, .2, 6.8], [x, 0, 0], trim);
for (const x of [-4.8, 4.8]) box(scene, [.08, .02, 6.4], [x, -.035, 0], material(x < 0 ? '#7298ad' : '#bf6d56'));
const ring = new THREE.Mesh(new THREE.RingGeometry(.85, .89, 40), material('#eee5c3'));
ring.rotation.x = -Math.PI / 2; ring.position.y = -.035; scene.add(ring);

// Deterministic scenery makes screenshots and later comparisons repeatable.
let seed = 42;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
for (let i = 0; i < 30; i++) {
  const x = (random() - .5) * 42, z = -8 - random() * 20, h = 2 + random() * 12;
  box(scene, [2 + random() * 2, h, 2.5], [x, h / 2 - 5, z], stone);
}
const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd080' });
for (const x of [-6.5, 0, 6.5]) for (const z of [-3.1, 3.1]) {
  box(scene, [.14, .8, .14], [x, .4, z], trim);
  const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(.22, 0), flameMat);
  flame.position.set(x, .95, z); scene.add(flame);
}

function makeFighter(x, maskColor) {
  const root = new THREE.Group(); scene.add(root);
  const skin = material('#648b45'), shell = material('#405c32'), front = material('#c8ad65'), mask = material(maskColor);
  box(root, [.75, .9, .48], [0, 1.05, 0], skin);
  box(root, [.65, .78, .2], [0, 1.08, .28], front);
  box(root, [.9, 1, .28], [0, 1.1, -.32], shell);
  box(root, [.6, .52, .55], [0, 1.77, 0], skin);
  box(root, [.63, .13, .57], [0, 1.83, .02], mask);
  for (const eyeX of [-.16, .16]) box(root, [.12, .075, .025], [eyeX, 1.85, .318], material('#f6edd2'));
  box(root, [.78, .14, .57], [0, .75, 0], material('#705440'));
  const legs = [-1, 1].map(side => box(root, [.28, .65, .32], [side * .24, .34, 0], skin));
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * .48, 1.4, 0); root.add(pivot);
    box(pivot, [.24, .65, .25], [0, -.27, 0], skin);
    box(pivot, [.26, .13, .27], [0, -.35, 0], mask);
    return pivot;
  });
  root.position.x = x;
  return { root, arms, legs, health: 100, velocityY: 0, attack: 0, cooldown: 0, hit: false, flash: 0 };
}
const fighters = [makeFighter(-2, '#5a96c1'), makeFighter(2, '#bc594b')];
const keys = new Set();
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', '/', 'w', 'a', 'd', 'f'].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
function reset() {
  fighters.forEach((f, i) => { f.health = 100; f.root.position.set(i ? 2 : -2, 0, 0); f.velocityY = f.attack = f.cooldown = 0; });
  keys.clear(); document.querySelector('#status').textContent = 'TRAINING';
}
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#wireframe').addEventListener('change', e => materials.forEach(m => m.wireframe = e.target.checked));
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  const halfHeight = 6.4;
  camera.left = -halfHeight * w / h; camera.right = halfHeight * w / h;
  camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas); resize();

let previous = performance.now(), elapsed = 0;
const controls = [['a', 'd', 'w', 'f'], ['arrowleft', 'arrowright', 'arrowup', '/']];
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - previous) / 1000, .04); previous = now; elapsed += dt;
  const ended = fighters.some(f => f.health <= 0);
  fighters.forEach((f, i) => {
    const other = fighters[1 - i], [left, right, jump, strike] = controls[i];
    const direction = other.root.position.x >= f.root.position.x ? 1 : -1;
    f.root.rotation.y = direction * Math.PI / 2;
    let movement = 0;
    if (!ended) {
      movement = Number(keys.has(right)) - Number(keys.has(left));
      f.root.position.x = THREE.MathUtils.clamp(f.root.position.x + movement * dt * 3, -6, 6);
      if (keys.has(jump) && f.root.position.y === 0) f.velocityY = 6;
      if (keys.has(strike) && f.cooldown <= 0) { f.attack = .3; f.cooldown = .55; f.hit = false; }
    }
    f.velocityY -= 17 * dt;
    f.root.position.y = Math.max(0, f.root.position.y + f.velocityY * dt);
    if (f.root.position.y === 0) f.velocityY = 0;
    f.cooldown -= dt; f.attack = Math.max(0, f.attack - dt);
    if (!ended && f.attack > .08 && f.attack < .22 && !f.hit && Math.abs(f.root.position.x - other.root.position.x) < 1.8 && Math.abs(f.root.position.y - other.root.position.y) < 1) {
      other.health = Math.max(0, other.health - 10); f.hit = true; other.flash = .15;
      other.root.position.x = THREE.MathUtils.clamp(other.root.position.x + direction * .35, -6, 6);
    }
    f.arms[1].rotation.x = f.attack > 0 ? -Math.sin(f.attack / .3 * Math.PI) * 1.7 : -.25;
    f.arms[0].rotation.x = -.35;
    f.legs.forEach((leg, j) => leg.rotation.x = movement ? Math.sin(elapsed * 12 + j * Math.PI) * .4 : 0);
    f.flash = Math.max(0, f.flash - dt); f.root.scale.setScalar(f.flash > 0 ? 1.04 : 1);
    document.querySelector(`#p${i + 1}-health`).style.width = `${f.health}%`;
  });
  // Resolve overlap so fighters cannot walk through one another on the ground.
  const [a, b] = fighters, gap = b.root.position.x - a.root.position.x;
  if (Math.abs(gap) < .85 && Math.abs(a.root.position.y - b.root.position.y) < 1.4) {
    const correction = (.85 - Math.abs(gap)) / 2, sign = gap >= 0 ? 1 : -1;
    a.root.position.x -= correction * sign; b.root.position.x += correction * sign;
  }
  if (fighters.some(f => f.health === 0)) document.querySelector('#status').textContent = fighters[0].health === 0 ? 'RAPH WINS' : 'LEO WINS';
  renderer.render(scene, camera);
});
