import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Pool } from "pg";
import { createApp } from "./app.js";
import { ChatService } from "./services/chat.service.js";
import { config } from "./config/env.js";

const pool = new Pool({ connectionString: config.DATABASE_URL });
const firebaseApp = initializeApp({
  credential: applicationDefault(),
  ...(config.FIREBASE_PROJECT_ID
    ? { projectId: config.FIREBASE_PROJECT_ID }
    : {}),
});
const chatService = new ChatService(pool, getFirestore(firebaseApp));
const server = createApp(chatService).listen(config.PORT, () => {
  console.log(`Chat API listening on port ${config.PORT}`);
});
