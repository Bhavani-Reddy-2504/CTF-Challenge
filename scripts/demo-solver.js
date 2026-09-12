import { bootstrapApplication } from '../dist/src/bootstrap.js';

process.env.ENCLAVE_FLAG = process.env.ENCLAVE_FLAG || 'BREACH{HYP3R10N_SIMULATION_SOLVED_FLAG_ACTIVE_ON_LIVE_SERVER}';

async function runDemo() {
  console.log('================================================================');
  console.log('  STRATACORE: LIVE DEMONSTRATION SOLVE RUN');
  console.log('================================================================\n');

  console.log('[Step 0] Bootstrapping Challenge Server...');
  const app = await bootstrapApplication({
    environment: 'development',
    port: 8080,
    host: '127.0.0.1',
    logLevel: 'error',
  });
  await app.server.start();
  const baseUrl = 'http://127.0.0.1:8080';
  console.log(`[Step 0] Server running at ${baseUrl}\n`);

  try {
    // 1. Initialize session
    console.log('[Step 1] Initializing player session...');
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const cookie = initRes.headers.get('set-cookie');
    const initData = await initRes.json();
    console.log('  -> HTTP Status:', initRes.status);
    console.log('  -> Session Active:', initData.session_active);
    console.log('  -> Secure Cookie:', cookie ? 'Received' : 'Missing');
    console.log();

    // 2. Discover evidence routes in strict progression order
    const orderedRoutes = [
      // Stage 1: Foundation
      'sim://metadata/workload-profile',
      'sim://metadata/execution-context',
      'sim://metadata/trust-boundary',
      'sim://metadata/compatibility-record',
      'sim://audit/bootstrap-history',
      'sim://audit/trust-events',
      'sim://audit/failed-transitions',
      'sim://audit/correlation-records',
      'sim://config/active-specification',
      'sim://config/binding-profile',
      'sim://config/federation-matrix',
      'sim://config/compatibility-rules',
      'sim://config/integrity-constraints',

      // Stage 2: Identity & Trust
      'sim://identity/context',
      'sim://identity/binding',
      'sim://identity/trust-membership',
      'sim://identity/lineage',
      'sim://identity/compatibility',
      'sim://trust/context-coherence',
      'sim://trust/binding-coherence',
      'sim://trust/lineage-coherence',
      'sim://trust/context-membership',
      'sim://trust/effective-interpretation',

      // Stage 3: Transitions & Constraints
      'sim://transition/observation',
      'sim://transition/correlation',
      'sim://transition/reconciliation',
      'sim://constraint/specification',
      'sim://constraint/continuity',
      'sim://constraint/boundary',
      'sim://constraint/reconciliation',

      // Stage 4: Inference & Graph Modeling
      'sim://inference/specification-model',
      'sim://inference/lineage-model',
      'sim://inference/boundary-model',
      'sim://inference/reconciliation-model',
      'sim://inference/convergence',
      'sim://graph/context-fragment',
      'sim://graph/correlation-fragment',
      'sim://graph/topology-fragment',
      'sim://graph/convergence-fragment',
      'sim://graph/reconstruction-fragment',

      // Stage 5: Synthesis & Resolution
      'sim://synthesis/specification-perspective',
      'sim://synthesis/lineage-perspective',
      'sim://synthesis/boundary-perspective',
      'sim://synthesis/relational-perspective',
      'sim://synthesis/multi-perspective',
      'sim://resolution/structural-context',
      'sim://resolution/historical-context',
      'sim://resolution/environmental-context',
      'sim://resolution/relational-context',
      'sim://resolution/resolution-context',

      // Stage 6: Evaluation Readiness
      'sim://evaluation/structural-readiness',
      'sim://evaluation/historical-readiness',
      'sim://evaluation/environmental-readiness',
      'sim://evaluation/relational-readiness',
      'sim://evaluation/submission-context',
    ];

    console.log(`[Step 2] Progressing through ${orderedRoutes.length} symbolic evidence routes...`);
    let count = 0;
    for (const route of orderedRoutes) {
      count++;
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie || '',
        },
        body: JSON.stringify({ route }),
      });
      const data = await res.json();
      if (res.status === 200) {
        process.stdout.write(`  [${count}/${orderedRoutes.length}] ${route} -> OK (Evidence: ${data.data?.evidence_id ?? 'Unlocked'})\n`);
      } else {
        process.stdout.write(`  [${count}/${orderedRoutes.length}] ${route} -> Status ${res.status}: ${data.message || data.code}\n`);
      }
    }
    console.log();

    // 3. Submit canonical interpretation
    const answer = 'HYPERION ENCLAVE FABRIC RECONCILED UNDER HARDWARE INTEGRITY ANCHOR 889F';
    console.log('[Step 3] Submitting final canonical interpretation:');
    console.log(`  "${answer}"\n`);

    const submitRes = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie || '',
      },
      body: JSON.stringify({ interpretation: answer }),
    });

    const submitData = await submitRes.json();
    console.log('================================================================');
    console.log('  SERVER EVALUATION RESPONSE:');
    console.log('================================================================');
    console.log(JSON.stringify(submitData, null, 2));
    console.log();

    if (submitData.status === 'ACCEPTED' && submitData.flag) {
      console.log('================================================================');
      console.log('  🎉 FLAG CAPTURED SUCCESSFULLY!');
      console.log(`  ${submitData.flag}`);
      console.log('================================================================\n');
    } else {
      console.log('❌ Submission was not accepted.');
    }
  } finally {
    console.log('[Step 4] Shutting down demo server...');
    await app.shutdown();
    console.log('[Step 4] Server stopped cleanly.\n');
  }
}

runDemo().catch((err) => {
  console.error('Fatal error during demo:', err);
  process.exit(1);
});
