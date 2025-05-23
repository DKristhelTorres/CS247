const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

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

class GameRoom {
    constructor(roomId, hostUsername, hostAvatar, hostColor) {
        this.roomId = roomId;
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
        if (this.players.length >= this.maxPlayers || this.players.some(p => p.name === username)) {
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
        if (this.players.length < 2) return false;
        this.gameState.status = 'in_progress';
        this.gameState.startTime = Date.now();
        this.gameState.currentTurn = 0;
        return true;
    }
}

const activeRooms = new Map();

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
        const room = activeRooms.get(roomId);
        if (!room || room.players.length >= room.maxPlayers || room.players.some(p => p.name === username)) {
            socket.emit('roomError', { message: 'Invalid room or name' });
            return;
        }
        room.addPlayer(username, avatar, color);
        socket.join(roomId);

        const playerIdx = room.players.findIndex(p => p.name === username);
        socket.emit('joinedRoom', {
            playerIdx,
            players: room.players
        });

        io.to(roomId).emit('gameUpdate', {
            board: room.board || Array.from({ length: 7 }, () => Array(7).fill(null)),
            players: room.players,
            currentTurn: room.gameState.currentTurn
        });

        if (room.gameState.status === 'in_progress') {
            socket.emit('gameStarted', {
                players: room.players,
                gameState: room.gameState,
                board: room.board,
                currentTurn: room.gameState.currentTurn
            });
        }
    });

    socket.on('startGame', ({ roomId }) => {
        const room = activeRooms.get(roomId);
        if (!room || !room.startGame()) {
            socket.emit('roomError', { message: 'Game cannot be started' });
            return;
        }

        room.board = Array.from({ length: 7 }, () => Array(7).fill(null));
        const ranked = [...room.players].sort((a, b) => (room.gameState.scores[b.name] || 0) - (room.gameState.scores[a.name] || 0));
        const tileCounts = [3, 2, 1, 0];

        ranked.forEach((p, i) => {
            const rp = room.players.find(player => player.name === p.name);
            if (rp) rp.tokens = tileCounts[i] || 0;
        });

        io.to(roomId).emit('gameStarted', {
            players: room.players,
            gameState: room.gameState,
            board: room.board,
            currentTurn: 0
        });
    });

    socket.on('placeToken', ({ roomId, x, y, tokenType, playerIdx }) => {
        const room = activeRooms.get(roomId);
        if (!room) return;

        room.board[y][x] = tokenType;
        const player = room.players[playerIdx];
        if (player) player.tokens = Math.max((player.tokens || 0) - 1, 0);

        io.to(roomId).emit('gameUpdate', {
            board: room.board,
            players: room.players,
            currentTurn: room.gameState.currentTurn
        });
    });

    socket.on('leaveRoom', ({ roomId, username }) => {
        const room = activeRooms.get(roomId);
        if (room) {
            room.removePlayer(username);
            socket.leave(roomId);
            if (room.players.length === 0) {
                activeRooms.delete(roomId);
            } else {
                io.to(roomId).emit('playerLeft', {
                    username,
                    players: room.players
                });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.get('/api/rooms', (req, res) => {
    res.json(Array.from(activeRooms.keys()));
});

app.get('/api/rooms/:roomId', (req, res) => {
    const room = activeRooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ roomId: room.roomId, players: room.players, gameState: room.gameState });
});

app.get('/api/rooms/:roomId/players', (req, res) => {
    const room = activeRooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room.players);
});

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
