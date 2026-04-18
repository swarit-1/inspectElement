import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";
import * as dotenv from "dotenv";

dotenv.config();

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
        hardhat: { chainId: 31337 },
        baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
            chainId: 84532,
            accounts: PK ? [PK] : [],
        },
    },
    etherscan: {
        apiKey: { baseSepolia: process.env.BASESCAN_API_KEY ?? "" },
        customChains: [
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
        ],
    },
};

export default config;
