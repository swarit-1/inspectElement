# Smart Product Vision

## What this is

IntentGuard is **not** a wallet and **not** the payment agent.

It is a **control layer for agentic payments** that sits on top of an existing wallet, runtime, and payment flow. Its job is to add:

- policy controls
- evidence capture
- advisory AI analysis
- challenge and recovery tools

In plain English:

- the wallet holds funds
- the agent proposes actions
- IntentGuard decides what is allowed, what is blocked, what is suspicious, and how users recover from bad outcomes

## What this is not

Do **not** reimplement:

- the wallet itself
- the core agent runtime
- the existing on-chain guard, receipt, and challenge flow
- Supabase auth/storage already in place
- the current demo flow that already works

This sprint is about turning the existing system into a clearer, smarter product surface.

## Product shape

The end-state product should have three simple surfaces:

### 1. Owner dashboard

Where the wallet owner:

- sets rules
- approves spend rails
- authorizes delegates
- monitors receipts, blocked attempts, and challenges

### 2. Partner/runtime console

Where an integrating team:

- submits trace-backed execution requests
- sees preflight and execution outcomes
- consumes live events

### 3. Review console

Where a reviewer or risk operator:

- opens a receipt or challenge
- reads the evidence
- sees an advisory Gemini summary
- understands why the system allowed, blocked, or flagged the action

## Priority tasks

### 1. Add Gemini advisory screening

Build a Gemini-powered screening layer that analyzes traces for prompt-injection or manipulation signals.

Goal:

- make the product visibly understand the attack, not just match a rule

### 2. Add Gemini incident summaries

Generate short advisory summaries for receipts and challenges from stored evidence.

Goal:

- make the evidence easy for judges, users, and reviewers to understand

### 3. Add a real execution API

Keep the demo scenarios, but add a proper runtime-facing execution surface so the product is not just button-driven.

Goal:

- make IntentGuard look integratable, not just theatrical

### 4. Add live updates

Stream new receipts, blocked attempts, challenges, and summaries into the UI.

Goal:

- make the system feel operational and real-time

### 5. Improve role-aware UI

Clarify what owners, challengers, reviewers, and partner admins can do.

Goal:

- make the product feel like a real control plane instead of a hackathon toy

## Product principles

- deterministic logic remains authoritative for money movement
- Gemini stays advisory unless explicitly gated
- evidence is first-class
- the UI should explain both prevention and recovery
- new features should build on top of the current system, not replace it

## One-sentence version

IntentGuard is a security and evidence layer for agentic payments that sits between an existing wallet and an existing agent, then blocks the obvious attack, explains the subtle one, and gives users a path to recover.
