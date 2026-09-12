import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  generateReleaseManifest,
  verifyReleaseManifest,
  writeReleaseManifest,
} from '../../src/release/release-manifest.js';
import { validateReleasePackage } from '../../src/release/release-validator.js';

describe('Prompt 17: Production Release Integrity & Tamper Validation', () => {
  const rootDir = process.cwd();
  const releaseDir = path.resolve(rootDir, 'release');

  it('1. Clean release bundle passes manifest verification', () => {
    const result = verifyReleaseManifest(releaseDir);
    assert.equal(result.valid, true, `Manifest verification failed: ${result.errors.join('; ')}`);
    assert.equal(result.errors.length, 0);
  });

  it('2. Tamper Detection: Modified file causes SHA-256 integrity mismatch', () => {
    const mockDir = path.resolve(rootDir, 'dist', 'test-prod-mock-modified');
    if (fs.existsSync(mockDir)) {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
    fs.mkdirSync(mockDir, { recursive: true });

    try {
      fs.writeFileSync(path.join(mockDir, 'runtime.js'), 'const a = 1;');
      writeReleaseManifest(mockDir, generateReleaseManifest(mockDir));

      // Modify the file
      fs.writeFileSync(path.join(mockDir, 'runtime.js'), 'const a = 2; // modified');

      const result = verifyReleaseManifest(mockDir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('SHA-256 integrity mismatch')));
    } finally {
      fs.rmSync(mockDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('3. Tamper Detection: Missing file causes missing expected file error', () => {
    const mockDir = path.resolve(rootDir, 'dist', 'test-prod-mock-missing');
    if (fs.existsSync(mockDir)) {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
    fs.mkdirSync(mockDir, { recursive: true });

    try {
      fs.writeFileSync(path.join(mockDir, 'file1.js'), 'console.log(1);');
      fs.writeFileSync(path.join(mockDir, 'file2.js'), 'console.log(2);');
      writeReleaseManifest(mockDir, generateReleaseManifest(mockDir));

      // Delete file2.js
      fs.unlinkSync(path.join(mockDir, 'file2.js'));

      const result = verifyReleaseManifest(mockDir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Missing expected release file')));
    } finally {
      fs.rmSync(mockDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('4. Tamper Detection: Unexpected unmanifested file causes verification failure', () => {
    const mockDir = path.resolve(rootDir, 'dist', 'test-prod-mock-unexpected');
    if (fs.existsSync(mockDir)) {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
    fs.mkdirSync(mockDir, { recursive: true });

    try {
      fs.writeFileSync(path.join(mockDir, 'valid.js'), 'console.log(1);');
      writeReleaseManifest(mockDir, generateReleaseManifest(mockDir));

      // Inject unmanifested file
      fs.writeFileSync(path.join(mockDir, 'injected.js'), 'console.log("hacked");');

      const result = verifyReleaseManifest(mockDir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Unexpected unmanifested file detected')));
    } finally {
      fs.rmSync(mockDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('5. Release validator catches forbidden development artifacts (.env, .map, test/)', () => {
    const mockDir = path.resolve(rootDir, 'dist', 'test-prod-mock-forbidden');
    if (fs.existsSync(mockDir)) {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(mockDir, 'public'), { recursive: true });

    try {
      fs.writeFileSync(path.join(mockDir, '.env'), 'SECRET=bad');
      fs.writeFileSync(path.join(mockDir, 'index.js.map'), '{}');

      const result = validateReleasePackage(mockDir);
      assert.equal(result.valid, false);
      assert.ok(result.diagnostics.some((d) => d.category === 'ENV_FILES'));
      assert.ok(result.diagnostics.some((d) => d.category === 'SOURCE_MAP'));
    } finally {
      fs.rmSync(mockDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });
});
