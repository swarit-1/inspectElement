import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const pk = process.argv[2] as Hex | undefined;
if (!pk) {
    console.error("usage: deriveAddress <0x-private-key>");
    process.exit(1);
}
console.log(privateKeyToAccount(pk).address);
