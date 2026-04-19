/**
 * Coinbase Server Wallet (CDP) account loader.
 *
 * Wraps a CDP-managed EVM EOA as a viem `Account` so the existing
 * runtime (guard-client, bootstrap, demo agents) can use it without
 * any further changes.
 *
 * Only the agent operator/delegate is sourced from CDP. The user/owner
 * (`OWNER_PRIVATE_KEY`) stays as a raw key — that account represents the
 * end-user (in the demo flow it stands in for what MetaMask does in the
 * web app) and must remain locally controllable.
 */

import { CdpClient } from "@coinbase/cdp-sdk";
import { toAccount } from "viem/accounts";
import type { Account, Hex } from "viem";

export const DEFAULT_CDP_AGENT_ACCOUNT_NAME = "intentguard-agent";

export interface CdpAgentAccount {
  readonly account: Account;
  readonly address: Hex;
  readonly name: string;
}

export interface LoadCdpAgentAccountOptions {
  readonly apiKeyId?: string;
  readonly apiKeySecret?: string;
  readonly walletSecret?: string;
  readonly accountName?: string;
}

let cached: CdpAgentAccount | null = null;
let cachedKey: string | null = null;

/**
 * Get-or-create a CDP Server Wallet EVM EOA and wrap it as a viem Account.
 *
 * Idempotent on `accountName`: CDP returns the same account if one already
 * exists with the same name, so repeat process invocations resolve to the
 * same on-chain address.
 *
 * Cached at module scope so repeat calls in a single process are free
 * (the first call performs a network request to CDP).
 */
export async function loadCdpAgentAccount(
  options: LoadCdpAgentAccountOptions = {}
): Promise<CdpAgentAccount> {
  const apiKeyId = options.apiKeyId ?? process.env.CDP_API_KEY_ID;
  const apiKeySecret = options.apiKeySecret ?? process.env.CDP_API_KEY_SECRET;
  const walletSecret = options.walletSecret ?? process.env.CDP_WALLET_SECRET;
  const accountName =
    options.accountName ??
    process.env.CDP_AGENT_ACCOUNT_NAME ??
    DEFAULT_CDP_AGENT_ACCOUNT_NAME;

  if (!apiKeyId || !apiKeySecret || !walletSecret) {
    throw new Error(
      "CDP credentials missing. Set CDP_API_KEY_ID, CDP_API_KEY_SECRET, and " +
        "CDP_WALLET_SECRET (or pass them explicitly) when AGENT_SIGNER=cdp."
    );
  }

  const cacheKey = `${apiKeyId}:${accountName}`;
  if (cached && cachedKey === cacheKey) {
    return cached;
  }

  const cdp = new CdpClient({ apiKeyId, apiKeySecret, walletSecret });
  const serverAccount = await cdp.evm.getOrCreateAccount({ name: accountName });

  const viemAccount = toAccount({
    address: serverAccount.address,
    sign: serverAccount.sign.bind(serverAccount),
    signMessage: serverAccount.signMessage.bind(serverAccount),
    signTransaction: serverAccount.signTransaction.bind(serverAccount),
    signTypedData: serverAccount.signTypedData.bind(serverAccount),
  });

  cached = {
    account: viemAccount,
    address: serverAccount.address as Hex,
    name: accountName,
  };
  cachedKey = cacheKey;
  return cached;
}

/**
 * Test-only helper: forget the cached CDP account so a fresh load is
 * performed on the next call. Not exported from the package index.
 */
export function clearCdpAccountCache(): void {
  cached = null;
  cachedKey = null;
}
