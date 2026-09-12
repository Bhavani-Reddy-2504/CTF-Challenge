import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('Categories 14, 15, 18: Information Leakage, Client Bundle & Release Integrity', () => {
  const rootDir = process.cwd();

  it('Category 14: Public release surface contains zero flag patterns or credentials', async () => {
    const publicFiles = ['index.html', 'index.css', 'app.js'];

    for (const filename of publicFiles) {
      const filePath = path.resolve(rootDir, 'public', filename);
      const content = await fs.promises.readFile(filePath, 'utf-8');

      assert(!content.includes('MOCK_FLAG{'), `${filename} must not leak MOCK_FLAG{ flag pattern`);
      assert(!content.includes('BPCTF{'), `${filename} must not leak legacy BPCTF{ flag pattern`);
      assert(!content.includes('FLAG{'), `${filename} must not leak generic FLAG{`);
      assert(!content.includes('PRIVATE_KEY'), `${filename} must not leak private keys`);
      assert(!content.includes('API_KEY'), `${filename} must not leak API keys`);
      assert(!content.includes('ENCLAVE_SECRET'), `${filename} must not leak server secret env vars`);
      assert(!content.includes('8dffab8c9cdc19062e7167ba76a405bb1fc0bd3748fb643f9fa31846b5f44f66'), `${filename} must not leak evaluation preimages`);
    }
  });

  it('Category 15: Client app.js contains zero evaluator logic, route inventories, or graph models', async () => {
    const appJsPath = path.resolve(rootDir, 'public', 'app.js');
    const content = await fs.promises.readFile(appJsPath, 'utf-8');

    // Evaluator logic containment
    assert(!content.includes('CANONICAL_INTERPRETATION'), 'app.js must not contain canonical interpretations');
    assert(!content.includes('sha256'), 'app.js must not contain sha256 evaluation logic');
    assert(!content.includes('deriveEnclaveFlag'), 'app.js must not contain flag derivation logic');
    assert(!content.includes('createHmac'), 'app.js must not contain crypto HMAC primitives');

    // Route inventory containment
    assert(!content.includes('APPROVED_SIM_NAMESPACES'), 'app.js must not contain approved namespace list');
    assert(!content.includes('EVALUATION_ARTIFACTS'), 'app.js must not contain evaluation artifacts catalog');
    assert(!content.includes('METADATA_ARTIFACTS'), 'app.js must not contain metadata artifacts catalog');

    // Zero graph topology
    assert(!content.includes('adjacency'), 'app.js must not contain graph adjacency matrices');
    assert(!content.includes('topological'), 'app.js must not contain topological sort logic');

    // Dynamic execution audit
    assert(!content.includes('eval('), 'app.js must not contain eval()');
    assert(!content.includes('new Function('), 'app.js must not contain new Function()');
  });

  it('Category 18: Release packaging script produces clean distribution without tests or source maps', async () => {
    const pkgScriptPath = path.resolve(rootDir, 'scripts', 'package-player.js');
    const scriptContent = await fs.promises.readFile(pkgScriptPath, 'utf-8');

    assert(scriptContent.includes("resolve(rootDir, 'public')"), 'Package script must copy public assets');
    assert(scriptContent.includes("resolve(rootDir, 'dist', 'src')"), 'Package script must copy compiled binaries');
    assert(!scriptContent.includes("resolve(rootDir, 'test')"), 'Package script must NOT copy tests');
    assert(!scriptContent.includes("resolve(rootDir, 'src')"), 'Package script must NOT copy TypeScript source files');
  });
});
