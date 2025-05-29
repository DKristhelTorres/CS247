// --- CONFIG ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const myUsername = localStorage.getItem('username');

const SERVER_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://cs247.onrender.com';

const socket = io(SERVER_URL);
const roomId = localStorage.getItem('roomPassword');
// const sidebar = document.getElementById('playerSidebar');


// Load background image
const backgroundImage = new Image();
backgroundImage.src = 'minigame1_street.png';

// --- OBSTACLE STATE ---
let obstacles = [];

const pigeons = [];
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);


const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 16;

// Load car sprites
function loadSprite(path) {
    const img = new Image();
    img.src = path;
    img.style = 'image-rendering: pixelated';
    return img;
}

function loadSpriteSheet(path) {
    const img = new Image();
    img.src = path;
    img.style = 'image-rendering: pixelated';
    img.onerror = () => {
        console.error(`Failed to load sprite: ${path}`);
    };
    return img;
}

function createPigeon(idx, name) {
    if (pigeons.find(p => p.name === name)) return; 
    const spawnY = (idx + 0.5) * (CANVAS_HEIGHT / 4) - 32;
    const pigeon = {
        name, // <-- attach username
        walkRight: loadSpriteSheet(`minigame1_PIGEON_ASSETS_PNG/WALK/WALK_RIGHT/Pigeon${idx + 1}.png`),
        walkLeft: loadSpriteSheet(`minigame1_PIGEON_ASSETS_PNG/WALK/WALK_LEFT/Pigeon${idx + 1}.png`),
        idle: loadSpriteSheet(`minigame1_PIGEON_ASSETS_PNG/IDLE/PIGEON_FRONT/Pigeon${idx + 1}.png`),
        x: 50,
        y: spawnY,
        spawnX: 50,        
        spawnY: spawnY,    
        width: 64,
        height: 64,
        direction: 'right',
        moving: false,
        frame: 0,
        frameTick: 0,
        hasFinished: false,
    };
    pigeons.push(pigeon);
}

function renderSidebar(players) {
    sidebar.innerHTML = ''; // Clear old entries
    players.forEach((name, idx) => {
        const card = document.createElement('div');
        card.className = 'player-card';
        const avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.src = `../images/Player${idx + 1}.png`; // Adjust path if needed

        const label = document.createElement('div');
        label.textContent = name;
        label.style.textAlign = 'center';

        card.appendChild(avatar);
        card.appendChild(label);
        sidebar.appendChild(card);
    });
}

function updatePlayerList(players) {
    // const container = document.getElementById('player-list');
    const container = document.getElementById('playerSidebar'); 
    container.innerHTML = '';
    players.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.style.backgroundColor = p.color || '#444';

        const avatar = document.createElement('img');
        avatar.src = `../images/${p.avatar || 'Player1.png'}`;
        avatar.alt = p.name;
        avatar.className = 'player-avatar';

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = p.name;

        const info = document.createElement('div');
        info.className = 'player-info';
        info.textContent = 'Alive'; // or tokens if available

        card.appendChild(avatar);
        card.appendChild(name);
        card.appendChild(info);
        container.appendChild(card);
    });
}




const carSprites = {
    police: {
        down: loadSprite('minigame1_CAR_ASSETS_PNG/Police_DOWN.png'),
        up: loadSprite('minigame1_CAR_ASSETS_PNG/Police_UP.png')
    },
    red: {
        down: loadSprite('minigame1_CAR_ASSETS_PNG/Red_DOWN.png'),
        up: loadSprite('minigame1_CAR_ASSETS_PNG/Red_UP.png')
    },
    brown: {
        down: loadSprite('minigame1_CAR_ASSETS_PNG/Brown_DOWN.png'),
        up: loadSprite('minigame1_CAR_ASSETS_PNG/Brown_UP.png')
    }
};

// --- SOCKET SETUP ---
// socket.emit('mg1JoinGame', roomId);

let myPlayerIndex = null;

// socket.on('mg1Init', ({ obstacles: initialObs, players }) => {
//     obstacles = initialObs;
    
//     players.forEach((name, idx) => {
//         createPigeon(idx, name); // pass name here
//         if (name === myUsername) {
//             myPlayerIndex = idx;
//         }
//     });

//     console.log(`[DEBUG] My index: ${myPlayerIndex}`);
//     updatePlayerList(players.map((name, idx) => ({
//         name,
//         avatar: `Player${(idx + 1)}.png`,
//         color: ['#e74c3c', '#8e44ad', '#27ae60', '#f1c40f'][idx % 4]
//     })));
//     renderSidebar(players);

// });

socket.on('mg1ObstaclesUpdate', ({ obstacles: updatedObs }) => {
    obstacles = updatedObs;
    // console.log(`[DEBUG] Received mg1ObstaclesUpdate: ${obstacles.length} obstacles`);
});

socket.on('mg1PlayerMoved', ({ username, x, y, direction, moving }) => {
    // console.log(`[DEBUG] RECEIVED movement for ${username}: (${x}, ${y})`);

    let p = pigeons.find(p => p.name === username);
    if (!p && username !== myUsername) {
        const idx = pigeons.length;
        console.log(`[DEBUG] Creating pigeon for new remote player: ${username}`);
        createPigeon(idx, username);
        p = pigeons[pigeons.length - 1];
    }

    if (p) {
        p.x = x;
        p.y = y;
        p.direction = direction;
        p.moving = moving;
    } else {
        console.warn(`[WARN] Could not find or create pigeon for: ${username}`);
    }
});

socket.on('mg1PlayerEliminated', ({ username }) => {
    console.log(`[DEBUG] Resetting pigeon: ${username}`);
    const p = pigeons.find(p => p.name === username);
    if (p) {
        p.x = 50;
        p.y = (pigeons.indexOf(p) + 0.5) * (CANVAS_HEIGHT / 4) - 32;
        p.moving = false;
        p.frame = 0;
        p.frameTick = 0;
    } else {
        console.warn(`[WARN] Could not reset pigeon for: ${username}`);
    }
});

socket.on('mg1Results', ({ finishOrder, tileRewards }) => {
    alert(`🏁 Final Results:\n` +
        finishOrder.map((name, i) => `${i + 1}. ${name} (+${tileRewards[name]} tiles)`).join('\n'));
    // Optionally: save to localStorage to use later in board game
    localStorage.setItem('mg1_tileRewards', JSON.stringify(tileRewards));
});


socket.on('mg1StartTimer', ({ duration }) => {
    let timeLeft = duration;

    // Clean up any existing timer
    let existingTimer = document.getElementById('countdownTimer');
    if (existingTimer) {
        existingTimer.remove();
    }

    const timerDiv = document.createElement('div');
    timerDiv.id = 'countdownTimer';
    timerDiv.style.position = 'absolute';
    timerDiv.style.top = '20px';
    timerDiv.style.right = '20px';
    timerDiv.style.fontSize = '24px';
    timerDiv.style.color = 'white';
    timerDiv.style.background = 'rgba(0,0,0,0.5)';
    timerDiv.style.padding = '10px 16px';
    timerDiv.style.borderRadius = '8px';
    timerDiv.style.fontWeight = 'bold';

    timerDiv.textContent = `Time left: ${timeLeft}s`;
    document.body.appendChild(timerDiv);

    const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft >= 0) {
            timerDiv.textContent = `Time left: ${timeLeft}s`;
        } else {
            clearInterval(interval);
            timerDiv.remove();
        }
    }, 1000);
});



// --- DRAWING ---
function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    obstacles.forEach(obs => {
        let carType = obs.color === 'yellow' ? 'police'
                    : obs.color === '#ff5252' ? 'red'
                    : 'brown';
        const sprite = carSprites[carType][obs.direction];

        const drawW = 80;
        const drawH = 60;
        const drawX = obs.x + (obs.width - drawW) / 2;
        const drawY = obs.y + (obs.height - drawH) / 2;

        ctx.imageSmoothingEnabled = false;
        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            if (carType === 'police') {
                const frame = Math.floor(Date.now() / 100) % 4;
                ctx.drawImage(
                    sprite,
                    frame * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT,
                    drawX, drawY, drawW, drawH
                );
            } else {
                ctx.drawImage(
                    sprite,
                    0, 0, FRAME_WIDTH, FRAME_HEIGHT,
                    drawX, drawY, drawW, drawH
                );
            }
        } else {
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
        ctx.imageSmoothingEnabled = true;
    });
    drawPigeons();
}

function drawPigeons() {
    pigeons.forEach(p => {
        let sheet, frames;
        if (p.moving) {
            sheet = p.direction === 'left' ? p.walkLeft : p.walkRight;
            frames = 4;
        } else {
            sheet = p.idle;
            frames = 4;
        }

        p.frameTick++;
        if (p.frameTick >= 8) {
            p.frame = (p.frame + 1) % frames;
            p.frameTick = 0;
        }

        ctx.drawImage(
            sheet,
            p.frame * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT,
            p.x, p.y, p.width, p.height
        );
    });
}


function update() {
    let p = null;

    if (myPlayerIndex !== null && pigeons[myPlayerIndex]) {
        p = pigeons[myPlayerIndex];
        p.moving = false;

        if (keys['ArrowRight']) { p.x += 2; p.direction = 'right'; p.moving = true; }
        if (keys['ArrowLeft'])  { p.x -= 2; p.direction = 'left'; p.moving = true; }
        if (keys['ArrowUp'])    { p.y -= 2; p.moving = true; }
        if (keys['ArrowDown'])  { p.y += 2; p.moving = true; }

        // Clamp to canvas
        p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
        p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));
        
        // Emit movement
        socket.emit('mg1PlayerMove', {
            roomId,
            username: myUsername,
            x: p.x,
            y: p.y,
            direction: p.direction,
            moving: p.moving
        });

        // Check collision with each obstacle
        for (let obs of obstacles) {
            if (checkCollision(p, obs)) {
                console.log(`[COLLISION] ${myUsername} hit by car!`);
                socket.emit('mg1PlayerHit', { roomId, username: myUsername });
                break;
            }
        }

        if (!p.hasFinished && p.x + p.width >= CANVAS_WIDTH - 10) {
            p.hasFinished = true;
            const finishedAt = Date.now(); // Record finish time
            console.log(`[DEBUG] ${myUsername} finished at ${finishedAt}`);
            socket.emit('mg1PlayerFinished', { roomId, username: myUsername, finishedAt });
            console.log(`[DEBUG] ${myUsername} finished the race!`);
        }
    }
}


function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// --- MAIN LOOP ---
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}
let sidebar;

window.onload = () => {
    sidebar = document.getElementById('playerSidebar'); // ✅ DOM is ready now

    socket.emit('mg1JoinGame', roomId);
    socket.on('mg1Init', ({ obstacles: initialObs, players }) => {
        obstacles = initialObs;
        
        players.forEach((name, idx) => {
            createPigeon(idx, name);
            if (name === myUsername) {
                myPlayerIndex = idx;
            }
        });

        console.log(`[DEBUG] My index: ${myPlayerIndex}`);
        updatePlayerList(players.map((name, idx) => ({
            name,
            avatar: `Player${(idx + 1)}.png`,
            color: ['#e74c3c', '#8e44ad', '#27ae60', '#f1c40f'][idx % 4]
        })));
        renderSidebar(players);
    });

    gameLoop();
};