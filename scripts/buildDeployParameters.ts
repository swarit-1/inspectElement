/*
 * Build the Ignition parameters file for `IntentGuardDeploy` so Dev 1 doesn't
 * have to hand-copy Dev 3's signer public keys at deploy time.
 *
 * Reads:
 *   - services/infra/.env.local (or .env / process.env) for
 *     TRACE_ACK_PRIVATE_KEY and (optional) REVIEWER_PRIVATE_KEY.
 *   - process.env.USDC for the on-chain USDC address (Base Sepolia default
 *     baked in).
 *   - process.env.INITIAL_OWNER (optional) for the Ownable2Step admin —
 *     defaults to the deployer if unset.
 *
 * Writes:
 *   - ignition/parameters/<network>.json with `IntentGuardDeploy.{usdc,
 *     traceAckSigner, reviewerSigner, initialOwner?}` derived from the keys.
 *
 * NEVER prints private keys. Only public addresses are written to disk.
 *
 * Usage:
 *   npx tsx scripts/buildDeployParameters.ts base-sepolia
 *   npx tsx scripts/buildDeployParameters.ts localhost
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const NETWORK_DEFAULTS: Record<string, { usdc?: string }> = {
    "base-sepolia": { usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
    localhost: {},
    hardhat: {},
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_KEY = "0x" + "0".repeat(64);

interface IgnitionParameters {
    IntentGuardDeploy: {
        usdc: string;
        traceAckSigner: string;
        reviewerSigner: string;
        initialOwner?: string;
    };
}

function loadEnvFiles(): void {
    // Order matters: .env.local wins over .env, and process.env wins over both.
    const candidates = [
        path.join(ROOT, "services/infra/.env.local"),
        path.join(ROOT, "services/infra/.env"),
        path.join(ROOT, ".env.local"),
        path.join(ROOT, ".env"),
    ];
    for (const file of candidates) {
        if (fs.existsSync(file)) loadDotenv({ path: file, override: false });
    }
}

function addressFromKey(label: string, raw: string | undefined, allowMissing: boolean): string {
    if (!raw || raw === ZERO_KEY) {
        if (allowMissing) return ZERO_ADDRESS;
        throw new Error(
            `${label} is required. Run \`npm --prefix services/infra run keygen\` and copy the line into services/infra/.env.local.`,
        );
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
        throw new Error(`${label} must be a 32-byte hex string (0x + 64 hex chars).`);
    }
    return privateKeyToAccount(raw as Hex).address;
}

function main(): void {
    loadEnvFiles();
    const [, , networkArg] = process.argv;
    const network = networkArg ?? "base-sepolia";
    const defaults = NETWORK_DEFAULTS[network] ?? {};

    const traceAckSigner = addressFromKey(
        "TRACE_ACK_PRIVATE_KEY",
        process.env.TRACE_ACK_PRIVATE_KEY,
        false,
    );
    const reviewerSigner = addressFromKey(
        "REVIEWER_PRIVATE_KEY",
        process.env.REVIEWER_PRIVATE_KEY,
        true,
    );

    const usdc = process.env.USDC ?? defaults.usdc ?? "";
    const initialOwner = process.env.INITIAL_OWNER ?? "";

    const parameters: IgnitionParameters = {
        IntentGuardDeploy: {
            usdc,
            traceAckSigner,
            reviewerSigner,
        },
    };
    if (initialOwner) parameters.IntentGuardDeploy.initialOwner = initialOwner;

    if (network === "base-sepolia" && !usdc) {
        throw new Error(
            "Base Sepolia USDC address is missing. Set USDC=<address> or run with the localhost network for MockUSDC.",
        );
    }

    const outDir = path.join(ROOT, "ignition", "parameters");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${network}.json`);
    fs.writeFileSync(outFile, JSON.stringify(parameters, null, 2) + "\n");

    console.log(`Wrote ${path.relative(ROOT, outFile)}`);
    console.log(`  usdc:            ${usdc || "<MockUSDC will be deployed>"}`);
    console.log(`  traceAckSigner:  ${traceAckSigner}`);
    console.log(
        `  reviewerSigner:  ${reviewerSigner === ZERO_ADDRESS ? "0x0 (rotate later)" : reviewerSigner}`,
    );
    if (initialOwner) console.log(`  initialOwner:    ${initialOwner}`);
    else console.log(`  initialOwner:    <deployer (Ignition default)>`);
}

main();
