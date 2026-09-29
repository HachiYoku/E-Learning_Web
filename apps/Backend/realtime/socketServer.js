const { Server } = require("socket.io");
const { authenticateAccessToken } = require("../services/accessTokenAuth");

let io;

const userRoom = (userId) => `user:${String(userId)}`;
const adminRoom = "admin";

function serialiseNotification(notification) {
  const value = typeof notification?.toObject === "function"
    ? notification.toObject()
    : notification;

  return {
    _id: String(value._id),
    userId: String(value.userId),
    courseId: value.courseId ? String(value.courseId) : null,
    announcementId: value.announcementId ? String(value.announcementId) : undefined,
    type: value.type,
    title: value.title,
    message: value.message,
    link: value.link || "",
    isRead: Boolean(value.isRead),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function initializeSocketServer(httpServer, { allowedOrigins, adapterFactory } = {}) {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        // Non-browser test clients do not send Origin. Browser connections are
        // restricted to the same allow-list as the HTTP API.
        if (!origin || (allowedOrigins || []).includes(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by CORS"));
      },
      credentials: true,
    },
  });

  // Keep this seam for a future multi-instance deployment. A Redis adapter can
  // be supplied here without changing notification producers or clients.
  if (adapterFactory) io.adapter(adapterFactory);

  io.use(async (socket, next) => {
    try {
      const user = await authenticateAccessToken(socket.handshake.auth?.token);
      socket.data.user = user;
      return next();
    } catch (_error) {
      // Do not reveal whether a token was malformed, expired, or revoked.
      return next(new Error("Unauthorized socket connection"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(userRoom(socket.data.user.id));
    if (socket.data.user.role === "admin") socket.join(adminRoom);
  });

  return io;
}

function emitAdminEvent(event) {
  if (io) io.to(adminRoom).emit(event);
}

function emitNotification(notification) {
  if (!io || !notification) return;
  const payload = serialiseNotification(notification);
  io.to(userRoom(payload.userId)).emit("notification:new", payload);
}

function closeSocketServer() {
  if (!io) return Promise.resolve();
  const socketServer = io;
  io = undefined;
  return new Promise((resolve) => socketServer.close(resolve));
}

module.exports = {
  initializeSocketServer,
  emitNotification,
  emitAdminEvent,
  closeSocketServer,
  userRoom,
  adminRoom,
};
