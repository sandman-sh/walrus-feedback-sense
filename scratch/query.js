import { webcrypto } from "node:crypto";

if (typeof crypto === "undefined") {
  globalThis.crypto = webcrypto;
} else if (typeof crypto.subtle === "undefined") {
  Object.defineProperty(crypto, "subtle", {
    value: webcrypto.subtle,
    writable: true,
    configurable: true,
  });
}

import { MemWal } from "@mysten-incubation/memwal";
import * as dotenv from "dotenv";

dotenv.config();

const accountId = process.env.MEMWAL_ACCOUNT_ID;
const delegateKey = process.env.MEMWAL_DELEGATE_KEY;
const namespace = "feedback-form-agent";

async function main() {
  const query = process.argv.slice(2).join(" ");
  if (!query) {
    console.error("Please provide a search query! Example: node scratch/query.js wallet connection chrome");
    process.exit(1);
  }

  const memwal = MemWal.create({
    key: delegateKey,
    accountId: accountId,
    serverUrl: "https://relayer.memory.walrus.xyz",
    namespace: namespace,
  });

  console.log(`🔍 Querying Walrus Memory for: "${query}"...`);
  try {
    const recallResult = await memwal.recall({
      query: query,
      limit: 3,
    });
    
    console.log(`\nFound ${recallResult.results.length} matches:`);
    recallResult.results.forEach((match, idx) => {
      console.log(`  ${idx + 1}. [Score Distance: ${match.distance.toFixed(4)}] ${match.text}`);
    });
  } catch (err) {
    console.error("❌ Semantic search query failed:", err.message || err);
  }
}

main();
