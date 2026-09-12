import { execSync } from 'node:child_process';

const rootDir = process.cwd();

console.log('================================================================');
console.log('  STRATACORE: PRODUCTION LAUNCH & SECURITY VERIFICATION');
console.log('================================================================\n');

const steps = [
  { name: '1. TypeScript Production Build', command: 'npm run build' },
  { name: '2. Complete Regression & Security Test Suite', command: 'npm test' },
  { name: '3. Zero-Knowledge Player Packaging', command: 'npm run package:player' },
  { name: '4. Player Release Security & AI Audit', command: 'npm run audit:player-release' },
];

for (const step of steps) {
  console.log(`[Verify] Starting: ${step.name}...`);
  try {
    execSync(step.command, {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        ENCLAVE_FLAG: process.env.ENCLAVE_FLAG || 'BREACH{MOCK_ENV_FLAG_FOR_TESTS_ONLY}',
      },
    });
    console.log(`[Verify] PASS: ${step.name}\n`);
  } catch {
    console.error(`\n[Verify] FATAL: ${step.name} failed! Verification halted.`);
    process.exit(1);
  }
}

console.log('================================================================');
console.log('  ALL PRODUCTION VERIFICATION GATES PASSED (100% VERIFIED)');
console.log('  STATUS: PASS - ZERO-KNOWLEDGE PRODUCTION READY');
console.log('================================================================\n');
