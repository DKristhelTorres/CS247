document.addEventListener('DOMContentLoaded', () => {
    // Add RoomManager class at the beginning
    class RoomManager {
        constructor() {
            this.activeRooms = new Map(); // Map of room passwords to room data
            this.ROOM_STATUS = {
                WAITING: 'waiting',
                IN_GAME: 'in-game',
                FINISHED: 'finished'
            };
        }

        createRoom(password, hostUsername) {
            if (this.activeRooms.has(password)) {
                return false; // Room already exists
            }
            
            this.activeRooms.set(password, {
                players: [hostUsername + ' (Host)'],
                created: Date.now(),
                maxPlayers: ROOM_CAPACITY,
                status: this.ROOM_STATUS.WAITING,
                gameStartTime: null
            });
            return true;
        }

        joinRoom(password, username) {
            const room = this.activeRooms.get(password);
            if (!room) {
                return { success: false, error: 'Room does not exist' };
            }
            
            if (room.status !== this.ROOM_STATUS.WAITING) {
                return { success: false, error: 'Game already in progress' };
            }
            
            if (room.players.length >= room.maxPlayers) {
                return { success: false, error: 'Room is full' };
            }

            if (room.players.includes(username)) {
                return { success: false, error: 'Username already in room' };
            }

            room.players.push(username);
            return { success: true, room };
        }

        leaveRoom(password, username) {
            const room = this.activeRooms.get(password);
            if (!room) return false;

            const playerIndex = room.players.findIndex(p => p === username);
            if (playerIndex === -1) return false;

            room.players.splice(playerIndex, 1);
            
            // If room is empty, remove it
            if (room.players.length === 0) {
                this.activeRooms.delete(password);
            }
            
            return true;
        }

        isRoomActive(password) {
            return this.activeRooms.has(password);
        }

        getRoomPlayers(password) {
            return this.activeRooms.get(password)?.players || [];
        }

        startGame(password) {
            const room = this.activeRooms.get(password);
            if (!room) return false;
            
            room.status = this.ROOM_STATUS.IN_GAME;
            room.gameStartTime = Date.now();
            return true;
        }

        endGame(password) {
            const room = this.activeRooms.get(password);
            if (!room) return false;
            
            room.status = this.ROOM_STATUS.FINISHED;
            return true;
        }

        getRoomStatus(password) {
            return this.activeRooms.get(password)?.status || null;
        }
    }

    const roomManager = new RoomManager();

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
    }

    function generateRoomPassword() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const passwordLength = 6;
        let password = '';
        
        // Create array for random values
        const randomValues = new Uint32Array(passwordLength);
        // Fill with cryptographically strong random values
        crypto.getRandomValues(randomValues);
        
        // Generate password using the random values
        for (let i = 0; i < passwordLength; i++) {
            const randomIndex = randomValues[i] % characters.length;
            password += characters[randomIndex];
        }
        
        return password;
    }

    // Function to switch between menus
    function switchMenu(from, to) {
        from.classList.remove('active');
        to.classList.add('active');
    }

    // Utility functions to show/hide title and description
    function showTitleAndDescription() {
        document.querySelector('.main-title').classList.remove('hidden');
        document.querySelector('.main-description').classList.remove('hidden');
    }
    function hideTitleAndDescription() {
        document.querySelector('.main-title').classList.add('hidden');
        document.querySelector('.main-description').classList.add('hidden');
    }

    // Show username menu after Play is clicked
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
        switchMenu(usernameMenu, gameOptions);
        hideTitleAndDescription();
    });

    // Back button click handler
    backButton.addEventListener('click', () => {
        switchMenu(gameOptions, mainMenu);
        showTitleAndDescription();
    });

    // Function to render the player list in the create room menu
    function renderPlayerList() {
        playerList.innerHTML = '';
        
        // Add room status indicator only if there are fewer than 4 players
        if (roomPlayers.length < ROOM_CAPACITY) {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'room-status status-waiting';
            statusDiv.textContent = 'Waiting for players...';
            playerList.appendChild(statusDiv);
        }
        
        // Add players list
        roomPlayers.forEach((player, idx) => {
            const div = document.createElement('div');
            div.className = 'player-name';
            div.textContent = player;
            playerList.appendChild(div);
        });
    }

    // Update createGameButton click handler
    createGameButton.addEventListener('click', () => {
        const newPassword = generateRoomPassword();
        const success = roomManager.createRoom(newPassword, currentUsername);
        
        if (!success) {
            // If room creation failed (very unlikely with random passwords), try again
            createGameButton.click();
            return;
        }

        roomPassword.textContent = newPassword;
        roomPlayers = roomManager.getRoomPlayers(newPassword);
        renderPlayerList();
        switchMenu(gameOptions, createRoom);
        hideTitleAndDescription();
    });

    // For demo: simulate adding a player every time 'Invite/Share' is clicked (until full)
    const inviteButton = document.getElementById('invite-button');
    if (inviteButton) {
        inviteButton.addEventListener('click', () => {
            console.log('Invite clicked');
            // Generate a shareable link using the current room password
            const password = roomPassword.textContent;
            const url = `${window.location.origin}?room=${encodeURIComponent(password)}`;
            console.log('Link to copy:', url);
            console.log('Clipboard API available:', !!navigator.clipboard);
            // Always try to copy to clipboard
            navigator.clipboard.writeText(url).then(() => {
                console.log('Clipboard writeText success');
            }).catch(err => {
                console.error('Clipboard copy failed:', err);
                alert('Copy this link to share your room:\n' + url);
            });
            // Try to use the Web Share API if available
            if (navigator.share) {
                navigator.share({
                    title: 'Join my Final Circuit game!',
                    text: `Join my game room: ${password}`,
                    url: url
                }).catch(() => {
                    // do nothing, already handled
                });
            }
            // Remove any existing message
            const prevMsg = inviteButton.parentNode.querySelector('.invite-msg');
            if (prevMsg) prevMsg.remove();
            // Show a temporary message
            let msg = document.createElement('span');
            msg.textContent = 'Link copied!';
            msg.className = 'invite-msg';
            msg.style.marginLeft = '1rem';
            msg.style.color = '#4ecdc4';
            inviteButton.parentNode.appendChild(msg);
            setTimeout(() => {
                msg.remove();
            }, 2000);
        });
    }

    // Join game button click handler
    joinGameButton.addEventListener('click', () => {
        switchMenu(gameOptions, joinRoom);
        hideTitleAndDescription();
    });

    // Update submitPassword click handler
    submitPassword.addEventListener('click', () => {
        const enteredPassword = passwordInput.value.trim().toUpperCase();
        clearJoinError();

        if (!enteredPassword) {
            showJoinError('Please enter a room password');
            return;
        }

        const result = roomManager.joinRoom(enteredPassword, currentUsername);
        
        if (!result.success) {
            showJoinError(result.error);
            return;
        }

        roomPlayers = result.room.players;
        renderPlayerList();
        switchMenu(joinRoom, createRoom); // Reuse create room view for joined rooms
        hideTitleAndDescription();
    });

    // Add cleanup when leaving room
    backToOptions.addEventListener('click', () => {
        const currentPassword = roomPassword.textContent;
        if (currentPassword && currentPassword !== 'Generating...') {
            roomManager.leaveRoom(currentPassword, currentUsername + ' (Host)');
        }
        switchMenu(createRoom, gameOptions);
        hideTitleAndDescription();
    });

    backToOptionsJoin.addEventListener('click', () => {
        const currentPassword = passwordInput.value.trim().toUpperCase();
        if (currentPassword) {
            roomManager.leaveRoom(currentPassword, currentUsername);
        }
        switchMenu(joinRoom, gameOptions);
        hideTitleAndDescription();
    });

    // Copy password to clipboard
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

    // Show error message below the input if password is invalid
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

    // Start game button handler
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
        if (roomManager.startGame(currentPassword)) {
            // Store player information in localStorage for Play&Boom to access
            localStorage.setItem('gamePlayers', JSON.stringify(roomPlayers));
            localStorage.setItem('roomPassword', currentPassword);
            localStorage.setItem('gameStartTime', Date.now());
            
            // Redirect to Play&Boom using the correct path for GitHub Pages
            window.location.href = '/Play&Boom/index.html';
        } else {
            alert('Failed to start game. Please try again.');
        }
    });

    // Add CSS styles for room status
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