import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { db, getProvider } from "../store/db.js";
import { logger } from "../utils/logger.js";

/**
 * Authentication middleware for IntentGuard infra API.
 *
 * Supports two modes:
 *   1. Session token (Bearer) — for frontend/user requests after SIWE login
 *   2. API key (X-API-Key header) — for partner service-to-service calls
 *
 * Augments `req` with `req.auth` containing the authenticated identity.
 */

export type UserRole = "owner" | "challenger" | "reviewer" | "partner_admin";

export interface AuthInfo {
  type: "user" | "partner" | "service";
  address?: string;    // wallet address for user auth
  partnerId?: string;  // partner UUID for API key auth
  scopes: string[];    // e.g. ["read", "write", "admin"]
  roles: UserRole[];   // e.g. ["owner", "reviewer"]
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

/**
 * Optional auth — sets req.auth if valid credentials present, passes through otherwise.
 */
export function optionalAuth() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await tryAuthenticate(req);
    } catch {
      // ignore auth errors in optional mode
    }
    next();
  };
}

/**
 * Required auth — rejects with 401 if no valid credentials.
 */
export function requireAuth(...allowedTypes: Array<"user" | "partner" | "service">) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await tryAuthenticate(req);
    } catch {
      // fall through
    }

    if (!req.auth) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(req.auth.type)) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permissions" });
      return;
    }

    next();
  };
}

/**
 * Require specific scopes on the authenticated identity.
 */
export function requireScope(...scopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const missing = scopes.filter((s) => !req.auth!.scopes.includes(s));
    if (missing.length > 0) {
      res.status(403).json({ error: "forbidden", message: `Missing scopes: ${missing.join(", ")}` });
      return;
    }
    next();
  };
}

/**
 * Require specific roles on the authenticated identity.
 * At least one of the specified roles must be present.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }
    const hasRole = roles.some((r) => req.auth!.roles.includes(r));
    if (!hasRole) {
      res.status(403).json({
        error: "forbidden",
        message: `Requires one of roles: ${roles.join(", ")}`,
      });
      return;
    }
    next();
  };
}

async function tryAuthenticate(req: Request): Promise<void> {
  // Already authenticated (e.g., by a previous middleware)
  if (req.auth) return;

  // Try Bearer token (session)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const auth = await verifySessionToken(token);
    if (auth) {
      req.auth = auth;
      return;
    }
  }

  // Try API key
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) {
    const auth = await verifyApiKey(apiKey);
    if (auth) {
      req.auth = auth;
      return;
    }
  }
}

async function verifySessionToken(token: string): Promise<AuthInfo | null> {
  if (getProvider() !== "supabase") {
    // SQLite mode: no session management
    return null;
  }

  const tokenHash = hashToken(token);
  const { data } = await db()
    .from("user_sessions")
    .select("address, expires_at")
    .eq("token_hash", tokenHash)
    .single();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  // Derive roles from session data — all authenticated users are owners/challengers
  const roles: UserRole[] = ["owner", "challenger"];
  // Check if this address is the reviewer signer
  const reviewerKey = process.env.REVIEWER_PRIVATE_KEY;
  if (reviewerKey) {
    // In a real system we'd check if the address matches the reviewer key's address
    // For now, users can be granted reviewer role via user_sessions.roles column
  }

  return {
    type: "user",
    address: data.address.toLowerCase(),
    scopes: ["read", "write"],
    roles,
  };
}

async function verifyApiKey(key: string): Promise<AuthInfo | null> {
  if (getProvider() !== "supabase") {
    return null;
  }

  const keyHash = hashToken(key);
  const { data } = await db()
    .from("partners")
    .select("id, name, scopes, active")
    .eq("api_key_hash", keyHash)
    .single();

  if (!data || !data.active) return null;

  return {
    type: "partner",
    partnerId: data.id,
    scopes: data.scopes as string[],
    roles: ["partner_admin"],
  };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new session token for a wallet address.
 * Returns the raw token (to send to the client) — only the hash is stored.
 */
export async function createSession(address: string, ttlHours = 24): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  await db()
    .from("user_sessions")
    .insert({
      address: address.toLowerCase(),
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  logger.info({ address }, "Session created");
  return token;
}

/**
 * Create a new API key for a partner.
 * Returns the raw key (show once to the partner) — only the hash is stored.
 */
export async function createPartnerApiKey(
  name: string,
  scopes: string[] = ["read"],
): Promise<{ id: string; key: string }> {
  const key = `ig_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = hashToken(key);

  const { data } = await db()
    .from("partners")
    .insert({
      name,
      api_key_hash: keyHash,
      scopes,
    })
    .select("id")
    .single();

  logger.info({ name, partnerId: data?.id }, "Partner API key created");
  return { id: data?.id ?? "", key };
}
