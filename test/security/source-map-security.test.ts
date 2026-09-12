import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { packagePlayerRelease } from '../../src/release/player-packager.js';
import { collectFilesRecursively } from '../../src/release/release-manifest.js';

describe('Prompt 18 — Security Suite 6: Source Map Security & Anti-Exposure', () => {
  const rootDir = process.cwd();
  const testReleaseDir = path.resolve(rootDir, 'dist', 'test-sourcemap-security');

  before(() => {
    packagePlayerRelease({
      rootDir,
      releaseDir: testReleaseDir,
    });
  });

  it('1. Release distribution contains zero .map or .d.ts.map files', () => {
    const files = collectFilesRecursively(testReleaseDir);
    for (const f of files) {
      assert(!f.endsWith('.map'), `Release must not contain source map: ${f}`);
      assert(!f.endsWith('.d.ts.map'), `Release must not contain declaration map: ${f}`);
    }
  });

  it('2. JavaScript and CSS files in release contain zero sourceMappingURL references', () => {
    const files = collectFilesRecursively(testReleaseDir);
    const codeFiles = files.filter(
      (f) => (f.endsWith('.js') || f.endsWith('.css')) && !f.includes('release-validator')
    );

    for (const relPath of codeFiles) {
      const content = fs.readFileSync(path.join(testReleaseDir, relPath), 'utf-8');
      assert(!content.includes('sourceMappingURL='), `File '${relPath}' contains forbidden sourceMappingURL reference`);
    }
  });

  it('3. Public client bundle app.js has zero sourceMappingURL references', () => {
    const appJsPath = path.join(testReleaseDir, 'public', 'app.js');
    const content = fs.readFileSync(appJsPath, 'utf-8');
    assert(!content.includes('sourceMappingURL='), 'public/app.js must not contain sourceMappingURL');
  });

  it('4. Public stylesheet index.css has zero sourceMappingURL references', () => {
    const cssPath = path.join(testReleaseDir, 'public', 'index.css');
    const content = fs.readFileSync(cssPath, 'utf-8');
    assert(!content.includes('sourceMappingURL='), 'public/index.css must not contain sourceMappingURL');
  });
});
