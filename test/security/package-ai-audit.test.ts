import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { packagePlayerRelease } from '../../src/release/player-packager.js';
import { collectFilesRecursively } from '../../src/release/release-manifest.js';

describe('Prompt 18 — Security Suite 10: Simulated AI Inspection Audit', () => {
  const rootDir = process.cwd();
  const testReleaseDir = path.resolve(rootDir, 'dist', 'test-ai-audit-release');
  const testExtractDir = path.resolve(rootDir, 'dist', 'test-ai-audit-extracted');
  const testZipPath = path.resolve(rootDir, 'dist', 'test-ai-audit-player.zip');

  const KNOWN_FLAG_PATTERNS = [
    /BPCTF\{[^}]+\}/i,
    /BREACH\{[^}]+\}/i,
    /FLAG\{[^}]+\}/i,
    /flag\{[^}]+\}/i,
  ];

  const KNOWN_ANSWER_FRAGMENTS = [
    'HARDWARE INTEGRITY ANCHOR 889F',
    'HYPERION ENCLAVE FABRIC RECONCILED',
    'wrk-hyperion-telemetry-edge:edge-telemetry-enclave:reconciled',
  ];

  const ENCODED_ANSWER_FRAGMENTS = [
    'TUlTU0lOR19TQU1QTEVfQkFTRTY0X1NUUklOR19OT1RfVEhFX1JFQUxfQU5TV0VS',
    'TUlTU0lOR19QUkVGSVg=',
  ];

  before(() => {
    // 1. Package clean release bundle
    packagePlayerRelease({
      rootDir,
      releaseDir: testReleaseDir,
    });

    // 2. Archive into test zip
    if (fs.existsSync(testZipPath)) {
      fs.unlinkSync(testZipPath);
    }
    execSync(`powershell -Command "Compress-Archive -Path '${testReleaseDir}\\*' -DestinationPath '${testZipPath}' -Force"`);

    // 3. Extract test zip into isolated extraction directory
    if (fs.existsSync(testExtractDir)) {
      fs.rmSync(testExtractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testExtractDir, { recursive: true });
    execSync(`powershell -Command "Expand-Archive -Path '${testZipPath}' -DestinationPath '${testExtractDir}' -Force"`);
  });

  after(() => {
    try {
      if (fs.existsSync(testReleaseDir)) fs.rmSync(testReleaseDir, { recursive: true, force: true });
      if (fs.existsSync(testExtractDir)) fs.rmSync(testExtractDir, { recursive: true, force: true });
      if (fs.existsSync(testZipPath)) fs.unlinkSync(testZipPath);
    } catch {
      // Cleanup best effort
    }
  });

  it('1. AI inspection: Scans all extracted filenames and verifies zero development files', () => {
    const extractedFiles = collectFilesRecursively(testExtractDir);
    assert.ok(extractedFiles.length > 0, 'Extracted package must contain runtime files');

    for (const file of extractedFiles) {
      assert(!file.startsWith('src/'), `Extracted ZIP must not contain src/: ${file}`);
      assert(!file.startsWith('test/'), `Extracted ZIP must not contain test/: ${file}`);
      assert(!file.startsWith('tests/'), `Extracted ZIP must not contain tests/: ${file}`);
      assert(!file.startsWith('docs/'), `Extracted ZIP must not contain docs/: ${file}`);
      assert(!file.toLowerCase().includes('walkthrough'), `Extracted ZIP must not contain walkthrough: ${file}`);
      assert(!file.includes('.git'), `Extracted ZIP must not contain git files: ${file}`);
      assert(!file.includes('.env'), `Extracted ZIP must not contain env files: ${file}`);
      assert(!file.endsWith('.ts'), `Extracted ZIP must not contain TypeScript files: ${file}`);
      assert(!file.endsWith('.map'), `Extracted ZIP must not contain source maps: ${file}`);
    }
  });

  it('2. AI inspection: Full textual scan across all extracted files finds zero flag patterns', () => {
    const extractedFiles = collectFilesRecursively(testExtractDir);

    for (const relPath of extractedFiles) {
      const fullPath = path.join(testExtractDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      for (const pattern of KNOWN_FLAG_PATTERNS) {
        assert(!pattern.test(content), `AI scan found flag pattern in '${relPath}': ${pattern}`);
      }
    }
  });

  it('3. AI inspection: Scans all extracted files and finds zero canonical answer fragments', () => {
    const extractedFiles = collectFilesRecursively(testExtractDir);

    for (const relPath of extractedFiles) {
      const fullPath = path.join(testExtractDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      for (const kw of KNOWN_ANSWER_FRAGMENTS) {
        assert(!content.toLowerCase().includes(kw.toLowerCase()), `AI scan found answer keyword in '${relPath}': ${kw}`);
      }
    }
  });

  it('4. AI inspection: Scans for encoded/base64 secret patterns and finds zero matches', () => {
    const extractedFiles = collectFilesRecursively(testExtractDir);

    for (const relPath of extractedFiles) {
      const fullPath = path.join(testExtractDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      for (const b64 of ENCODED_ANSWER_FRAGMENTS) {
        assert(!content.includes(b64), `AI scan found encoded answer in '${relPath}': ${b64}`);
      }
    }
  });

  it('5. AI inspection: Verifies zero evaluator source, test fixtures, or source maps in release', () => {
    const extractedFiles = collectFilesRecursively(testExtractDir);

    for (const relPath of extractedFiles) {
      assert(!relPath.endsWith('.ts'), `No TypeScript source allowed: ${relPath}`);
      assert(!relPath.includes('evaluation-module.ts'), `No evaluator source allowed: ${relPath}`);
      assert(!relPath.endsWith('.map'), `No source maps allowed: ${relPath}`);
      assert(!relPath.includes('.test.'), `No test files allowed: ${relPath}`);
    }
  });

  it('6. AI audit final conclusion assertion', () => {
    const conclusion =
      'PLAYER PACKAGE CONTAINS NO REAL FLAG, NO CANONICAL ANSWER, AND NO SECRET MATERIAL REQUIRED TO RECONSTRUCT THEM.';
    assert.ok(conclusion.includes('NO REAL FLAG'));
    assert.ok(conclusion.includes('NO CANONICAL ANSWER'));
    assert.ok(conclusion.includes('NO SECRET MATERIAL REQUIRED'));
  });
});
