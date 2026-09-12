import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
// Copies resolve(rootDir, 'public') and resolve(rootDir, 'dist', 'src') into clean release bundle

try {
  console.log('[Packaging] Building and creating clean player release bundle...');
  const packagerModulePath = path.resolve(rootDir, 'dist', 'src', 'release', 'player-packager.js');
  const { packagePlayerRelease } = await import(`file://${packagerModulePath.replace(/\\/g, '/')}`);

  const result = packagePlayerRelease({ rootDir });
  console.log(`[Packaging] Player release created successfully at: ${result.releaseDir}`);
  console.log(`[Packaging] Manifest generated with ${result.manifest.files.length} verified files.`);

  // Create or refresh distribution zip
  const zipPath = path.resolve(rootDir, 'stratacore-player-release.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  try {
    execSync(`powershell -Command "Compress-Archive -Path '${result.releaseDir}\\*' -DestinationPath '${zipPath}' -Force"`);
    console.log(`[Packaging] Distribution zip generated at: ${zipPath}`);
  } catch (zipErr) {
    console.warn(`[Packaging] Warning: Could not create zip archive automatically: ${zipErr.message}`);
  }

  console.log('[Packaging] Ready for player distribution.');
} catch (err) {
  console.error('[Packaging] Fatal error during player packaging:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}
