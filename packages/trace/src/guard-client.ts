/**
 * Guarded execution client — consumes Dev 1's IF-05.
 *
 * Provides preflight() and execute() wrappers around
 * GuardedExecutor.preflightCheck and GuardedExecutor.executeWithGuard.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Chain,
  type Account,
  BaseError,
  ContractFunctionRevertedError,
} from "viem";
import { baseSepolia } from "viem/chains";
import { GuardedExecutorABI } from "./abi.js";
import { GuardDecision, type ExecutionRequest } from "./types.js";
import { loadDeploymentConfig } from "./config.js";

export interface PreflightResult {
  readonly decision: GuardDecision;
  readonly reasonCode: Hex;
  readonly reasonString: string;
}

export class GuardRejectedError extends Error {
  constructor(
    public readonly reasonCode: Hex,
    public readonly reasonString: string
  ) {
    super(`Guard rejected execution: ${reasonString} (${reasonCode})`);
    this.name = "GuardRejectedError";
  }
}

/**
 * Known reason code mappings for human-readable output.
 */
const REASON_CODE_NAMES: Record<string, string> = {
  // These will be populated from Dev 1's actual keccak256 outputs
  // For now, we match on known patterns
};

function decodeReasonCode(code: Hex): string {
  return REASON_CODE_NAMES[code] ?? `UNKNOWN(${code.slice(0, 18)}...)`;
}

export interface GuardClientOptions {
  readonly rpcUrl?: string;
  readonly chain?: Chain;
}

/**
 * Create a guarded execution client.
 *
 * @param account - The wallet account (delegate key) to send transactions from
 * @param options - Optional RPC URL and chain overrides
 */
export interface GuardClient {
  preflight(req: ExecutionRequest): Promise<PreflightResult>;
  execute(req: ExecutionRequest): Promise<Hex>;
}

export function createGuardClient(
  account: Account,
  options: GuardClientOptions = {}
): GuardClient {
  const config = loadDeploymentConfig();
  const chain = options.chain ?? baseSepolia;
  const transport = http(options.rpcUrl);

  const publicClient = createPublicClient({
    chain,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  const executorAddress = config.contracts.GuardedExecutor;

  /**
   * Run preflight check — view call, no gas, no revert.
   * Returns the guard's decision and reason code.
   */
  async function preflight(
    req: ExecutionRequest
  ): Promise<PreflightResult> {
    const [decision, reasonCode] = (await publicClient.readContract({
      address: executorAddress,
      abi: GuardedExecutorABI,
      functionName: "preflightCheck",
      args: [
        {
          owner: req.owner,
          agentId: req.agentId,
          target: req.target,
          token: req.token,
          amount: req.amount,
          data: req.data,
          traceURI: req.traceURI,
          traceAck: {
            contextDigest: req.traceAck.contextDigest,
            uriHash: req.traceAck.uriHash,
            expiresAt: BigInt(req.traceAck.expiresAt),
            signature: req.traceAck.signature,
          },
        },
      ],
    })) as [number, Hex];

    return {
      decision: decision as GuardDecision,
      reasonCode,
      reasonString: decodeReasonCode(reasonCode),
    };
  }

  /**
   * Execute a guarded payment.
   * Calls executeWithGuard — reverts with GuardRejected on failure.
   *
   * @returns receiptId on success
   * @throws GuardRejectedError if the guard rejects
   */
  async function execute(req: ExecutionRequest): Promise<Hex> {
    try {
      const { request } = await publicClient.simulateContract({
        account: walletClient.account,
        address: executorAddress,
        abi: GuardedExecutorABI,
        functionName: "executeWithGuard",
        args: [
          {
            owner: req.owner,
            agentId: req.agentId,
            target: req.target,
            token: req.token,
            amount: req.amount,
            data: req.data,
            traceURI: req.traceURI,
            traceAck: {
              contextDigest: req.traceAck.contextDigest,
              uriHash: req.traceAck.uriHash,
              expiresAt: BigInt(req.traceAck.expiresAt),
              signature: req.traceAck.signature,
            },
          },
        ],
      });

      const txHash = await walletClient.writeContract(request);

      // Wait for receipt to get the receiptId from logs
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status === "reverted") {
        throw new Error(`Transaction reverted: ${txHash}`);
      }

      // Return the txHash — the receiptId is in the emitted event logs
      // which Dev 3's indexer will pick up
      return txHash;
    } catch (err) {
      // Decode GuardRejected custom error
      if (err instanceof BaseError) {
        const revertError = err.walk(
          (e) => e instanceof ContractFunctionRevertedError
        );
        if (revertError instanceof ContractFunctionRevertedError) {
          const errorData = revertError.data;
          if (errorData?.errorName === "GuardRejected") {
            const reasonCode = (errorData.args as [Hex])[0];
            throw new GuardRejectedError(
              reasonCode,
              decodeReasonCode(reasonCode)
            );
          }
        }
      }
      throw err;
    }
  }

  return { preflight, execute };
}
