# Privy setup (IntentGuard web)

This app uses **Privy React Auth** plus **`@privy-io/wagmi`** so wallet state stays aligned with Privy’s connectors. The versions pinned in `package.json` should match Privy’s [wagmi integration guide](https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi).

## Official documentation (source of truth)

| Topic | Link |
| --- | --- |
| Create app & get **App ID** | [Create a new app](https://docs.privy.io/basics/get-started/dashboard/create-new-app) |
| React `PrivyProvider` setup | [Setup](https://docs.privy.io/basics/react/setup) |
| **wagmi** (`createConfig`, `WagmiProvider`) | [Integrating with wagmi](https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi) |
| **EVM networks** (`supportedChains`, `defaultChain`) | [Configuring EVM networks](https://docs.privy.io/basics/react/advanced/configuring-evm-networks) |
| Optional **App Clients** (`clientId`) | [App clients](https://docs.privy.io/basics/get-started/dashboard/app-clients) |
| Wait until SDK is ready | [`usePrivy` → `ready`](https://docs.privy.io/basics/react/setup) (see “Waiting for Privy to be ready”) |

## Install (already in this repo)

```bash
npm i wagmi @privy-io/react-auth @privy-io/wagmi @tanstack/react-query
```

Import **`createConfig` and `WagmiProvider` from `@privy-io/wagmi`**, not from `wagmi` directly.

## Provider order (required)

```
PrivyProvider
  → QueryClientProvider
    → WagmiProvider (@privy-io/wagmi)
      → your app
```

Implemented in `src/components/providers/providers.tsx`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Public **App ID** from the Privy Dashboard |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | No | Only if you use **App Clients** for multiple domains/environments |

This monorepo loads **both** the repo root and `apps/web/` `.env*` files via `next.config.mjs`, and passes `NEXT_PUBLIC_PRIVY_APP_ID` through Next’s `env` config so Turbopack still inlines it when using a monorepo root.

### If the UI still says the App ID is missing

1. **Restart** the dev server (full stop, then `npm run dev` again). `NEXT_PUBLIC_*` is fixed when the dev server starts.
2. **Clear the cache:** `rm -rf apps/web/.next` then restart.
3. **Check the line** in `.env.local` (no typo): exactly `NEXT_PUBLIC_PRIVY_APP_ID=...` — no spaces around `=`, no quotes unless the value needs them.
4. Put the same line in **`apps/web/.env.local`** if root env still doesn’t apply in your environment.
5. Confirm the value is your **App ID** from the Privy dashboard (not a secret key).

## Dashboard checklist

1. Enable login methods you need (**Email**, **Wallet**, etc.) — they must match `loginMethods` in `src/lib/privy.ts`.
2. Allow **Base Sepolia** (chain id `84532`) and set it as default if you want connect prompts to match this app.
3. Add your dev origin (e.g. `http://localhost:3000`) under allowed domains / authorized origins.

## Code map

- `src/lib/privy.ts` — `PrivyClientConfig` (`supportedChains`, `defaultChain`, `loginMethods`, …)
- `src/lib/wagmi.ts` — wagmi `createConfig` from `@privy-io/wagmi`, same chains as Privy
- `src/components/providers/providers.tsx` — provider tree + SIWE bootstrap after Privy `ready`

After changing Privy or wagmi versions, re-read the **wagmi** integration page above — provider imports and peer dependencies are the usual drift points.
