# 1. Executive Summary

This document defines the next product phase for IntentGuard: turning it from a strong hackathon demo into integration-ready software that a wallet provider, agent platform, fintech product, or stablecoin payment system could realistically adopt.

The current project already proves the core idea:

- an AI agent can be constrained by a user-approved intent
- some unsafe actions can be blocked before execution
- executed overspends can be challenged and refunded through operator stake
- a frontend and backend can show the full story to the user

What is still missing is the shift from a guided demo environment to a stable, secure, headless product that another team can plug into their system.

The goal of this PRD is to define that shift.

IntentGuard should become:

- an API-first and SDK-first guard layer for agentic USDC payments
- a policy and evidence system that is usable outside a demo script
- a product with stable interfaces, real environment separation, production storage, operational controls, and integration docs

In simple terms:

Today, IntentGuard is a convincing prototype.

The next version should be software that a partner can actually integrate into a real product without depending on mock endpoints, manual coordination, or hackathon assumptions.

---

# 2. Product Goal

## 2.1 Primary objective

Build an integration-ready version of IntentGuard that can sit between:

- an AI runtime or agent platform
- a wallet or smart-account system
- a USDC payment flow

and provide:

- policy enforcement
- trace-backed evidence
- deterministic challenge and recourse
- partner-friendly APIs and SDKs

## 2.2 What “integration-ready” means

IntentGuard is considered integration-ready when a third-party team can:

1. create and manage user intents through documented APIs or SDKs
2. register agent identities and delegates through stable interfaces
3. submit execution requests using a real runtime rather than demo-only scenario endpoints
4. receive receipts, blocked attempts, and challenge updates through APIs and webhooks
5. operate across dev, staging, and production-like environments with clear secrets, auth, observability, and rollback practices

## 2.3 Product positioning

IntentGuard is not a consumer wallet.

IntentGuard is infrastructure for products that want to let AI agents move USDC safely.

The product should be designed as:

- headless by default
- embeddable by partners
- explainable to compliance, ops, and security teams
- deterministic on critical money paths

---

# 3. Current State vs Target State

## 3.1 Current state

The current repository has a strong real core plus several hackathon shortcuts.

What is already real:

- Solidity contracts and deployment flow
- Base Sepolia execution path
- challenge and slash mechanics
- trace hashing and signing model
- backend APIs for manifests, traces, feed, and challenge prep
- frontend app that can run live when mocks are disabled

What is still demo-first:

- frontend mocks are enabled by default
- wallet onboarding includes a simulated deploy step
- runtime execution is exposed mainly through demo scenario endpoints
- trace stub fallback still exists for local flow
- mock x402 merchant is still part of the main path
- reviewer flow is a stub
- infra defaults are localhost, open CORS, and local SQLite
- contract execution still relies on standing USDC approvals rather than a stronger account execution model

## 3.2 Target state

The target system should preserve the same safety story while replacing demo-only seams with real product interfaces:

- no critical path depends on mock APIs
- no user-facing deploy step is simulated
- agent execution is initiated through a real runtime API or SDK
- production evidence storage is managed and durable
- auth and tenancy exist across all off-chain services
- observability and incident tooling are first-class
- frontend becomes an example console, not the only way to operate the product

---

# 4. End-State Product Experience

## 4.1 Partner experience

A partner team should be able to:

1. install an IntentGuard SDK or call a documented HTTP API
2. create an intent for a user account
3. delegate an approved agent key or service identity
4. submit a trace-backed execution request
5. receive a decision:
   - allowed
   - blocked with reason
   - executed with receipt
6. surface receipts and disputes in their own UI
7. optionally use the IntentGuard console for ops and review

## 4.2 End-user experience

An end user should be able to:

- connect or onboard through a real wallet flow
- understand what permissions they are granting
- approve agent policies in plain language
- see what the agent tried to do
- see what was blocked
- dispute a bad execution
- view the outcome of that dispute

## 4.3 Ops and risk experience

An operations or risk team should be able to:

- inspect receipts and trace evidence
- review disputes and summaries
- track blocked actions and reason codes
- audit partner and user activity
- receive alerts and webhooks for high-risk events

---

# 5. Core Product Requirements

## 5.1 Stable integration surfaces

IntentGuard must expose stable, versioned integration surfaces.

Required surfaces:

- HTTP API for manifests, traces, receipts, challenges, health, and review
- TypeScript SDK for frontend and backend integrations
- optional server SDK for agent runtimes
- contract ABI bundle and deployment manifest with versioning
- webhook/event delivery for receipt and challenge updates

Rules:

- partner-facing APIs must be versioned
- response shapes must be documented and test-covered
- breaking changes require version bumps and migration notes

## 5.2 Real agent execution flow

The demo scenario endpoints are useful for testing but cannot remain the main product surface.

Required change:

- replace demo-only scenario execution with a real execution request API and/or SDK flow

The runtime integration should support:

- arbitrary real agent runtimes
- trace upload before execution
- preflight-only checks
- execution submission
- standardized blocked and success responses

The demo control service may remain only as:

- QA tooling
- sandbox/testing utility

It should not define the primary integration model.

## 5.3 Production wallet and account model

The onboarding flow must move from simulated deploy behavior to actual account state checks and execution readiness.

Required capabilities:

- detect whether the user account is already provisioned
- deploy or attach a real smart account path
- verify guard installation instead of simulating success
- clearly manage token allowances or move to stronger account execution semantics

Preferred direction:

- migrate from broad ERC-20 `transferFrom` approvals toward a safer smart-account execution model
- maintain compatibility with embedded wallet providers and partner wallet stacks

## 5.4 Production evidence and storage

IntentGuard needs durable, managed off-chain storage.

Canonical direction:

- MongoDB Atlas as the evidence/document store for manifests, traces, receipts, challenge data, and reviewer summaries

Required properties:

- environment-specific databases
- migrations or schema evolution strategy
- backups and restore plan
- retention policy
- encrypted secrets and access control

Development fallback may still exist locally, but production and staging must use managed infrastructure.

## 5.5 Auth, tenancy, and access control

Hackathon-local trust assumptions must be replaced with explicit access control.

Required:

- API authentication for partner backends
- user identity binding where relevant
- tenant or partner separation
- role-based access for ops, reviewer, and admin functions
- secure secret management

Examples of roles:

- partner service
- end user
- operator
- reviewer
- admin

## 5.6 Observability and operations

Integration-ready software must be operable.

Required:

- structured logs across services
- request correlation IDs
- metrics for receipt volume, blocks, challenge rate, API latency, signer failures, and indexer lag
- alerting for critical failures
- dashboards for service health
- replay-safe indexing and recovery procedures

## 5.7 Security requirements

Security must move beyond demo assumptions.

Required:

- strict CORS and origin controls
- request validation on every API
- signer key isolation and rotation procedures
- rate limiting and abuse protection
- audit trail for reviewer and admin actions
- environment separation for test and production keys
- contract and backend security review before mainnet-like usage

## 5.8 Product console and headless mode

The frontend should evolve into an operator and example console, not the only integration path.

Required:

- the web app continues as a reference and internal operations console
- every critical action the UI performs must also be possible via API or SDK

This ensures the product can be embedded into:

- partner dashboards
- internal payment systems
- agent orchestration products

## 5.9 Reviewer and explanation layer

The review layer should become genuinely useful without becoming the decision-maker on deterministic flows.

Gemini may be used for:

- incident summaries
- reviewer context generation
- natural-language explanations of traces and receipts

Gemini must not:

- override deterministic challenge outcomes
- approve or deny on-chain execution
- become a hidden dependency for the money path

---

# 6. Product Architecture Changes

## 6.1 Replace demo-only primary surfaces

The following should be moved off the primary path:

- `services/demo-control`
- `services/mock-x402`
- `packages/trace/src/trace-stub.ts`
- default frontend mocks
- simulated deploy success in onboarding

These may remain as:

- test harnesses
- local QA tools
- sandbox/demo utilities

## 6.2 Introduce a headless runtime integration layer

Create a real runtime integration surface with:

- `preflightExecution`
- `submitExecution`
- `getExecutionStatus`
- `uploadTrace`

This can be exposed as:

- HTTP endpoints
- a server SDK
- a TypeScript client package

## 6.3 Introduce webhooks

Partners should not have to poll forever.

Required webhooks:

- receipt created
- blocked attempt recorded
- challenge filed
- challenge resolved
- reviewer summary ready

Each webhook must support:

- signing
- retries
- idempotency keys
- tenant scoping

## 6.4 Environment model

Define and support:

- local
- sandbox
- staging
- production

Each environment must have:

- separate deployments
- separate storage
- separate signing keys
- separate wallet/account configuration

## 6.5 Versioned schemas

The following schemas need explicit lifecycle management:

- intent manifest schema
- decision trace schema
- feed and receipt response schemas
- challenge response schemas

Rules:

- additive changes should be preferred
- breaking changes require versioning
- schema docs should be published for partners

---

# 7. Workstream Breakdown

## 7.1 Protocol and wallet execution

Goals:

- harden the contract path
- reduce unsafe approval patterns
- support a real smart-account execution model

Deliverables:

- production-reviewed ABI bundle
- contract versioning policy
- migration path from standing approvals to stronger execution semantics
- deploy scripts for sandbox, staging, and production-like environments

## 7.2 Runtime and SDK

Goals:

- replace demo scenarios with real runtime integration
- make trace-backed execution usable by partner systems

Deliverables:

- runtime SDK
- trace upload client
- execution client
- typed error model
- example integration for a real agent service

## 7.3 Infra and storage

Goals:

- production storage
- multi-tenant APIs
- webhook delivery
- durable indexing

Deliverables:

- MongoDB Atlas-backed store
- migration plan from local SQLite development patterns
- auth layer
- webhook subsystem
- production-ready deployment manifests

## 7.4 Frontend and console

Goals:

- turn the dashboard into a real operator console and reference integration

Deliverables:

- real account readiness checks
- no simulated deploy success
- real review and evidence views
- admin/ops console surfaces
- partner configuration screens

## 7.5 DevOps and security

Goals:

- production readiness
- safe operations

Deliverables:

- secret management
- alerting and dashboards
- SLOs and runbooks
- incident response playbook
- environment promotion flow

---

# 8. Milestones

## Phase 1 — Remove demo dependencies

Exit criteria:

- frontend mocks off by default in non-local environments
- fake onboarding/deploy behavior removed
- trace stub no longer used in staging path
- demo-control service reclassified as testing-only

## Phase 2 — API-first integration layer

Exit criteria:

- runtime SDK and HTTP APIs exist for real execution flow
- partner auth exists
- versioned API docs exist
- webhook delivery exists for receipts and challenge events

## Phase 3 — Production infrastructure

Exit criteria:

- MongoDB Atlas is the canonical evidence store in staging/production
- managed deployments exist for backend services
- observability and alerting are live
- signer and reviewer keys are managed safely

## Phase 4 — Pilot readiness

Exit criteria:

- one external or internal partner can integrate without using demo endpoints
- a real user flow can create intent, execute allowed payment, show blocked attempt, and complete challenge flow
- runbooks cover onboarding, failure recovery, indexer replay, and key rotation

## Phase 5 — Production candidate

Exit criteria:

- contract and backend security review completed
- operational SLOs defined
- environment promotion path validated
- partner docs and SDK docs published

---

# 9. Non-Goals for This Next Phase

These are still not required to become integration-ready:

- many-chain expansion
- generalized DeFi routing
- semantic AI judging on the live money path
- consumer social features
- speculative token economics
- fully autonomous moderation without human override

The point of this phase is not to become everything.

The point is to become trustworthy, stable, and easy to plug into another real system.

---

# 10. Biggest Gaps to Close

These are the most important current gaps between the demo and an integratable product:

1. simulated onboarding instead of real provisioning checks
2. demo scenario APIs instead of runtime-facing execution APIs
3. fallback stubs still present on critical paths
4. no partner auth or tenancy model
5. local/dev infrastructure defaults instead of managed production infrastructure
6. broad ERC-20 approval model that should evolve toward safer execution semantics
7. polling-heavy UX without webhook-first partner delivery

---

# 11. Success Criteria

This phase succeeds when all of the following are true:

- a partner can integrate without using demo-only routes
- the system can run with real services and no local stubs in the critical path
- user onboarding, intent commit, delegation, execution, receipt display, and challenge flow all work in a repeatable staging environment
- off-chain evidence is durable and queryable
- APIs, SDKs, and contract artifacts are versioned and documented
- the product can be operated, monitored, and recovered by a team that did not build the hackathon demo

---

# 12. Final Framing

The current IntentGuard project proves that the idea is real.

This next PRD is about making the software usable by someone other than the original builders.

That is the standard for “not just a demo.”

It does not mean removing the demo.

It means making sure the demo is only one view of a real product, instead of the product being built around the demo.
