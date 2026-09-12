import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { packagePlayerRelease } from '../../src/release/player-packager.js';
import { collectFilesRecursively } from '../../src/release/release-manifest.js';

describe('Prompt 18 — Security Suite 2: Player Release Structure Verification', () => {
  const rootDir = process.cwd();
  const testReleaseDir = path.resolve(rootDir, 'dist', 'test-player-structure');

  before(() => {
    packagePlayerRelease({
      rootDir,
      releaseDir: testReleaseDir,
    });
  });

  it('1. Package contains no src directory', () => {
    assert.equal(fs.existsSync(path.join(testReleaseDir, 'src')), false);
  });

  it('2. Package contains no test or tests directory', () => {
    assert.equal(fs.existsSync(path.join(testReleaseDir, 'test')), false);
    assert.equal(fs.existsSync(path.join(testReleaseDir, 'tests')), false);
  });

  it('3. Package contains no docs directory', () => {
    assert.equal(fs.existsSync(path.join(testReleaseDir, 'docs')), false);
  });

  it('4. Package contains no walkthrough files (walkthrough.md, svgwalkthrough.md)', () => {
    const files = collectFilesRecursively(testReleaseDir);
    for (const f of files) {
      assert(!f.toLowerCase().includes('walkthrough'), `File '${f}' must not be a walkthrough file`);
    }
  });

  it('5. Package contains no .git or .gitignore files', () => {
    assert.equal(fs.existsSync(path.join(testReleaseDir, '.git')), false);
    assert.equal(fs.existsSync(path.join(testReleaseDir, '.gitignore')), false);
  });

  it('6. Package contains no .env or environment configuration files', () => {
    const files = collectFilesRecursively(testReleaseDir);
    for (const f of files) {
      assert(!f.includes('.env'), `File '${f}' must not be an environment file`);
    }
  });

  it('7. Package contains zero TypeScript source files (*.ts, *.tsx)', () => {
    const files = collectFilesRecursively(testReleaseDir);
    for (const f of files) {
      assert(!f.endsWith('.ts'), `File '${f}' must not be a TypeScript file`);
      assert(!f.endsWith('.tsx'), `File '${f}' must not be a TSX file`);
    }
  });

  it('8. Package contains zero source maps (*.map, *.d.ts.map)', () => {
    const files = collectFilesRecursively(testReleaseDir);
    for (const f of files) {
      assert(!f.endsWith('.map'), `File '${f}' must not be a source map file`);
    }
  });

  it('9. Package contains zero coverage reports or log directories', () => {
    assert.equal(fs.existsSync(path.join(testReleaseDir, 'coverage')), false);
    assert.equal(fs.existsSync(path.join(testReleaseDir, 'logs')), false);
  });
});
