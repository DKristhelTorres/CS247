// --- CONFIG ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Load background image
const backgroundImage = new Image();
backgroundImage.src = 'minigame1_street.png';

// --- OBSTACLE CONFIG ---
const lanes = 4;
const laneHeight = CANVAS_HEIGHT / lanes;
const obstacles = [];
const obstacleWidth = 40;
const obstacleHeight = 30;
const obstaclePositions = [
    CANVAS_WIDTH * 0.2,
    CANVAS_WIDTH * 0.4,
    CANVAS_WIDTH * 0.6,
    CANVAS_WIDTH * 0.8
];
const FAST_SPEED = 4.5;
const SLOW_SPEED = 2.5;
const OBSTACLES_PER_LANE = 2; // Number of obstacles per lane
const SIDE_OFFSET = 35; // Increased offset for more horizontal separation

function randomObstacleSpeed() {
    return 2 + Math.random() * 4;
}

function getObstacleColor(speed) {
    if (speed >= FAST_SPEED) return 'yellow';
    if (speed <= SLOW_SPEED) return 'blue';
    return '#ff5252';
}

function spawnObstacles() {
    obstacles.length = 0;
    for (let i = 0; i < lanes; i++) {
        const direction = i % 2 === 0 ? 'down' : 'up';
        // Create multiple obstacles for each lane
        for (let j = 0; j < OBSTACLES_PER_LANE; j++) {
            const speed = randomObstacleSpeed();
            const color = getObstacleColor(speed);
            // Offset the second obstacle to the side
            const x = obstaclePositions[i] - obstacleWidth / 2 + (j * SIDE_OFFSET);
            // Start at different vertical positions to prevent overlap
            const y = direction === 'down' 
                ? -obstacleHeight - (j * CANVAS_HEIGHT / 3) 
                : CANVAS_HEIGHT + (j * CANVAS_HEIGHT / 3);
            
            obstacles.push({ 
                x, 
                y, 
                width: obstacleWidth, 
                height: obstacleHeight, 
                speed, 
                color, 
                lane: i,
                direction 
            });
        }
    }
}

// --- PLAYER CONFIG ---
const playerStartPositions = [
    { x: 50, y: CANVAS_HEIGHT / 5 - 32 },
    { x: 50, y: 2 * CANVAS_HEIGHT / 5 - 32 },
    { x: 50, y: 3 * CANVAS_HEIGHT / 5 - 32 },
    { x: 50, y: 4 * CANVAS_HEIGHT / 5 - 32 }
];

// Add lane boundaries configuration
const laneBoundaries = [
    { minY: 0, maxY: CANVAS_HEIGHT / 4 },
    { minY: CANVAS_HEIGHT / 4, maxY: CANVAS_HEIGHT / 2 },
    { minY: CANVAS_HEIGHT / 2, maxY: 3 * CANVAS_HEIGHT / 4 },
    { minY: 3 * CANVAS_HEIGHT / 4, maxY: CANVAS_HEIGHT }
];

function makePlayer(idx) {
    return {
        x: playerStartPositions[idx].x,
        y: playerStartPositions[idx].y,
        width: 64,
        height: 64,
        speed: 2,
        frame: 0,
        frameTick: 0,
        frameTickMax: 8,
        direction: 'right',
        moving: false,
        finished: false,
        rank: null
    };
}
const player1 = makePlayer(0);
const player2 = makePlayer(1);
const player3 = makePlayer(2);
const player4 = makePlayer(3);

// --- GAME STATE ---
let gameState = 'playing';
let finishOrder = [];
let finishCountdown = null;
let finishCountdownStart = null;
const FINISH_TIME_LIMIT = 3000; // 3 seconds in ms

// --- INPUT ---
const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup', e => { keys[e.key] = false; });

// --- SPRITE SHEET ANIMATION CONFIG ---
const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 16;
const WALK_FRAMES = 4;
const IDLE_FRAMES = 4;
const ANIMATION_SPEED = 8;
function loadSpriteSheet(path) {
    const img = new Image();
    img.src = path;
    img.style = 'image-rendering: pixelated';
    img.onerror = () => {
        console.error(`Failed to load sprite: ${path}`);
    };
    return img;
}

// Load car sprites
const carSprites = {
    police: {
        down: loadSpriteSheet('minigame1_CAR_ASSETS_PNG/Police_DOWN.png'),
        up: loadSpriteSheet('minigame1_CAR_ASSETS_PNG/Police_UP.png')
    },
    red: {
        down: loadSpriteSheet('minigame1_CAR_ASSETS_PNG/Red_DOWN.png'),
        up: loadSpriteSheet('minigame1_CAR_ASSETS_PNG/Red_UP.png')
    },
    brown: {
        down: loadSpriteSheet('minigame1_CAR_ASSETS_PNG/Brown_DOWN.png'),
        up: loadSpriteSheet('minigame1_CAR_ASSETS_PNG/Brown_UP.png')
    }
};

const pigeons = [
    {
        walkRight: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/WALK/WALK_RIGHT/Pigeon1.png'),
        walkLeft: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/WALK/WALK_LEFT/Pigeon1.png'),
        idle: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/IDLE/PIGEON_FRONT/Pigeon1.png'),
        x: player1.x, y: player1.y, width: player1.width, height: player1.height, direction: 'right', moving: false, frame: 0, frameTick: 0
    },
    {
        walkRight: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/WALK/WALK_RIGHT/Pigeon2.png'),
        walkLeft: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/WALK/WALK_LEFT/Pigeon2.png'),
        idle: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/IDLE/PIGEON_FRONT/Pigeon2.png'),
        x: player2.x, y: player2.y, width: player2.width, height: player2.height, direction: 'right', moving: false, frame: 0, frameTick: 0
    },
    {
        walkRight: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/WALK/WALK_RIGHT/Pigeon3.png'),
        walkLeft: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/WALK/WALK_LEFT/Pigeon3.png'),
        idle: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/IDLE/PIGEON_FRONT/Pigeon3.png'),
        x: player3.x, y: player3.y, width: player3.width, height: player3.height, direction: 'right', moving: false, frame: 0, frameTick: 0
    },
    {
        walkRight: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/WALK/WALK_RIGHT/Pigeon4.png'),
        walkLeft: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/WALK/WALK_LEFT/Pigeon4.png'),
        idle: loadSpriteSheet('minigame1_PIGEON_ASSETS_PNG/IDLE/PIGEON_FRONT/Pigeon4.png'),
        x: player4.x, y: player4.y, width: player4.width, height: player4.height, direction: 'right', moving: false, frame: 0, frameTick: 0
    }
];
function syncPigeonStates() {
    pigeons[0].x = player1.x; pigeons[0].y = player1.y; pigeons[0].direction = player1.direction; pigeons[0].moving = player1.moving;
    pigeons[1].x = player2.x; pigeons[1].y = player2.y; pigeons[1].direction = player2.direction; pigeons[1].moving = player2.moving;
    pigeons[2].x = player3.x; pigeons[2].y = player3.y; pigeons[2].direction = player3.direction; pigeons[2].moving = player3.moving;
    pigeons[3].x = player4.x; pigeons[3].y = player4.y; pigeons[3].direction = player4.direction; pigeons[3].moving = player4.moving;
}
function drawPigeons() {
    for (let i = 0; i < pigeons.length; i++) {
        const p = pigeons[i];
        let sheet, frames;
        if (p.moving) {
            if (p.direction === 'left') {
                sheet = p.walkLeft;
            } else {
                sheet = p.walkRight;
            }
            frames = WALK_FRAMES;
        } else {
            sheet = p.idle;
            frames = IDLE_FRAMES;
        }
        p.frameTick++;
        if (p.frameTick >= ANIMATION_SPEED) {
            p.frame = (p.frame + 1) % frames;
            p.frameTick = 0;
        }
        ctx.drawImage(
            sheet,
            p.frame * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT,
            p.x, p.y, p.width, p.height
        );
    }
}

// --- DRAW MEDALS AND RANKS ---
function drawMedalsAndRanks() {
    const players = [player1, player2, player3, player4];
    players.forEach((p, i) => {
        if (p.rank === 1) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x + p.width / 2, p.y - 10, 8, 0, 2 * Math.PI);
            ctx.fillStyle = 'gold';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#b8860b';
            ctx.stroke();
            ctx.restore();
        }
        if (p.rank) {
            ctx.save();
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.fillText(p.rank, p.x + p.width / 2, p.y - 20);
            ctx.restore();
        }
    });
}

// --- GAME LOOP ---
function update() {
    player1.moving = false;
    player2.moving = false;
    player3.moving = false;
    player4.moving = false;
    if (gameState !== 'won') {
        if (!player1.finished && keys['d']) { player1.x += player1.speed; player1.direction = 'right'; player1.moving = true; }
        if (!player1.finished && keys['a']) { player1.x -= player1.speed; player1.direction = 'left'; player1.moving = true; }
        if (!player1.finished && keys['w']) { player1.y -= player1.speed; player1.moving = true; }
        if (!player1.finished && keys['s']) { player1.y += player1.speed; player1.moving = true; }
        if (!player2.finished && keys['ArrowRight']) { player2.x += player2.speed; player2.direction = 'right'; player2.moving = true; }
        if (!player2.finished && keys['ArrowLeft']) { player2.x -= player2.speed; player2.direction = 'left'; player2.moving = true; }
        if (!player2.finished && keys['ArrowUp']) { player2.y -= player2.speed; player2.moving = true; }
        if (!player2.finished && keys['ArrowDown']) { player2.y += player2.speed; player2.moving = true; }
        if (!player3.finished && keys['l']) { player3.x += player3.speed; player3.direction = 'right'; player3.moving = true; }
        if (!player3.finished && keys['j']) { player3.x -= player3.speed; player3.direction = 'left'; player3.moving = true; }
        if (!player3.finished && keys['i']) { player3.y -= player3.speed; player3.moving = true; }
        if (!player3.finished && keys['k']) { player3.y += player3.speed; player3.moving = true; }
        if (!player4.finished && keys['h']) { player4.x += player4.speed; player4.direction = 'right'; player4.moving = true; }
        if (!player4.finished && keys['f']) { player4.x -= player4.speed; player4.direction = 'left'; player4.moving = true; }
        if (!player4.finished && keys['t']) { player4.y -= player4.speed; player4.moving = true; }
        if (!player4.finished && keys['g']) { player4.y += player4.speed; player4.moving = true; }
    }
    player1.x = Math.max(0, Math.min(CANVAS_WIDTH - player1.width, player1.x));
    player1.y = Math.max(laneBoundaries[0].minY, Math.min(laneBoundaries[0].maxY - player1.height, player1.y));
    
    player2.x = Math.max(0, Math.min(CANVAS_WIDTH - player2.width, player2.x));
    player2.y = Math.max(laneBoundaries[1].minY, Math.min(laneBoundaries[1].maxY - player2.height, player2.y));
    
    player3.x = Math.max(0, Math.min(CANVAS_WIDTH - player3.width, player3.x));
    player3.y = Math.max(laneBoundaries[2].minY, Math.min(laneBoundaries[2].maxY - player3.height, player3.y));
    
    player4.x = Math.max(0, Math.min(CANVAS_WIDTH - player4.width, player4.x));
    player4.y = Math.max(laneBoundaries[3].minY, Math.min(laneBoundaries[3].maxY - player4.height, player4.y));
    for (const obs of obstacles) {
        // Move based on direction
        if (obs.direction === 'down') {
            obs.y += obs.speed;
            if (obs.y > CANVAS_HEIGHT) {
                obs.y = -obstacleHeight;
                obs.speed = randomObstacleSpeed();
                obs.color = getObstacleColor(obs.speed);
            }
        } else {
            obs.y -= obs.speed;
            if (obs.y < -obstacleHeight) {
                obs.y = CANVAS_HEIGHT;
                obs.speed = randomObstacleSpeed();
                obs.color = getObstacleColor(obs.speed);
            }
        }

        // Get player hitboxes
        const p1box = getPlayerHitbox(player1);
        const p2box = getPlayerHitbox(player2);
        const p3box = getPlayerHitbox(player3);
        const p4box = getPlayerHitbox(player4);
        // Get car hitbox
        const carBox = getCarHitbox(obs);

        // Check collisions with reduced car hitboxes
        if (!player1.finished && p1box.x < carBox.x + carBox.w && p1box.x + p1box.w > carBox.x && p1box.y < carBox.y + carBox.h && p1box.y + p1box.h > carBox.y) {
            player1.x = playerStartPositions[0].x;
            player1.y = playerStartPositions[0].y;
        }
        if (!player2.finished && p2box.x < carBox.x + carBox.w && p2box.x + p2box.w > carBox.x && p2box.y < carBox.y + carBox.h && p2box.y + p2box.h > carBox.y) {
            player2.x = playerStartPositions[1].x;
            player2.y = playerStartPositions[1].y;
        }
        if (!player3.finished && p3box.x < carBox.x + carBox.w && p3box.x + p3box.w > carBox.x && p3box.y < carBox.y + carBox.h && p3box.y + p3box.h > carBox.y) {
            player3.x = playerStartPositions[2].x;
            player3.y = playerStartPositions[2].y;
        }
        if (!player4.finished && p4box.x < carBox.x + carBox.w && p4box.x + p4box.w > carBox.x && p4box.y < carBox.y + carBox.h && p4box.y + p4box.h > carBox.y) {
            player4.x = playerStartPositions[3].x;
            player4.y = playerStartPositions[3].y;
        }
    }
    // Ranking logic
    let now = Date.now();
    function checkFinish(player, idx) {
        if (!player.finished && player.x + player.width >= CANVAS_WIDTH) {
            player.finished = true;
            finishOrder.push(idx);
            player.rank = finishOrder.length;
            if (finishOrder.length === 1) {
                finishCountdown = true;
                finishCountdownStart = now;
            }
        }
    }
    checkFinish(player1, 0);
    checkFinish(player2, 1);
    checkFinish(player3, 2);
    checkFinish(player4, 3);
    if (finishCountdown && now - finishCountdownStart > FINISH_TIME_LIMIT) {
        finishCountdown = false;
        [player1, player2, player3, player4].forEach(p => { if (!p.finished) p.rank = null; });
    }
    if ((player1.finished && player2.finished && player3.finished && player4.finished) || (finishCountdown === false && finishOrder.length > 0)) {
        gameState = 'won';
    }
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw background
    ctx.drawImage(backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw lane dividers
    /* Commented out to make lane borders invisible
    for (let i = 1; i < lanes; i++) {
        ctx.strokeStyle = '#b2dfdb';
        ctx.beginPath();
        ctx.moveTo(0, i * laneHeight);
        ctx.lineTo(CANVAS_WIDTH, i * laneHeight);
        ctx.stroke();
    }
    */

    // Draw obstacles (cars)
    for (const obs of obstacles) {
        let carType;
        if (obs.color === 'yellow') carType = 'police';
        else if (obs.color === '#ff5252') carType = 'red';
        else carType = 'brown';

        const sprite = carSprites[carType][obs.direction];
        ctx.imageSmoothingEnabled = false;

        // Draw car sprite at 2x size (80x60), centered on the obstacle
        const drawW = 80;
        const drawH = 60;
        const drawX = obs.x + (obs.width - drawW) / 2;
        const drawY = obs.y + (obs.height - drawH) / 2;

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
            if (sprite && (!sprite.complete || sprite.naturalWidth === 0)) {
                console.error('Sprite not loaded yet:', sprite.src);
            }
        }
        ctx.imageSmoothingEnabled = true;
    }

    syncPigeonStates();
    drawPigeons();
    drawMedalsAndRanks();
    if (finishCountdown && finishCountdownStart) {
        let timeLeft = Math.max(0, FINISH_TIME_LIMIT - (Date.now() - finishCountdownStart));
        ctx.save();
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#d32f2f';
        ctx.textAlign = 'center';
        ctx.fillText('Time left: ' + (timeLeft / 1000).toFixed(1) + 's', CANVAS_WIDTH / 2, 50);
        ctx.restore();
        const players = [player1, player2, player3, player4];
        players.forEach((p) => {
            ctx.save();
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#d32f2f';
            ctx.textAlign = 'center';
            ctx.fillText((timeLeft / 1000).toFixed(1) + 's', p.x + p.width / 2, p.y - 35);
            ctx.restore();
        });
    }
    if (gameState === 'won') {
        ctx.fillStyle = '#388e3c';
        ctx.font = '48px Arial';
        ctx.fillText('You Win!', CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

window.onload = () => {
    spawnObstacles();
    gameLoop();
};

function getPlayerHitbox(player) {
    const shrink = 0.5; // Reduced to 50% of original size (was 0.7)
    const w = player.width * shrink;
    const h = player.height * shrink;
    const x = player.x + (player.width - w) / 2;
    const y = player.y + (player.height - h) / 2;
    return { x, y, w, h };
}

function getCarHitbox(obs) {
    const shrink = 0.6; // 60% of original size
    const w = obs.width * shrink;
    const h = obs.height * shrink;
    const x = obs.x + (obs.width - w) / 2;
    const y = obs.y + (obs.height - h) / 2;
    return { x, y, w, h };
} 