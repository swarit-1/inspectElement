import { Router } from "express";
import { loadDeployments, loadEnv } from "../config/env.js";
import { Signer } from "../signer/index.js";
import { getMeta, META_LAST_INDEXED_BLOCK } from "../store/meta.js";

/**
 * Liveness + signer pubkey discovery endpoint.
 *
 * Dev 1 + Dev 2 can hit `GET /v1/health` to discover the running TraceAck
 * signer pubkey without poking around in env files. This is the canonical
 * "publish the signer pubkey" surface called out in Dev 3 spec §3.2 / §6.
 */
export function createHealthRouter(): Router {
  const router = Router();
  const env = loadEnv();
  const deployment = loadDeployments(env);
  const signer = Signer.fromEnv();

  router.get("/", async (_req, res) => {
    res.json({
      ok: true,
      service: "intentguard-infra",
      chainId: env.CHAIN_ID,
      traceAckSigner: signer.traceAck.address,
      reviewerSigner: signer.reviewer?.address ?? null,
      contracts: deployment?.contracts ?? null,
      lastIndexedBlock: await getMeta(META_LAST_INDEXED_BLOCK),
      traceAckTtlSeconds: env.TRACE_ACK_TTL_SECONDS,
    });
  });

  return router;
}
