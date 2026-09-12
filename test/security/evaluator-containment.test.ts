import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('Prompt 18 — Security Suite 3: Evaluator Containment & Zero Client Evaluation', () => {
  const rootDir = process.cwd();
  const appJsPath = path.resolve(rootDir, 'public', 'app.js');
  const indexHtmlPath = path.resolve(rootDir, 'public', 'index.html');

  it('1. Evaluator execution exists strictly on the server', () => {
    assert.ok(fs.existsSync(path.resolve(rootDir, 'src', 'modules', 'evaluation', 'evaluation-module.ts')));
  });

  it('2. Frontend app.js contains zero candidate or answer comparison statements', () => {
    const code = fs.readFileSync(appJsPath, 'utf-8');

    // Reject direct equality or comparison against candidate strings
    assert(!/candidate\s*===/i.test(code), 'app.js must not perform candidate comparison');
    assert(!/interpretation\s*===/i.test(code), 'app.js must not perform interpretation comparison');
    assert(!/submission\s*===/i.test(code), 'app.js must not perform submission comparison');
    assert(!code.includes('validateAnswer'), 'app.js must not validate answers');
    assert(!code.includes('compareInterpretation'), 'app.js must not compare interpretations');
  });

  it('3. Frontend app.js contains zero cryptographic hash checks or preimages', () => {
    const code = fs.readFileSync(appJsPath, 'utf-8');

    assert(!code.includes('sha256'), 'app.js must not contain sha256 hashing logic');
    assert(!code.includes('createHash'), 'app.js must not import createHash');
    assert(!code.includes('crypto.subtle'), 'app.js must not use Web Crypto for answer hashing');
    assert(!code.includes('CANONICAL_INTERPRETATION_HASHES'), 'app.js must not contain canonical hashes');
  });

  it('4. Frontend app.js contains zero expected interpretation strings or keywords', () => {
    const code = fs.readFileSync(appJsPath, 'utf-8');

    const canonicalKeywords = [
      'HARDWARE INTEGRITY ANCHOR 889F',
      'HYPERION ENCLAVE FABRIC RECONCILED',
      'enclave-integrity-anchor-889f',
    ];

    for (const kw of canonicalKeywords) {
      assert(!code.toLowerCase().includes(kw.toLowerCase()), `app.js must not leak keyword: ${kw}`);
    }
  });

  it('5. Frontend app.js contains zero scoring or distance metrics logic', () => {
    const code = fs.readFileSync(appJsPath, 'utf-8');

    assert(!code.includes('scoringRubric'), 'app.js must not compute scoring rubrics');
    assert(!code.includes('levenshtein'), 'app.js must not calculate edit distance');
    assert(!code.includes('partialMatch'), 'app.js must not score partial matches');
  });

  it('6. Frontend contains zero validation oracle clues in DOM attributes or HTML', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf-8');

    assert(!html.includes('data-answer'), 'index.html must not contain data-answer');
    assert(!html.includes('data-flag'), 'index.html must not contain data-flag');
    assert(!html.includes('data-expected'), 'index.html must not contain data-expected');
    assert(!html.includes('data-solution'), 'index.html must not contain data-solution');
  });
});
