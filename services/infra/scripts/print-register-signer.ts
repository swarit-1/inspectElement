/**
 * Print the exact transactions Dev 1 needs to send so this infra service's
 * signer keys are recognized by the deployed contracts.
 *
 *   npm --prefix services/infra run print-register-signer
 *
 * Reads:
 *   - TRACE_ACK_PRIVATE_KEY / REVIEWER_PRIVATE_KEY (from services/infra/.env)
 *   - deployments/base-sepolia.json (Dev 1 publishes this)
 *
 * Prints, for each contract:
 *   - the function name and decoded args
 *   - the raw 4-byte selector + ABI-encoded calldata
 *   - a copy-paste `cast send` invocation
 *
 * NEVER prints private keys.
 */
import { encodeFunctionData, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadDeployments, loadEnv } from "../src/config/env.js";

const GUARDED_EXECUTOR_SET_SIGNER_ABI = [
  {
    type: "function",
    name: "setTraceAckSigner",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const CHALLENGE_ARBITER_SET_REVIEWER_ABI = [
  {
    type: "function",
    name: "setReviewerSigner",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

function header(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n=== ${line} ===`);
}

function block(label: string, value: string): void {
  // eslint-disable-next-line no-console
  console.log(`${label}: ${value}`);
}

function main(): void {
  const env = loadEnv();
  const deployment = loadDeployments(env);
  if (!deployment) {
    // eslint-disable-next-line no-console
    console.error(
      "deployments/base-sepolia.json not found. Have Dev 1 publish it (or set DEPLOYMENTS_PATH) and re-run.",
    );
    process.exit(1);
  }

  if (!env.TRACE_ACK_PRIVATE_KEY) {
    // eslint-disable-next-line no-console
    console.error(
      "TRACE_ACK_PRIVATE_KEY is not set. Run `npm run keygen` first and copy the keys into services/infra/.env.local.",
    );
    process.exit(1);
  }

  const traceAckSigner = privateKeyToAccount(env.TRACE_ACK_PRIVATE_KEY as Hex).address;
  const reviewerSigner = env.REVIEWER_PRIVATE_KEY
    ? privateKeyToAccount(env.REVIEWER_PRIVATE_KEY as Hex).address
    : null;

  const guardedExecutor = getAddress(deployment.contracts.GuardedExecutor);
  const challengeArbiter = getAddress(deployment.contracts.ChallengeArbiter);
  const chainId = deployment.chainId;
  const rpcUrl = env.RPC_URL;

  header("Network");
  block("chainId", String(chainId));
  block("rpcUrl", rpcUrl);

  header("TraceAck signer registration (REQUIRED for the demo)");
  block("contract", `GuardedExecutor @ ${guardedExecutor}`);
  block("function", "setTraceAckSigner(address)");
  block("argument", traceAckSigner);

  const traceAckCalldata = encodeFunctionData({
    abi: GUARDED_EXECUTOR_SET_SIGNER_ABI,
    functionName: "setTraceAckSigner",
    args: [traceAckSigner as Hex],
  });
  block("calldata", traceAckCalldata);

  const traceAckCast = [
    "cast send",
    `--rpc-url ${rpcUrl}`,
    `--chain ${chainId}`,
    "--private-key $OWNER_PRIVATE_KEY",
    guardedExecutor,
    `"setTraceAckSigner(address)"`,
    traceAckSigner,
  ].join(" ");
  block("cast send", traceAckCast);

  if (reviewerSigner) {
    header("Reviewer signer registration (optional — only if reviewer flow is wired in)");
    block("contract", `ChallengeArbiter @ ${challengeArbiter}`);
    block("function", "setReviewerSigner(address)");
    block("argument", reviewerSigner);

    const reviewerCalldata = encodeFunctionData({
      abi: CHALLENGE_ARBITER_SET_REVIEWER_ABI,
      functionName: "setReviewerSigner",
      args: [reviewerSigner as Hex],
    });
    block("calldata", reviewerCalldata);

    const reviewerCast = [
      "cast send",
      `--rpc-url ${rpcUrl}`,
      `--chain ${chainId}`,
      "--private-key $OWNER_PRIVATE_KEY",
      challengeArbiter,
      `"setReviewerSigner(address)"`,
      reviewerSigner,
    ].join(" ");
    block("cast send", reviewerCast);
  } else {
    header("Reviewer signer registration");
    // eslint-disable-next-line no-console
    console.log(
      "REVIEWER_PRIVATE_KEY is not set; reviewer signer registration is skipped.",
    );
  }

  header("Verification (after the txs land)");
  // eslint-disable-next-line no-console
  console.log(
    `cast call --rpc-url ${rpcUrl} ${guardedExecutor} "traceAckSigner()(address)"  # expect ${traceAckSigner}`,
  );
  if (reviewerSigner) {
    // eslint-disable-next-line no-console
    console.log(
      `cast call --rpc-url ${rpcUrl} ${challengeArbiter} "reviewerSigner()(address)"  # expect ${reviewerSigner}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log("");
}

main();
