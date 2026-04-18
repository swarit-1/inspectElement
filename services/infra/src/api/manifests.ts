import { Router } from "express";
import { z } from "zod";
import { buildCanonicalManifest } from "../canonical/manifest.js";
import { createPinner } from "../ipfs/index.js";
import { logger } from "../utils/logger.js";
import {
  getManifestByHash,
  insertManifest,
} from "../store/manifests.js";
import { asyncHandler, badRequest } from "./errors.js";

/**
 * IF-01 — Manifest pinning.
 *
 *   POST /v1/manifests
 *   Body: { owner, token, maxSpendPerTx, maxSpendPerDay,
 *           allowedCounterparties, expiry, nonce, metadata? }
 *   200:  { manifestURI, intentHash }
 *
 * Canonicalization rules live in `canonical/manifest.ts`. The same canonical
 * bytes are pinned to IPFS *and* hashed into `intentHash`, so Dev 4's
 * `commitIntent` call cannot drift from the stored manifest.
 */

const ManifestBody = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  token: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  maxSpendPerTx: z.union([z.string(), z.number(), z.bigint()]),
  maxSpendPerDay: z.union([z.string(), z.number(), z.bigint()]),
  allowedCounterparties: z.array(z.string().regex(/^0x[0-9a-fA-F]{40}$/)).min(1),
  expiry: z.union([z.string(), z.number(), z.bigint()]),
  nonce: z.union([z.string(), z.number(), z.bigint()]),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export function createManifestsRouter(): Router {
  const router = Router();
  const pinner = createPinner();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = ManifestBody.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("invalid manifest body", parsed.error.flatten());
      }

      const { manifest, json, intentHash } = buildCanonicalManifest({
        owner: parsed.data.owner,
        token: parsed.data.token,
        maxSpendPerTx: parsed.data.maxSpendPerTx as never,
        maxSpendPerDay: parsed.data.maxSpendPerDay as never,
        allowedCounterparties: parsed.data.allowedCounterparties,
        expiry: parsed.data.expiry as never,
        nonce: parsed.data.nonce as never,
        metadata: (parsed.data.metadata as Record<string, unknown> | null | undefined) ?? null,
      });

      const cached = getManifestByHash(intentHash);
      if (cached) {
        res.json({ manifestURI: cached.manifestUri, intentHash });
        return;
      }

      const pin = await pinner.pin(json, `manifest-${intentHash.slice(2, 10)}.json`);
      insertManifest({
        intentHash,
        manifestUri: pin.uri,
        manifestJson: json,
        owner: manifest.owner,
        token: manifest.token,
        maxSpendPerTx: manifest.maxSpendPerTx,
        maxSpendPerDay: manifest.maxSpendPerDay,
        expiry: manifest.expiry,
        nonce: manifest.nonce,
        allowedCounterparties: manifest.allowedCounterparties,
      });

      logger.info(
        { intentHash, manifestURI: pin.uri, pinner: pin.pinner, bytes: pin.bytes },
        "Pinned manifest",
      );
      res.json({ manifestURI: pin.uri, intentHash });
    }),
  );

  router.get(
    "/:intentHash",
    asyncHandler(async (req, res) => {
      const intentHash = String(req.params.intentHash);
      if (!/^0x[0-9a-fA-F]{64}$/.test(intentHash)) {
        throw badRequest("intentHash must be a 0x-prefixed 32-byte hex string");
      }
      const row = getManifestByHash(intentHash as `0x${string}`);
      if (!row) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({
        intentHash: row.intentHash,
        manifestURI: row.manifestUri,
        manifest: JSON.parse(row.manifestJson),
      });
    }),
  );

  return router;
}
