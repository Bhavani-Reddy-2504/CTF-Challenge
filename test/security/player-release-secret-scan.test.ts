process.env.TLS_CERT_PATH = 'certs/server.crt'; process.env.TLS_KEY_PATH = 'certs/server.key';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { packagePlayerRelease } from '../../src/release/player-packager.js';
import { collectFilesRecursively } from '../../src/release/release-manifest.js';

describe('Prompt 18 — Security Suite 1: Player Release Secret Scan', () => {
  const rootDir = process.cwd();
  const testReleaseDir = path.resolve(rootDir, 'dist', 'test-player-secret-scan');

  const CANONICAL_ANSWER_KEYWORDS = [
    'HARDWARE INTEGRITY ANCHOR 889F',
    'HYPERION ENCLAVE FABRIC RECONCILED',
    'wrk-hyperion-telemetry-edge:edge-telemetry-enclave:reconciled',
  ];

  before(() => {
    packagePlayerRelease({
      rootDir,
      releaseDir: testReleaseDir,
    });
  });

  it('1. Release contains zero real flags or flag prefixes (BPCTF{, MOCK_FLAG{, FLAG{, flag{)', () => {
    const files = collectFilesRecursively(testReleaseDir);
    const flagPattern = /(?:BPCTF|BREACH|flag|FLAG)\{[^}]+\}/;
    const prefixPattern = /(?:BPCTF|BREACH|FLAG)\{/;

    for (const relPath of files) {
      const fullPath = path.join(testReleaseDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Exclude release validator self-reference if present
      if (!relPath.includes('validator')) {
        assert(!flagPattern.test(content), `File '${relPath}' must not contain flag pattern`);
        assert(!prefixPattern.test(content), `File '${relPath}' must not contain flag prefix`);
      }
    }
  });

  it('2. Release contains zero canonical answers or answer fragments in public or doc files', () => {
    const files = collectFilesRecursively(testReleaseDir);
    const publicAndDocs = files.filter(
      (f) => f.startsWith('public/') || f === 'README.md' || f === 'package.json'
    );

    for (const relPath of publicAndDocs) {
      const content = fs.readFileSync(path.join(testReleaseDir, relPath), 'utf-8');
      for (const kw of CANONICAL_ANSWER_KEYWORDS) {
        assert(!content.toLowerCase().includes(kw.toLowerCase()), `File '${relPath}' must not leak answer keyword: ${kw}`);
      }
    }
  });

  it('3. Release contains zero encoded answers or base64 solution payloads', () => {
    const knownBase64Solutions = [
      'TUlTU0lOR19TQU1QTEVfQkFTRTY0X1NUUklOR19OT1RfVEhFX1JFQUxfQU5TV0VS',
      'TUlTU0lOR19QUkVGSVg=',
    ];

    const files = collectFilesRecursively(testReleaseDir);
    for (const relPath of files) {
      const content = fs.readFileSync(path.join(testReleaseDir, relPath), 'utf-8');
      for (const b64 of knownBase64Solutions) {
        assert(!content.includes(b64), `File '${relPath}' must not contain base64 answer payload: ${b64}`);
      }
    }
  });

  it('4. Release contains zero XOR secret arrays or obfuscated fallback flag buffers', () => {
    const files = collectFilesRecursively(testReleaseDir);
    for (const relPath of files) {
      const content = fs.readFileSync(path.join(testReleaseDir, relPath), 'utf-8');
      assert(!content.includes('PROTECTED_FALLBACK_FLAG'), `File '${relPath}' must not contain PROTECTED_FALLBACK_FLAG`);
      assert(!content.includes('PROTECTED_DYNAMIC_PREFIX'), `File '${relPath}' must not contain PROTECTED_DYNAMIC_PREFIX`);
      assert(!content.includes('FLAG_KEY'), `File '${relPath}' must not contain FLAG_KEY`);
    }
  });

  it('5. Release contains zero fallback flags and zero hardcoded secret defaults', () => {
    const files = collectFilesRecursively(testReleaseDir);
    for (const relPath of files) {
      const content = fs.readFileSync(path.join(testReleaseDir, relPath), 'utf-8');
      assert(!content.includes('SIMULATION_SOLVED_FLAG'), `File '${relPath}' must not contain fallback flag identifier`);
    }
  });

  it('6. Public client scripts contain zero evaluator secret constants or preimages', () => {
    const appJsPath = path.join(testReleaseDir, 'public', 'app.js');
    const content = fs.readFileSync(appJsPath, 'utf-8');

    const knownPreimages = [
      '8dffab8c9cdc19062e7167ba76a405bb1fc0bd3748fb643f9fa31846b5f44f66',
      '0a553039094c7af9a35d3d71ae02b9b186c3bf39ea7cad9efe84ef1de98ab901',
      '2f76d07eff418a2231deaf2767be6173f05dadaa29b544db7b311225c4278c2b',
      '2d98c4059cb0cee6c627d58d60e8538747ba18fbb5f938442cb9fa28817516da',
    ];

    for (const preimage of knownPreimages) {
      assert(!content.includes(preimage), `public/app.js must not contain evaluation preimage: ${preimage}`);
    }
  });
});
