import { authRouter } from "./router/auth";
import { connectionRouter } from "./router/connection";
import { messageRouter } from "./router/message";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  connection: connectionRouter,
  message: messageRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
