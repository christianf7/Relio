export const USERS_INDEX = "relio_users";
export const EVENTS_INDEX = "relio_events";

export const USERS_MAPPING = {
  properties: {
    id: { type: "keyword" as const },
    name: { type: "text" as const, analyzer: "standard", fields: { keyword: { type: "keyword" as const } } },
    displayName: { type: "text" as const, analyzer: "standard", fields: { keyword: { type: "keyword" as const } } },
    bio: { type: "text" as const, analyzer: "standard" },
    unitCodes: { type: "keyword" as const },
    unitUniversities: { type: "keyword" as const },
    connectionIds: { type: "keyword" as const },
    upcomingEventIds: { type: "keyword" as const },
    organisedEventIds: { type: "keyword" as const },
    createdAt: { type: "date" as const },
  },
};

export const EVENTS_MAPPING = {
  properties: {
    id: { type: "keyword" as const },
    title: { type: "text" as const, analyzer: "standard", fields: { keyword: { type: "keyword" as const } } },
    location: { type: "text" as const, analyzer: "standard", fields: { keyword: { type: "keyword" as const } } },
    content: { type: "text" as const, analyzer: "standard" },
    date: { type: "date" as const },
    bannerUrl: { type: "keyword" as const },
    ticketUrl: { type: "keyword" as const },
    organiserIds: { type: "keyword" as const },
    organiserNames: { type: "text" as const, analyzer: "standard" },
    participantIds: { type: "keyword" as const },
    participantCount: { type: "integer" as const },
  },
};

export interface UserDocument {
  id: string;
  name: string;
  displayName: string | null;
  bio: string | null;
  unitCodes: string[];
  unitUniversities: string[];
  connectionIds: string[];
  upcomingEventIds: string[];
  organisedEventIds: string[];
  createdAt: string;
}

export interface EventDocument {
  id: string;
  title: string;
  location: string;
  content: string | null;
  date: string;
  bannerUrl: string | null;
  ticketUrl: string | null;
  organiserIds: string[];
  organiserNames: string[];
  participantIds: string[];
  participantCount: number;
}
