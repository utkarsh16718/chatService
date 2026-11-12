import express from "express";
import type { ChatService } from "./services/chat.service.js";
import { errorHandler } from "./middleware/error-handler.js";
import { chatRouter } from "./routes/chat.routes.js";
import { userRouter } from "./routes/user.routes.js";

export function createApp(chatService: ChatService) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/chat", chatRouter(chatService));
  app.use("/user", userRouter(chatService));
  app.use(errorHandler);
  return app;
}
