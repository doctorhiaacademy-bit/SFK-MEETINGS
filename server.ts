import express from "express";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId: string, userId: string, userName: string) => {
      socket.join(roomId);
      console.log(`User ${userName} (${userId}) joined room ${roomId}`);
      
      // Broadcast to others in the room that a new user joined
      socket.to(roomId).emit("user-connected", userId, userName);

      socket.on("disconnect", () => {
        console.log(`User ${userName} (${userId}) disconnected`);
        socket.to(roomId).emit("user-disconnected", userId);
      });

      // Chat messaging
      socket.on("send-message", (message: string) => {
        io.to(roomId).emit("receive-message", {
          id: Math.random().toString(36).substr(2, 9),
          userId,
          userName,
          text: message,
          timestamp: new Date().toISOString()
        });
      });

      // User status updates (mute, video, hand raise)
      socket.on("update-status", (status: any) => {
        socket.to(roomId).emit("status-updated", userId, status);
      });

      // Host controls
      socket.on("host-action", (action: string, targetId?: string) => {
        // Enforce basic host logic if needed, but for now allow anyone to broadcast host actions
        io.to(roomId).emit("receive-host-action", { action, targetId });
      });

      // Reactions
      socket.on("send-reaction", (emoji: string) => {
        io.to(roomId).emit("receive-reaction", { userId, userName, emoji });
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
