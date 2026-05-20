import express from "express";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

interface RoomState {
  hostId: string;
  passcode: string;
  waitingRoomEnabled: boolean;
  activeUsers: { [socketId: string]: { userId: string; name: string } };
  waitingUsers: { [socketId: string]: { userId: string; name: string } };
}

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

  // Track rooms on the server
  const rooms: { [roomId: string]: RoomState } = {};

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("Socket client connected:", socket.id);

    // 1. Initial Handshake / Room Check
    socket.on("check-room-needs", (roomId: string, callback: (data: { exists: boolean; hasPasscode: boolean; waitingRoom: boolean }) => void) => {
      const room = rooms[roomId];
      if (room) {
        callback({
          exists: true,
          hasPasscode: !!room.passcode,
          waitingRoom: room.waitingRoomEnabled
        });
      } else {
        callback({
          exists: false,
          hasPasscode: false,
          waitingRoom: false
        });
      }
    });

    // 2. Joining a room
    socket.on("join-room", (roomId: string, userId: string, userName: string, passcode?: string) => {
      console.log(`User ${userName} (${userId}) requesting join for Room ${roomId}`);
      
      // Initialize room if it doesn't exist
      if (!rooms[roomId]) {
        rooms[roomId] = {
          hostId: socket.id,
          passcode: passcode || Math.floor(100000 + Math.random() * 900000).toString(), // auto 6-digit passcode
          waitingRoomEnabled: false,
          activeUsers: {},
          waitingUsers: {}
        };
        console.log(`Created Room ${roomId} with Host ${userName} (${socket.id}). Passcode is ${rooms[roomId].passcode}`);
      }

      const room = rooms[roomId];
      const isHost = room.hostId === socket.id;

      // Check passcode if not host
      if (!isHost && room.passcode && passcode && room.passcode !== passcode) {
        socket.emit("join-error", "Incorrect passcode.");
        return;
      }

      // Check if waiting room is enabled
      if (!isHost && room.waitingRoomEnabled) {
        // Enlist in waiting list
        room.waitingUsers[socket.id] = { userId, name: userName };
        socket.join(roomId + "-waiting");
        
        // Notify only the Host
        io.to(room.hostId).emit("waiting-list-updated", Object.entries(room.waitingUsers).map(([sId, data]) => ({
          socketId: sId,
          userId: data.userId,
          name: data.name
        })));

        socket.emit("entered-waiting-room", {
          roomId,
          passcode: room.passcode
        });
        
        console.log(`User ${userName} placed in waiting room for Room ${roomId}`);
        return;
      }

      // Procceed to join room directly
      room.activeUsers[socket.id] = { userId, name: userName };
      socket.join(roomId);

      // Emit room info including host details and passcode
      socket.emit("room-info", {
        hostId: room.hostId,
        isHost,
        passcode: room.passcode,
        waitingRoomEnabled: room.waitingRoomEnabled
      });

      // Notify others in active room
      socket.to(roomId).emit("user-connected", userId, userName);

      // Setup actions inside room
      socket.on("disconnect", () => {
        console.log(`User ${userName} (${userId}) disconnected`);
        if (room) {
          delete room.activeUsers[socket.id];
          delete room.waitingUsers[socket.id];
          
          // If host left, assign another host if possible
          if (room.hostId === socket.id) {
            const activeKeys = Object.keys(room.activeUsers);
            if (activeKeys.length > 0) {
              room.hostId = activeKeys[0];
              io.to(room.hostId).emit("room-info", {
                hostId: room.hostId,
                isHost: true,
                passcode: room.passcode,
                waitingRoomEnabled: room.waitingRoomEnabled
              });
              io.to(roomId).emit("receive-host-action", { action: "new-host", targetId: room.hostId });
            } else {
              delete rooms[roomId];
              console.log(`Room ${roomId} deleted because all members left.`);
            }
          } else {
            // Notify host if waiting user disconnected
            io.to(room.hostId).emit("waiting-list-updated", Object.entries(room.waitingUsers).map(([sId, data]) => ({
              socketId: sId,
              userId: data.userId,
              name: data.name
            })));
          }
        }
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

      // Status updates
      socket.on("update-status", (status: any) => {
        socket.to(roomId).emit("status-updated", userId, status);
      });

      // Host controls
      socket.on("host-action", (action: string, targetId?: string) => {
        if (socket.id !== room.hostId) {
          // Verify host authorization
          return;
        }

        if (action === "toggle-waiting-room") {
          room.waitingRoomEnabled = !room.waitingRoomEnabled;
          io.to(roomId).emit("room-info", {
            hostId: room.hostId,
            isHost: true,
            passcode: room.passcode,
            waitingRoomEnabled: room.waitingRoomEnabled
          });
        } else if (action === "admit-user" && targetId) {
          const waitingData = room.waitingUsers[targetId];
          if (waitingData) {
            delete room.waitingUsers[targetId];
            
            // Notify the admitted socket to join fully
            io.to(targetId).emit("admitted-by-host");
            
            // Notify Host of updated list
            io.to(room.hostId).emit("waiting-list-updated", Object.entries(room.waitingUsers).map(([sId, data]) => ({
              socketId: sId,
              userId: data.userId,
              name: data.name
            })));
          }
        } else if (action === "reject-user" && targetId) {
          delete room.waitingUsers[targetId];
          io.to(targetId).emit("rejected-by-host");
          io.to(room.hostId).emit("waiting-list-updated", Object.entries(room.waitingUsers).map(([sId, data]) => ({
            socketId: sId,
            userId: data.userId,
            name: data.name
          })));
        } else if (action === "change-passcode" && targetId) {
          room.passcode = targetId; // temporary hack to send new passcode payload
          io.to(roomId).emit("room-info", {
            hostId: room.hostId,
            isHost: true,
            passcode: room.passcode,
            waitingRoomEnabled: room.waitingRoomEnabled
          });
        } else {
          // Broad relay for other host actions (e.g., mute-all, stop-video-all)
          io.to(roomId).emit("receive-host-action", { action, targetId });
        }
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
