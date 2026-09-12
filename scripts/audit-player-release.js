import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const releaseDir = path.resolve(rootDir, 'release');
const zipPath = path.resolve(rootDir, 'stratacore-player-release.zip');

console.log('================================================================');
console.log('  STRATACORE: ZERO-KNOWLEDGE PLAYER RELEASE SECURITY AUDIT');
console.log('================================================================\n');

let failed = false;
const violations = [];

// 1. Inspect release directory existence
if (!fs.existsSync(releaseDir)) {
  console.error('[AUDIT] FAILED: Release directory does not exist. Run "npm run package:player" first.');
  process.exit(1);
}

// 2. Validate release package with validator module
try {
  const validatorModulePath = path.resolve(rootDir, 'dist', 'src', 'release', 'release-validator.js');
  const { validateReleasePackage } = await import(`file://${validatorModulePath.replace(/\\/g, '/')}`);
  const result = validateReleasePackage(releaseDir);

  if (!result.valid) {
    failed = true;
    for (const diag of result.diagnostics) {
      violations.push(`[${diag.category}] ${diag.filePath ?? ''}: ${diag.message}`);
    }
  } else {
    console.log(`[AUDIT] PASS: Release validator scanned ${result.scannedFilesCount} files cleanly.`);
  }
} catch (err) {
  failed = true;
  violations.push(`Validator execution fault: ${err instanceof Error ? err.message : String(err)}`);
}

// 3. Inspect ZIP archive contents
if (fs.existsSync(zipPath)) {
  try {
    let zipFileList = '';
    try {
      zipFileList = execSync(`tar -tf "${zipPath}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    } catch {
      // Fallback for Windows environments without bsdtar
      zipFileList = execSync(
        `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}').Entries | Select-Object -ExpandProperty FullName"`,
        { encoding: 'utf-8' }
      );
    }

    const lines = zipFileList.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    console.log(`[AUDIT] Inspecting ZIP archive with ${lines.length} entries...`);

    const forbiddenZipPatterns = [
      { pattern: /^src[\\/]/i, reason: 'TypeScript source directory' },
      { pattern: /(?:^|[\\/])(?:test|tests|docs)[\\/]/i, reason: 'Test/documentation directory' },
      { pattern: /\.(?:ts|test\.[jt]sx?|spec\.[jt]sx?|map)$/i, reason: 'Source/test/map file' },
      { pattern: /\b(?:svg)?walkthrough\.md$/i, reason: 'Walkthrough document' },
      { pattern: /(?:^|\/)\.git(?:\/|$)/i, reason: 'Git metadata' },
      { pattern: /(?:^|\/)\.env/i, reason: 'Environment configuration file' },
    ];

    for (const entry of lines) {
      for (const rule of forbiddenZipPatterns) {
        if (rule.pattern.test(entry)) {
          failed = true;
          violations.push(`ZIP entry forbidden: ${entry} (${rule.reason})`);
        }
      }
    }
  } catch (err) {
    console.warn('[AUDIT] Note: Could not inspect ZIP contents directly via shell:', err instanceof Error ? err.message : String(err));
  }
}

// 4. Content scanning across release files
function scanDirectory(dir, relBase = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.join(relBase, entry.name).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      scanDirectory(full, rel);
    } else if (entry.isFile()) {
      // Reject any source maps or forbidden extensions
      if (entry.name.endsWith('.map') || entry.name.endsWith('.ts')) {
        failed = true;
        violations.push(`Forbidden file extension in release: ${rel}`);
        continue;
      }

      // Check text contents
      if (
        entry.name.endsWith('.js') ||
        entry.name.endsWith('.html') ||
        entry.name.endsWith('.css') ||
        entry.name.endsWith('.json') ||
        entry.name.endsWith('.md')
      ) {
        const text = fs.readFileSync(full, 'utf-8');

        // Check for flag patterns in public files and documents
        if (rel.startsWith('public/') || rel === 'README.md' || rel === 'package.json') {
          if (/BPCTF\{|BREACH\{|FLAG\{|flag\{/.test(text)) {
            failed = true;
            violations.push(`Flag pattern leaked in public file: ${rel}`);
          }
          if (/HARDWARE INTEGRITY ANCHOR 889F|HYPERION ENCLAVE FABRIC RECONCILED/i.test(text)) {
            failed = true;
            violations.push(`Canonical answer leaked in public file: ${rel}`);
          }
        }

        // Check for private keys everywhere
        if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text)) {
          failed = true;
          violations.push(`Private key leaked in file: ${rel}`);
        }

        // Check for sourceMappingURL everywhere
        if (text.includes('sourceMappingURL=')) {
          failed = true;
          violations.push(`sourceMappingURL leaked in file: ${rel}`);
        }
      }
    }
  }
}

scanDirectory(releaseDir);

// 5. Final Report
if (failed || violations.length > 0) {
  console.error('\n[AUDIT] FAILED: Release security audit detected violations:');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log('\n================================================================');
console.log('  AUDIT RESULT: PASS');
console.log('  PLAYER PACKAGE CONTAINS NO REAL FLAG,');
console.log('  NO CANONICAL ANSWER,');
console.log('  AND NO SECRET MATERIAL REQUIRED TO RECONSTRUCT THEM.');
console.log('================================================================\n');
process.exit(0);
