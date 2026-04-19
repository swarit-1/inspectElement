import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";
import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

for (const file of [".env.local", ".env"]) {
    const resolved = path.resolve(process.cwd(), file);
    if (fs.existsSync(resolved)) {
        dotenv.config({ path: resolved, override: false });
    }
}

const PK = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: { enabled: true, runs: 200 },
            viaIR: true,
            evmVersion: "paris",
        },
    },
    paths: {
        sources: "contracts",
        tests: "test",
        cache: "cache",
        artifacts: "artifacts",
    },
    networks: {
        hardhat: { type: "edr-simulated", chainId: 31337 },
        baseSepolia: {
            type: "http",
            url: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
            chainId: 84532,
            accounts: PK ? [PK] : [],
        },
    },
    chainDescriptors: {
        84532: {
            name: "baseSepolia",
            blockExplorers: {
                etherscan: {
                    name: "BaseScan Sepolia",
                    url: "https://sepolia.basescan.org",
                    apiUrl: "https://api-sepolia.basescan.org/api",
                },
            },
        },
    },
};

export default config;
