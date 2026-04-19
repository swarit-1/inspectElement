import { Router } from "express";
import crypto from "node:crypto";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { db, getProvider } from "../store/db.js";
import { createSession } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";
import { asyncHandler, badRequest } from "./errors.js";

/**
 * SIWE (Sign-In With Ethereum) authentication routes.
 *
 *   GET  /v1/auth/nonce?address=0x…  → { nonce }
 *   POST /v1/auth/verify              → { token, address, expiresAt }
 *
 * Flow:
 *   1. Frontend requests a nonce for the connected wallet address
 *   2. Frontend constructs a SIWE message with that nonce and has wallet sign it
 *   3. Frontend POSTs the message + signature to /verify
 *   4. Backend validates signature, creates a session, returns a bearer token
 */

const NonceQuery = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

const VerifyBody = z.object({
  message: z.string(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export function createAuthRouter(): Router {
  const router = Router();

  router.get(
    "/nonce",
    asyncHandler(async (req, res) => {
      const parsed = NonceQuery.safeParse(req.query);
      if (!parsed.success) throw badRequest("address is required");

      const address = parsed.data.address.toLowerCase();
      const nonce = crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      if (getProvider() === "supabase") {
        // Clean up expired nonces for this address
        await db()
          .from("auth_nonces")
          .delete()
          .eq("address", address)
          .lt("expires_at", new Date().toISOString());

        await db()
          .from("auth_nonces")
          .insert({ nonce, address, expires_at: expiresAt });
      }

      res.json({ nonce });
    }),
  );

  router.post(
    "/verify",
    asyncHandler(async (req, res) => {
      const parsed = VerifyBody.safeParse(req.body);
      if (!parsed.success) throw badRequest("invalid verify body", parsed.error.flatten());

      const siweMessage = new SiweMessage(parsed.data.message);

      // Verify the SIWE signature
      let verification;
      try {
        verification = await siweMessage.verify({
          signature: parsed.data.signature,
        });
      } catch (e) {
        throw badRequest(`SIWE verification failed: ${(e as Error).message}`);
      }

      if (!verification.success) {
        throw badRequest("SIWE signature is invalid");
      }

      const address = siweMessage.address.toLowerCase();
      const nonce = siweMessage.nonce;

      // Verify nonce (if using Supabase)
      if (getProvider() === "supabase") {
        const { data: nonceRow } = await db()
          .from("auth_nonces")
          .select("*")
          .eq("nonce", nonce)
          .eq("address", address)
          .eq("used", false)
          .single();

        if (!nonceRow) {
          throw badRequest("Invalid or expired nonce");
        }

        if (new Date(nonceRow.expires_at) < new Date()) {
          throw badRequest("Nonce has expired");
        }

        // Mark nonce as used
        await db()
          .from("auth_nonces")
          .update({ used: true })
          .eq("nonce", nonce);
      }

      // Create session
      const token = await createSession(address);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      logger.info({ address }, "User authenticated via SIWE");

      res.json({
        token,
        address,
        expiresAt,
      });
    }),
  );

  return router;
}
