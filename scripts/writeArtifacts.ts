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
import { fileURLToPath } from "url";

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

function writeJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
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

    // Build the schema infra + packages/trace expect.
    const contracts = {
        IntentRegistry: stripped.IntentRegistry,
        AgentRegistry: stripped.AgentRegistry,
        GuardedExecutor: stripped.GuardedExecutor,
        ChallengeArbiter: stripped.ChallengeArbiter,
        StakeVault: stripped.StakeVault,
        USDC: stripped.USDC ?? stripped.MockUSDC,
    };

    // Prefer the signer addresses that were actually passed to the Ignition
    // deploy (source of truth — those values were baked into the contract
    // constructors). Fall back to explicit env vars if the params file is
    // missing for any reason.
    const paramsFile = path.join(ROOT, "ignition", "parameters", `${networkName}.json`);
    const params = readJsonIfExists<IgnitionParameters>(paramsFile);
    const paramsTraceAck = params?.IntentGuardDeploy?.traceAckSigner;
    const paramsReviewer = params?.IntentGuardDeploy?.reviewerSigner;
    const traceAckSigner =
        (paramsTraceAck && paramsTraceAck !== ZERO_ADDRESS ? paramsTraceAck : undefined) ??
        process.env.TRACE_ACK_SIGNER_ADDRESS ??
        ZERO_ADDRESS;
    const reviewerSigner =
        (paramsReviewer && paramsReviewer !== ZERO_ADDRESS ? paramsReviewer : undefined) ??
        process.env.REVIEWER_SIGNER_ADDRESS ??
        traceAckSigner;

    const out = {
        chainId,
        network: networkName,
        addresses, // keep for anyone reading the legacy shape
        contracts,
        traceAckSigner,
        reviewerSigner,
        startBlock: findStartBlock(ignitionDir),
        constants: {
            chainId,
            maxSpendPerTx: "10000000",
            maxSpendPerDay: "50000000",
            agentStake: "50000000",
            challengeBond: "1000000",
            challengeWindowSec: 259200,
        },
    };

    writeJson(path.join(ROOT, "deployments", `${networkName}.json`), out);
    let wroteWebMirror = false;
    if (networkName === "base-sepolia") {
        // Legacy mirror retained for any tooling that still expects the file
        // inside the web package. The app itself now imports the repo-root
        // manifest directly.
        writeJson(path.join(ROOT, "apps", "web", "src", "config", "base-sepolia.json"), out);
        wroteWebMirror = true;
    }

    // Write ABIs to abi/<Name>.json.
    const abiDir = path.join(ROOT, "abi");
    fs.mkdirSync(abiDir, { recursive: true });
    for (const name of CONTRACTS) {
        const artifactPath = path.join(ROOT, "artifacts", "contracts", `${name}.sol`, `${name}.json`);
        const testArtifactPath = path.join(
            ROOT,
            "artifacts",
            "contracts",
            "test",
            `${name}.sol`,
            `${name}.json`,
        );
        const pathToUse = fs.existsSync(artifactPath)
            ? artifactPath
            : fs.existsSync(testArtifactPath)
              ? testArtifactPath
              : null;
        if (!pathToUse) continue;
        const artifact = JSON.parse(fs.readFileSync(pathToUse, "utf8"));
        fs.writeFileSync(
            path.join(abiDir, `${name}.json`),
            JSON.stringify(artifact.abi, null, 2) + "\n",
        );
    }

    const suffix = wroteWebMirror ? ", and web manifest mirror" : "";
    console.log(`Wrote deployments/${networkName}.json and abi/*.json${suffix}`);
}

main();
