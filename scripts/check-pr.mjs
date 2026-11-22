import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const { PR_TITLE = '', PR_BRANCH = '', BASE_SHA, HEAD_SHA, PR_FORK } = process.env;
const title = PR_TITLE.match(/^(feat|fix|docs|test|refactor|perf|build|ci|chore|revert)(?:\((CLP-[1-9]\d*)\))?!?: \S.*$/);
if (!title || !BASE_SHA || !HEAD_SHA) {
  console.error('Formato esperado: feat(CLP-5): registrar solicitudes o ci: actualizar comprobaciones.');
  process.exit(1);
}

const files = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', BASE_SHA + '...' + HEAD_SHA, '--'], { encoding: 'utf8' }).split('\0');
const product = files.some((path) => /^(?:frontend\/|backend\/|package(?:-lock)?\.json$)/.test(path));
const issue = title[2];
const errors = [];
if (product && !issue) errors.push('Los cambios de producto requieren una clave CLP en el título.');
if (issue && PR_FORK !== 'true') {
  const branch = PR_BRANCH.replace(/^codex\//, '');
  if (branch !== issue && !branch.startsWith(issue + '-')) errors.push('La rama debe empezar por ' + issue + '- o codex/' + issue + '-.');
}
if (product && issue && !files.some((path) => /^docs\/epicas\/CLP-\d+\/CLP-\d+\.mc$/.test(path)
  && path.endsWith('/' + issue + '.mc') && existsSync(path))) {
  errors.push('Actualiza la ficha de ' + issue + ' en docs/epicas.');
}
if (errors.length) console.error(errors.join('\n'));
else console.log('Convenciones del PR verificadas.');
process.exitCode = errors.length ? 1 : 0;
