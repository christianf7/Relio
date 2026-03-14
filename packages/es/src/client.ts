import { Client } from "@elastic/elasticsearch";

const createEsClient = () => {
  const node = process.env.ELASTICSEARCH_URL;
  const apiKey = process.env.ELASTICSEARCH_API_KEY;

  if (!node || !apiKey) {
    console.warn(
      "[ES] ELASTICSEARCH_URL or ELASTICSEARCH_API_KEY not set – ES client disabled",
    );
    return null;
  }

  return new Client({
    node,
    auth: { apiKey },
    tls: { rejectUnauthorized: true },
  });
};

const globalForEs = globalThis as unknown as {
  esClient: Client | null | undefined;
};

export const es = globalForEs.esClient ?? createEsClient();

if (process.env.NODE_ENV !== "production") globalForEs.esClient = es;
