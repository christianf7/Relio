export { es } from "./client";
export type { Client as EsClient } from "@elastic/elasticsearch";
export {
  EVENTS_INDEX,
  USERS_INDEX,
  type EventDocument,
  type UserDocument,
} from "./indices";
export {
  indexEvent,
  indexUser,
  removeDocument,
  updateEventParticipants,
  updateUserConnections,
  updateUserEvents,
} from "./sync";
