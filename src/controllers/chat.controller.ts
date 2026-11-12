import type { Request, Response } from "express";
import { z } from "zod";
import type { ChatService } from "../services/chat.service.js";

const uuidSchema = z.string().uuid();
const messageIdSchema = z.string().min(1).max(1500).regex(/^[^/]+$/);
const createChatSchema = z.object({
  userAId: uuidSchema,
  userBId: uuidSchema,
}).strict();
const sendMessageSchema = z.object({
  senderId: uuidSchema,
  text: z.string().trim().min(1).max(10_000),
}).strict();
const readMessageSchema = z.object({ userId: uuidSchema }).strict();
const lastSeenSchema = z.object({
  userId: uuidSchema,
  messageId: messageIdSchema,
}).strict();
const messageLimitSchema = z.coerce.number().int().min(1).max(100).default(50);

export function createChatController(chatService: ChatService) {
  const createOrGetChat = async (request: Request, response: Response) => {
    const input = createChatSchema.parse(request.body);
    const chat = await chatService.createOrGetChat(input.userAId, input.userBId);
    response.status(200).json(chat);
  };

  const sendMessage = async (request: Request, response: Response) => {
    const chatId = uuidSchema.parse(request.params.chatId);
    const input = sendMessageSchema.parse(request.body);
    const message = await chatService.sendMessage(chatId, input.senderId, input.text);
    response.status(201).json(message);
  };

  const getMessages = async (request: Request, response: Response) => {
    const chatId = uuidSchema.parse(request.params.chatId);
    const limit = messageLimitSchema.parse(request.query.limit);
    response.json(await chatService.getMessages(chatId, limit));
  };

  const markMessageRead = async (request: Request, response: Response) => {
    const chatId = uuidSchema.parse(request.params.chatId);
    const messageId = messageIdSchema.parse(request.params.messageId);
    const input = readMessageSchema.parse(request.body);
    await chatService.markMessageRead(chatId, messageId, input.userId);
    response.status(204).end();
  };

  const updateLastSeen = async (request: Request, response: Response) => {
    const chatId = uuidSchema.parse(request.params.chatId);
    const input = lastSeenSchema.parse(request.body);
    await chatService.updateLastSeen(chatId, input.userId, input.messageId);
    response.status(204).end();
  };

  return {
    createOrGetChat,
    sendMessage,
    getMessages,
    markMessageRead,
    updateLastSeen,
  };
}
