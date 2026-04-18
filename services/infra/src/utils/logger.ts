import { pino } from "pino";
import { loadEnv } from "../config/env.js";

const env = (() => {
  try {
    return loadEnv();
  } catch {
    return null;
  }
})();

export const logger = pino({
  level: env?.LOG_LEVEL ?? process.env.LOG_LEVEL ?? "info",
  base: { service: "intentguard-infra" },
  redact: {
    paths: [
      "*.privateKey",
      "*.private_key",
      "TRACE_ACK_PRIVATE_KEY",
      "REVIEWER_PRIVATE_KEY",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});
