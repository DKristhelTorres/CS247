document.addEventListener('DOMContentLoaded', () => {
    // Add debug logging
    const DEBUG = true;
    function debugLog(...args) {
        if (DEBUG) {
            console.log('[DEBUG]', ...args);
        }
    }

    // Initialize Socket.IO connection for Render backend
    const SERVER_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://cs247.onrender.com';

    const socket = io(SERVER_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
    });

    socket.on('connect', () => {
        debugLog('Connected to server with socket ID:', socket.id);
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        alert('Unable to connect to the game server. Please try again later.');
    });

    const mainMenu = document.getElementById('main-menu');
    const gameOptions = document.getElementById('game-options');
    const createRoom = document.getElementById('create-room');
    const joinRoom = document.getElementById('join-room');
    const playButton = document.getElementById('play-button');
    const backButton = document.getElementById('back-button');
    const createGameButton = document.getElementById('create-game');
    const joinGameButton = document.getElementById('join-game');
    const backToOptions = document.getElementById('back-to-options');
    const backToOptionsJoin = document.getElementById('back-to-options-join');
    const roomPassword = document.getElementById('room-password');
    const copyPassword = document.getElementById('copy-password');
    const passwordInput = document.getElementById('password-input');
    const submitPassword = document.getElementById('submit-password');
    const startGame = document.getElementById('start-game');
    const playerList = document.getElementById('player-list');
    let roomPlayers = [];
    const ROOM_CAPACITY = 4;

    // Username/avatar selection logic
    const usernameMenu = document.getElementById('username-menu');
    const usernameInput = document.getElementById('username-input');
    const randomUsernameBtn = document.getElementById('random-username');
    const usernameStartBtn = document.getElementById('username-start');
    const avatarImg = document.getElementById('avatar-img');
    const randomAvatarBtn = document.getElementById('random-avatar');

    let currentUsername = '';
    let currentAvatarIdx = 0;
    const avatarList = [
        'avatar1.png',
        'avatar2.png',
        'avatar3.png',
        'avatar4.png'
    ];

    function randomUsername() {
        const adjectives = ['Cool', 'Fast', 'Smart', 'Brave', 'Lucky', 'Sneaky', 'Happy', 'Funky'];
        const nouns = ['Cat', 'Dog', 'Ninja', 'Wizard', 'Pirate', 'Robot', 'Ghost', 'Hero'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(1000 + Math.random() * 9000);
        return `${adj}${noun}${number}`;
    }

    function setRandomUsername() {
        usernameInput.value = randomUsername();
    }

    function setAvatar(idx) {
        avatarImg.src = avatarList[idx % avatarList.length];
        currentAvatarIdx = idx % avatarList.length;
        localStorage.setItem('currentAvatar', avatarList[currentAvatarIdx]);
    }

    function generateRoomPassword() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const passwordLength = 6;
        let password = '';
        const randomValues = new Uint32Array(passwordLength);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < passwordLength; i++) {
            const randomIndex = randomValues[i] % characters.length;
            password += characters[randomIndex];
        }
        return password;
    }

    function switchMenu(from, to) {
        from.classList.remove('active');
        to.classList.add('active');
    }

    function showTitleAndDescription() {
        document.querySelector('.main-title').classList.remove('hidden');
        document.querySelector('.main-description').classList.remove('hidden');
    }
    function hideTitleAndDescription() {
        document.querySelector('.main-title').classList.add('hidden');
        document.querySelector('.main-description').classList.add('hidden');
    }

    playButton.addEventListener('click', () => {
        switchMenu(mainMenu, usernameMenu);
        setRandomUsername();
        setAvatar(0);
        hideTitleAndDescription();
    });

    randomUsernameBtn.addEventListener('click', setRandomUsername);
    randomAvatarBtn.addEventListener('click', () => {
        setAvatar(currentAvatarIdx + 1);
    });

    usernameStartBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name) {
            usernameInput.focus();
            usernameInput.placeholder = 'Please enter a nickname!';
            return;
        }
        currentUsername = name;
        localStorage.setItem('username', name);
        localStorage.setItem('currentAvatar', avatarList[currentAvatarIdx]);
        switchMenu(usernameMenu, gameOptions);
        hideTitleAndDescription();
    });

    backButton.addEventListener('click', () => {
        switchMenu(gameOptions, mainMenu);
        showTitleAndDescription();
    });

    function renderPlayerList() {
        playerList.innerHTML = '';
        if (roomPlayers.length < ROOM_CAPACITY) {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'room-status status-waiting';
            statusDiv.textContent = 'Waiting for players...';
            playerList.appendChild(statusDiv);
        }
        roomPlayers.forEach((player, idx) => {
            const div = document.createElement('div');
            div.className = 'player-name';
            div.textContent = player;
            playerList.appendChild(div);
        });
    }

    createGameButton.addEventListener('click', () => {
        debugLog('Creating new room...');
        const newPassword = generateRoomPassword();
        socket.emit('createRoom', {
            roomId: newPassword,
            username: currentUsername,
            avatar: avatarList[currentAvatarIdx]
        });
    });

    const inviteButton = document.getElementById('invite-button');
    if (inviteButton) {
        inviteButton.addEventListener('click', () => {
            const password = roomPassword.textContent;
            const url = `${window.location.origin}?room=${encodeURIComponent(password)}`;
            navigator.clipboard.writeText(url).then(() => {
                debugLog('Link copied:', url);
            }).catch(err => {
                alert('Copy this link to share your room:\n' + url);
            });
            if (navigator.share) {
                navigator.share({
                    title: 'Join my Final Circuit game!',
                    text: `Join my game room: ${password}`,
                    url: url
                }).catch(() => {});
            }
            const prevMsg = inviteButton.parentNode.querySelector('.invite-msg');
            if (prevMsg) prevMsg.remove();
            let msg = document.createElement('span');
            msg.textContent = 'Link copied!';
            msg.className = 'invite-msg';
            msg.style.marginLeft = '1rem';
            msg.style.color = '#4ecdc4';
            inviteButton.parentNode.appendChild(msg);
            setTimeout(() => { msg.remove(); }, 2000);
        });
    }

    joinGameButton.addEventListener('click', () => {
        switchMenu(gameOptions, joinRoom);
        hideTitleAndDescription();
    });

    submitPassword.addEventListener('click', () => {
        let enteredPassword = passwordInput.value.trim().toUpperCase();
        debugLog('Attempting to join room:', enteredPassword);
        clearJoinError();
        if (!enteredPassword) {
            showJoinError('Please enter a room password');
            return;
        }
        // Ensure unique username per device
        let uniqueUsername = currentUsername;
        if (roomPlayers.includes(uniqueUsername)) {
            // Append a random 4-digit suffix if username already exists in the room
            uniqueUsername = `${currentUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
            debugLog('Username already in room, using unique username:', uniqueUsername);
        }
        socket.emit('joinRoom', {
            roomId: enteredPassword,
            username: uniqueUsername,
            avatar: avatarList[currentAvatarIdx]
        });
        // Update currentUsername to the unique one for this session
        currentUsername = uniqueUsername;
        localStorage.setItem('username', uniqueUsername);
    });

    startGame.addEventListener('click', () => {
        if (roomPlayers.length < 2) {
            alert('Need at least 2 players to start the game!');
            return;
        }
        if (roomPlayers.length > ROOM_CAPACITY) {
            alert('Too many players! Maximum is ' + ROOM_CAPACITY);
            return;
        }
        const currentPassword = roomPassword.textContent;
        debugLog('Starting game with players:', roomPlayers);
        socket.emit('startGame', {
            roomId: currentPassword,
            players: roomPlayers
        });
    });

    if (socket) {
        socket.on('roomCreated', ({ roomId, players }) => {
            debugLog('Room created event received:', { roomId, players });
            roomPassword.textContent = roomId;
            roomPlayers = players;
            renderPlayerList();
            switchMenu(gameOptions, createRoom);
            hideTitleAndDescription();
        });
        socket.on('playerJoined', ({ username, players }) => {
            debugLog('Player joined event received:', { username, players });
            roomPlayers = players;
            renderPlayerList();
            // Only transition if the joining player is the current user
            if (username === currentUsername) {
                switchMenu(joinRoom, createRoom);
                hideTitleAndDescription();
            }
        });
        socket.on('playerLeft', ({ username, players }) => {
            debugLog('Player left event received:', { username, players });
            roomPlayers = players;
            renderPlayerList();
        });
        socket.on('gameStarted', ({ players, gameState }) => {
            debugLog('Game started event received:', { players, gameState });
            roomPlayers = players;
            localStorage.setItem('gamePlayers', JSON.stringify(players));
            localStorage.setItem('roomPassword', roomPassword.textContent);
            localStorage.setItem('gameState', JSON.stringify(gameState));
            localStorage.setItem('gameStartTime', Date.now());
            window.location.href = 'game-board.html';
        });
        socket.on('roomError', ({ message }) => {
            debugLog('Room error received:', message);
            showJoinError(message);
        });
    }

    backToOptions.addEventListener('click', () => {
        const currentPassword = roomPassword.textContent;
        if (currentPassword && currentPassword !== 'Generating...') {
            socket.emit('leaveRoom', {
                roomId: currentPassword,
                username: currentUsername
            });
        }
        switchMenu(createRoom, gameOptions);
        hideTitleAndDescription();
    });

    backToOptionsJoin.addEventListener('click', () => {
        const currentPassword = passwordInput.value.trim().toUpperCase();
        if (currentPassword) {
            socket.emit('leaveRoom', {
                roomId: currentPassword,
                username: currentUsername
            });
        }
        switchMenu(joinRoom, gameOptions);
        hideTitleAndDescription();
    });

    copyPassword.addEventListener('click', () => {
        navigator.clipboard.writeText(roomPassword.textContent)
            .then(() => {
                const originalText = copyPassword.textContent;
                copyPassword.textContent = 'Copied!';
                setTimeout(() => {
                    copyPassword.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy password:', err);
            });
    });

    function showJoinError(message) {
        let errorDiv = document.getElementById('join-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'join-error';
            errorDiv.style.color = '#ff6b6b';
            errorDiv.style.marginTop = '0.5rem';
            errorDiv.style.fontWeight = 'bold';
            passwordInput.parentNode.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
    }
    function clearJoinError() {
        const errorDiv = document.getElementById('join-error');
        if (errorDiv) errorDiv.textContent = '';
    }

    const style = document.createElement('style');
    style.textContent = `
        .room-status {
            padding: 8px;
            margin-bottom: 10px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
        }
        .status-waiting {
            background-color: #4ecdc4;
            color: white;
        }
        .status-in-game {
            background-color: #ff6b6b;
            color: white;
        }
        .status-finished {
            background-color: #95a5a6;
            color: white;
        }
        .status-unknown {
            background-color: #bdc3c7;
            color: white;
        }
    `;
    document.head.appendChild(style);
}); 