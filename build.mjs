import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import webExt from 'web-ext';

const dev = process.argv.includes('--dev');
const e2e = process.argv.includes('--e2e');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const ARTIFACTS = 'web-ext-artifacts';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('static', 'dist', { recursive: true });

const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8'));
manifest.version = pkg.version;
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

await build({
  entryPoints: { background: 'src/background.ts', content: 'src/content.ts' },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'firefox128',
  minify: false,
  sourcemap: dev ? 'inline' : false,
  define: { __E2E__: JSON.stringify(e2e) },
  logLevel: 'info',
});
console.log(`Built Tupo Replay ${pkg.version} -> dist/${e2e ? ' (e2e hooks, no zip)' : ''}`);

if (!e2e) {
  const { extensionPath } = await webExt.cmd.build(
    { sourceDir: 'dist', artifactsDir: ARTIFACTS, filename: `tupo-replay-${pkg.version}.zip`, overwriteDest: true },
    { shouldExitProgram: false },
  );
  console.log(`Extension zip -> ${extensionPath}`);
  const sourceZip = `${ARTIFACTS}/tupo-replay-${pkg.version}-source.zip`;
  try {
    execFileSync('git', ['archive', '--format=zip', '-o', sourceZip, 'HEAD'], { stdio: 'pipe' });
    console.log(`Source zip (last commit) -> ${sourceZip}`);
  } catch {
    console.warn('Source zip skipped: no git commit yet.');
  }
}
