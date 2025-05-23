const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "https://dkristheltorres.github.io",
            "https://dkristheltorres.github.io/CS247",
            "https://dkristheltorres.github.io/CS247/",
            "http://localhost:3000"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors({
    origin: [
        "https://dkristheltorres.github.io",
        "https://dkristheltorres.github.io/CS247",
        "https://dkristheltorres.github.io/CS247/",
        "http://localhost:3000"
    ],
    credentials: true
}));
app.use(express.json());

// Game Room Manager
class GameRoom {
    constructor(roomId, hostUsername, hostAvatar, hostColor) {
        this.roomId = roomId;
        this.hostUsername = hostUsername;
        this.players = [{
            name: hostUsername,
            avatar: hostAvatar || 'avatar1.png',
            color: hostColor || '#e74c3c',
            tokens: 5,
            alive: true
        }];
        this.gameState = {
            status: 'waiting',
            startTime: null,
            currentTurn: null,
            scores: {}
        };
        this.maxPlayers = 4;
    }

    addPlayer(username, avatar, color) {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }
        if (this.players.some(p => p.name === username)) {
            return false;
        }
        const colors = ['#e74c3c', '#8e44ad', '#27ae60', '#f1c40f'];
        const avatars = ['avatar1.png', 'avatar2.png', 'avatar3.png', 'avatar4.png'];
        const idx = this.players.length % 4;
        this.players.push({
            name: username,
            avatar: avatar || avatars[idx],
            color: color || colors[idx],
            tokens: 5,
            alive: true
        });
        this.gameState.scores[username] = 0;
        return true;
    }

    removePlayer(username) {
        const index = this.players.findIndex(p => p.name === username);
        if (index > -1) {
            this.players.splice(index, 1);
            delete this.gameState.scores[username];
            return true;
        }
        return false;
    }

    startGame() {
        if (this.players.length < 2) {
            return false;
        }
        this.gameState.status = 'in_progress';
        this.gameState.startTime = Date.now();
        this.gameState.currentTurn = 0;  // Index of first player
        return true;
    }

    endGame() {
        this.gameState.status = 'finished';
        return true;
    }
}

// Room Management
const activeRooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', ({ roomId, username, avatar, color }) => {
        if (activeRooms.has(roomId)) {
            socket.emit('roomError', { message: 'Room already exists' });
            return;
        }

        const room = new GameRoom(roomId, username, avatar, color);
        activeRooms.set(roomId, room);
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, players: room.players });
        console.log(`Room ${roomId} created by ${username}`);
    });

    socket.on('joinRoom', ({ roomId, username, avatar, color }) => {
        console.log(`joinRoom called: roomId=${roomId}, username=${username}`); // Debug log
        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit('roomError', { message: 'Room does not exist' });
            return;
        }

        if (room.players.length >= room.maxPlayers) {
            socket.emit('roomError', { message: 'Room is full' });
            return;
        }

        if (room.players.some(p => p.name === username)) {
            socket.emit('roomError', { message: 'Username already in room' });
            return;
        }

        room.addPlayer(username, avatar, color);
        socket.join(roomId);

        // Notify the joining player of the current room state
        socket.emit('playerJoined', {
            username,
            players: room.players
        });

        // Notify all other players in the room
        socket.to(roomId).emit('playerJoined', {
            username,
            players: room.players
        });

        // Log room state for debugging
        console.log(`Player ${username} joined room ${roomId}. Players now:`, room.players);
    });

    socket.on('startGame', ({ roomId }) => {
        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit('roomError', { message: 'Room does not exist' });
            return;
        }

        if (room.startGame()) {
            io.to(roomId).emit('gameStarted', {
                players: room.players,
                gameState: room.gameState,
                currentTurn: 0
            });
            console.log(`Game started in room ${roomId}`);
        } else {
            socket.emit('roomError', { message: 'Could not start game' });
        }
    });

    socket.on('leaveRoom', ({ roomId, username }) => {
        const room = activeRooms.get(roomId);
        if (room) {
            room.removePlayer(username);
            socket.leave(roomId);
            
            if (room.players.length === 0) {
                activeRooms.delete(roomId);
                console.log(`Room ${roomId} deleted (empty)`);
            } else {
                io.to(roomId).emit('playerLeft', {
                    username,
                    players: room.players
                });
                console.log(`Player ${username} left room ${roomId}. Players now:`, room.players);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// REST API endpoints
app.post('/api/rooms', (req, res) => {
    const { roomId, username } = req.body;
    if (activeRooms.has(roomId)) {
        return res.status(400).json({ error: 'Room already exists' });
    }

    const room = new GameRoom(roomId, username);
    activeRooms.set(roomId, room);
    res.json({ roomId, players: room.players });
});

app.get('/api/rooms', (req, res) => {
    res.json(Array.from(activeRooms.keys()));
});

app.get('/api/rooms/:roomId', (req, res) => {
    const room = activeRooms.get(req.params.roomId);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    res.json({
        roomId: room.roomId,
        players: room.players,
        gameState: room.gameState
    });
});

app.get('/api/rooms/:roomId/players', (req, res) => {
    const room = activeRooms.get(req.params.roomId);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room.players);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 