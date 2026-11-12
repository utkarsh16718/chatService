import { Router } from "express";
import type { ChatService } from "../services/chat.service.js";
import { createUserController } from "../controllers/user.controller.js";

export function userRouter(chatService: ChatService): Router {
  const router = Router();
  const controller = createUserController(chatService);

  router.get("/:userId/chats", controller.listUserChats);

  return router;
}
