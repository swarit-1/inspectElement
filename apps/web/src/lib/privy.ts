import type { PrivyClientConfig } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";

/**
 * Privy client config — keep in sync with official docs (chains must match wagmi `createConfig`):
 * - Setup: https://docs.privy.io/basics/react/setup
 * - wagmi integration: https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi
 * - EVM networks: https://docs.privy.io/basics/react/advanced/configuring-evm-networks
 *
 * `defaultChain` must be included in `supportedChains` (Privy requirement).
 *
 * Public app identifier from the Privy Dashboard (not a secret). Optional `clientId` on
 * `PrivyProvider` is for [App Clients](https://docs.privy.io/basics/get-started/dashboard/app-clients)
 * when you deploy to multiple domains — we only pass `appId` here unless you add it.
 */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const privyClientConfig: PrivyClientConfig = {
  supportedChains: [baseSepolia],
  defaultChain: baseSepolia,
  loginMethods: ["email", "wallet"],
  appearance: {
    showWalletLoginFirst: true,
    walletList: [
      "detected_wallets",
      "metamask",
      "coinbase_wallet",
      "wallet_connect",
    ],
    walletChainType: "ethereum-only",
    landingHeader: "Vault",
    loginMessage:
      "Create an account or sign in with email, then connect or link MetaMask or Coinbase Wallet on Base Sepolia.",
  },
};
