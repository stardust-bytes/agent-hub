import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

console.log('[build] Installing frontend deps...');
execSync('npm ci', { cwd: resolve(ROOT, 'frontend'), stdio: 'inherit' });

console.log('[build] Building frontend...');
execSync('npm run build', { cwd: resolve(ROOT, 'frontend'), stdio: 'inherit' });

console.log('[build] Installing backend deps...');
execSync('npm ci', { cwd: resolve(ROOT, 'backend'), stdio: 'inherit' });

console.log('[build] Building backend...');
execSync('npm run build', { cwd: resolve(ROOT, 'backend'), stdio: 'inherit' });
