import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const template = await readFile('scripts/service-worker.template.js', 'utf8');
const files = ['index.html', 'offline.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png'];
const hash = createHash('sha256').update(template);
for (const file of files) hash.update(await readFile('dist/' + file));
await writeFile('dist/sw.js', template.replaceAll('__VERSION__', hash.digest('hex').slice(0, 16)));
