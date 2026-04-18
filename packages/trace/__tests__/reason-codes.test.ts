import { describe, it, expect } from "vitest";
import { keccak256, stringToBytes } from "viem";
import {
  REASON_CODE_HEX,
  decodeReasonLabel,
} from "../src/reason-codes.js";

describe("reason codes", () => {
  it("matches keccak256(bytes(label)) for known labels", () => {
    expect(REASON_CODE_HEX.COUNTERPARTY_NOT_ALLOWED).toBe(
      keccak256(stringToBytes("COUNTERPARTY_NOT_ALLOWED"))
    );
  });

  it("decodeReasonLabel returns the frozen name for known hashes", () => {
    expect(
      decodeReasonLabel(REASON_CODE_HEX.COUNTERPARTY_NOT_ALLOWED)
    ).toBe("COUNTERPARTY_NOT_ALLOWED");
  });
});
