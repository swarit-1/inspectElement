import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { baseSepolia } from "viem/chains";

/**
 * Use `createConfig` / `WagmiProvider` from `@privy-io/wagmi`, not `wagmi` directly.
 * Chains here must match `supportedChains` / `defaultChain` in `privyClientConfig`.
 * @see https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi
 *
 * Connectors are supplied by Privy — do not add `injected()` here.
 */
export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
