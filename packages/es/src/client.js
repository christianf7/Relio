"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.es = void 0;
var elasticsearch_1 = require("@elastic/elasticsearch");
var createEsClient = function () {
    var node = process.env.ELASTICSEARCH_URL;
    var apiKey = process.env.ELASTICSEARCH_API_KEY;
    if (!node || !apiKey) {
        console.warn("[ES] ELASTICSEARCH_URL or ELASTICSEARCH_API_KEY not set – ES client disabled");
        return null;
    }
    return new elasticsearch_1.Client({
        node: node,
        auth: { apiKey: apiKey },
        tls: { rejectUnauthorized: true },
    });
};
var globalForEs = globalThis;
exports.es = (_a = globalForEs.esClient) !== null && _a !== void 0 ? _a : createEsClient();
if (process.env.NODE_ENV !== "production")
    globalForEs.esClient = exports.es;
