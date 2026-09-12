import path from 'node:path';

const rootDir = process.cwd();
const releaseDir = path.resolve(rootDir, 'release');

try {
  console.log('[Validation] Scanning generated release package at:', releaseDir);
  const validatorModulePath = path.resolve(rootDir, 'dist', 'src', 'release', 'release-validator.js');
  const { validateReleasePackage } = await import(`file://${validatorModulePath.replace(/\\/g, '/')}`);

  const result = validateReleasePackage(releaseDir);

  if (!result.valid) {
    console.error('[Validation] FAILED: Release package validation detected violations:');
    for (const diag of result.diagnostics) {
      const loc = diag.filePath ? ` [${diag.filePath}]` : '';
      console.error(`  - [${diag.category}]${loc}: ${diag.message}`);
    }
    process.exit(1);
  }

  console.log(`[Validation] PASS: All ${result.scannedFilesCount} files verified. Zero forbidden assets, secrets, or leakage detected.`);
  process.exit(0);
} catch (err) {
  console.error('[Validation] Fatal error during release validation:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}
