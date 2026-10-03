import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  build: { rolldownOptions: { input: { dojo: fileURLToPath(new URL('./index.html', import.meta.url)), lab: fileURLToPath(new URL('./lab.html', import.meta.url)), motion: fileURLToPath(new URL('./motion.html', import.meta.url)) } } },
});
