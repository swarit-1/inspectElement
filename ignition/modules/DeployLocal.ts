import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Local-only deploy module: always deploys MockUSDC and wires everything up.
// Use this against hardhat/localhost. For Base Sepolia, use Deploy.ts with a real USDC address.
export default buildModule("IntentGuardDeployLocal", (m) => {
    const deployer = m.getAccount(0);

    const traceAckSigner = m.getParameter<string>("traceAckSigner", deployer);
    const reviewerSigner = m.getParameter<string>("reviewerSigner", deployer);
    const initialOwner = m.getParameter<string>("initialOwner", deployer);

    const usdc = m.contract("MockUSDC", [], { id: "MockUSDC" });

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

    m.call(stakeVault, "setWiring", [agentRegistry, challengeArbiter], {
        from: deployer,
        after: [agentRegistry, challengeArbiter],
    });

    return { usdc, intentRegistry, stakeVault, guardedExecutor, agentRegistry, challengeArbiter };
});
