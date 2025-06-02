const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const { log } = require("console");
const mg1FinishOrders = new Map(); // Map<roomId, [username1, username2, ...]>
const mg1FinishTimers = new Map(); // Map<roomId, NodeJS.Timeout>
const TIME_OUT_DURATION = 30; // 60 seconds
const resultsSeenMap = new Map(); // Map<roomId, Set<username>>
const votes = new Map(); // { [roomId]: { next: Set<socketId>, skip: Set, nextTut: Set, skipTut: Set } }

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://dkristheltorres.github.io",
      "https://dkristheltorres.github.io/CS247",
      "https://dkristheltorres.github.io/CS247/",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: [
      "https://dkristheltorres.github.io",
      "https://dkristheltorres.github.io/CS247",
      "https://dkristheltorres.github.io/CS247/",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);
app.use(express.json());

class GameRoom {
  constructor(roomId, hostUsername, hostAvatar, hostColor) {
    this.roomId = roomId;
    // this.players = [{
    //     name: hostUsername,
    //     avatar: hostAvatar || 'avatar1.png',
    //     color: hostColor || '#e74c3c',
    //     tokens: 5,
    //     alive: true
    // }];
    this.players = [];
    this.gameState = {
      status: "waiting",
      startTime: null,
      currentTurn: null,
      scores: {},
    };
    this.board = Array.from({ length: 7 }, () => Array(7).fill(null)); //!!!
    this.board[0][0] = "┼";
    this.board[0][6] = "┼";
    this.board[6][0] = "┼";
    this.board[6][6] = "┼";
    this.board[3][3] = "┼"; // center tile
    this.maxPlayers = 4;

    this.addPlayer(hostUsername, hostColor);
  }

  addPlayer(username, color) {
    if (
      this.players.length >= this.maxPlayers ||
      this.players.some((p) => p.name === username)
    ) {
      return false;
    }
    const colors = ["#e74c3c", "#8e44ad", "#27ae60", "#f1c40f"];
    const avatars = [
      "Player1.png",
      "Player2.png",
      "Player3.png",
      "Player4.png",
    ];
    // const idx = this.players.length % 4;
    const idx = this.players.length;
    this.players.push({
      name: username,
      avatar: avatars[idx],
      color: color || colors[idx],
      tokens: 5,
      alive: true,
    });
    this.gameState.scores[username] = 0;
    return true;
  }

  removePlayer(username) {
    const index = this.players.findIndex((p) => p.name === username);
    if (index > -1) {
      this.players.splice(index, 1);
      delete this.gameState.scores[username];
      return true;
    }
    return false;
  }

  startGame() {
    if (this.players.length < 2) return false;
    this.gameState.status = "in_progress";
    this.gameState.startTime = Date.now();
    this.gameState.currentTurn = 0;
    return true;
  }
}

function getConnections(symbol) {
  switch (symbol) {
    case "─":
      return ["left", "right"];
    case "│":
      return ["up", "down"];
    case "┌":
      return ["right", "down"];
    case "┐":
      return ["left", "down"];
    case "┘":
      return ["left", "up"];
    case "└":
      return ["right", "up"];
    case "┼":
      return ["up", "down", "left", "right"];
    default:
      return [];
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
    right: [0, 1],
  };

  const opposite = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
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
        console.log(
          `  ↳ Moving ${dir} to [${ny},${nx}] = ${neighborSymbol} (has ${neighborConnections})`
        );
        queue.push([ny, nx]);
      }
    }
  }

  const corners = [
    [0, 0],
    [0, N - 1],
    [N - 1, 0],
    [N - 1, N - 1],
  ];

  for (const [cy, cx] of corners) {
    if (visited[cy][cx]) {
      return [cy, cx];
    }
  }

  return null; // No path to any corner found
}

const activeRooms = new Map();
const socketToRoomMap = new Map(); // Track which room each socket belongs to

// --- MINIGAME1 OBSTACLE SYNC SETUP ---
const mg1Obstacles = new Map();
const mg1Winners = new Map();

const CANVAS_HEIGHT = 700;
const OBSTACLE_WIDTH = 40;
const OBSTACLE_HEIGHT = 30;
const SIDE_OFFSET = 35;
const OBSTACLES_PER_LANE = 2;
const OBSTACLE_POSITIONS = [0.2, 0.4, 0.6, 0.8].map((p) => 700 * p);

function generateObstacleSet() {
  const lanes = 4;
  const result = [];
  const POLICE_SPEED = 12; // Fastest
  const RED_SPEED = 8;     // Medium
  const BROWN_SPEED = 5;   // Slowest
  
  for (let i = 0; i < lanes; i++) {
    const direction = i % 2 === 0 ? "down" : "up";
    for (let j = 0; j < OBSTACLES_PER_LANE; j++) {
      // Randomly assign car colors: 1/3 chance for each type
      const color = Math.random() < 0.33 ? "yellow" : Math.random() < 0.5 ? "#ff5252" : "brown";
      // Assign speed based on color
      const speed = color === "yellow" ? POLICE_SPEED : color === "#ff5252" ? RED_SPEED : BROWN_SPEED;
      
      const x = OBSTACLE_POSITIONS[i] - OBSTACLE_WIDTH / 2 + j * SIDE_OFFSET;
      const y =
        direction === "down"
          ? -OBSTACLE_HEIGHT - (j * CANVAS_HEIGHT) / 3
          : CANVAS_HEIGHT + (j * CANVAS_HEIGHT) / 3;
      result.push({
        x,
        y,
        width: OBSTACLE_WIDTH,
        height: OBSTACLE_HEIGHT,
        speed,
        color,
        lane: i,
        direction,
      });
    }
  }
  return result;
}

function finishMinigame(roomId, order, room) {
  const tileRewards = {};
  order.forEach((player, index) => {
    tileRewards[player] = Math.max(4 - index, 1);
  });

  // Add any players not in the order (shouldn't happen, but for safety)
  const unfinished = room.players
    .map((p) => p.name)
    .filter((name) => !order.includes(name));

  unfinished.forEach((name) => {
    tileRewards[name] = 1;
    order.push(name);
  });

  room._tileRewards = tileRewards;

  // First emit results to all clients
  io.to(roomId).emit("mg1Results", { finishOrder: order, tileRewards });
  console.log(`[RESULTS] Sent for room ${roomId}:`, tileRewards);

  // Wait for all players to acknowledge seeing results before transitioning
  if (!readyForResultsMap.has(roomId)) {
    readyForResultsMap.set(roomId, new Set());
  }
}

function startGameLoop(roomId) {
  const room = activeRooms.get(roomId);
  if (!room) return;

  // Reset minigame state for this room
  mg1FinishOrders.delete(roomId);
  mg1FinishTimers.delete(roomId);

  // Select a random minigame (currently only minigame1)
  const selectedMinigame = "minigame1";
  console.log(`[SERVER] Starting game loop with minigame: ${selectedMinigame}`);

  // Transition players to the tutorial for the selected minigame
  io.to(roomId).emit("transitionToTutorial", { minigame: selectedMinigame });
}

// Add synchronization maps
const readyForResultsMap = new Map(); // Map<roomId, Set<username>>

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`[VOTE] ${socket.id} joined voting room ${roomId}`);
  });

  socket.on("joinVoteRoom", (roomId) => {
    socket.join(roomId);
    console.log(`[VOTE] ${socket.id} joined voting room ${roomId}`);
  });

  // when any client casts a vote for next/skip (in intro or tutorial)
  socket.on("vote", ({ roomId, action }) => {
    if (!votes.has(roomId)) votes.set(roomId, {});
    const roomVotes = votes.get(roomId);
    if (!roomVotes[action]) roomVotes[action] = new Set();
    roomVotes[action].add(socket.id);
    const count = roomVotes[action].size;
    const room = activeRooms.get(roomId);
    const total = room?.players?.length || 0;
    // Broadcast updated tally
    io.to(roomId).emit("voteCount", { action, count, total });
    // When everyone has voted, clear and tell clients to advance
    if (count === total) {
      roomVotes[action].clear();
      io.to(roomId).emit("voteComplete", { action });
    }
  });
  // socket.onAny((event, ...args) => {
  //     // console.log(`[SOCKET DEBUG] Received event: ${event}`, ...args);
  // });

  socket.on("createRoom", ({ roomId, username, avatar, color }) => {
    if (activeRooms.has(roomId)) {
      socket.emit("roomError", { message: "Room already exists" });
      return;
    }
    const room = new GameRoom(roomId, username, avatar, color);
    activeRooms.set(roomId, room);
    socket.join(roomId);
    socket.emit("roomCreated", { roomId, players: room.players });
    console.log(`Room ${roomId} created by ${username}`);
  });

  socket.on("joinRoom", ({ roomId, username, avatar, color }) => {
    console.log(`joinRoom called: roomId=${roomId}, username=${username}`); // Debug log
    const room = activeRooms.get(roomId);
    if (!room) {
      socket.emit("roomError", { message: "Room does not exist" });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit("roomError", { message: "Room is full" });
      return;
    }
    const existingPlayer = room.players.find((p) => p.name === username);

    if (existingPlayer) {
      console.log(`[SERVER] ${username} is reconnecting.`);
      // socket.join(roomId);
      // socketToRoomMap.set(socket.id, roomId);
    } else {
      if (room.players.length >= room.maxPlayers) {
        socket.emit("roomError", { message: "Room is full" });
        return;
      }

      room.addPlayer(username, color);
      socket.join(roomId);
      socketToRoomMap.set(socket.id, roomId);
    }

    // room.addPlayer(username, avatar, color);
    socket.join(roomId);
    socketToRoomMap.set(socket.id, roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // Notify the joining player of the current room state
    socket.emit("playerJoined", {
      username,
      players: room.players,
    });

    // console.log(`[DEBUG] Emitting gameUpdate on joinRoom. Board snapshot:`);
    // console.table(room.board);

    socket.emit("gameUpdate", {
      board: room.board || Array.from({ length: 7 }, () => Array(7).fill(null)),
      players: room.players,
      currentTurn: room.gameState.currentTurn,
    });

    // Notify all other players in the room
    socket.to(roomId).emit("playerJoined", {
      username,
      players: room.players,
    });

    if (room.gameState.status === "in_progress") {
      socket.emit("gameUpdate", {
        board: room.board,
        players: room.players,
        currentTurn: room.gameState.currentTurn,
      });
      console.log(`[SERVER] Synced gameUpdate to ${username} on rejoin.`);
    }

    setTimeout(() => {
      io.in(roomId)
        .allSockets()
        .then((sockets) => {
          console.log(`Sockets currently in ${roomId}:`, [...sockets]);
        });
    }, 100); // Give a small delay to allow room state to settle

    // Log room state for debugging
    console.log(
      `Player ${username} joined room ${roomId}. Players now:`,
      room.players
    );
  });

  socket.on("startGame", ({ roomId, tileRewards }) => {
    const room = activeRooms.get(roomId);
    if (!room || !room.startGame()) {
      socket.emit("roomError", { message: "Game cannot be started" });
      return;
    }

    room.board = Array.from({ length: 7 }, () => Array(7).fill(null));
    room.board[0][0] = "┼";
    room.board[0][6] = "┼";
    room.board[6][0] = "┼";
    room.board[6][6] = "┼";
    room.board[3][3] = "┼"; // center tile
    // const ranked = [...room.players].sort((a, b) => (room.gameState.scores[b.name] || 0) - (room.gameState.scores[a.name] || 0));
    // const tileCounts = [3, 2, 1, 0];

    // ranked.forEach((p, i) => {
    //     const rp = room.players.find(player => player.name === p.name);
    //     if (rp) rp.tokens = tileCounts[i] || 0;
    // });
    // ranked.forEach((p, i) => {
    //     const rp = room.players.find(player => player.name === p.name);
    //     if (rp) {
    //         const assigned = tileCounts[i] || 0;
    //         rp.tokens = assigned;
    //         rp.initialTiles = assigned;
    //     }
    // });

    if (tileRewards) {
      console.log("[START GAME] Using tileRewards:", tileRewards);
      room.players.forEach((player) => {
        const reward = tileRewards[player.name];
        const tiles = reward ?? 0;
        console.log(`Assigning ${tiles} tiles to ${player.name}`);
        player.tokens = tiles;
        player.initialTiles = tiles;
      });

      room.players.sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
    } else {
      console.warn(
        "[START GAME] tileRewards missing or invalid — using fallback"
      );
      // Fall back to fixed rank-based assignment
      const ranked = [...room.players].sort(
        (a, b) =>
          (room.gameState.scores[b.name] || 0) -
          (room.gameState.scores[a.name] || 0)
      );
      const tileCounts = [3, 2, 1, 0];

      ranked.forEach((p, i) => {
        const rp = room.players.find((player) => player.name === p.name);
        if (rp) {
          const assigned = tileCounts[i] || 0;
          console.log(`Fallback: Assigning ${assigned} tiles to ${rp.name}`);
          rp.tokens = assigned;
          rp.initialTiles = assigned;
        }
      });
    }

    io.to(roomId).emit("gameStarted", {
      players: room.players,
      gameState: room.gameState,
      board: room.board,
      currentTurn: 0,
    });

    // Start the game loop
    startGameLoop(roomId);
  });

  socket.on("placeToken", ({ roomId, x, y, tokenType, playerIdx }) => {
    console.log(`[SERVER] Received placeToken: room=${roomId}, (${x}, ${y}) => ${tokenType}, from player ${playerIdx}`);

    const room = activeRooms.get(roomId);
    if (!room) {
      console.warn(`[SERVER] No room found for ${roomId}`);
      return;
    }

    console.log(`[SERVER] Emitting gameUpdate for ${roomId}`);
    console.log("Board state:", room.board);

    io.in(roomId)
      .allSockets()
      .then((sockets) => {
        console.log(`[CHECK] All sockets in room ${roomId}:`, [...sockets]);
      });

    // Ensure the board is initialized
    if (!room.board) {
      room.board = Array.from({ length: 7 }, () => Array(7).fill(null));
    }
    room.board[3][3] = room.board[3][3] || "┼"; // Always ensure center is set
    const isCenter = x === 3 && y === 3;
    const isCorner =
      (x === 0 && y === 0) ||
      (x === 0 && y === 6) ||
      (x === 6 && y === 0) ||
      (x === 6 && y === 6);

    // Place the token
    if (isCenter || isCorner) {
      console.log(`[SERVER] Tile at (${x}, ${y}) is protected. Ignoring move.`);
      return;
    }
    room.board[y][x] = tokenType;

    // Ensure center is seeded
    room.board[3][3] = room.board[3][3] || "┼";

    const cornerReached = isPathToCorner(room.board);
    if (cornerReached) {
      console.log("💥 BOOM detected at corner:", cornerReached);

      const [cy, cx] = cornerReached;
      const cornerKey = `${cy},${cx}`;
      const cornerPositions = ["0,0", "0,6", "6,6", "6,0"];

      const index = cornerPositions.indexOf(cornerKey);
      if (index !== -1 && room.players[index]) {
        const victim = room.players[index];
        victim.alive = false; // Mark as eliminated
        io.to(roomId).emit("boomTriggered", {
          playerName: victim.name,
        });
        // --- FIX: If the eliminated player is the current turn, advance turn ---
        if (room.gameState.currentTurn === index || !room.players[room.gameState.currentTurn].alive) {
          const total = room.players.length;
          for (let i = 1; i <= total; i++) {
            const nextIdx = (room.gameState.currentTurn + i) % total;
            const nextPlayer = room.players[nextIdx];
            if (nextPlayer && nextPlayer.alive && nextPlayer.tokens > 0) {
              room.gameState.currentTurn = nextIdx;
              break;
            }
          }
        }
      } else {
        console.warn("Corner reached but player not found:", cornerKey);
        io.to(roomId).emit("boomTriggered", {
          playerName: "Unknown (unassigned corner)",
        });
      }
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
    io.in(roomId)
      .allSockets()
      .then((sockets) => {
        console.log(`Sockets in ${roomId}:`, [...sockets]);
      });

    console.log(`[SERVER] About to emit gameUpdate to room ${roomId}`);
    console.log("Board state now:", JSON.stringify(room.board));
    console.log("Players now:", JSON.stringify(room.players));

    io.to(roomId).emit("gameUpdate", {
      board: room.board,
      players: room.players,
      currentTurn: room.gameState.currentTurn,
    });
    console.log(`[SERVER] Emitted gameUpdate to room ${roomId}`);

    io.in(roomId)
      .allSockets()
      .then((sockets) => {
        console.log(`[DEBUG] Emitted gameUpdate to room ${roomId} with sockets:`, [...sockets]);
      });

    console.log(`[DEBUG] gameUpdate sent – currentTurn: ${room.gameState.currentTurn}`);

    // --- WIN CONDITION: If only one alive player remains, end the game ---
    const alivePlayers = room.players.filter(p => p.alive);
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];
      io.to(roomId).emit("gameOver", { winner: winner.name, avatar: winner.avatar });
      return; // Stop further processing
    }

    // Check for end-of-round conditions
    const allPlayersHaveZeroTokens = room.players.every(p => p.tokens === 0);
    const noPlayerDied = !cornerReached;

    if ((noPlayerDied && allPlayersHaveZeroTokens) || (cornerReached && allPlayersHaveZeroTokens)) {
      console.log(`[SERVER] Board round ended for room ${roomId}`);
      io.to(roomId).emit("boardRoundEnd", {
        board: room.board,
        players: room.players,
      });
      startGameLoop(roomId);
    }
  });

  socket.on("leaveRoom", ({ roomId, username }) => {
    const room = activeRooms.get(roomId);
    if (room) {
      room.removePlayer(username);
      socket.leave(roomId);
      if (room.players.length === 0) {
        activeRooms.delete(roomId);
      } else {
        io.to(roomId).emit("playerLeft", {
          username,
          players: room.players,
        });
      }
    }
  });

  socket.on("mg1JoinGame", (roomId) => {
    const room = activeRooms.get(roomId);
    console.log(
      `[SERVER] mg1JoinGame called by socket ${socket.id} for room ${roomId}`
    );

    if (!room) return;
    console.log(
      `[SERVER] Room ${roomId} players:`,
      room.players.map((p) => p.name)
    );

    socket.join(roomId);
    // if (!mg1Obstacles.has(roomId)) {
    //     mg1Obstacles.set(roomId, generateObstacleSet());
    // }
    if (!mg1Obstacles.has(roomId) || !Array.isArray(mg1Obstacles.get(roomId))) {
      console.log(`[SERVER] Generating new obstacles for ${roomId}`);
      mg1Obstacles.set(roomId, generateObstacleSet());
    }

    const playerNames = room.players.map((p) => p.name);
    socket.emit("mg1Init", {
      obstacles: mg1Obstacles.get(roomId),
      players: playerNames,
    });
  });

  socket.on(
    "mg1PlayerMove",
    ({ roomId, username, x, y, direction, moving }) => {
      // console.log(`[SERVER] mg1PlayerMove from ${username} in ${roomId}: (${x}, ${y}), dir=${direction}, moving=${moving}`);

      // Emit to ALL players in room INCLUDING the one who moved
      io.to(roomId).emit("mg1PlayerMoved", {
        username,
        x,
        y,
        direction,
        moving,
      });

      // console.log(`[SERVER] Broadcasting mg1PlayerMoved for ${username} to ALL clients in room ${roomId}`);
    }
  );

  socket.on("mg1PlayerHit", ({ roomId, username }) => {
    console.log(`[SERVER] ${username} was hit in minigame1`);
    io.to(roomId).emit("mg1PlayerEliminated", { username });
  });

  socket.on("mg1PlayerFinished", ({ roomId, username }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    if (!mg1FinishOrders.has(roomId)) {
      mg1FinishOrders.set(roomId, []);
    }

    const order = mg1FinishOrders.get(roomId);
    if (order.includes(username)) return;

    order.push(username);
    console.log(`[RANKING] ${username} finished in position ${order.length}`);

    // Only start the timer after the FIRST player finishes
    if (order.length === 1) {
      io.to(roomId).emit("mg1StartTimer", {
        duration: TIME_OUT_DURATION,
        startTime: Date.now(),
      });

      const timer = setTimeout(() => {
        finishMinigame(roomId, order, room); // End after timer
      }, TIME_OUT_DURATION * 1000); // Convert seconds to milliseconds

      mg1FinishTimers.set(roomId, timer);
    }

    // If all players finished before timeout, end early (use all players, not just alive)
    if (order.length === room.players.length) {
      clearTimeout(mg1FinishTimers.get(roomId));
      finishMinigame(roomId, order, room); // Early finish path
    }
  });

  socket.on("resultsSeen", ({ roomId, username }) => {
    if (!readyForResultsMap.has(roomId)) {
      readyForResultsMap.set(roomId, new Set());
    }
    const set = readyForResultsMap.get(roomId);
    set.add(username);
    const room = activeRooms.get(roomId);
    const alivePlayers = room?.players.filter(p => p.alive) || [];
    
    if (set.size === alivePlayers.length) {
      // All alive players have seen results, transition to board
      console.log(`[SERVER] All players have seen results, transitioning to board for room ${roomId}`);

      // --- FIX: Update player tokens for new board round ---
      if (room && room._tileRewards) {
        room.players.forEach(player => {
          const reward = room._tileRewards[player.name];
          player.tokens = reward ?? 0;
          player.initialTiles = reward ?? 0;
        });
      }
      // -----------------------------------------------------

      io.to(roomId).emit("transitionToMainBoard");
      readyForResultsMap.delete(roomId);
    }
  });

  socket.on("boardRoundEndAck", ({ roomId }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    // Check if only one player is alive
    const alivePlayers = room.players.filter(p => p.alive);
    if (alivePlayers.length === 1) {
      io.to(roomId).emit("gameOver", { winner: alivePlayers[0].name });
      return;
    }
    // Otherwise, start the next round with tutorial
    io.to(roomId).emit("transitionToTutorial", { minigame: "minigame1" });
  });

  socket.on("tutorialComplete", ({ roomId }) => {
    console.log(`[SERVER] Tutorial completed for room ${roomId}`);
    // Transition to minigame1 after tutorial
    io.to(roomId).emit("transitionToMinigame", { minigame: "minigame1" });
  });

  socket.on("disconnect", () => {
    const roomId = socketToRoomMap.get(socket.id);
    socketToRoomMap.delete(socket.id);
    console.log("User disconnected:", socket.id);

    // Handle disconnect during minigame
    if (roomId && mg1FinishOrders.has(roomId)) {
      const room = activeRooms.get(roomId);
      if (room) {
        // Find the username for this socket
        const player = room.players.find(p => p.socketId === socket.id);
        if (player && player.alive) {
          // If no one has finished yet, just mark as eliminated
          const order = mg1FinishOrders.get(roomId);
          if (order.length === 0) {
            player.alive = false;
            console.log(`[DISCONNECT] Marked ${player.name} as eliminated (disconnect before finish)`);
          } else {
            // If at least one has finished, mark as finished in last place
            if (!order.includes(player.name)) {
              order.push(player.name);
              console.log(`[DISCONNECT] Marked ${player.name} as finished (disconnect)`);
              // If all players finished, end minigame
              if (order.length === room.players.filter(p => p.alive).length) {
                clearTimeout(mg1FinishTimers.get(roomId));
                finishMinigame(roomId, order, room);
              }
            }
          }
        }
      }
    }
  });
});

// --- MINIGAME1 OBSTACLE BROADCAST LOOP ---
// Broadcast obstacle updates every 60ms
setInterval(() => {
  for (const [roomId, obsList] of mg1Obstacles.entries()) {
    obsList.forEach((obs) => {
      if (obs.direction === "down") {
        obs.y += obs.speed;
        if (obs.y > CANVAS_HEIGHT) obs.y = -OBSTACLE_HEIGHT;
      } else {
        obs.y -= obs.speed;
        if (obs.y < -OBSTACLE_HEIGHT) obs.y = CANVAS_HEIGHT;
      }
    });
    io.to(roomId).emit("mg1ObstaclesUpdate", { obstacles: obsList });
    // console.log(`[SERVER] Sent mg1ObstaclesUpdate to ${roomId} with ${obsList.length} obstacles`);
  }
}, 60);

app.get("/api/rooms", (req, res) => {
  res.json(Array.from(activeRooms.keys()));
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = activeRooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({
    roomId: room.roomId,
    players: room.players,
    gameState: room.gameState,
  });
});

app.get("/api/rooms/:roomId/players", (req, res) => {
  const room = activeRooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json(room.players);
});

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "docs")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "docs", "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
