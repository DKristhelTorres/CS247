// // --- CONFIG ---
// const canvas = document.getElementById("gameCanvas");
// const ctx = canvas.getContext("2d");
// const CANVAS_WIDTH = canvas.width;
// const CANVAS_HEIGHT = canvas.height;
// const myUsername = localStorage.getItem("username");

// const SERVER_URL =
//   window.location.hostname === "localhost"
//     ? "http://localhost:3000"
//     : "https://cs247.onrender.com";

// const socket = io(SERVER_URL);
// const roomId = localStorage.getItem("roomPassword");
// // const sidebar = document.getElementById('playerSidebar');

// // Load background image
// const backgroundImage = new Image();
// backgroundImage.src = "minigame1_street.png";

// // --- OBSTACLE STATE ---
// let obstacles = [];

// // --- GAME STATE ---
// const pigeons = [];
// let keys = {};
// let myPlayerIndex = null;
// let initialized = false;
// let gameEnded = false;

// const PLAYER_SPEED = 2; // Standardized speed for all players

// document.addEventListener("keydown", (e) => (keys[e.key] = true));
// document.addEventListener("keyup", (e) => (keys[e.key] = false));

// const FRAME_WIDTH = 16;
// const FRAME_HEIGHT = 16;

// // Load car sprites
// function loadSprite(path) {
//   const img = new Image();
//   img.src = path;
//   img.style = "image-rendering: pixelated";
//   return img;
// }

// function loadSpriteSheet(path) {
//   const img = new Image();
//   img.src = path;
//   img.style = "image-rendering: pixelated";
//   img.onerror = () => {
//     console.error(`Failed to load sprite: ${path}`);
//   };
//   return img;
// }

// // --- FACTORY: pigeons ---
// function createPigeon(idx, name) {
//   // avoid dupes
//   if (pigeons.find((p) => p.name === name)) return;
//   const spawnY = (idx + 0.5) * (CANVAS_HEIGHT / 4) - 32;
//   pigeons.push({
//     name,
//     x: 50,
//     y: spawnY,
//     spawnX: 50,
//     spawnY,
//     width: 64,
//     height: 64,
//     direction: "right",
//     moving: false,
//     frame: 0,
//     frameTick: 0,
//     hasFinished: false,
//     walkRight: loadSpriteSheet(
//       `minigame1_PIGEON_ASSETS_PNG/WALK/WALK_RIGHT/Pigeon${idx + 1}.png`
//     ),
//     walkLeft: loadSpriteSheet(
//       `minigame1_PIGEON_ASSETS_PNG/WALK/WALK_LEFT/Pigeon${idx + 1}.png`
//     ),
//     idle: loadSpriteSheet(
//       `minigame1_PIGEON_ASSETS_PNG/IDLE/PIGEON_FRONT/Pigeon${idx + 1}.png`
//     ),
//   });
// }

// // --- SIDEBAR HELPERS ---
// let sidebar;
// function renderSidebar(players) {
//   sidebar.innerHTML = ""; // Clear old entries
//   players.forEach((p) => {
//     const card = document.createElement("div");
//     card.className = "player-card";
//     card.style.backgroundColor = p.color;

//     // Dim dead players
//     if (!p.alive) {
//       card.style.filter = "grayscale(0.8) brightness(0.6)";
//       card.style.opacity = "0.7";
//     }

//     const avatar = document.createElement("img");
//     avatar.className = "player-avatar";
//     avatar.src = `../images/${p.avatar}`;

//     const name = document.createElement("div");
//     name.className = "player-name";
//     name.textContent = p.name;

//     const status = document.createElement("div");
//     status.className = "player-info";
//     status.textContent = p.alive ? "Alive" : "💀 Dead";
//     status.style.fontSize = "12px";
//     status.style.color = p.alive ? "#4ecdc4" : "#ff6b6b";

//     card.append(avatar, name, status);
//     sidebar.appendChild(card);
//   });
// }

// function updatePlayerList(rawPlayers) {
//   const decorated = rawPlayers.map((name, i) => ({
//     name,
//     avatar: `Player${i + 1}.png`,
//     color: ["#e74c3c", "#8e44ad", "#27ae60", "#f1c40f"][i % 4],
//   }));
//   renderSidebar(decorated);
// }

// // --- SPRITES: cars ---
// const carSprites = {
//   police: {
//     down: loadSprite("minigame1_CAR_ASSETS_PNG/Police_DOWN.png"),
//     up: loadSprite("minigame1_CAR_ASSETS_PNG/Police_UP.png"),
//   },
//   red: {
//     down: loadSprite("minigame1_CAR_ASSETS_PNG/Red_DOWN.png"),
//     up: loadSprite("minigame1_CAR_ASSETS_PNG/Red_UP.png"),
//   },
//   brown: {
//     down: loadSprite("minigame1_CAR_ASSETS_PNG/Brown_DOWN.png"),
//     up: loadSprite("minigame1_CAR_ASSETS_PNG/Brown_UP.png"),
//   },
// };

// // --- NETWORK: event handlers ---
// socket.on("mg1ObstaclesUpdate", ({ obstacles: updatedObs }) => {
//   obstacles = updatedObs;
// });

// socket.on("mg1PlayerMoved", ({ username, x, y, direction, moving }) => {
//   if (!initialized) return; // ignore until after init
//   const p = pigeons.find((p) => p.name === username);
//   if (p) {
//     p.x = x;
//     p.y = y;
//     p.direction = direction;
//     p.moving = moving;
//   }
//   // if no p found, we silently ignore (avoid dynamic spawns)
// });

// socket.on("mg1PlayerEliminated", ({ username }) => {
//   const p = pigeons.find((p) => p.name === username);
//   if (p) {
//     p.x = p.spawnX;
//     p.y = p.spawnY;
//     p.moving = false;
//     p.frame = p.frameTick = 0;
//   }
// });

// socket.on("mg1PlayerFinished", ({ roomId, username }) => {
//   const p = pigeons.find((p) => p.name === username);
//   if (p) {
//     p.hasFinished = true;
//     p.finishTime = Date.now();
//   }
// });

// socket.on("mg1Results", ({ finishOrder, tileRewards }) => {
//   if (gameEnded) return; // Prevent multiple transitions
//   gameEnded = true;

//   // Store ONLY the server's results
//   localStorage.setItem(
//     "mg1Results",
//     JSON.stringify({
//       finishOrder,
//       tileRewards,
//     })
//   );

//   // Navigate to results page
//   window.location.href = "../mg-results.html";
// });

// socket.on("mg1StartTimer", ({ duration }) => {
//   let timeLeft = duration;
//   const existingTimer = document.getElementById("countdownTimer");
//   if (existingTimer) existingTimer.remove();

//   const timerDiv = document.createElement("div");
//   timerDiv.id = "countdownTimer";
//   Object.assign(timerDiv.style, {
//     position: "absolute",
//     top: "20px",
//     right: "20px",
//     fontSize: "24px",
//     color: "white",
//     background: "rgba(0,0,0,0.5)",
//     padding: "10px 16px",
//     borderRadius: "8px",
//     fontWeight: "bold",
//   });
//   document.body.append(timerDiv);

//   const iv = setInterval(() => {
//     if (timeLeft >= 0) {
//       timerDiv.textContent = `Time left: ${timeLeft--}s`;
//     } else {
//       clearInterval(iv);
//       timerDiv.remove();
//     }
//   }, 1000);
// });

// socket.on("redirectToResults", () => {
//   window.location.href = "../mg-results.html";
// });

// socket.on("transitionToMainBoard", () => {
//   window.location.href = "../game-board.html";
// });

// // --- DRAWING ---
// function draw() {
//   ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
//   ctx.drawImage(backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

//   // draw cars
//   obstacles.forEach((obs) => {
//     let carType =
//       obs.color === "yellow"
//         ? "police"
//         : obs.color === "#ff5252"
//         ? "red"
//         : "brown";
//     const sprite = carSprites[carType][obs.direction];

//     const drawW = 80,
//       drawH = 60;
//     const drawX = obs.x + (obs.width - drawW) / 2,
//       drawY = obs.y + (obs.height - drawH) / 2;

//     ctx.imageSmoothingEnabled = false;
//     if (sprite && sprite.complete && sprite.naturalWidth > 0) {
//       if (carType === "police") {
//         const frame = Math.floor(Date.now() / 100) % 4;
//         ctx.drawImage(
//           sprite,
//           frame * FRAME_WIDTH,
//           0,
//           FRAME_WIDTH,
//           FRAME_HEIGHT,
//           drawX,
//           drawY,
//           drawW,
//           drawH
//         );
//       } else {
//         ctx.drawImage(
//           sprite,
//           0,
//           0,
//           FRAME_WIDTH,
//           FRAME_HEIGHT,
//           drawX,
//           drawY,
//           drawW,
//           drawH
//         );
//       }
//     } else {
//       ctx.fillStyle = obs.color;
//       ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
//     }
//     ctx.imageSmoothingEnabled = true;
//   });

//   // draw pigeons
//   pigeons.forEach((p) => {
//     const sheet = p.moving
//       ? p.direction === "left"
//         ? p.walkLeft
//         : p.walkRight
//       : p.idle;

//     if (++p.frameTick >= 8) {
//       p.frame = (p.frame + 1) % 4;
//       p.frameTick = 0;
//     }

//     ctx.drawImage(
//       sheet,
//       p.frame * FRAME_WIDTH,
//       0,
//       FRAME_WIDTH,
//       FRAME_HEIGHT,
//       p.x,
//       p.y,
//       p.width,
//       p.height
//     );
//   });
// }

// // --- UPDATE & EMIT ---
// let lastMoveEmit = 0;
// const MOVE_EMIT_INTERVAL = 33; // ms, ~30fps
// let lastUpdate = Date.now();
// const SPEED_PER_SEC = 120; // pixels per second
// function update() {
//   if (myPlayerIndex === null) return; // No control if dead/spectating
//   const p = pigeons[myPlayerIndex];
//   if (!p) return;

//   const now = Date.now();
//   const delta = Math.min((now - lastUpdate) / 1000, 0.05);
//   lastUpdate = now;

//   let moved = false;
//   if (keys["ArrowRight"] || keys["d"]) {
//     p.x += SPEED_PER_SEC * delta;
//     p.direction = "right";
//     moved = true;
//   }
//   if (keys["ArrowLeft"] || keys["a"]) {
//     p.x -= SPEED_PER_SEC * delta;
//     p.direction = "left";
//     moved = true;
//   }
//   if (keys["ArrowUp"] || keys["w"]) {
//     p.y -= SPEED_PER_SEC * delta;
//     moved = true;
//   }
//   if (keys["ArrowDown"] || keys["s"]) {
//     p.y += SPEED_PER_SEC * delta;
//     moved = true;
//   }
//   p.moving = moved;

//   p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
//   p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));

//   // Throttle movement emits to 30fps
//   const nowEmit = Date.now();
//   if (nowEmit - lastMoveEmit > MOVE_EMIT_INTERVAL) {
//     socket.emit("mg1PlayerMove", {
//       roomId,
//       username: myUsername,
//       x: p.x,
//       y: p.y,
//       direction: p.direction,
//       moving: p.moving,
//     });
//     lastMoveEmit = nowEmit;
//   }

//   // collisions
//   for (let obs of obstacles) {
//     if (checkCollision(p, obs)) {
//       socket.emit("mg1PlayerHit", { roomId, username: myUsername });
//       const hitSound = document.getElementById("pigeonHitSound");
//       if (hitSound) {
//         hitSound.currentTime = 0;
//         hitSound.play();
//       }
//       break;
//     }
//   }

//   // finish
//   if (!p.hasFinished && p.x + p.width >= CANVAS_WIDTH - 10) {
//     p.hasFinished = true;
//     socket.emit("mg1PlayerFinished", {
//       roomId,
//       username: myUsername,
//       finishedAt: Date.now(),
//     });
//     const crossedSound = document.getElementById("pigeonCrossedSound");
//     if (crossedSound) {
//       crossedSound.currentTime = 0;
//       crossedSound.play();
//     }
//   }
// }

// function checkCollision(a, b) {
//   return (
//     a.x < b.x + b.width &&
//     a.x + a.width > b.x &&
//     a.y < b.y + b.height &&
//     a.y + a.height > b.y
//   );
// }

// // --- MAIN LOOP & INIT ---
// function gameLoop() {
//   update();
//   draw();
//   requestAnimationFrame(gameLoop);
// }

// // function tryJoinMinigame() {
// //   const myName = localStorage.getItem("username");
// //   const players = JSON.parse(localStorage.getItem("lastPlayersState") || "[]");
// //   const me = players.find((p) => p.name === myName);
// //   if (me && !me.alive) {
// //     alert("You are eliminated and cannot join the minigame.");
// //     return;
// //   }
// //   // Proceed to join minigame
// //   socket.emit("mg1JoinGame", roomId);
// // }
// function tryJoinMinigame() {
//   const myName = localStorage.getItem("username");
//   const players = JSON.parse(localStorage.getItem("lastPlayersState") || "[]");
//   const me = players.find((p) => p.name === myName);

//   // Dead players can still join to spectate and see results
//   if (me && !me.alive) {
//     console.log(`[DEBUG] ${myName} is dead but joining as spectator`);
//     // Show spectator message
//     const spectatorDiv = document.createElement("div");
//     spectatorDiv.style.position = "absolute";
//     spectatorDiv.style.top = "20px";
//     spectatorDiv.style.left = "50%";
//     spectatorDiv.style.transform = "translateX(-50%)";
//     spectatorDiv.style.background = "rgba(0,0,0,0.8)";
//     spectatorDiv.style.color = "white";
//     spectatorDiv.style.padding = "16px 24px";
//     spectatorDiv.style.borderRadius = "8px";
//     spectatorDiv.style.fontSize = "18px";
//     spectatorDiv.style.fontWeight = "bold";
//     spectatorDiv.style.zIndex = "1000";
//     spectatorDiv.textContent = "👻 SPECTATING - You were eliminated";
//     document.body.appendChild(spectatorDiv);
//   }

//   // Always proceed to join (alive players play, dead players spectate)
//   socket.emit("mg1JoinGame", roomId);
// }

// window.onload = () => {
//   sidebar = document.getElementById("playerSidebar");

//   // Re-enable join & init
//   tryJoinMinigame();
//   socket.on(
//     "mg1Init",
//     ({ obstacles: initialObs, players, deadPlayers = [] }) => {
//       // load obstacles
//       obstacles = initialObs;

//       // clear & spawn pigeons
//       pigeons.length = 0;
//       myPlayerIndex = null;

//       // Only create pigeons for alive players
//       players.forEach((name, idx) => {
//         createPigeon(idx, name);
//         if (name === myUsername) {
//           myPlayerIndex = idx;
//         }
//       });

//       // Check if current user is dead
//       const isSpectator = deadPlayers.includes(myUsername);
//       if (isSpectator) {
//         myPlayerIndex = null; // Ensure no player control
//         console.log(`[DEBUG] ${myUsername} is spectating (dead)`);
//       }

//       // Create player list for sidebar including dead players with status
//       const allPlayers = JSON.parse(
//         localStorage.getItem("lastPlayersState") || "[]"
//       );
//       const decoratedPlayers = allPlayers.map((player, i) => ({
//         name: player.name,
//         avatar: player.avatar || `Player${i + 1}.png`,
//         color:
//           player.color || ["#e74c3c", "#8e44ad", "#27ae60", "#f1c40f"][i % 4],
//         alive: player.alive,
//       }));

//       renderSidebar(decoratedPlayers);

//       // now we can react to moves
//       initialized = true;
//       console.log(
//         `[DEBUG] Initialized: myPlayerIndex=${myPlayerIndex}, isSpectator=${isSpectator}`
//       );
//     }
//   );

//   // start the loop
//   gameLoop();
// };
// --- CONFIG ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const myUsername = localStorage.getItem("username");

const SERVER_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://cs247.onrender.com";

const socket = io(SERVER_URL);
const roomId = localStorage.getItem("roomPassword");

// Load background image
const backgroundImage = new Image();
backgroundImage.src = "minigame1_street.png";

// --- OBSTACLE STATE ---
let obstacles = [];

// --- GAME STATE ---
const pigeons = [];
let keys = {};
let myPlayerIndex = null;
let initialized = false;
let gameEnded = false;
let isSpectator = false;

const PLAYER_SPEED = 2; // Standardized speed for all players

document.addEventListener("keydown", (e) => (keys[e.key] = true));
document.addEventListener("keyup", (e) => (keys[e.key] = false));

const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 16;

// Load car sprites
function loadSprite(path) {
  const img = new Image();
  img.src = path;
  img.style = "image-rendering: pixelated";
  return img;
}

function loadSpriteSheet(path) {
  const img = new Image();
  img.src = path;
  img.style = "image-rendering: pixelated";
  img.onerror = () => {
    console.error(`Failed to load sprite: ${path}`);
  };
  return img;
}

// --- FACTORY: pigeons ---
function createPigeon(idx, name) {
  // avoid dupes
  if (pigeons.find((p) => p.name === name)) return;
  const spawnY = (idx + 0.5) * (CANVAS_HEIGHT / 4) - 32;
  pigeons.push({
    name,
    x: 50,
    y: spawnY,
    spawnX: 50,
    spawnY,
    width: 64,
    height: 64,
    direction: "right",
    moving: false,
    frame: 0,
    frameTick: 0,
    hasFinished: false,
    walkRight: loadSpriteSheet(
      `minigame1_PIGEON_ASSETS_PNG/WALK/WALK_RIGHT/Pigeon${idx + 1}.png`
    ),
    walkLeft: loadSpriteSheet(
      `minigame1_PIGEON_ASSETS_PNG/WALK/WALK_LEFT/Pigeon${idx + 1}.png`
    ),
    idle: loadSpriteSheet(
      `minigame1_PIGEON_ASSETS_PNG/IDLE/PIGEON_FRONT/Pigeon${idx + 1}.png`
    ),
  });
}

// --- SIDEBAR HELPERS ---
let sidebar;
function renderSidebar(players) {
  if (!sidebar) {
    sidebar = document.getElementById("playerSidebar");
    if (!sidebar) {
      console.warn("Sidebar element not found");
      return;
    }
  }

  sidebar.innerHTML = ""; // Clear old entries
  players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    card.style.backgroundColor = p.color;

    // Dim dead players
    if (p.alive === false) {
      card.style.filter = "grayscale(0.8) brightness(0.6)";
      card.style.opacity = "0.7";
    }

    const avatar = document.createElement("img");
    avatar.className = "player-avatar";
    avatar.src = `../images/${p.avatar}`;

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;

    const status = document.createElement("div");
    status.className = "player-info";
    status.textContent = p.alive !== false ? "Alive" : "💀 Dead";
    status.style.fontSize = "12px";
    status.style.color = p.alive !== false ? "#4ecdc4" : "#ff6b6b";

    card.append(avatar, name, status);
    sidebar.appendChild(card);
  });
}

function updatePlayerList(rawPlayers) {
  // Get full player data from localStorage if available
  const allPlayers = JSON.parse(
    localStorage.getItem("lastPlayersState") || "[]"
  );

  const decorated = rawPlayers.map((name, i) => {
    // Try to find the player in saved state first
    const savedPlayer = allPlayers.find((p) => p.name === name);
    if (savedPlayer) {
      return {
        name: savedPlayer.name,
        avatar: savedPlayer.avatar,
        color: savedPlayer.color,
        alive: savedPlayer.alive,
      };
    }
    // Fallback to defaults
    return {
      name,
      avatar: `Player${i + 1}.png`,
      color: ["#e74c3c", "#8e44ad", "#27ae60", "#f1c40f"][i % 4],
      alive: true,
    };
  });

  renderSidebar(decorated);
}

// --- SPRITES: cars ---
const carSprites = {
  police: {
    down: loadSprite("minigame1_CAR_ASSETS_PNG/Police_DOWN.png"),
    up: loadSprite("minigame1_CAR_ASSETS_PNG/Police_UP.png"),
  },
  red: {
    down: loadSprite("minigame1_CAR_ASSETS_PNG/Red_DOWN.png"),
    up: loadSprite("minigame1_CAR_ASSETS_PNG/Red_UP.png"),
  },
  brown: {
    down: loadSprite("minigame1_CAR_ASSETS_PNG/Brown_DOWN.png"),
    up: loadSprite("minigame1_CAR_ASSETS_PNG/Brown_UP.png"),
  },
};

// --- NETWORK: event handlers ---
socket.on("mg1ObstaclesUpdate", ({ obstacles: updatedObs }) => {
  obstacles = updatedObs;
});

socket.on("mg1PlayerMoved", ({ username, x, y, direction, moving }) => {
  if (!initialized) return; // ignore until after init
  const p = pigeons.find((p) => p.name === username);
  if (p) {
    p.x = x;
    p.y = y;
    p.direction = direction;
    p.moving = moving;
  }
});

socket.on("mg1PlayerEliminated", ({ username }) => {
  const p = pigeons.find((p) => p.name === username);
  if (p) {
    p.x = p.spawnX;
    p.y = p.spawnY;
    p.moving = false;
    p.frame = p.frameTick = 0;
  }
});

socket.on("mg1PlayerFinished", ({ roomId, username }) => {
  const p = pigeons.find((p) => p.name === username);
  if (p) {
    p.hasFinished = true;
    p.finishTime = Date.now();
  }
});

socket.on("mg1Results", ({ finishOrder, tileRewards }) => {
  if (gameEnded) return; // Prevent multiple transitions
  gameEnded = true;

  // Store ONLY the server's results
  localStorage.setItem(
    "mg1Results",
    JSON.stringify({
      finishOrder,
      tileRewards,
    })
  );

  // Navigate to results page
  window.location.href = "../mg-results.html";
});

socket.on("mg1StartTimer", ({ duration }) => {
  let timeLeft = duration;
  const existingTimer = document.getElementById("countdownTimer");
  if (existingTimer) existingTimer.remove();

  const timerDiv = document.createElement("div");
  timerDiv.id = "countdownTimer";
  Object.assign(timerDiv.style, {
    position: "absolute",
    top: "20px",
    right: "20px",
    fontSize: "24px",
    color: "white",
    background: "rgba(0,0,0,0.5)",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "bold",
  });
  document.body.append(timerDiv);

  const iv = setInterval(() => {
    if (timeLeft >= 0) {
      timerDiv.textContent = `Time left: ${timeLeft--}s`;
    } else {
      clearInterval(iv);
      timerDiv.remove();
    }
  }, 1000);
});

socket.on("redirectToResults", () => {
  window.location.href = "../mg-results.html";
});

socket.on("transitionToMainBoard", () => {
  window.location.href = "../game-board.html";
});

socket.on("syncPlayerState", ({ players, gameState }) => {
  console.log("[MINIGAME SYNC] Received updated player state:", players);

  // Update localStorage with fresh state
  localStorage.setItem("lastPlayersState", JSON.stringify(players));
  localStorage.setItem("gameState", JSON.stringify(gameState));
});

// --- DRAWING ---
function draw() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.drawImage(backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // draw cars
  obstacles.forEach((obs) => {
    let carType =
      obs.color === "yellow"
        ? "police"
        : obs.color === "#ff5252"
        ? "red"
        : "brown";
    const sprite = carSprites[carType][obs.direction];

    const drawW = 80,
      drawH = 60;
    const drawX = obs.x + (obs.width - drawW) / 2,
      drawY = obs.y + (obs.height - drawH) / 2;

    ctx.imageSmoothingEnabled = false;
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      if (carType === "police") {
        const frame = Math.floor(Date.now() / 100) % 4;
        ctx.drawImage(
          sprite,
          frame * FRAME_WIDTH,
          0,
          FRAME_WIDTH,
          FRAME_HEIGHT,
          drawX,
          drawY,
          drawW,
          drawH
        );
      } else {
        ctx.drawImage(
          sprite,
          0,
          0,
          FRAME_WIDTH,
          FRAME_HEIGHT,
          drawX,
          drawY,
          drawW,
          drawH
        );
      }
    } else {
      ctx.fillStyle = obs.color;
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
    ctx.imageSmoothingEnabled = true;
  });

  // draw pigeons
  pigeons.forEach((p) => {
    const sheet = p.moving
      ? p.direction === "left"
        ? p.walkLeft
        : p.walkRight
      : p.idle;

    if (++p.frameTick >= 8) {
      p.frame = (p.frame + 1) % 4;
      p.frameTick = 0;
    }

    ctx.drawImage(
      sheet,
      p.frame * FRAME_WIDTH,
      0,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      p.x,
      p.y,
      p.width,
      p.height
    );
  });
}

// --- UPDATE & EMIT ---
let lastMoveEmit = 0;
const MOVE_EMIT_INTERVAL = 33; // ms, ~30fps
let lastUpdate = Date.now();
const SPEED_PER_SEC = 120; // pixels per second
function update() {
  if (myPlayerIndex === null || isSpectator) return; // No control if dead/spectating
  const p = pigeons[myPlayerIndex];
  if (!p) return;

  const now = Date.now();
  const delta = Math.min((now - lastUpdate) / 1000, 0.05);
  lastUpdate = now;

  let moved = false;
  if (keys["ArrowRight"] || keys["d"]) {
    p.x += SPEED_PER_SEC * delta;
    p.direction = "right";
    moved = true;
  }
  if (keys["ArrowLeft"] || keys["a"]) {
    p.x -= SPEED_PER_SEC * delta;
    p.direction = "left";
    moved = true;
  }
  if (keys["ArrowUp"] || keys["w"]) {
    p.y -= SPEED_PER_SEC * delta;
    moved = true;
  }
  if (keys["ArrowDown"] || keys["s"]) {
    p.y += SPEED_PER_SEC * delta;
    moved = true;
  }
  p.moving = moved;

  p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
  p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));

  // Throttle movement emits to 30fps
  const nowEmit = Date.now();
  if (nowEmit - lastMoveEmit > MOVE_EMIT_INTERVAL) {
    socket.emit("mg1PlayerMove", {
      roomId,
      username: myUsername,
      x: p.x,
      y: p.y,
      direction: p.direction,
      moving: p.moving,
    });
    lastMoveEmit = nowEmit;
  }

  // collisions
  for (let obs of obstacles) {
    if (checkCollision(p, obs)) {
      socket.emit("mg1PlayerHit", { roomId, username: myUsername });
      const hitSound = document.getElementById("pigeonHitSound");
      if (hitSound) {
        hitSound.currentTime = 0;
        hitSound.play();
      }
      break;
    }
  }

  // finish
  if (!p.hasFinished && p.x + p.width >= CANVAS_WIDTH - 10) {
    p.hasFinished = true;
    socket.emit("mg1PlayerFinished", {
      roomId,
      username: myUsername,
      finishedAt: Date.now(),
    });
    const crossedSound = document.getElementById("pigeonCrossedSound");
    if (crossedSound) {
      crossedSound.currentTime = 0;
      crossedSound.play();
    }
  }
}

function checkCollision(a, b) {
  // how many pixels we want to “shrink” each side of the pigeon’s box:
  const pad = 16;

  // compute a smaller “effective” rectangle for pigeon a:
  const ax1 = a.x + pad;
  const ay1 = a.y + pad;
  const ax2 = a.x + a.width - pad;
  const ay2 = a.y + a.height - pad;

  // optionally, you can also shrink the car’s box by a smaller amount:
  const bPad = 4;
  const bx1 = b.x + bPad;
  const by1 = b.y + bPad;
  const bx2 = b.x + b.width - bPad;
  const by2 = b.y + b.height - bPad;

  // now do the standard AABB test on these shrunken rectangles:
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

// --- MAIN LOOP & INIT ---
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function tryJoinMinigame() {
  const myName = localStorage.getItem("username");

  // Wait a brief moment for any syncPlayerState to arrive
  setTimeout(() => {
    const players = JSON.parse(
      localStorage.getItem("lastPlayersState") || "[]"
    );
    const me = players.find((p) => p.name === myName);

    // Check if player is dead
    if (me && !me.alive) {
      console.log(`[DEBUG] ${myName} is dead but joining as spectator`);
      isSpectator = true;

      // Show spectator message
      const spectatorDiv = document.createElement("div");
      spectatorDiv.style.position = "absolute";
      spectatorDiv.style.top = "20px";
      spectatorDiv.style.left = "50%";
      spectatorDiv.style.transform = "translateX(-50%)";
      spectatorDiv.style.background = "rgba(0,0,0,0.8)";
      spectatorDiv.style.color = "white";
      spectatorDiv.style.padding = "16px 24px";
      spectatorDiv.style.borderRadius = "8px";
      spectatorDiv.style.fontSize = "18px";
      spectatorDiv.style.fontWeight = "bold";
      spectatorDiv.style.zIndex = "1000";
      spectatorDiv.textContent = "👻 SPECTATING - You were eliminated";
      document.body.appendChild(spectatorDiv);
    }

    // Always proceed to join (alive players play, dead players spectate)
    socket.emit("mg1JoinGame", roomId);
  }, 300); // Wait 300ms for any sync data
}

window.onload = () => {
  sidebar = document.getElementById("playerSidebar");

  // Re-enable join & init
  tryJoinMinigame();

  socket.on(
    "mg1Init",
    ({ obstacles: initialObs, players, deadPlayers = [] }) => {
      console.log("[DEBUG] mg1Init received:", { players, deadPlayers });

      // load obstacles
      obstacles = initialObs;

      // clear & spawn pigeons
      pigeons.length = 0;
      myPlayerIndex = null;

      // Create pigeons for alive players only
      players.forEach((name, idx) => {
        createPigeon(idx, name);
        if (name === myUsername && !isSpectator) {
          myPlayerIndex = idx;
        }
      });

      console.log(
        `[DEBUG] Created ${pigeons.length} pigeons for players:`,
        players
      );
      console.log(
        `[DEBUG] myPlayerIndex: ${myPlayerIndex}, isSpectator: ${isSpectator}`
      );

      // Get all players (alive and dead) for sidebar
      const allPlayers = JSON.parse(
        localStorage.getItem("lastPlayersState") || "[]"
      );

      // If we don't have saved state, create from available data
      if (allPlayers.length === 0) {
        const allPlayerNames = [...players, ...deadPlayers];
        allPlayerNames.forEach((name, i) => {
          allPlayers.push({
            name,
            avatar: `Player${i + 1}.png`,
            color: ["#e74c3c", "#8e44ad", "#27ae60", "#f1c40f"][i % 4],
            alive: !deadPlayers.includes(name),
          });
        });
      }

      // Update sidebar with all players
      renderSidebar(allPlayers);

      // now we can react to moves
      initialized = true;
      console.log(`[DEBUG] Initialization complete`);
    }
  );

  // start the loop
  gameLoop();
};
