/**
 * STRATACORE // HYPERION ENCLAVE FABRIC
 * Secure Forensic Investigation Runtime (Player Presentation Layer)
 *
 * Strictly adheres to Prompt 15 Security Architecture:
 * - Presentation and interaction layer only.
 * - Server remains the sole challenge authority.
 * - Zero hardcoded routes, route inventories, or dependency topology.
 * - Zero answers, solutions, or evaluator logic.
 * - Zero unsafe HTML injection, eval, or script injection primitives.
 */

(function () {
  'use strict';

  // Client-side transient UI state (non-authoritative)
  const state = {
    sessionActive: false,
    discoveredEvidence: new Map(),
    selectedEvidenceId: null,
    sessionInitInFlight: false,  // Guard against concurrent session init requests
  };

  // DOM Elements
  const sessionDot = document.getElementById('sessionDot');
  const sessionStatusLabel = document.getElementById('sessionStatusLabel');
  const btnInitSession = document.getElementById('btnInitSession');
  const btnTermSession = document.getElementById('btnTermSession');

  const evidenceList = document.getElementById('evidenceList');
  const emptyEvidencePlaceholder = document.getElementById('emptyEvidencePlaceholder');
  const evidenceCountBadge = document.getElementById('evidenceCountBadge');

  const routeForm = document.getElementById('routeForm');
  const routeInput = document.getElementById('routeInput');
  const btnClearRoute = document.getElementById('btnClearRoute');
  const btnDispatch = document.getElementById('btnDispatch');

  const viewerEmptyState = document.getElementById('viewerEmptyState');
  const viewerContentArea = document.getElementById('viewerContentArea');
  const viewerIdBadge = document.getElementById('viewerIdBadge');
  const btnToggleRawJson = document.getElementById('btnToggleRawJson');
  const metaSource = document.getElementById('metaSource');
  const metaClassification = document.getElementById('metaClassification');
  const metaVersion = document.getElementById('metaVersion');
  const metaStatus = document.getElementById('metaStatus');
  const correlationBox = document.getElementById('correlationBox');
  const correlationChips = document.getElementById('correlationChips');
  const structuredViewer = document.getElementById('structuredViewer');
  const contentTree = document.getElementById('contentTree');
  const rawJsonViewer = document.getElementById('rawJsonViewer');

  const submissionForm = document.getElementById('submissionForm');
  const submissionInput = document.getElementById('submissionInput');
  const btnSubmitEval = document.getElementById('btnSubmitEval');
  const submissionOutcomeBox = document.getElementById('submissionOutcomeBox');
  const outcomeStatusBadge = document.getElementById('outcomeStatusBadge');
  const outcomeMessage = document.getElementById('outcomeMessage');

  const consoleLogs = document.getElementById('consoleLogs');
  const btnClearConsole = document.getElementById('btnClearConsole');

  // =========================================================================
  // Safe Logging (Safe DOM text rendering)
  // =========================================================================

  function logConsole(tag, message, tagClass) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const now = new Date();
    const timeStr = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join(':');

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${timeStr}]`;

    const tagSpan = document.createElement('span');
    tagSpan.className = `log-tag ${tagClass}`;
    tagSpan.textContent = `[${tag}]`;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'log-msg';
    msgSpan.textContent = message;

    entry.appendChild(timeSpan);
    entry.appendChild(tagSpan);
    entry.appendChild(msgSpan);

    consoleLogs.appendChild(entry);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  // =========================================================================
  // Session Lifecycle
  // =========================================================================

  async function checkSessionStatus() {
    try {
      const res = await fetch('/api/v1/session/status');
      if (res.ok) {
        const data = await res.json();
        updateSessionUI(data.session_active === true);
        if (data.session_active) {
          logConsole('SESSION', 'Active challenge session verified.', 'log-tag-system');
        } else {
          logConsole('SESSION', 'No active session. Initializing new session...', 'log-tag-system');
          await initSession();
        }
      }
    } catch (err) {
      updateSessionUI(false);
      if (isConnectionError(err)) {
        logConsole('ERROR', 'Cannot reach server. If you see a certificate warning, open https://127.0.0.1:8443 directly, click Advanced, then Proceed. Then refresh this page.', 'log-tag-error');
      } else {
        logConsole('ERROR', 'Failed to verify session status with server. Please refresh the page.', 'log-tag-error');
      }
    }
  }

  /**
   * Returns true if the error is a network/connection-refused/TLS error.
   * Distinguishes from server-side errors (which produce HTTP responses, not thrown errors).
   */
  function isConnectionError(err) {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed') ||
      msg.includes('network request failed') ||
      err instanceof TypeError
    );
  }

  async function initSession() {
    // Guard: prevent concurrent session init if one is already in flight
    if (state.sessionInitInFlight) {
      logConsole('SESSION', 'Session initialization already in progress...', 'log-tag-system');
      return;
    }
    state.sessionInitInFlight = true;

    try {
      btnInitSession.disabled = true;
      const res = await fetch('/api/v1/session/init', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        updateSessionUI(true);
        state.discoveredEvidence.clear();
        renderEvidenceList();
        clearViewer();
        logConsole('SESSION', 'Challenge session initialized and authenticated.', 'log-tag-system');
      } else {
        logConsole('ERROR', data.message || 'Session initialization rejected.', 'log-tag-error');
      }
    } catch (err) {
      if (isConnectionError(err)) {
        logConsole('ERROR',
          'Cannot connect to the HTTPS server. ' +
          'If you see a certificate warning in Chrome, open https://127.0.0.1:8443, ' +
          'click Advanced → Proceed, then refresh this page.',
          'log-tag-error'
        );
      } else {
        logConsole('ERROR', 'Session initialization failed: ' + (err && err.message ? err.message : 'Unknown error'), 'log-tag-error');
      }
    } finally {
      state.sessionInitInFlight = false;
      btnInitSession.disabled = false;
    }
  }

  async function terminateSession() {
    try {
      btnTermSession.disabled = true;
      const res = await fetch('/api/v1/session/terminate', { method: 'POST' });
      if (res.ok) {
        updateSessionUI(false);
        state.discoveredEvidence.clear();
        renderEvidenceList();
        clearViewer();
        logConsole('SESSION', 'Challenge session terminated cleanly.', 'log-tag-system');
      }
    } catch {
      logConsole('ERROR', 'Session termination fault.', 'log-tag-error');
    } finally {
      btnTermSession.disabled = false;
    }
  }

  function updateSessionUI(isActive) {
    state.sessionActive = isActive;
    sessionDot.className = 'status-dot ' + (isActive ? 'active' : 'terminated');
    sessionStatusLabel.textContent = isActive ? 'AUTHENTICATED' : 'ANONYMOUS';
    btnTermSession.disabled = !isActive;
  }

  // =========================================================================
  // Evidence Rendering (Safe DOM Construction)
  // =========================================================================

  function renderEvidenceList() {
    evidenceList.textContent = ''; // Safe clear
    const count = state.discoveredEvidence.size;
    evidenceCountBadge.textContent = String(count);

    if (count === 0) {
      emptyEvidencePlaceholder.classList.remove('hidden');
      return;
    }

    emptyEvidencePlaceholder.classList.add('hidden');

    for (const [id, item] of state.discoveredEvidence.entries()) {
      const li = document.createElement('li');
      li.className = 'evidence-item' + (state.selectedEvidenceId === id ? ' selected' : '');
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');

      const idDiv = document.createElement('div');
      idDiv.className = 'evidence-item-id';
      idDiv.textContent = item.id;

      const classDiv = document.createElement('div');
      classDiv.className = 'evidence-item-classification';
      classDiv.textContent = item.classification || 'UNKNOWN';

      const sourceDiv = document.createElement('div');
      sourceDiv.className = 'evidence-item-source';
      sourceDiv.textContent = `DOMAIN: ${item.source || 'ENCLAVE'}`;

      li.appendChild(idDiv);
      li.appendChild(classDiv);
      li.appendChild(sourceDiv);

      li.addEventListener('click', () => selectEvidence(id));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectEvidence(id);
        }
      });

      evidenceList.appendChild(li);
    }
  }

  function selectEvidence(id) {
    state.selectedEvidenceId = id;
    renderEvidenceList();
    const item = state.discoveredEvidence.get(id);
    if (item) {
      displayEvidenceRecord(item);
    }
  }

  function clearViewer() {
    state.selectedEvidenceId = null;
    viewerEmptyState.classList.remove('hidden');
    viewerContentArea.classList.add('hidden');
    viewerIdBadge.classList.add('hidden');
    btnToggleRawJson.classList.add('hidden');
  }

  function displayEvidenceRecord(evidence) {
    viewerEmptyState.classList.add('hidden');
    viewerContentArea.classList.remove('hidden');
    viewerIdBadge.classList.remove('hidden');
    btnToggleRawJson.classList.remove('hidden');

    viewerIdBadge.textContent = evidence.id;
    metaSource.textContent = evidence.source || '-';
    metaClassification.textContent = evidence.classification || '-';
    metaVersion.textContent = evidence.version || '1.0.0';
    metaStatus.textContent = evidence.status || 'ACTIVE';

    // Correlation Chips
    const refs = evidence.correlation_references || [];
    correlationChips.textContent = '';
    if (refs.length > 0) {
      correlationBox.classList.remove('hidden');
      refs.forEach((ref) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = ref;
        correlationChips.appendChild(chip);
      });
    } else {
      correlationBox.classList.add('hidden');
    }

    // Structured Content Tree (Safe recursive DOM construction)
    contentTree.textContent = '';
    buildContentTree(evidence.content, contentTree);

    // Raw JSON Viewer
    const codeEl = rawJsonViewer.querySelector('code');
    if (codeEl) {
      codeEl.textContent = JSON.stringify(evidence, null, 2);
    }
  }

  function buildContentTree(obj, container) {
    if (obj === null || obj === undefined) {
      const span = document.createElement('span');
      span.className = 'tree-value';
      span.textContent = 'null';
      container.appendChild(span);
      return;
    }

    if (typeof obj !== 'object') {
      const span = document.createElement('span');
      span.className = 'tree-value';
      span.textContent = String(obj);
      container.appendChild(span);
      return;
    }

    if (Array.isArray(obj)) {
      const ul = document.createElement('ul');
      ul.className = 'tree-list';
      obj.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'tree-list-item';
        buildContentTree(item, li);
        ul.appendChild(li);
      });
      container.appendChild(ul);
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const card = document.createElement('div');
      card.className = 'tree-card';

      const keyEl = document.createElement('div');
      keyEl.className = 'tree-key';
      keyEl.textContent = key.replace(/_/g, ' ').toUpperCase();

      const valEl = document.createElement('div');
      valEl.className = 'tree-value';
      buildContentTree(value, valEl);

      card.appendChild(keyEl);
      card.appendChild(valEl);
      container.appendChild(card);
    }
  }

  // =========================================================================
  // Route Exploration & Dispatching
  // =========================================================================

  async function handleRouteDispatch(e) {
    e.preventDefault();
    if (!state.sessionActive) {
      logConsole('ERROR', 'Authentication required. Initialize a session first.', 'log-tag-error');
      return;
    }

    let inputVal = routeInput.value.trim();
    if (!inputVal) return;

    // Normalizing route prefix
    let fullRoute = inputVal.startsWith('sim://') ? inputVal : `sim://${inputVal}`;

    logConsole('DISPATCH', `Querying symbolic route: ${fullRoute}`, 'log-tag-dispatch');
    btnDispatch.disabled = true;

    try {
      const res = await fetch('/api/v1/sim/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: fullRoute }),
      });

      const data = await res.json();

      if (res.ok && data && data.status === 'ok' && data.evidence) {
        const ev = data.evidence;
        state.discoveredEvidence.set(ev.id, ev);
        state.selectedEvidenceId = ev.id;
        renderEvidenceList();
        displayEvidenceRecord(ev);
        logConsole('EVIDENCE', `Discovered ${ev.id} [${ev.classification}]`, 'log-tag-evidence');
      } else {
        const errCode = data.code || `HTTP_${res.status}`;
        const errMsg = data.message || 'Operation failed.';
        logConsole('ERROR', `[${errCode}] ${errMsg}`, 'log-tag-error');
      }
    } catch {
      logConsole('ERROR', 'Communication error during route dispatch.', 'log-tag-error');
    } finally {
      btnDispatch.disabled = false;
    }
  }

  // =========================================================================
  // Final Evaluation Submission Boundary
  // =========================================================================

  async function handleEvaluationSubmit(e) {
    e.preventDefault();
    if (!state.sessionActive) {
      logConsole('ERROR', 'Active challenge session required for evaluation.', 'log-tag-error');
      return;
    }

    const interpretation = submissionInput.value.trim();
    if (!interpretation) return;

    logConsole('EVAL', 'Submitting candidate final interpretation to server...', 'log-tag-eval');
    btnSubmitEval.disabled = true;

    try {
      const res = await fetch('/api/v1/evaluation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interpretation }),
      });

      const data = await res.json();

      submissionOutcomeBox.classList.remove('hidden', 'accepted', 'not-accepted', 'error');

      if (res.ok && data && typeof data.status === 'string') {
        if (data.status === 'ACCEPTED') {
          submissionOutcomeBox.classList.add('accepted');
          outcomeStatusBadge.className = 'badge badge-success';
          outcomeStatusBadge.textContent = 'ACCEPTED';
          if (data.flag && typeof data.flag === 'string') {
            outcomeMessage.textContent =
              'Verification confirmed by the server enclave. Flag: ' + data.flag;
            logConsole('FLAG', 'Enclave Flag: ' + data.flag, 'log-tag-evidence');
          } else {
            outcomeMessage.textContent =
              'Verification confirmed by the server enclave. Challenge reasoning successfully completed.';
            logConsole('EVAL', 'Submission outcome: ACCEPTED', 'log-tag-evidence');
          }
        } else {
          submissionOutcomeBox.classList.add('not-accepted');
          outcomeStatusBadge.className = 'badge badge-danger';
          outcomeStatusBadge.textContent = 'NOT_ACCEPTED';
          outcomeMessage.textContent =
            'Candidate interpretation was not accepted by the server evaluator.';
          logConsole('EVAL', 'Submission outcome: NOT_ACCEPTED', 'log-tag-eval');
        }
      } else {
        submissionOutcomeBox.classList.add('error');
        outcomeStatusBadge.className = 'badge badge-warning';
        outcomeStatusBadge.textContent = data.code || 'BLOCKED';
        outcomeMessage.textContent = data.message || 'Evaluation could not be performed.';
        logConsole('ERROR', `Evaluation error: ${data.message || 'Unknown fault'}`, 'log-tag-error');
      }
    } catch {
      submissionOutcomeBox.classList.remove('hidden');
      submissionOutcomeBox.classList.add('error');
      outcomeStatusBadge.className = 'badge badge-warning';
      outcomeStatusBadge.textContent = 'FAULT';
      outcomeMessage.textContent = 'Network communication failure during evaluation.';
      logConsole('ERROR', 'Network error during evaluation submission.', 'log-tag-error');
    } finally {
      btnSubmitEval.disabled = false;
    }
  }

  // =========================================================================
  // Event Listeners & Initialization
  // =========================================================================

  btnInitSession.addEventListener('click', initSession);
  btnTermSession.addEventListener('click', terminateSession);
  routeForm.addEventListener('submit', handleRouteDispatch);
  btnClearRoute.addEventListener('click', () => {
    routeInput.value = '';
    routeInput.focus();
  });

  submissionForm.addEventListener('submit', handleEvaluationSubmit);

  btnClearConsole.addEventListener('click', () => {
    consoleLogs.textContent = '';
  });

  btnToggleRawJson.addEventListener('click', () => {
    const isHidden = rawJsonViewer.classList.contains('hidden');
    if (isHidden) {
      rawJsonViewer.classList.remove('hidden');
      structuredViewer.classList.add('hidden');
      btnToggleRawJson.textContent = 'STRUCTURED';
    } else {
      rawJsonViewer.classList.add('hidden');
      structuredViewer.classList.remove('hidden');
      btnToggleRawJson.textContent = 'RAW JSON';
    }
  });

  // Start runtime
  logConsole('SYSTEM', 'StrataCore Forensic Runtime initialized.', 'log-tag-system');
  checkSessionStatus();
})();
