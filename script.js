document.addEventListener('DOMContentLoaded', () => {
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
        roomPlayers.forEach((player, idx) => {
            const div = document.createElement('div');
            div.className = 'player-name';
            div.textContent = player;
            playerList.appendChild(div);
        });
    }

    // Use currentUsername when creating or joining a room
    // For demo: add the creator as the first player when room is created
    createGameButton.addEventListener('click', () => {
        const newPassword = generateRoomPassword();
        roomPassword.textContent = newPassword;
        // Simulate creator joining as first player
        roomPlayers = [currentUsername + ' (Host)'];
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

    // Back to options from create room
    backToOptions.addEventListener('click', () => {
        switchMenu(createRoom, gameOptions);
        hideTitleAndDescription();
    });

    // Back to options from join room
    backToOptionsJoin.addEventListener('click', () => {
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

    // Submit password to join room
    submitPassword.addEventListener('click', () => {
        const enteredPassword = passwordInput.value.trim().toUpperCase();
        clearJoinError();
        if (!roomPassword.textContent || roomPassword.textContent === 'Generating...') {
            showJoinError('No room exists. Please create a room first.');
            return;
        }
        if (enteredPassword === roomPassword.textContent) {
            if (roomPlayers.length >= ROOM_CAPACITY) {
                showJoinError('Room is full.');
                return;
            }
            // Add the joined player to the room
            roomPlayers.push(currentUsername);
            renderPlayerList();
            switchMenu(joinRoom, createRoom);
        } else {
            showJoinError('Invalid room password. Please try again.');
        }
    });

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
        
        // Store player information in localStorage for Play&Boom to access
        localStorage.setItem('gamePlayers', JSON.stringify(roomPlayers));
        localStorage.setItem('roomPassword', roomPassword.textContent);
        
        // Redirect to Play&Boom using the correct path for GitHub Pages
        window.location.href = '/Play&Boom/index.html';
    });
}); 