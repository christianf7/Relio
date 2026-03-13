import { authRouter } from "./router/auth";
import { connectionRouter } from "./router/connection";
import { discoverRouter } from "./router/discover";
import { messageRouter } from "./router/message";
import { eventRouter } from "./router/event";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  connection: connectionRouter,
  discover: discoverRouter,
  message: messageRouter,
  event: eventRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
