import { es } from "./client";
import { EVENTS_INDEX, EVENTS_MAPPING, USERS_INDEX, USERS_MAPPING } from "./indices";

async function ensureIndex(
  indexName: string,
  mappings: typeof USERS_MAPPING | typeof EVENTS_MAPPING,
): Promise<void> {
  if (!es) {
    console.error("[ES] Client not available – check env vars");
    process.exit(1);
  }

  const exists = await es.indices.exists({ index: indexName });
  if (exists) {
    console.log(`[ES] Index "${indexName}" already exists, updating mappings...`);
    await es.indices.putMapping({ index: indexName, ...mappings });
  } else {
    console.log(`[ES] Creating index "${indexName}"...`);
    await es.indices.create({
      index: indexName,
      mappings,
    });
  }
  console.log(`[ES] Index "${indexName}" ready`);
}

async function main() {
  await ensureIndex(USERS_INDEX, USERS_MAPPING);
  await ensureIndex(EVENTS_INDEX, EVENTS_MAPPING);
  console.log("[ES] All indices ready");
  process.exit(0);
}

main().catch((err) => {
  console.error("[ES] Failed to ensure indices:", err);
  process.exit(1);
});
