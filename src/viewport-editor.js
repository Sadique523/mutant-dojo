import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { jointObject, jointForObject } from './viewport-selection.js';
import './viewport-editor.css';

export function setupViewportEditor({ scene, camera, canvas, orbit, editor, model, preview, pause, notify }) {
  const controls = new TransformControls(camera, canvas); controls.setMode('rotate'); controls.setSpace('local'); controls.setSize(.8);
  const helper = controls.getHelper(); scene.add(helper);
  const bounds = new THREE.Box3(), outline = new THREE.Box3Helper(bounds, '#a8f5cc');
  outline.material.depthTest = false; outline.material.transparent = true; outline.material.opacity = .65; outline.renderOrder = 1000; outline.visible = false; scene.add(outline);
  const bar = document.createElement('div'); bar.className = 'viewport-pose-tools';
  bar.innerHTML = '<button data-pose aria-pressed="true">POSE ON</button><button data-rotate aria-pressed="true">ROTATE · R</button><button data-move aria-pressed="false">MOVE · T</button><button data-root>WHOLE BODY</button><button data-key>ADD KEY · K</button><button data-save>SAVE CLIPS</button><label><input data-snap type="checkbox"> SNAP</label><span class="picked-joint">CLICK A BODY PART</span>';
  canvas.parentElement.append(bar);
  const $ = selector => bar.querySelector(selector), ray = new THREE.Raycaster(), point = new THREE.Vector2();
  let enabled = true, selectedObject = null, selectedModel = null, selectedName = null, armed = false;
  function clear() { controls.detach(); outline.visible = false; selectedObject = selectedModel = selectedName = null; $('.picked-joint').textContent = enabled ? 'CLICK A BODY PART' : 'CAMERA ORBIT'; }
  function focus() { canvas.focus({ preventScroll: true }); }
  function select(name) {
    if (!enabled || !preview() || !model()) return;
    pause(); editor.selectJoint(name);
    const object = jointObject(model(), name); if (!object) return;
    selectedObject = object; selectedModel = model(); selectedName = name; controls.attach(object);
    $('.picked-joint').textContent = name.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
    notify('Drag a colored ring or arrow to pose this joint. Add Key keeps the edited frame.');
  }
  function setMode(mode) {
    controls.setMode(mode); controls.setSpace(mode === 'rotate' ? 'local' : 'world');
    $('[data-rotate]').setAttribute('aria-pressed', String(mode === 'rotate')); $('[data-move]').setAttribute('aria-pressed', String(mode === 'translate')); focus();
  }
  $('[data-pose]').addEventListener('click', () => { enabled = !enabled; $('[data-pose]').textContent = enabled ? 'POSE ON' : 'POSE OFF'; $('[data-pose]').setAttribute('aria-pressed', String(enabled)); if (!enabled) clear(); focus(); });
  $('[data-rotate]').addEventListener('click', () => setMode('rotate'));
  $('[data-move]').addEventListener('click', () => setMode('translate'));
  $('[data-root]').addEventListener('click', () => { select('Root'); focus(); });
  $('[data-key]').addEventListener('click', () => { editor.addKey(); focus(); });
  $('[data-save]').addEventListener('click', () => { editor.save(); focus(); });
  $('[data-snap]').addEventListener('change', event => { controls.setRotationSnap(event.target.checked ? Math.PI / 12 : null); controls.setTranslationSnap(event.target.checked ? .05 : null); });
  controls.addEventListener('dragging-changed', event => { orbit.enabled = !event.value; });
  controls.addEventListener('mouseDown', () => { armed = editor.beginDirectEdit(); });
  controls.addEventListener('objectChange', () => { if (armed) editor.recordDirectEdit(); });
  controls.addEventListener('mouseUp', () => { armed = false; orbit.enabled = true; });
  // Capture selection before OrbitControls consumes the left mouse button.
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !enabled || !preview() || !model()) return;
    const rect = canvas.getBoundingClientRect(); point.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    if (controls.object) controls.pointerHover({ x: point.x, y: point.y, button: event.button });
    if (controls.axis !== null && controls.object) { orbit.enabled = false; focus(); return; }
    model().root.updateMatrixWorld(true); ray.setFromCamera(point, camera);
    const meshes = model().surfaces.map(surface => surface.object).filter(object => { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; });
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) {
      const name = event.shiftKey ? 'Root' : jointForObject(model(), hit.object);
      if (name) { event.preventDefault(); event.stopImmediatePropagation(); select(name); focus(); }
    } else clear();
  }, true);
  window.addEventListener('pointerup', () => { if (!controls.dragging) orbit.enabled = true; });
  function cancelDrag() {
    if (controls.dragging) { controls.reset(); controls.pointerUp(null); }
    armed = false; orbit.enabled = true;
  }
  window.addEventListener('blur', cancelDrag); canvas.addEventListener('pointercancel', cancelDrag);
  window.addEventListener('keydown', event => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) || !enabled || !preview()) return;
    if (event.code === 'KeyR') { event.preventDefault(); setMode('rotate'); }
    if (event.code === 'KeyT') { event.preventDefault(); setMode('translate'); }
    if (event.code === 'KeyK' && !event.repeat) { event.preventDefault(); editor.addKey(); }
    if (event.code === 'Escape') { cancelDrag(); clear(); }
  });
  return {
    update() {
      const active = enabled && preview(); controls.enabled = active;
      if (!active || model() !== selectedModel) { if (selectedObject) { cancelDrag(); clear(); } return; }
      if (selectedName && editor.selectedJoint !== selectedName && !controls.dragging) select(editor.selectedJoint);
      if (!selectedObject) return;
      model().root.updateMatrixWorld(true); bounds.makeEmpty();
      for (const surface of model().surfaces) {
        if (selectedName !== 'Root' && jointForObject(model(), surface.object) !== selectedName) continue;
        if (!surface.object.visible) continue;
        bounds.union(new THREE.Box3().setFromObject(surface.object));
      }
      outline.visible = !bounds.isEmpty();
    },
  };
}
