# IntentGuard Demo Runbook

## Pre-demo setup

1. Ensure Base Sepolia RPC is reachable
2. Start infra services (Dev 3): `cd apps/infra && npm start`
3. Start agent runtime (Dev 2): `cd apps/runtime && npm start`
4. Start frontend: `cd apps/web && npm run dev`
5. Open browser to `http://localhost:3000`

## Demo flow (5 minutes)

### Step 1: Onboard (30s)
1. Click **Connect Wallet** on the landing page
2. Approve wallet connection in Privy/MetaMask
3. You'll be redirected to the dashboard

### Step 2: Commit Intent (45s)
1. Review the prefilled intent: 10 USDC/tx, 50 USDC/day, 3 counterparties
2. Click **Sign & Commit Intent**
3. Approve the transaction in your wallet
4. Wait for on-chain confirmation — you'll see "Intent committed"

### Step 3: Delegate Agent (30s)
1. The agent delegation form appears after intent is committed
2. Enter the Agent ID (printed by Dev 2's bootstrap script)
3. Enter the delegate address (agent's signing key)
4. Click **Approve Delegate** and confirm the transaction

### Step 4: Run Legit Payment (30s)
1. Navigate to **Demo Panel** (sidebar)
2. Click **Run** on "Run Legit Payment" (2 USDC to allowlisted merchant)
3. Wait for result card showing "Executed" with txHash
4. Switch to **Dashboard** — see the confirmed receipt in the feed

### Step 5: Run Blocked Attack (30s)
1. Back on Demo Panel, click **Run** on "Run Blocked Attack"
2. Result shows: Blocked — COUNTERPARTY NOT ALLOWED
3. Dashboard feed shows the blocked attempt with red indicator

### Step 6: Run Overspend Attack (30s)
1. Click **Run** on "Run Overspend Attack" (15 USDC to allowlisted merchant)
2. Result shows "Executed" — the payment went through
3. Dashboard feed shows overspend receipt with warning and "File challenge" button

### Step 7: File Challenge (1m)
1. Click **File challenge** on the overspend receipt in the feed
2. Receipt detail page opens showing the violation
3. Click **File AmountViolation**
4. Approve USDC bond (1 USDC) and the challenge transaction
5. Challenge status updates to UPHELD
6. **15 USDC returned** from operator stake to user

### Step 8: Verify (30s)
1. Return to Dashboard — challenge resolution appears in feed
2. Click the BaseScan link to verify on-chain

## Troubleshooting

- **Wallet won't connect**: Ensure MetaMask is on Base Sepolia (chain ID 84532)
- **Transaction fails**: Check the smart account has testnet ETH for gas
- **Feed not updating**: Check infra API is running, or set `NEXT_PUBLIC_USE_MOCKS=true`
- **Demo panel errors**: Check runtime API is running at the configured URL

## Reset

```bash
cd apps/web && npx tsx scripts/reset.ts
```

This clears local caches, creates a fresh agent delegate, and reseeds the intent.
