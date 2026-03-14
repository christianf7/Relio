"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENTS_MAPPING = exports.USERS_MAPPING = exports.EVENTS_INDEX = exports.USERS_INDEX = void 0;
exports.USERS_INDEX = "relio_users";
exports.EVENTS_INDEX = "relio_events";
exports.USERS_MAPPING = {
    properties: {
        id: { type: "keyword" },
        name: { type: "text", analyzer: "standard", fields: { keyword: { type: "keyword" } } },
        displayName: { type: "text", analyzer: "standard", fields: { keyword: { type: "keyword" } } },
        bio: { type: "text", analyzer: "standard" },
        unitCodes: { type: "keyword" },
        unitUniversities: { type: "keyword" },
        connectionIds: { type: "keyword" },
        upcomingEventIds: { type: "keyword" },
        organisedEventIds: { type: "keyword" },
        createdAt: { type: "date" },
    },
};
exports.EVENTS_MAPPING = {
    properties: {
        id: { type: "keyword" },
        title: { type: "text", analyzer: "standard", fields: { keyword: { type: "keyword" } } },
        location: { type: "text", analyzer: "standard", fields: { keyword: { type: "keyword" } } },
        content: { type: "text", analyzer: "standard" },
        date: { type: "date" },
        bannerUrl: { type: "keyword" },
        ticketUrl: { type: "keyword" },
        organiserIds: { type: "keyword" },
        organiserNames: { type: "text", analyzer: "standard" },
        participantIds: { type: "keyword" },
        participantCount: { type: "integer" },
    },
};
