/*
 * Post-deploy artifact writer.
 *
 * Reads Ignition's per-chain `deployed_addresses.json` and emits a consolidated
 * `deployments/<network>.json` + ABIs into `abi/` so Dev 3 (indexer) and Dev 4
 * (web) can consume a stable location instead of scraping Ignition internals.
 *
 * Usage:
 *   npx ts-node scripts/writeArtifacts.ts base-sepolia 84532
 *   npx ts-node scripts/writeArtifacts.ts localhost 31337
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const CONTRACTS = [
    "IntentRegistry",
    "StakeVault",
    "GuardedExecutor",
    "AgentRegistry",
    "ChallengeArbiter",
    "MockUSDC",
];

function main() {
    const [, , networkName, chainIdStr] = process.argv;
    if (!networkName || !chainIdStr) {
        console.error("Usage: writeArtifacts <networkName> <chainId>");
        process.exit(1);
    }
    const chainId = Number(chainIdStr);

    const ignitionDir = path.join(ROOT, "ignition", "deployments", `chain-${chainId}`);
    const addressesFile = path.join(ignitionDir, "deployed_addresses.json");
    if (!fs.existsSync(addressesFile)) {
        console.error(`No deployed_addresses.json at ${addressesFile}`);
        process.exit(1);
    }

    const raw: Record<string, string> = JSON.parse(fs.readFileSync(addressesFile, "utf8"));

    // Ignition keys look like "IntentGuardDeploy#IntentRegistry". Strip module prefix.
    const addresses: Record<string, string> = {};
    for (const [key, addr] of Object.entries(raw)) {
        const local = key.split("#").pop() ?? key;
        addresses[local] = addr;
    }

    // Build the schema infra + packages/trace expect.
    const contracts = {
        IntentRegistry: addresses.IntentRegistry,
        AgentRegistry: addresses.AgentRegistry,
        GuardedExecutor: addresses.GuardedExecutor,
        ChallengeArbiter: addresses.ChallengeArbiter,
        StakeVault: addresses.StakeVault,
        USDC: addresses.USDC ?? addresses.MockUSDC,
    };

    const traceAckSigner =
        process.env.TRACE_ACK_SIGNER_ADDRESS ??
        "0x0000000000000000000000000000000000000000";
    const reviewerSigner =
        process.env.REVIEWER_SIGNER_ADDRESS ?? traceAckSigner;

    const out = {
        chainId,
        network: networkName,
        addresses, // keep for anyone reading the legacy shape
        contracts,
        traceAckSigner,
        reviewerSigner,
        constants: {
            chainId,
            maxSpendPerTx: "10000000",
            maxSpendPerDay: "50000000",
            agentStake: "50000000",
            challengeBond: "1000000",
            challengeWindowSec: 259200,
        },
    };

    const deploymentsDir = path.join(ROOT, "deployments");
    fs.mkdirSync(deploymentsDir, { recursive: true });
    fs.writeFileSync(
        path.join(deploymentsDir, `${networkName}.json`),
        JSON.stringify(out, null, 2) + "\n",
    );

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

    console.log(`Wrote deployments/${networkName}.json and abi/*.json`);
}

main();
