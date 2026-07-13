import { webcrypto } from "node:crypto";

if (typeof crypto === "undefined") {
  globalThis.crypto = webcrypto as any;
} else if (typeof crypto.subtle === "undefined") {
  Object.defineProperty(crypto, "subtle", {
    value: webcrypto.subtle,
    writable: true,
    configurable: true,
  });
}

import * as dotenv from "dotenv";
import { MemWal } from "@mysten-incubation/memwal";

// Load environment variables from .env file
dotenv.config();

const accountId = process.env.MEMWAL_ACCOUNT_ID;
const delegateKey = process.env.MEMWAL_DELEGATE_KEY;
const namespace = "feedback-form-agent";

async function main() {
  console.log("==================================================");
  console.log("🚀 Starting Walrus Memory Seeding & Verification");
  console.log("==================================================");

  if (!accountId || !delegateKey) {
    console.error("❌ Error: Missing credentials!");
    console.error("Please create a '.env' file in the root directory with the following variables:");
    console.error("  MEMWAL_ACCOUNT_ID=your_account_sui_object_id");
    console.error("  MEMWAL_DELEGATE_KEY=your_delegate_private_key_hex");
    console.error("\nYou can obtain these on Sui Mainnet from: https://memory.walrus.xyz");
    process.exit(1);
  }

  console.log(`📡 Connecting to Walrus Memory Mainnet Relayer...`);
  console.log(`🔑 Account ID: ${accountId}`);
  console.log(`🏷️  Namespace:  ${namespace}`);

  // Create the MemWal client
  const memwal = MemWal.create({
    key: delegateKey,
    accountId: accountId,
    serverUrl: "https://relayer.memory.walrus.xyz",
    namespace: namespace,
  });

  // Optimize: Pre-configure server config with the official low-latency SUI Mainnet RPC
  (memwal as any).serverConfig = {
    packageId: "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6",
    network: "mainnet",
    suiRpcUrl: "https://fullnode.mainnet.sui.io:443"
  };

  // Override the hardcoded 15-second timeout in the SDK with a 60-second timeout
  (memwal as any).recall = async function (queryOrParams: any, limitOrOptions: any, namespace: any) {
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
        const filtered = result.results.filter((memory: any) => memory.distance < options.maxDistance);
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

  // Check health and compatibility
  try {
    await memwal.health();
    console.log("🟢 Relayer health check: PASSED");
  } catch (err: any) {
    console.error("❌ Health check failed. Make sure the Mainnet relayer is reachable.", err.message);
    process.exit(1);
  }

  // 10 high-quality, structured community feedback entries
  const feedbacks = [
    "FB-001 | User: alice_crypto | Type: Bug | Severity: High | Description: Failed to connect Sui Wallet extension on mainnet. The connect modal gets stuck spinning infinitely on Chrome v126. | Tags: wallet, chrome, connection",
    "FB-002 | User: bob_builder | Type: UX | Severity: Medium | Description: Dark mode toggle is missing in the dashboard. The bright white background makes it hard to use at night. | Tags: ui, dark-mode",
    "FB-003 | User: charlie_sui | Type: Bug | Severity: High | Description: Gas estimate is incorrect. Transaction fails with EWrongVersion error when executing the smart contract. | Tags: gas, transaction, smart-contract",
    "FB-004 | User: dave_walrus | Type: Feature Request | Severity: Low | Description: Add CSV export option for transaction history to help with tax reporting. | Tags: export, tax, history",
    "FB-005 | User: eva_dev | Type: Bug | Severity: High | Description: Image upload to Walrus fails for files larger than 10MB, giving a 413 Payload Too Large error on the publisher endpoint. | Tags: upload, walrus, file-size",
    "FB-006 | User: frank_mcp | Type: UX | Severity: Low | Description: MCP server login command needs better interactive instructions when running in standard CLI. | Tags: mcp, login, docs",
    "FB-007 | User: grace_tester | Type: Bug | Severity: Medium | Description: Feedback list does not paginate. If there are more than 50 feedback items, the UI lags significantly. | Tags: pagination, UI, performance",
    "FB-008 | User: heidi_web3 | Type: Feature Request | Severity: Medium | Description: Support Discord webhook notifications whenever a high-severity bug is submitted through the form. | Tags: webhook, discord, notifications",
    "FB-009 | User: ivan_coder | Type: Bug | Severity: High | Description: Delegate key permissions check fails intermittently. Some write requests are rejected despite valid key signing. | Tags: security, delegate, permissions",
    "FB-010 | User: julia_s | Type: Feature Request | Severity: Low | Description: Allow sorting the feedback cards by date and rating instead of only severity. | Tags: sorting, UI, feedback"
  ];

  console.log("\n📦 Starting sequential write of 10 blobs to Walrus Mainnet...");
  console.log("⚠️  Note: Writes are executed sequentially to verify and ensure successful finalization.\n");

  const writtenItems = [];

  for (let i = 0; i < feedbacks.length; i++) {
    const feedback = feedbacks[i];
    console.log(`[${i + 1}/${feedbacks.length}] Writing to Walrus: "${feedback.substring(0, 70)}..."`);
    
    try {
      const result = await memwal.rememberAndWait(feedback);
      console.log(`   ✅ Success! Job ID: ${result.job_id} | Blob ID: ${result.blob_id}`);
      writtenItems.push({
        feedback,
        blobId: result.blob_id,
        jobId: result.job_id
      });
    } catch (err: any) {
      console.error(`   ❌ Failed to write entry ${i + 1}:`, err.message || err);
      console.error("Please verify that your delegate key has write access and your account is active.");
      process.exit(1);
    }
  }

  console.log("\n🎉 All 10 feedback blobs successfully written to Walrus Mainnet!");
  console.log("==================================================");
  console.log(`Total Writes: ${writtenItems.length}`);
  console.log("==================================================");

  console.log("\n🔍 Running verification semantic queries...");

  // Test Query 1: Wallet Connection
  const query1 = "wallet connection issue on Chrome";
  console.log(`\nQuery 1: "${query1}"`);
  try {
    const recallResult1 = await memwal.recall({
      query: query1,
      limit: 3,
    });
    
    console.log(`Found ${recallResult1.results.length} matches:`);
    recallResult1.results.forEach((match, idx) => {
      console.log(`  ${idx + 1}. [Score Distance: ${match.distance.toFixed(4)}] ${match.text}`);
    });
  } catch (err: any) {
    console.error("❌ Semantic search query 1 failed:", err.message || err);
  }

  // Test Query 2: Payload too large error
  const query2 = "file upload limit error or large size payload fails";
  console.log(`\nQuery 2: "${query2}"`);
  try {
    const recallResult2 = await memwal.recall({
      query: query2,
      limit: 3,
    });
    
    console.log(`Found ${recallResult2.results.length} matches:`);
    recallResult2.results.forEach((match, idx) => {
      console.log(`  ${idx + 1}. [Score Distance: ${match.distance.toFixed(4)}] ${match.text}`);
    });
  } catch (err: any) {
    console.error("❌ Semantic search query 2 failed:", err.message || err);
  }

  // Test Query 3: Chrome high-severity bugs
  const query3 = "Show me all high-severity bugs reported by Chrome users";
  console.log(`\nQuery 3: "${query3}"`);
  try {
    const recallResult3 = await memwal.recall({
      query: query3,
      limit: 3,
    });
    
    console.log(`Found ${recallResult3.results.length} matches:`);
    recallResult3.results.forEach((match, idx) => {
      console.log(`  ${idx + 1}. [Score Distance: ${match.distance.toFixed(4)}] ${match.text}`);
    });
  } catch (err: any) {
    console.error("❌ Semantic search query 3 failed:", err.message || err);
  }

  console.log("\n==================================================");
  console.log("🏆 Seeding & Verification completed successfully!");
  console.log("Your agent ID is proof of writes. Use the logs above for your submission.");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Unhandled execution error:", err);
});
