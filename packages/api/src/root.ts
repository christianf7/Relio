import { authRouter } from "./router/auth";
import { eventRouter } from "./router/event";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  event: eventRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
