/**
 * Live Solver against the active StrataCore server at http://127.0.0.1:8080
 */
const baseUrl = 'http://127.0.0.1:8080';

async function solve() {
  console.log('================================================================');
  console.log('  STRATACORE // LIVE SOLVE SEQUENCE');
  console.log('================================================================\n');

  // Step 1: Health check
  const healthRes = await fetch(`${baseUrl}/health`);
  const health = await healthRes.json();
  console.log('[1] Health Check:', health);

  // Step 2: Initialize Session
  console.log('\n[2] Initializing authenticated session via /api/v1/session/init...');
  const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
  const cookie = initRes.headers.get('set-cookie');
  const initData = await initRes.json();
  console.log('    Status:', initRes.status);
  console.log('    Session Active:', initData.session_active);
  console.log('    Cookie header received:', !!cookie);

  // Step 3: Progressive Route Exploration
  console.log('\n[3] Querying symbolic routes to discover evidence artifacts across all 6 stages...');

  const stages = [
    {
      name: 'Stage 1: Foundation (metadata, audit, config)',
      routes: [
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
      ],
    },
    {
      name: 'Stage 2: Identity & Trust',
      routes: [
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
      ],
    },
    {
      name: 'Stage 3: Transitions & Constraints',
      routes: [
        'sim://transition/observation',
        'sim://transition/correlation',
        'sim://transition/reconciliation',
        'sim://constraint/specification',
        'sim://constraint/continuity',
        'sim://constraint/boundary',
        'sim://constraint/reconciliation',
      ],
    },
    {
      name: 'Stage 4: Inference & Graph Modeling',
      routes: [
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
      ],
    },
    {
      name: 'Stage 5: Synthesis & Resolution',
      routes: [
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
      ],
    },
    {
      name: 'Stage 6: Evaluation Readiness & Submission Context',
      routes: [
        'sim://evaluation/structural-readiness',
        'sim://evaluation/historical-readiness',
        'sim://evaluation/environmental-readiness',
        'sim://evaluation/relational-readiness',
        'sim://evaluation/submission-context',
      ],
    },
  ];

  let totalDiscovered = 0;
  for (const stage of stages) {
    console.log(`\n  --- ${stage.name} ---`);
    for (const route of stage.routes) {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie || '',
        },
        body: JSON.stringify({ route }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        totalDiscovered++;
        console.log(`    ✓ [${totalDiscovered}/55] ${route} -> Discovered ${data.evidence?.id || 'OK'}`);
      } else {
        console.error(`    ✗ ${route} -> Status ${res.status}:`, data);
      }
    }
  }

  // Step 4: Submit Final Interpretation
  console.log('\n[4] Submitting Canonical Multi-Domain Synthesis Interpretation...');
  const candidate = 'HYPERION ENCLAVE FABRIC RECONCILED UNDER HARDWARE INTEGRITY ANCHOR 889F';
  console.log(`    Candidate: "${candidate}"`);

  const submitRes = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie || '',
    },
    body: JSON.stringify({ interpretation: candidate }),
  });

  const submitResult = await submitRes.json();
  console.log('\n================================================================');
  console.log('  SERVER EVALUATION VERDICT:');
  console.log('================================================================');
  console.log(JSON.stringify(submitResult, null, 2));

  if (submitResult.status === 'ACCEPTED' && submitResult.flag) {
    console.log('\n================================================================');
    console.log('  FLAG RETRIEVED:');
    console.log(`  ${submitResult.flag}`);
    console.log('================================================================\n');
  }
}

solve().catch(console.error);
