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
    const pigeon = {
        name, // <-- attach username
        walkRight: loadSpriteSheet(`minigame1_PIGEON_ASSETS_PNG/WALK/WALK_RIGHT/Pigeon${idx + 1}.png`),
        walkLeft: loadSpriteSheet(`minigame1_PIGEON_ASSETS_PNG/WALK/WALK_LEFT/Pigeon${idx + 1}.png`),
        idle: loadSpriteSheet(`minigame1_PIGEON_ASSETS_PNG/IDLE/PIGEON_FRONT/Pigeon${idx + 1}.png`),
        x: 50,
        y: (idx + 0.5) * (CANVAS_HEIGHT / 4) - 32,
        width: 64,
        height: 64,
        direction: 'right',
        moving: false,
        frame: 0,
        frameTick: 0
    };
    pigeons.push(pigeon);
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
socket.emit('mg1JoinGame', roomId);

let myPlayerIndex = null;

socket.on('mg1Init', ({ obstacles: initialObs, players }) => {
    obstacles = initialObs;
    
    players.forEach((name, idx) => {
        createPigeon(idx, name); // pass name here
        if (name === myUsername) {
            myPlayerIndex = idx;
        }
    });

    console.log(`[DEBUG] My index: ${myPlayerIndex}`);
});

socket.on('mg1ObstaclesUpdate', ({ obstacles: updatedObs }) => {
    obstacles = updatedObs;
    console.log(`[DEBUG] Received mg1ObstaclesUpdate: ${obstacles.length} obstacles`);
});

socket.on('mg1PlayerMoved', ({ username, x, y, direction, moving }) => {
    console.log(`[DEBUG] RECEIVED movement for ${username}: (${x}, ${y})`);

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
    if (myPlayerIndex !== null && pigeons[myPlayerIndex]) {
        const p = pigeons[myPlayerIndex];
        p.moving = false;

        if (keys['ArrowRight']) { p.x += 2; p.direction = 'right'; p.moving = true; }
        if (keys['ArrowLeft'])  { p.x -= 2; p.direction = 'left'; p.moving = true; }
        if (keys['ArrowUp'])    { p.y -= 2; p.moving = true; }
        if (keys['ArrowDown'])  { p.y += 2; p.moving = true; }

        // Clamp to canvas
        p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
        p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));
    }
    if (myPlayerIndex !== null) {
        const p = pigeons[myPlayerIndex];
        socket.emit('mg1PlayerMove', {
            roomId,
            username: myUsername,
            x: p.x,
            y: p.y,
            direction: p.direction,
            moving: p.moving
        });
        console.log(`[DEBUG] Sent mg1PlayerMove: ${myUsername} (${p.x}, ${p.y}) ${p.direction} ${p.moving}`);
    }
}


// --- MAIN LOOP ---
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

window.onload = () => {
    gameLoop();
};