import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Generate a fresh secp256k1 keypair and print TraceAck + Reviewer entries
 * for `.env.local`. Never commit the output.
 *
 *   npm run keygen
 */
function main(): void {
  const traceAckKey = generatePrivateKey();
  const reviewerKey = generatePrivateKey();

  const traceAck = privateKeyToAccount(traceAckKey);
  const reviewer = privateKeyToAccount(reviewerKey);

  console.log("# Add these to services/infra/.env.local");
  console.log("# DO NOT COMMIT");
  console.log("");
  console.log(`TRACE_ACK_PRIVATE_KEY=${traceAckKey}`);
  console.log(`REVIEWER_PRIVATE_KEY=${reviewerKey}`);
  console.log("");
  console.log("# Public addresses (publish these to Dev 1):");
  console.log(`#   TraceAck signer: ${traceAck.address}`);
  console.log(`#   Reviewer signer: ${reviewer.address}`);
}

main();
