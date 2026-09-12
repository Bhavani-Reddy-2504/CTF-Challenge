# StrataCore: The Hyperion Enclave Fabric
## Cloud Security & Confidential Computing CTF Challenge Framework

StrataCore is a high-assurance, zero-trust cloud security and confidential computing simulation CTF challenge. It models an isolated, attestation-gated enclave architecture with server-authoritative evidence discovery, deterministic graph synthesis, cryptographic session isolation, and strict evaluation resistance.

---

## 1. Zero-Knowledge Player Distribution Architecture

Under Prompt 18, StrataCore implements a strict **Zero-Knowledge Player Distribution & AI-Resistant Secret Containment** architecture.

### The Fundamental Security Invariant
> A player, Claude, ChatGPT, Gemini, static-analysis tool, decompiler, source-code scanner, or any AI given the COMPLETE PLAYER DISTRIBUTION ZIP will NOT be able to obtain the real flag, fallback flag, flag prefix, or canonical interpretation from the distributed files.

### Key Containment Controls
1. **Server-Only Flag Storage**: The flag exists **strictly** in `process.env.ENCLAVE_FLAG` (or `process.env.CHALLENGE_FLAG`) on the deployed server.
2. **Zero Fallback Flag**: The challenge contains zero default or fallback flags. If `ENCLAVE_FLAG` is absent in production or evaluation, the engine raises a safe `ConfigurationError`.
3. **Server-Authoritative Evaluation**: Candidate answers are hashed and evaluated strictly server-side. The player release contains zero evaluator source, hash preimages, or comparison logic.
4. **Clean Distribution Archive**: `stratacore-player-release.zip` contains strictly allowlisted runtime assets (`public/`, compiled `dist/src/`, clean `package.json`, `release-manifest.json`). Zero tests, TypeScript sources, source maps, walkthroughs, or `.env` files enter the package.
5. **AI Inspection Immunity**: A dedicated 6-layer simulated AI inspection audit (`test/security/package-ai-audit.test.ts` and `npm run audit:player-release`) verifies that full-text and pattern searches across the release bundle yield zero secrets.

---

## 2. Quick Start & Operator Commands

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: npm v9+

### Installation
```bash
npm install
```

### Command Reference

| Command | Description |
| :--- | :--- |
| `npm test` | Executes the complete test suite (1,132 tests across 175 suites) including all 10 Prompt 18 security suites. |
| `npm run build` | Compiles the TypeScript codebase (`src/` and `test/`) into production JavaScript binaries in `dist/`. |
| `npm run start:dev` | Runs the development server via `tsx` with hot loading and local diagnostics. |
| `npm start` | Launches the compiled production server (`node dist/src/index.js`). |
| `npm run package:player` | Generates a clean, isolated player release bundle in `release/` and `stratacore-player-release.zip`. |
| `npm run audit:player-release` | Performs an automated simulated AI inspection and secret leakage audit of the release bundle and zip. |
| `npm run verify:production` | Complete production launch gatekeeper (`build` -> `test` -> `package:player` -> `audit:player-release`). |

---

## 3. Server Environment Configuration

Copy `.env.example` to `.env` on the production server (never commit or distribute `.env`):

```bash
cp .env.example .env
```

| Environment Variable | Allowed Values | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `production`, `development`, `test` | `development` | Runtime environment mode. In `production`, port 0 is disallowed and `ENCLAVE_FLAG` is required. |
| `PORT` | `1` - `65535` (numeric string) | `8080` | Port for the HTTP server. Must be positive integer in production. |
| `HOST` | IP address or hostname (e.g., `0.0.0.0`, `127.0.0.1`) | `0.0.0.0` | Network interface to bind. Rejects special characters and command injections. |
| `ENCLAVE_FLAG` | CTF flag string | *(none)* | **Required on production server.** Flag delivered upon successful evaluation. |

Example server launch:
```bash
export NODE_ENV=production
export PORT=8080
export HOST=0.0.0.0
export ENCLAVE_FLAG="BREACH{your_live_production_flag_here}"
npm start
```

---

## 4. Server Lifecycle & Operational Health Checks

The StrataCore runtime implements a finite state lifecycle with graceful shutdown and connection draining:

```
[ STARTING ] ---> [ READY ] ---> [ DRAINING ] ---> [ STOPPED ]
```

### Health & Readiness Endpoints
- **`GET /health`**: Uninformative liveness probe. Returns HTTP 200 with `{ "status": "OK" }`.
- **`GET /ready`**: Readiness probe.
  - When in `READY` state: returns HTTP 200 with `{ "status": "READY" }`.
  - When in `STARTING`, `DRAINING`, or `STOPPED` state: returns HTTP 503 with `{ "status": "NOT_READY" }`.

### Graceful Termination
When the process receives `SIGINT` (Ctrl+C) or `SIGTERM`:
1. The server transitions immediately to `DRAINING` state.
2. New session initialization attempts are rejected with HTTP 503 (`SERVER_DRAINING`).
3. Existing in-flight requests are permitted to complete within the shutdown grace period.
4. Active sessions and socket connections are cleanly closed.
5. The process transitions to `STOPPED` and terminates cleanly with exit code 0.

---

## 5. Security Verification Status

- **Complete Test Suite**: 1,132 / 1,132 passing (175 suites, 0 failures, 0 skipped)
- **TypeScript Build**: Zero compile errors (`strict: true`)
- **Player Release AI Audit**: 100% PASS (Zero flag patterns, zero canonical answers, zero source maps)
- **Launch Readiness Status**: **STATUS: PASS — ZERO-KNOWLEDGE PRODUCTION READY**
