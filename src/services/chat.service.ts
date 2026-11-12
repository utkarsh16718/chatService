import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  FieldPath,
  FieldValue,
  type Firestore,
  Timestamp,
} from "firebase-admin/firestore";
import { HttpError } from "../errors/http-error.js";

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  readReceipts: Record<string, string>;
}

export type ChatSummary = {
  chatId: string;
  memberIds: [string, string];
  createdAt: string;
}

type MessageData = {
  senderId: string;
  text: string;
  createdAt: Timestamp;
  readReceipts?: Record<string, Timestamp>;
}

export class ChatService {
  constructor(
    private readonly pool: Pool,
    private readonly firestore: Firestore,
  ) {}

  async createOrGetChat(userAId: string, userBId: string): Promise<{ chatId: string }> {
    const userIds = [userAId.toLowerCase(), userBId.toLowerCase()];
    if (userIds[0] === userIds[1]) {
      throw new HttpError(400, "A chat requires two distinct users");
    }

    userIds.sort();
    const existingUsers = await this.pool.query<{ id: string }>(
      "SELECT id FROM users WHERE id = ANY($1::uuid[])",
      [userIds],
    );
    if (existingUsers.rowCount !== 2) {
      throw new HttpError(404, "One or both users were not found");
    }

    const id = randomUUID();
    const inserted = await this.pool.query<{ id: string }>(
      `INSERT INTO chats (id, member_a_id, member_b_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (member_a_id, member_b_id) DO NOTHING
       RETURNING id`,
      [id, userIds[0], userIds[1]],
    );
    if (inserted.rows[0]) {
      return { chatId: inserted.rows[0].id };
    }

    const existingChat = await this.pool.query<{ id: string }>(
      "SELECT id FROM chats WHERE member_a_id = $1 AND member_b_id = $2",
      userIds,
    );
    const chat = existingChat.rows[0];
    if (!chat) {
      throw new Error("Chat conflict occurred but the existing chat could not be loaded");
    }
    return { chatId: chat.id };
  }

  async sendMessage(chatId: string, senderId: string, text: string): Promise<ChatMessage> {
    await this.requireMember(chatId, senderId);

    const ref = this.messagesCollection(chatId).doc();
    await ref.create({
      senderId,
      text,
      createdAt: FieldValue.serverTimestamp(),
      readReceipts: {},
    });
    const snapshot = await ref.get();
    const data = snapshot.data();
    if (!data) {
      throw new Error("The newly created message could not be loaded");
    }
    return this.toMessage(snapshot.id, data as MessageData);
  }

  async getMessages(chatId: string, limit: number): Promise<ChatMessage[]> {
    await this.requireChat(chatId);
    const snapshot = await this.messagesCollection(chatId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs
      .reverse()
      .map((document) => this.toMessage(document.id, document.data() as MessageData));
  }

  async markMessageRead(chatId: string, messageId: string, userId: string): Promise<void> {
    await this.requireMember(chatId, userId);
    const messageRef = this.messagesCollection(chatId).doc(messageId);
    await this.firestore.runTransaction(async (transaction) => {
      const message = await transaction.get(messageRef);
      if (!message.exists) {
        throw new HttpError(404, "Message not found");
      }
      transaction.update(
        messageRef,
        new FieldPath("readReceipts", userId),
        FieldValue.serverTimestamp(),
      );
    });
  }

  async updateLastSeen(chatId: string, userId: string, messageId: string): Promise<void> {
    await this.requireMember(chatId, userId);
    const messageRef = this.messagesCollection(chatId).doc(messageId);
    const lastSeenRef = this.lastSeenCollection(chatId).doc(userId);

    await this.firestore.runTransaction(async (transaction) => {
      const [message, lastSeen] = await Promise.all([
        transaction.get(messageRef),
        transaction.get(lastSeenRef),
      ]);
      if (!message.exists) {
        throw new HttpError(404, "Message not found");
      }

      const messageCreatedAt = message.get("createdAt") as Timestamp;
      if (lastSeen.exists) {
        const previousMessageId = lastSeen.get("messageId") as string;
        const previousMessage = await transaction.get(
          this.messagesCollection(chatId).doc(previousMessageId),
        );
        if (previousMessage.exists) {
          const previousCreatedAt = previousMessage.get("createdAt") as Timestamp;
          if (previousCreatedAt.toMillis() > messageCreatedAt.toMillis()) {
            return;
          }
        }
      }

      transaction.set(lastSeenRef, {
        messageId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  async listUserChats(userId: string): Promise<ChatSummary[]> {
    const result = await this.pool.query<{
      id: string;
      member_a_id: string;
      member_b_id: string;
      created_at: Date;
    }>(
      `SELECT id, member_a_id, member_b_id, created_at
       FROM chats
       WHERE member_a_id = $1 OR member_b_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      chatId: row.id,
      memberIds: [row.member_a_id, row.member_b_id],
      createdAt: row.created_at.toISOString(),
    }));
  }

  private async requireChat(chatId: string): Promise<void> {
    const result = await this.pool.query("SELECT 1 FROM chats WHERE id = $1", [chatId]);
    if (result.rowCount === 0) {
      throw new HttpError(404, "Chat not found");
    }
  }

  private async requireMember(chatId: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM chats
       WHERE id = $1 AND (member_a_id = $2 OR member_b_id = $2)`,
      [chatId, userId],
    );
    if (result.rowCount === 0) {
      throw new HttpError(404, "Chat not found");
    }
  }

  private messagesCollection(chatId: string) {
    return this.firestore.collection("chats").doc(chatId).collection("messages");
  }

  private lastSeenCollection(chatId: string) {
    return this.firestore.collection("chats").doc(chatId).collection("lastSeen");
  }

  private toMessage(id: string, data: MessageData): ChatMessage {
    const readReceipts: Record<string, string> = {};
    for (const [userId, readAt] of Object.entries(data.readReceipts ?? {})) {
      if (readAt instanceof Timestamp) {
        readReceipts[userId] = readAt.toDate().toISOString();
      }
    }
    return {
      id,
      senderId: data.senderId,
      text: data.text,
      createdAt: data.createdAt.toDate().toISOString(),
      readReceipts,
    };
  }
}
