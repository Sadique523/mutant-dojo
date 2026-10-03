import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Set BLENDER_PATH for a custom installation. Official portable ZIPs work too.
const candidates = [process.env.BLENDER_PATH, 'blender'];
const savedPath = resolve('tools/blender-path.txt');
if (existsSync(savedPath)) candidates.splice(1, 0, readFileSync(savedPath, 'utf8').trim());
for (const base of ['C:/Program Files/Blender Foundation', resolve('tools')]) {
  if (!existsSync(base)) continue;
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (entry.isDirectory() && /blender/i.test(entry.name)) candidates.push(join(base, entry.name, 'blender.exe'));
  }
}
let blender;
for (const candidate of candidates.filter(Boolean)) {
  const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (probe.status === 0) { blender = candidate; break; }
}
if (!blender) {
  console.error('Blender was not found. Install Blender from https://www.blender.org/download/ or extract its portable ZIP into tools/. Alternatively set BLENDER_PATH to blender.exe, then run npm run art.');
  process.exit(1);
}
mkdirSync(resolve('public/models'), { recursive: true });
const preview = process.argv.includes('--preview');
const skeletal = process.argv.includes('--skeletal');
console.log(`${preview ? 'Rendering preview' : 'Building art'} with ${blender}`);
const script = resolve(skeletal ? (preview ? 'art/render_skeletal_leo.py' : 'art/build_skeletal_leo.py') : (preview ? 'art/render_preview.py' : 'art/build_scene.py'));
const argumentsForScript = preview || skeletal ? [resolve('.'), ...(skeletal && !preview && process.argv.includes('--raphael') ? ['raphael'] : [])] : ['--output', resolve('public/models'), '--source', resolve('art'), ...process.argv.slice(2)];
const result = spawnSync(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', ...argumentsForScript], { stdio: 'inherit', env: { ...process.env, PYTHONUNBUFFERED: '1' } });
if (result.error) console.error(`Could not launch Blender: ${result.error.message}`);
process.exit(result.status ?? 1);
