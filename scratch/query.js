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

  // Optimize: Pre-configure server config with the official low-latency SUI Mainnet RPC
  memwal.serverConfig = {
    packageId: "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6",
    network: "mainnet",
    suiRpcUrl: "https://fullnode.mainnet.sui.io:443"
  };

  // Override the hardcoded 15-second timeout in the SDK with a 60-second timeout
  memwal.recall = async function (queryOrParams, limitOrOptions, namespace) {
    let query;
    let options;
    if (typeof queryOrParams === "object") {
      const { query: q, ...rest } = queryOrParams;
      query = q;
      options = rest;
    } else {
      query = queryOrParams;
      if (limitOrOptions == null) {
        options = { limit: 10, namespace };
      } else if (typeof limitOrOptions === "number") {
        options = { limit: limitOrOptions, namespace };
      } else {
        options = limitOrOptions;
      }
    }
    const limit = options.topK ?? options.limit ?? 10;
    const resolvedNamespace = options.namespace ?? this.namespace;
    
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 60000); // 60 seconds
    try {
      const result = await this.signedRequest("POST", "/api/recall", {
        query,
        limit,
        namespace: resolvedNamespace,
      }, { signal: ac.signal });
      if (typeof options.maxDistance === "number") {
        const filtered = result.results.filter((memory) => memory.distance < options.maxDistance);
        return {
          ...result,
          results: filtered,
          total: filtered.length,
        };
      }
      return result;
    } finally {
      clearTimeout(tid);
    }
  };

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
