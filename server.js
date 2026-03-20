// ==========================================
// TeamSync - WebRTC Signaling Server
// Advanced Multi-Party Team Communication
// ==========================================

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Session Management
// ==========================================

const sessions = new Map();
const users = new Map();

class Session {
    constructor(id) {
        this.id = id;
        this.participants = new Map();
        this.createdAt = Date.now();
        this.transcript = [];
    }

    addParticipant(userId, userInfo) {
        this.participants.set(userId, {
            ...userInfo,
            joinedAt: Date.now()
        });
    }

    removeParticipant(userId) {
        this.participants.delete(userId);
    }

    addTranscript(speaker, text) {
        this.transcript.push({
            speaker,
            text,
            timestamp: new Date().toISOString()
        });
    }

    getParticipantList() {
        return Array.from(this.participants.entries()).map(([id, info]) => ({
            id,
            name: info.name,
            joinedAt: info.joinedAt
        }));
    }
}

// ==========================================
// REST API Routes
// ==========================================

// Create new session
app.post('/api/sessions', (req, res) => {
    const sessionId = 'session-' + uuidv4().substring(0, 12);
    const session = new Session(sessionId);
    sessions.set(sessionId, session);

    console.log(`✅ Session created: ${sessionId}`);

    res.json({
        success: true,
        sessionId,
        joinUrl: `http://localhost:${PORT}?session=${sessionId}`
    });
});

// Get session info
app.get('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }

    res.json({
        success: true,
        sessionId,
        participants: session.getParticipantList(),
        createdAt: session.createdAt,
        duration: Date.now() - session.createdAt
    });
});

// Get session transcript
app.get('/api/sessions/:sessionId/transcript', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }

    res.json({
        success: true,
        sessionId,
        transcript: session.transcript
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'Server is running',
        activeSessions: sessions.size,
        activeUsers: users.size
    });
});

// ==========================================
// Socket.IO Signaling
// ==========================================

io.on('connection', (socket) => {
    console.log(`👤 User connected: ${socket.id}`);

    let currentSessionId = null;
    let currentUserId = null;
    let userInfo = {};

    // User joins session
    socket.on('join-session', (data) => {
        const { sessionId, userName } = data;

        // Find or create session
        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, new Session(sessionId));
        }

        const session = sessions.get(sessionId);
        currentSessionId = sessionId;
        currentUserId = socket.id;
        userInfo = { name: userName };

        // Add participant to session
        session.addParticipant(currentUserId, userInfo);
        users.set(socket.id, { sessionId, userName, connectedAt: Date.now() });

        // Join socket room
        socket.join(sessionId);

        console.log(`✋ ${userName} joined session ${sessionId}`);

        // Notify others in session
        const participants = session.getParticipantList();
        io.to(sessionId).emit('participant-joined', {
            userId: currentUserId,
            userName,
            participants,
            totalParticipants: session.participants.size
        });

        // Send existing participants to new user
        socket.emit('get-participants', {
            participants: participants.filter(p => p.id !== currentUserId),
            userId: currentUserId
        });
    });

    // Offer (initiate peer connection)
    socket.on('offer', (data) => {
        const { to, offer } = data;
        io.to(to).emit('offer', {
            from: socket.id,
            offer
        });
        console.log(`📮 Offer sent from ${socket.id} to ${to}`);
    });

    // Answer
    socket.on('answer', (data) => {
        const { to, answer } = data;
        io.to(to).emit('answer', {
            from: socket.id,
            answer
        });
        console.log(`📬 Answer sent from ${socket.id} to ${to}`);
    });

    // ICE Candidate
    socket.on('ice-candidate', (data) => {
        const { to, candidate } = data;
        io.to(to).emit('ice-candidate', {
            from: socket.id,
            candidate
        });
    });

    // Add transcript entry
    socket.on('add-transcript', (data) => {
        const { text } = data;
        if (currentSessionId && sessions.has(currentSessionId)) {
            const session = sessions.get(currentSessionId);
            session.addTranscript(userInfo.name || 'Unknown', text);
            
            // Broadcast transcript to all in session
            io.to(currentSessionId).emit('transcript-update', {
                speaker: userInfo.name,
                text,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Get participants
    socket.on('get-participants', () => {
        if (currentSessionId && sessions.has(currentSessionId)) {
            const session = sessions.get(currentSessionId);
            socket.emit('participants-list', {
                participants: session.getParticipantList()
            });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (currentSessionId && sessions.has(currentSessionId)) {
            const session = sessions.get(currentSessionId);
            session.removeParticipant(currentUserId);

            // Notify others
            io.to(currentSessionId).emit('participant-left', {
                userId: currentUserId,
                userName: userInfo.name,
                totalParticipants: session.participants.size
            });

            console.log(`👋 ${userInfo.name} left session ${currentSessionId}`);

            // Delete session if empty
            if (session.participants.size === 0) {
                sessions.delete(currentSessionId);
                console.log(`🗑️  Session ${currentSessionId} deleted (empty)`);
            }
        }

        users.delete(socket.id);
        console.log(`❌ User disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on('error', (error) => {
        console.error(`⚠️  Socket error for ${socket.id}:`, error);
    });
});

// ==========================================
// Server Startup
// ==========================================

server.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════╗
║   🎤 TeamSync Signaling Server 🎤      ║
╚════════════════════════════════════════╝

📡 Server running at: http://localhost:${PORT}
🌐 Host: ${HOST}
⚙️  Node: ${process.version}

📊 APIs:
   POST   /api/sessions           - Create new session
   GET    /api/sessions/:id       - Get session info
   GET    /api/sessions/:id/transcript - Get transcript
   GET    /api/health             - Health check

🔌 WebSocket Events:
   join-session, offer, answer, ice-candidate
   add-transcript, get-participants

💡 Test URL: http://localhost:${PORT}?session=test-session-123

Press Ctrl+C to stop the server
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// ==========================================
// Advanced Features (Optional)
// ==========================================

// Periodic cleanup of inactive sessions (30 minutes)
setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.createdAt > maxAge && session.participants.size === 0) {
            sessions.delete(sessionId);
            console.log(`🧹 Cleaned up inactive session: ${sessionId}`);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

module.exports = server;
