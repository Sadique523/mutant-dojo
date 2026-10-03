import { Controllers } from './controllers.js';
import { DojoMusic } from './music.js';
import './play-controls.css';
import { setupControllerSettings } from './controller-settings.js';

export function setupPlayControls(parent) {
  const controllers = new Controllers(), music = new DojoMusic();
  const panel = document.createElement('div'); panel.className = 'play-controls';
  panel.innerHTML = '<button type="button" class="music-toggle" aria-pressed="false">MUSIC OFF</button><label class="music-volume">VOL <input type="range" min="0" max="1" step=".05" value=".25" aria-label="Music volume"></label><span class="controller-status" role="status">PAD: PRESS A BUTTON</span>';
  parent.append(panel);
  const controllerSettings = setupControllerSettings(panel, controllers);
  const toggle = panel.querySelector('button'), status = panel.querySelector('.controller-status'), volume = panel.querySelector('input');
  try { music.setVolume(localStorage.getItem('mutant-dojo:volume') ?? .25); volume.value = music.volume; } catch { /* Optional preference. */ }
  function refresh() { toggle.textContent = music.enabled ? 'MUSIC ON' : 'MUSIC OFF'; toggle.setAttribute('aria-pressed', String(music.enabled)); }
  toggle.addEventListener('click', async () => {
    if (music.enabled) music.stop();
    else try { await music.play(); toggle.title = 'Original Midnight Circuit synth groove'; } catch (error) { toggle.title = error.message; toggle.textContent = 'AUDIO UNAVAILABLE'; return; }
    refresh();
  });
  volume.addEventListener('input', () => { music.setVolume(volume.value); try { localStorage.setItem('mutant-dojo:volume', music.volume); } catch { /* Optional preference. */ } });
  let resumeAfterHidden = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { resumeAfterHidden = music.enabled; music.stop(); }
    else if (resumeAfterHidden) { resumeAfterHidden = false; music.play().then(refresh).catch(() => refresh()); }
    refresh();
  });
  window.addEventListener('pagehide', () => music.stop());
  let lastStatus = '';
  return {
    poll() {
      const focused = !document.hidden && document.hasFocus();
      const state = controllers.poll(focused && !controllerSettings.open);
      controllerSettings.update(state);
      const label = state.error ? 'PAD: BROWSER ACCESS ERROR' : state.connected.some(Boolean) ? !focused ? 'PAD: CLICK GAME TO FOCUS' : state.connected.map((connected, i) => `P${i + 1}: ${connected ? 'PAD' : 'KEYS'}`).join(' / ') + (state.unsupported ? ' / CUSTOM LAYOUT' : '') : 'PAD: PRESS A BUTTON';
      if (label !== lastStatus) { status.textContent = label; lastStatus = label; }
      return state;
    },
  };
}
