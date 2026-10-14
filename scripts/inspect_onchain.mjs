import { JsonRpcProvider, Contract, isAddress } from "ethers";

const rpc = process.env.NODE_RPC;
const address = process.argv[2];
if (!rpc || !address || !isAddress(address)) {
  console.error("Usage: NODE_RPC=https://... node scripts/inspect_onchain.mjs <address>");
  process.exit(2);
}

const provider = new JsonRpcProvider(rpc);
const code = await provider.getCode(address);
const result = { address, bytecodeBytes: Math.max(0, (code.length - 2) / 2), calls: {} };
const candidates = [
  ["owner", "function owner() view returns (address)"],
  ["timelock", "function timelock() view returns (address)"],
  ["admin", "function admin() view returns (address)"],
  ["implementation", "function implementation() view returns (address)"]
];
for (const [name, signature] of candidates) {
  try {
    const contract = new Contract(address, [signature], provider);
    result.calls[name] = await contract[name]();
  } catch {
    result.calls[name] = null;
  }
}
console.log(JSON.stringify(result, null, 2));
