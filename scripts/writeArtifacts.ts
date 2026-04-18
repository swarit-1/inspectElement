/*
 * Post-deploy artifact writer.
 *
 * Reads Ignition's per-chain `deployed_addresses.json` (and the parameters
 * file we built before deploy) and emits:
 *
 *   1. `deployments/<network>.json`  — consolidated manifest in the EXACT
 *      shape that Dev 3's `services/infra/src/config/env.ts#loadDeployments`
 *      and `apps/web/src/lib/deployments.ts` consume. Specifically:
 *
 *      {
 *        "chainId": <number>,
 *        "contracts": {
 *          "IntentRegistry": "0x...",
 *          "AgentRegistry": "0x...",
 *          "GuardedExecutor": "0x...",
 *          "ChallengeArbiter": "0x...",
 *          "StakeVault": "0x...",
 *          "USDC": "0x..."
 *        },
 *        "traceAckSigner": "0x...",
 *        "reviewerSigner": "0x...",
 *        "startBlock": <number | null>,
 *        "constants": { ... },
 *        "network": "<networkName>"
 *      }
 *
 *      Previously this script wrote `{chainId, network, addresses}` which
 *      Dev 3's loader silently rejected, so every infra boot saw a missing
 *      manifest and the indexer was disabled. That bug is now fixed.
 *
 *   2. `abi/<Name>.json` — raw ABI per contract for downstream consumers.
 *
 * Usage:
 *   npx tsx scripts/writeArtifacts.ts base-sepolia 84532
 *   npx tsx scripts/writeArtifacts.ts localhost 31337
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const CONTRACTS = [
    "IntentRegistry",
    "StakeVault",
    "GuardedExecutor",
    "AgentRegistry",
    "ChallengeArbiter",
    "MockUSDC",
];

// Frozen demo constants — single source of truth is CONTRACTS-README.md §3.
// Mirrored here so the manifest is self-contained for downstream consumers
// (Dev 3 indexer, Dev 4 dashboard) that import from it.
const CONSTANTS = (chainId: number) => ({
    chainId,
    maxSpendPerTx: "10000000",      // 10 USDC
    maxSpendPerDay: "50000000",     // 50 USDC
    agentStake: "50000000",         // BRONZE_TIER_THRESHOLD
    challengeBond: "1000000",       // CHALLENGE_BOND
    challengeWindowSec: 259200,     // BRONZE_CHALLENGE_WINDOW (72h)
});

interface DeployedAddresses {
    [ignitionKey: string]: string; // e.g. "IntentGuardDeploy#GuardedExecutor"
}

interface IgnitionParameters {
    IntentGuardDeploy?: {
        usdc?: string;
        traceAckSigner?: string;
        reviewerSigner?: string;
        initialOwner?: string;
    };
}

function readJsonIfExists<T>(file: string): T | null {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function stripPrefix(addresses: DeployedAddresses): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, addr] of Object.entries(addresses)) {
        const local = key.split("#").pop() ?? key;
        out[local] = addr;
    }
    return out;
}

/**
 * Best-effort read of the deployment's start block from Ignition's journal so
 * Dev 3's indexer can avoid scanning from genesis. Returns null if the
 * journal isn't present or doesn't include a block height.
 */
function findStartBlock(ignitionDir: string): number | null {
    const journal = path.join(ignitionDir, "journal.jsonl");
    if (!fs.existsSync(journal)) return null;
    try {
        const lines = fs
            .readFileSync(journal, "utf8")
            .split("\n")
            .filter((l) => l.trim().length > 0);
        let earliest: number | null = null;
        for (const line of lines) {
            try {
                const evt = JSON.parse(line) as { blockNumber?: number };
                if (typeof evt.blockNumber === "number") {
                    if (earliest === null || evt.blockNumber < earliest) {
                        earliest = evt.blockNumber;
                    }
                }
            } catch {
                // Ignore malformed journal lines — best-effort only.
            }
        }
        return earliest;
    } catch {
        return null;
    }
}

function writeAbis(): string[] {
    const abiDir = path.join(ROOT, "abi");
    fs.mkdirSync(abiDir, { recursive: true });
    const wrote: string[] = [];
    for (const name of CONTRACTS) {
        const candidates = [
            path.join(ROOT, "artifacts", "contracts", `${name}.sol`, `${name}.json`),
            path.join(ROOT, "artifacts", "contracts", "test", `${name}.sol`, `${name}.json`),
        ];
        const pathToUse = candidates.find((p) => fs.existsSync(p));
        if (!pathToUse) continue;
        const artifact = JSON.parse(fs.readFileSync(pathToUse, "utf8")) as { abi: unknown };
        const dest = path.join(abiDir, `${name}.json`);
        fs.writeFileSync(dest, JSON.stringify(artifact.abi, null, 2) + "\n");
        wrote.push(`abi/${name}.json`);
    }
    return wrote;
}

function main(): void {
    const [, , networkName, chainIdStr] = process.argv;
    if (!networkName || !chainIdStr) {
        console.error("Usage: tsx scripts/writeArtifacts.ts <networkName> <chainId>");
        process.exit(1);
    }
    const chainId = Number(chainIdStr);

    const ignitionDir = path.join(ROOT, "ignition", "deployments", `chain-${chainId}`);
    const addressesFile = path.join(ignitionDir, "deployed_addresses.json");
    const addresses = readJsonIfExists<DeployedAddresses>(addressesFile);
    if (!addresses) {
        console.error(`No deployed_addresses.json at ${addressesFile}`);
        console.error("Run `npm run deploy:base-sepolia` (or the equivalent) first.");
        process.exit(1);
    }

    const stripped = stripPrefix(addresses);
    const required = ["IntentRegistry", "AgentRegistry", "GuardedExecutor", "ChallengeArbiter", "StakeVault"];
    const missing = required.filter((c) => !stripped[c]);
    if (missing.length > 0) {
        console.error(
            `deployed_addresses.json is missing contracts: ${missing.join(", ")}. Re-run the deployment.`,
        );
        process.exit(1);
    }

    // USDC may be the external Base Sepolia address or the deployed MockUSDC,
    // depending on whether `usdc` was supplied in the parameters file. Prefer
    // the parameters value (external addresses won't show up in
    // deployed_addresses.json) and fall back to MockUSDC if present.
    const params = readJsonIfExists<IgnitionParameters>(
        path.join(ROOT, "ignition", "parameters", `${networkName}.json`),
    );
    const declaredUsdc = params?.IntentGuardDeploy?.usdc?.trim() ?? "";
    const usdc = declaredUsdc !== "" ? declaredUsdc : (stripped.MockUSDC ?? ZERO_ADDRESS);
    if (usdc === ZERO_ADDRESS) {
        console.error(
            "Could not resolve USDC address. Either set `usdc` in the parameters file or deploy MockUSDC.",
        );
        process.exit(1);
    }

    const traceAckSigner = params?.IntentGuardDeploy?.traceAckSigner ?? ZERO_ADDRESS;
    const reviewerSigner = params?.IntentGuardDeploy?.reviewerSigner ?? ZERO_ADDRESS;
    if (traceAckSigner === ZERO_ADDRESS) {
        console.warn(
            "WARN: traceAckSigner is 0x0 in the parameters file. The infra service will not be able to sign acks until this is rotated.",
        );
    }

    const startBlock = findStartBlock(ignitionDir);

    const manifest = {
        chainId,
        network: networkName,
        contracts: {
            IntentRegistry: stripped.IntentRegistry,
            AgentRegistry: stripped.AgentRegistry,
            GuardedExecutor: stripped.GuardedExecutor,
            ChallengeArbiter: stripped.ChallengeArbiter,
            StakeVault: stripped.StakeVault,
            USDC: usdc,
        },
        traceAckSigner,
        reviewerSigner,
        startBlock,
        constants: CONSTANTS(chainId),
    };

    const deploymentsDir = path.join(ROOT, "deployments");
    fs.mkdirSync(deploymentsDir, { recursive: true });
    const manifestFile = path.join(deploymentsDir, `${networkName}.json`);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

    const abiFiles = writeAbis();

    console.log(`Wrote deployments/${networkName}.json`);
    console.log(`  GuardedExecutor:  ${manifest.contracts.GuardedExecutor}`);
    console.log(`  ChallengeArbiter: ${manifest.contracts.ChallengeArbiter}`);
    console.log(`  IntentRegistry:   ${manifest.contracts.IntentRegistry}`);
    console.log(`  AgentRegistry:    ${manifest.contracts.AgentRegistry}`);
    console.log(`  StakeVault:       ${manifest.contracts.StakeVault}`);
    console.log(`  USDC:             ${manifest.contracts.USDC}`);
    console.log(`  traceAckSigner:   ${manifest.traceAckSigner}`);
    console.log(`  reviewerSigner:   ${manifest.reviewerSigner}`);
    console.log(`  startBlock:       ${manifest.startBlock ?? "<unknown — indexer will start from latest>"}`);
    if (abiFiles.length > 0) {
        console.log(`Wrote ${abiFiles.length} ABI files: ${abiFiles.join(", ")}`);
    }
}

main();
