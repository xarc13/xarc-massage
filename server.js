const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const allowedOrigins = new Set(
  [process.env.FRONTEND_URL, ...(process.env.CORS_ORIGINS || '').split(',')]
    .map(value => value && value.trim().replace(/\/$/, ''))
    .filter(Boolean)
);
// Socket.IO must accept the deployed Vercel origin. Configure FRONTEND_URL or
// CORS_ORIGINS in Render; localhost is included for local development.
for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173']) {
  allowedOrigins.add(origin);
}
const corsOrigin = (origin, callback) => {
  // Non-browser clients and same-origin local development may omit Origin.
  if (!origin || allowedOrigins.has(origin)) return callback(null, true);
  return callback(new Error('Origin tidak diizinkan oleh konfigurasi CORS.'));
};
const io = new Server(server, {
  maxHttpBufferSize: 96 * 1024 * 1024,
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] }
});
const rooms = new Map();
const PORT = process.env.PORT || 3000;
const ROOM_TTL = 24 * 60 * 60 * 1000;
const MIN_MEMBERS = 2;
const MAX_MEMBERS_LIMIT = 100;

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)');
  next();
});
app.get('/health', (_req, res) => res.json({ ok: true, service: 'xarc-massage' }));
app.use(express.static('public', { extensions: ['html'] }));

function newRoomId() { return crypto.randomBytes(18).toString('base64url'); }
// URL-safe alphabet: letters, numbers, and symbols (-/_). This avoids &, #, ?, =, % etc.
// that can be interpreted as URL separators when a room code is shared.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789-_';
function newInviteCode() {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  return code;
}
function newInviteSalt() { return crypto.randomBytes(16).toString('base64url'); }
function codeTaken(code) {
  for (const room of rooms.values()) if (room.code === code) return true;
  return false;
}
function makeUniqueInviteCode() {
  let code;
  do code = newInviteCode(); while (codeTaken(code));
  return code;
}
function validRoomId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(id); }
function normalizeMaxMembers(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < MIN_MEMBERS || n > MAX_MEMBERS_LIMIT) return null;
  return n;
}
function cleanup(roomId) {
  const room = rooms.get(roomId);
  if (room && Date.now() - room.createdAt > ROOM_TTL) rooms.delete(roomId);
}
function roster(room) {
  return [...room.members.keys()].map(() => ({}));
}
function emitRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('room:state', {
    members: room.members.size,
    maxMembers: room.maxMembers,
    names: roster(room)
  });
}

io.on('connection', socket => {
  socket.on('room:create', ({ maxMembers } = {}, ack) => {
    const limit = normalizeMaxMembers(maxMembers);
    if (!limit) return ack?.({ ok: false, error: 'Jumlah anggota room tidak valid.' });

    const roomId = newRoomId();
    const code = makeUniqueInviteCode();
    const salt = newInviteSalt();
    const member = { socketId: socket.id };
    rooms.set(roomId, {
      createdAt: Date.now(),
      maxMembers: limit,
      code,
      salt,
      members: new Map([[socket.id, member]])
    });

    socket.join(roomId);
    socket.data.roomId = roomId;
    ack?.({ ok: true, roomId, code, salt, maxMembers: limit, members: 1, names: roster(rooms.get(roomId)) });
  });

  socket.on('room:leave', ({ roomId } = {}, ack) => {
    cleanup(roomId);
    const room = rooms.get(roomId);
    if (!room) return ack?.({ ok: false, error: 'Room tidak ditemukan atau sudah kedaluwarsa.' });
    if (socket.data.roomId !== roomId || !room.members.has(socket.id)) {
      return ack?.({ ok: false, error: 'Kamu bukan anggota room ini.' });
    }
    room.members.delete(socket.id);
    socket.leave(roomId);
    socket.data.roomId = null;
    if (room.members.size === 0) rooms.delete(roomId);
    else emitRoomState(roomId);
    ack?.({ ok: true });
  });

  socket.on('room:update-capacity', ({ roomId, maxMembers } = {}, ack) => {
    cleanup(roomId);
    const room = rooms.get(roomId);
    const limit = normalizeMaxMembers(maxMembers);
    if (!room) return ack?.({ ok: false, error: 'Room tidak ditemukan atau sudah kedaluwarsa.' });
    if (!limit) return ack?.({ ok: false, error: 'Kapasitas room tidak valid.' });
    if (socket.data.roomId !== roomId || !room.members.has(socket.id)) {
      return ack?.({ ok: false, error: 'Kamu bukan anggota room ini.' });
    }
    if (limit < room.members.size) {
      return ack?.({ ok: false, error: `Kapasitas tidak boleh lebih kecil dari ${room.members.size} anggota yang sedang terhubung.` });
    }
    room.maxMembers = limit;
    emitRoomState(roomId);
    ack?.({ ok: true, maxMembers: limit, members: room.members.size });
  });

  socket.on('room:delete', ({ roomId } = {}, ack) => {
    cleanup(roomId);
    const room = rooms.get(roomId);
    if (!room) return ack?.({ ok: false, error: 'Room tidak ditemukan atau sudah kedaluwarsa.' });
    if (socket.data.roomId !== roomId || !room.members.has(socket.id)) {
      return ack?.({ ok: false, error: 'Kamu bukan anggota room ini.' });
    }

    rooms.delete(roomId);
    for (const member of room.members.values()) {
      const memberSocket = io.sockets.sockets.get(member.socketId);
      if (memberSocket) {
        memberSocket.leave(roomId);
        memberSocket.data.roomId = null;
        memberSocket.emit('room:deleted');
      }
    }
    ack?.({ ok: true });
  });

  socket.on('room:lookup', ({ code } = {}, ack) => {
    for (const [id, room] of rooms) cleanup(id);
    const normalized = typeof code === 'string' ? code.trim() : '';
    if (normalized.length !== 6) return ack?.({ ok: false, error: 'Kode room harus 6 karakter.' });
    let foundId = null;
    for (const [id, room] of rooms) {
      if (room.code === normalized) { foundId = id; break; }
    }
    if (!foundId) return ack?.({ ok: false, error: 'Kode room tidak ditemukan atau room sudah kedaluwarsa.' });
    const room = rooms.get(foundId);
    ack?.({ ok: true, roomId: foundId, code: room.code, salt: room.salt, members: room.members.size, maxMembers: room.maxMembers });
  });

  socket.on('room:join', ({ roomId } = {}, ack) => {
    cleanup(roomId);
    const room = rooms.get(roomId);
    if (!room) return ack?.({ ok: false, error: 'Room tidak ditemukan atau sudah kedaluwarsa.' });
    if (room.members.has(socket.id)) {
      return ack?.({ ok: true, code: room.code, salt: room.salt, members: room.members.size, maxMembers: room.maxMembers, names: roster(room) });
    }
    if (room.members.size >= room.maxMembers) return ack?.({ ok: false, error: `Room sudah penuh (${room.maxMembers} anggota).` });

    room.members.set(socket.id, { socketId: socket.id });
    socket.join(roomId);
    socket.data.roomId = roomId;
    
    ack?.({ ok: true, code: room.code, salt: room.salt, members: room.members.size, maxMembers: room.maxMembers, names: roster(room) });
    emitRoomState(roomId);
  });

  socket.on('message:encrypted', ({ roomId, payload } = {}, ack) => {
    if (!validRoomId(roomId) || typeof payload !== 'object' || !rooms.has(roomId)) {
      return ack?.({ ok: false, error: 'Room atau payload tidak valid.' });
    }
    const room = rooms.get(roomId);
    if (socket.data.roomId !== roomId || !room.members.has(socket.id)) {
      return ack?.({ ok: false, error: 'Socket belum terdaftar di room.' });
    }
    // The server treats the payload as opaque ciphertext and does not decrypt it.
    // Broadcast only to the other members; the sender renders its own message locally.
    socket.to(roomId).emit('message:encrypted', payload);
    ack?.({ ok: true });
  });

  socket.on('typing', ({ roomId, active } = {}) => {
    if (!validRoomId(roomId) || socket.data.roomId !== roomId) return;
    socket.to(roomId).emit('typing', { active: !!active });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room) return;
    room.members.delete(socket.id);
    if (room.members.size === 0) rooms.delete(roomId);
    else emitRoomState(roomId);
  });
});

setInterval(() => {
  for (const [id, room] of rooms) if (Date.now() - room.createdAt > ROOM_TTL) rooms.delete(id);
}, 10 * 60 * 1000).unref();

server.listen(PORT, '0.0.0.0', () => console.log(`Xarc Massage Socket.IO server listening on port ${PORT}`));
