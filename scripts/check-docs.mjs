import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = resolve(root, 'docs');
const [base, head, ...extra] = process.argv.slice(2);
const errors = [];

function checkLinks() {
  if (!existsSync(resolve(docs, 'README.mc'))) {
    errors.push('Falta docs/README.mc.');
    return;
  }

  for (const entry of readdirSync(docs, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.mc')) continue;
    const path = resolve(entry.parentPath, entry.name);
    const content = readFileSync(path, 'utf8');
    for (const [, target] of content.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = target.split('#')[0];
      if (!link || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(link)) continue;
      if (!existsSync(resolve(dirname(path), link))) {
        errors.push(`${relative(root, path)}: enlace local inexistente (${target}).`);
      }
    }
  }
}

function checkPullRequest() {
  const args = ['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`, '--'];
  const changes = execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\0');
  const productChanged = changes.some(
    (path) => /^(?:frontend\/|backend\/|package(?:-lock)?\.json$)/.test(path),
  );
  const storyUpdated = changes.some(
    (path) => /^docs\/epicas\/CLP-\d+\/CLP-\d+\.mc$/.test(path) && existsSync(resolve(root, path)),
  );
  if (productChanged && !storyUpdated) {
    errors.push('El PR cambia el producto. Actualiza una ficha docs/epicas/CLP-<épica>/CLP-<HU>.mc.');
  }
}

if (Boolean(base) !== Boolean(head) || extra.length) {
  console.error('Uso: node scripts/check-docs.mjs [<base> <head>]');
  process.exitCode = 1;
} else {
  checkLinks();
  if (base && head) checkPullRequest();

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log('Documentación verificada.');
  }
}
