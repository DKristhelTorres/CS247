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
        this.board = Array.from({ length: 7 }, () => Array(7).fill(null)); //!!!
        this.board[0][0] = '┼';
        this.board[0][6] = '┼';
        this.board[6][0] = '┼';
        this.board[6][6] = '┼';
        this.board[3][3] = '┼'; // center tile
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

function getConnections(symbol) {
    switch (symbol) {
        case '─': return ['left', 'right'];
        case '│': return ['up', 'down'];
        case '┌': return ['right', 'down'];
        case '┐': return ['left', 'down'];
        case '┘': return ['left', 'up'];
        case '└': return ['right', 'up'];
        case '┼': return ['up', 'down', 'left', 'right'];
        default: return [];
    }
}

function isPathToCorner(board) {
    const N = board.length;
    const visited = Array.from({ length: N }, () => Array(N).fill(false));
    const center = [3, 3];
    const queue = [center];

    const directions = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1]
    };

    const opposite = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left'
    };

    
    while (queue.length > 0) {
        const [y, x] = queue.shift();
        if (visited[y][x]) continue;
        visited[y][x] = true;

        const symbol = board[y][x];
        if (!symbol) continue;

        console.log(`Visiting [${y},${x}] = ${symbol}`);

        const connections = getConnections(symbol);

        for (const dir of connections) {
            const [dy, dx] = directions[dir];
            const ny = y + dy;
            const nx = x + dx;

            if (ny < 0 || ny >= N || nx < 0 || nx >= N) continue;
            if (visited[ny][nx]) continue;

            const neighborSymbol = board[ny][nx];
            if (!neighborSymbol) continue;

            const neighborConnections = getConnections(neighborSymbol);
            if (neighborConnections.includes(opposite[dir])) {
                console.log(`  ↳ Moving ${dir} to [${ny},${nx}] = ${neighborSymbol} (has ${neighborConnections})`);
                queue.push([ny, nx]);
            }
        }
    }

    const corners = [
        [0, 0],
        [0, N - 1],
        [N - 1, 0],
        [N - 1, N - 1]
    ];

    return corners.some(([cy, cx]) => visited[cy][cx]);
}

const activeRooms = new Map();
const socketToRoomMap = new Map(); // Track which room each socket belongs to

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.onAny((event, ...args) => {
        console.log(`[SOCKET DEBUG] Received event: ${event}`, ...args);
    });

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
        const existingPlayer = room.players.find(p => p.name === username);

        if (existingPlayer) {
            console.log(`[SERVER] ${username} is reconnecting.`);
            socket.join(roomId);
            socketToRoomMap.set(socket.id, roomId);
        } else {
            if (room.players.length >= room.maxPlayers) {
                socket.emit('roomError', { message: 'Room is full' });
                return;
            }

            room.addPlayer(username, avatar, color);
            socket.join(roomId);
            socketToRoomMap.set(socket.id, roomId);
        }

        room.addPlayer(username, avatar, color);
        socket.join(roomId);
        socketToRoomMap.set(socket.id, roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);



        // Notify the joining player of the current room state
        socket.emit('playerJoined', {
            username,
            players: room.players
        });

        console.log(`[DEBUG] Emitting gameUpdate on joinRoom. Board snapshot:`);
        console.table(room.board);

        socket.emit('gameUpdate', {
            board: room.board || Array.from({ length: 7 }, () => Array(7).fill(null)),
            players: room.players,
            currentTurn: room.gameState.currentTurn
        });
        
        // Notify all other players in the room
        socket.to(roomId).emit('playerJoined', {
            username,
            players: room.players
        });

        if (room.gameState.status === 'in_progress') {
            socket.emit('gameUpdate', {
                board: room.board,
                players: room.players,
                currentTurn: room.gameState.currentTurn
            });
            console.log(`[SERVER] Synced gameUpdate to ${username} on rejoin.`);
        }



        setTimeout(() => {
            io.in(roomId).allSockets().then(sockets => {
                console.log(`Sockets currently in ${roomId}:`, [...sockets]);
            });
        }, 100); // Give a small delay to allow room state to settle

        // Log room state for debugging
        console.log(`Player ${username} joined room ${roomId}. Players now:`, room.players);
    });

    socket.on('startGame', ({ roomId }) => {
        const room = activeRooms.get(roomId);
        if (!room || !room.startGame()) {
            socket.emit('roomError', { message: 'Game cannot be started' });
            return;
        }

        room.board = Array.from({ length: 7 }, () => Array(7).fill(null));
        room.board[0][0] = '┼';
        room.board[0][6] = '┼';
        room.board[6][0] = '┼';
        room.board[6][6] = '┼';
        room.board[3][3] = '┼'; // center tile
        const ranked = [...room.players].sort((a, b) => (room.gameState.scores[b.name] || 0) - (room.gameState.scores[a.name] || 0));
        const tileCounts = [3, 2, 1, 0];

        // ranked.forEach((p, i) => {
        //     const rp = room.players.find(player => player.name === p.name);
        //     if (rp) rp.tokens = tileCounts[i] || 0;
        // });
        ranked.forEach((p, i) => {
            const rp = room.players.find(player => player.name === p.name);
            if (rp) {
                const assigned = tileCounts[i] || 0;
                rp.tokens = assigned;
                rp.initialTiles = assigned; 
            }
        });

        io.to(roomId).emit('gameStarted', {
            players: room.players,
            gameState: room.gameState,
            board: room.board,
            currentTurn: 0
        });
    });

    socket.on('placeToken', ({ roomId, x, y, tokenType, playerIdx }) => {
        console.log(`[SERVER] Received placeToken: room=${roomId}, (${x}, ${y}) => ${tokenType}, from player ${playerIdx}`);

        const room = activeRooms.get(roomId);
        if (!room) {
            console.warn(`[SERVER] No room found for ${roomId}`);
            return;
        }

        console.log(`[SERVER] Emitting gameUpdate for ${roomId}`);
        console.log("Board state:", room.board);

        io.in(roomId).allSockets().then(sockets => {
            console.log(`[CHECK] All sockets in room ${roomId}:`, [...sockets]);
        });

        // Ensure the board is initialized
        if (!room.board) {
            room.board = Array.from({ length: 7 }, () => Array(7).fill(null));
        }
        room.board[3][3] = room.board[3][3] || '┼'; // Always ensure center is set


        // // Reject move if the cell is already filled (defensive check)
        // if (room.board[y][x]) return;


        // Place the token
        room.board[y][x] = tokenType;

        // Ensure center is seeded
        room.board[3][3] = room.board[3][3] || '┼';

        if (isPathToCorner(room.board)) {
            console.log("💥 BOOM detected on server!");
            io.to(roomId).emit('boomTriggered', {
                playerName: room.players[playerIdx]?.name || "Unknown"
            });
        } else {
           console.log("[SERVER] No path to corner yet.");
        }


        const player = room.players[playerIdx];
        if (player) {
            player.tokens = Math.max((player.tokens || 0) - 1, 0);
        }

        // Always attempt to advance turn (after every valid move)
        const total = room.players.length;
        if (player.tokens === 0) {
            for (let i = 1; i <= total; i++) {
                const nextIdx = (room.gameState.currentTurn + i) % total;
                const nextPlayer = room.players[nextIdx];
                if (nextPlayer && nextPlayer.alive && nextPlayer.tokens > 0) {
                    room.gameState.currentTurn = nextIdx;
                    break;
                }
            }
        }

        // Broadcast update
        console.log(`[SERVER] Broadcasting gameUpdate to room ${roomId}`);
        io.in(roomId).allSockets().then(sockets => {
            console.log(`Sockets in ${roomId}:`, [...sockets]);
        });

        console.log(`[SERVER] About to emit gameUpdate to room ${roomId}`);
        console.log("Board state now:", JSON.stringify(room.board));
        console.log("Players now:", JSON.stringify(room.players));

        io.to(roomId).emit('gameUpdate', {
            board: room.board,
            players: room.players,
            currentTurn: room.gameState.currentTurn
        });
        console.log(`[SERVER] Emitted gameUpdate to room ${roomId}`);


        io.in(roomId).allSockets().then(sockets => {
            console.log(`[DEBUG] Emitted gameUpdate to room ${roomId} with sockets:`, [...sockets]);
        });

        console.log(`[DEBUG] gameUpdate sent – currentTurn: ${room.gameState.currentTurn}`);
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
        const roomId = socketToRoomMap.get(socket.id);
        socketToRoomMap.delete(socket.id);
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
