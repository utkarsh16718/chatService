import { Router } from "express";
import type { ChatService } from "../services/chat.service.js";
import { createChatController } from "../controllers/chat.controller.js";

export function chatRouter(chatService: ChatService): Router {
  const router = Router();
  const controller = createChatController(chatService);

  router.post("/create", controller.createOrGetChat);
  router.post("/:chatId/message/send", controller.sendMessage);
  router.get("/:chatId/messages", controller.getMessages);
  router.post("/:chatId/message/:messageId/read", controller.markMessageRead);
  router.post("/:chatId/lastseen", controller.updateLastSeen);

  return router;
}
