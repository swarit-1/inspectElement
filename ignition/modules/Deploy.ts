import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// ---------------------------------------------------------------------------
// IntentGuard deploy module.
// ---------------------------------------------------------------------------
// Required parameters (provide via --parameters or env-wired JSON):
//   - usdc:            address   — Base Sepolia USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e)
//                                  OR leave unset to deploy MockUSDC (hardhat/local only).
//   - traceAckSigner:  address   — Dev 3 infra signer public key.
//   - reviewerSigner:  address   — reviewer signer pubkey (may be zero; rotate later).
//   - initialOwner:    address   — admin for Ownable2Step contracts (defaults to deployer).
// ---------------------------------------------------------------------------
export default buildModule("IntentGuardDeploy", (m) => {
    const deployer = m.getAccount(0);

    const usdcParam = m.getParameter<string>("usdc", "");
    const traceAckSigner = m.getParameter<string>("traceAckSigner", deployer);
    const reviewerSigner = m.getParameter<string>("reviewerSigner", deployer);
    const initialOwner = m.getParameter<string>("initialOwner", deployer);

    // If no USDC address was provided, deploy MockUSDC. Only safe for local/hardhat.
    const usdc =
        usdcParam === ""
            ? m.contract("MockUSDC", [], { id: "MockUSDC" })
            : m.contractAt("MockUSDC", usdcParam, { id: "ExternalUSDC" });

    const intentRegistry = m.contract("IntentRegistry", [usdc]);
    const stakeVault = m.contract("StakeVault", [usdc]);

    const guardedExecutor = m.contract("GuardedExecutor", [
        usdc,
        intentRegistry,
        traceAckSigner,
        initialOwner,
    ]);

    const agentRegistry = m.contract("AgentRegistry", [usdc, stakeVault]);

    const challengeArbiter = m.contract("ChallengeArbiter", [
        usdc,
        stakeVault,
        agentRegistry,
        intentRegistry,
        guardedExecutor,
        reviewerSigner,
        initialOwner,
    ]);

    // One-shot wiring: StakeVault → (AgentRegistry, ChallengeArbiter).
    m.call(stakeVault, "setWiring", [agentRegistry, challengeArbiter], {
        from: deployer,
        after: [agentRegistry, challengeArbiter],
    });

    return { usdc, intentRegistry, stakeVault, guardedExecutor, agentRegistry, challengeArbiter };
});
