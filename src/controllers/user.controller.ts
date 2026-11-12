import type { Request, Response } from "express";
import { z } from "zod";
import type { ChatService } from "../services/chat.service.js";

const uuidSchema = z.string().uuid();

export function createUserController(chatService: ChatService) {
  const listUserChats = async (request: Request, response: Response) => {
    const userId = uuidSchema.parse(request.params.userId);
    response.json(await chatService.listUserChats(userId));
  };

  return { listUserChats };
}
