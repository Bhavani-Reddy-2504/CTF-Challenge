import { execSync } from 'node:child_process';
import path from 'node:path';

const rootDir = process.cwd();

console.log('================================================================');
console.log('  STRATACORE: THE HYPERION ENCLAVE FABRIC');
console.log('  PRODUCTION VERIFICATION & LAUNCH VALIDATION PIPELINE');
console.log('================================================================\n');

const steps = [
  { name: '1. TypeScript Production Build', command: 'npm run build' },
  { name: '2. Complete Regression Test Suite', command: 'npm test' },
  { name: '3. Player Release Packaging', command: 'npm run package:player' },
  { name: '4. Release Integrity & Leakage Validation', command: 'npm run validate:release' },
];

for (const step of steps) {
  console.log(`[Pipeline] Running: ${step.name}...`);
  try {
    execSync(step.command, {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log(`[Pipeline] PASS: ${step.name}\n`);
  } catch {
    console.error(`\n[Pipeline] FATAL: ${step.name} failed! Pipeline stopped.`);
    process.exit(1);
  }
}

console.log('================================================================');
console.log('  ALL PRODUCTION & LAUNCH GATES PASSED (100% VERIFIED)');
console.log('  STATUS: PRODUCTION READY');
console.log('================================================================\n');
