import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LOCAL_CAS_DIR } from "../ipfs/index.js";
import { asyncHandler, badRequest, notFound } from "./errors.js";

/**
 * Local content-addressed storage gateway.
 *
 * When `IPFS_TOKEN` is unset, manifests/traces are pinned into `data/cas/`
 * and the returned `traceURI` / `manifestURI` is `${PUBLIC_BASE_URL}/ipfs/<sha256>`.
 * This endpoint serves those bytes back so Dev 4 / Dev 2 can fetch by URI.
 *
 * Production deployments using a real IPFS pinning provider can drop this
 * route entirely.
 */
export function createLocalCasRouter(): Router {
  const router = Router();

  router.get(
    "/:cid",
    asyncHandler(async (req, res) => {
      const cid = String(req.params.cid);
      if (!/^[0-9a-f]{64}$/.test(cid)) throw badRequest("cid must be a sha256 hex");
      const path = resolve(LOCAL_CAS_DIR, cid);
      if (!existsSync(path)) throw notFound("cid not pinned locally");
      const bytes = readFileSync(path);
      res.set("content-type", "application/json");
      res.set("cache-control", "public, max-age=31536000, immutable");
      res.send(bytes);
    }),
  );

  return router;
}
