import { io } from 'socket.io-client';
import { QUESTION_TYPES } from './scenes/GameScene.js';

class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.playerName = null;
        this.isHost = false;
        this.players = [];
        this.gameScene = null;
        this.hackerScene = null;
        this.selectedQuestionTypes = null; // Will store selected question type keys
        this.gameMode = null; // 'quiz-defense' or 'the-hacker'
        this.gameDuration = 10; // For Hacker mode (in minutes)
    }

    connect() {
        this.socket = io('https://quiz-defense.onrender.com');
        this.setupSocketListeners();
        return this.socket;
    }

    setupSocketListeners() {
        // Room created
        this.socket.on('room-created', (data) => {
            this.roomCode = data.roomCode;
            this.isHost = true;

            // Store game mode and immediately broadcast it
            if (this.gameMode) {
                // Store in localStorage as backup
                localStorage.setItem(`room-${this.roomCode}-mode`, this.gameMode);

                // Broadcast game mode immediately
                setTimeout(() => {
                    this.socket.emit('broadcast-game-mode', {
                        roomCode: this.roomCode,
                        gameMode: this.gameMode
                    });
                }, 100);
            }

            this.showWaitingRoom(data.room);
        });

        // Room updated
        this.socket.on('room-updated', (room) => {
            this.players = room.players;

            const isPlayerInRoom = room.players.some(p => p.id === this.socket.id);

            // If we're joining and don't have game mode yet, wait for broadcast
            if (!this.isHost && !this.gameMode) {
                // Check localStorage again
                const storedMode = localStorage.getItem(`room-${this.roomCode}-mode`);
                if (storedMode) {
                    this.gameMode = storedMode;
                    console.log('Found game mode in storage during room-updated:', storedMode);
                } else {
                    // Default to Quiz Defense temporarily
                    this.gameMode = 'quiz-defense';
                    console.log('No game mode found, defaulting to quiz-defense');
                }
            }

            if (isPlayerInRoom && document.getElementById('lobby-screen').style.display !== 'none') {
                this.showWaitingRoom(room);
            }

            // Host continuously broadcasts game mode to ensure all players get it
            if (this.isHost && this.gameMode && this.roomCode) {
                // Store in localStorage
                localStorage.setItem(`room-${this.roomCode}-mode`, this.gameMode);

                // Broadcast to all players
                setTimeout(() => {
                    this.socket.emit('broadcast-game-mode', {
                        roomCode: this.roomCode,
                        gameMode: this.gameMode
                    });
                }, 200);
            }

            // Update the correct players list based on game mode
            if (this.gameMode === 'the-hacker') {
                if (document.getElementById('hacker-waiting-room').style.display !== 'none') {
                    this.updateHackerPlayersList(room);
                }
            } else {
                if (document.getElementById('waiting-room').style.display !== 'none') {
                    this.updatePlayersList(room);
                }
            }
        });

        // Handle broadcast-game-mode response (server might relay it back)
        this.socket.on('broadcast-game-mode', (data) => {
            if (!this.isHost && data.roomCode === this.roomCode) {
                console.log('Received broadcast-game-mode:', data.gameMode);
                this.handleGameModeUpdate(data.gameMode);
            }
        });

        // Listen for game mode broadcasts from host
        this.socket.on('game-mode-set', (data) => {
            if (!this.isHost && data.roomCode === this.roomCode) {
                console.log('Received game-mode-set from host:', data.gameMode);
                this.handleGameModeUpdate(data.gameMode);

                // Stop polling if we were
                if (this.gameModePolling) {
                    clearInterval(this.gameModePolling);
                    this.gameModePolling = null;
                }
            }
        });

        // Handle game mode requests (host responds)
        this.socket.on('request-game-mode', (data) => {
            if (this.isHost && data.roomCode === this.roomCode && this.gameMode) {
                console.log('Responding to game mode request with:', this.gameMode);
                this.socket.emit('broadcast-game-mode', {
                    roomCode: this.roomCode,
                    gameMode: this.gameMode
                });
            }
        });

        // Room error
        this.socket.on('room-error', (message) => {
            this.showError(message);
            document.getElementById('create-room-btn').disabled = false;
            document.getElementById('join-room-btn').disabled = false;
        });

        // Game starting
        this.socket.on('game-starting', () => {
            this.startGame();
        });

        // Hacker game starting
        this.socket.on('hacker-game-starting', (data) => {
            this.gameDuration = data.duration;
            this.startGame();
        });

        // Monster spawned
        this.socket.on('monster-spawned', (monsterData) => {
            if (this.gameScene) {
                this.gameScene.spawnSyncedMonster(monsterData);
            }
        });

        // Monster damaged
        this.socket.on('monster-damaged', (data) => {
            if (this.gameScene) {
                this.gameScene.syncMonsterDamage(data);
            }
        });

        // Monster killed
        this.socket.on('monster-killed', (monsterId) => {
            if (this.gameScene) {
                this.gameScene.syncMonsterKill(monsterId);
            }
        });

        // Base damaged
        this.socket.on('base-damaged', (damage) => {
            if (this.gameScene) {
                this.gameScene.syncBaseDamage(damage);
            }
        });

        // Player stats updated
        this.socket.on('player-stats-updated', (data) => {
            if (this.gameScene) {
                this.gameScene.updatePlayerStats(data);
            }
        });

        // Hacker mode: Player score updated
        this.socket.on('player-score-updated', (data) => {
            if (this.hackerScene) {
                this.hackerScene.updatePlayerScore(data);
            }
        });

        // Hacker mode: Hack attempt
        this.socket.on('hack-attempt', (data) => {
            if (this.hackerScene) {
                this.hackerScene.handleHackAttempt(data);
            }
        });

        // Hacker mode: Remove shield
        this.socket.on('remove-shield', (data) => {
            if (this.hackerScene) {
                this.hackerScene.handleRemoveShield(data);
            }
        });

        // Hacker mode: Activate shield
        this.socket.on('activate-shield', (data) => {
            if (this.hackerScene) {
                this.hackerScene.handleActivateShield(data);
            }
        });
    }

    createRoom(playerName) {
        this.playerName = playerName;

        // Try to send with game mode, but fall back to just name for compatibility
        const roomData = {
            playerName: playerName,
            gameMode: this.gameMode || 'quiz-defense'
        };

        // Try the new format first
        this.socket.emit('create-room', roomData);

        // Also try the old format for backwards compatibility
        setTimeout(() => {
            this.socket.emit('create-room', playerName);
        }, 100);
    }

    joinRoom(roomCode, playerName) {
        this.playerName = playerName;
        this.roomCode = roomCode.toUpperCase();

        // Try to get game mode from localStorage first
        const storedMode = localStorage.getItem(`room-${this.roomCode}-mode`);
        if (storedMode) {
            this.gameMode = storedMode;
            console.log('Retrieved game mode from storage:', storedMode);
        }

        this.socket.emit('join-room', { roomCode: this.roomCode, playerName });

        // Set up polling for game mode (fallback mechanism)
        this.gameModePollingCount = 0;
        this.gameModePolling = setInterval(() => {
            if (this.gameModePollingCount++ > 10) {
                // Stop after 10 attempts (5 seconds)
                clearInterval(this.gameModePolling);
                return;
            }

            // Request game mode from host
            this.socket.emit('request-game-mode', { roomCode: this.roomCode });
        }, 500);
    }

    startGameAsHost() {
        if (this.isHost) {
            // For The Hacker, we need to handle it differently
            if (this.gameMode === 'the-hacker') {
                // Use the same start-game event but we'll handle it client-side
                this.socket.emit('start-game');

                // Immediately trigger the hacker game start for all clients
                setTimeout(() => {
                    this.startGame();
                }, 100);
            } else {
                // Normal Quiz Defense start
                this.socket.emit('start-game');
            }
        }
    }

    showWaitingRoom(room) {
        document.getElementById('lobby-screen').style.display = 'none';

        console.log('Showing waiting room for game mode:', this.gameMode);
        console.log('Is host:', this.isHost);
        console.log('Room code:', this.roomCode);

        if (this.gameMode === 'the-hacker') {
            this.showHackerWaitingRoom(room);
        } else {
            // Default to Quiz Defense if no game mode set
            // This handles backwards compatibility
            if (!this.gameMode) {
                this.gameMode = 'quiz-defense';
            }

            // Quiz Defense waiting room
            document.getElementById('waiting-room').style.display = 'flex';
            document.getElementById('display-room-code').textContent = this.roomCode;

            // Update subtitle to show game mode
            const subtitle = document.querySelector('#waiting-room .waiting-subtitle');
            if (subtitle) {
                subtitle.textContent = '🏰 Quiz Defense - Ventar på spelarar...';
            }

            if (this.isHost) {
                document.getElementById('start-game-btn').style.display = 'block';
                document.getElementById('question-type-selector').style.display = 'block';
                this.setupQuestionTypeSelector();
            }

            this.updatePlayersList(room);
        }
    }

    showHackerWaitingRoom(room) {
        document.getElementById('hacker-waiting-room').style.display = 'flex';
        document.getElementById('hacker-room-code').textContent = this.roomCode;

        // Update subtitle to show game mode
        const subtitle = document.querySelector('#hacker-waiting-room .matrix-subtitle');
        if (subtitle) {
            subtitle.innerHTML = `💻 THE HACKER - Rom: <span id="hacker-room-code">${this.roomCode}</span>`;
        }

        // Update players list
        this.updateHackerPlayersList(room);

        // Show host settings
        if (this.isHost) {
            document.getElementById('hacker-host-settings').style.display = 'block';
            document.getElementById('hacker-start-game-btn').style.display = 'block';

            // Setup duration input
            const durationInput = document.getElementById('game-duration-input');
            durationInput.value = this.gameDuration;
            durationInput.oninput = (e) => {
                this.gameDuration = parseInt(e.target.value) || 10;
            };

            // Setup start game button
            document.getElementById('hacker-start-game-btn').onclick = () => {
                this.startHackerGame();
            };

            // Setup question selector button
            document.getElementById('hacker-question-selector-btn').onclick = () => {
                // Reuse the same selector modal from Quiz Defense
                document.getElementById('question-type-selector').style.display = 'block';
                this.setupQuestionTypeSelector();
            };
        }

        // Show password selection for all players
        this.setupPasswordSelection();

        // Leave button
        document.getElementById('hacker-leave-room-btn').onclick = () => {
            location.reload();
        };
    }

    updateHackerPlayersList(room) {
        const playersList = document.getElementById('hacker-players-list');
        playersList.innerHTML = '';

        room.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'hacker-player-item';
            playerDiv.innerHTML = `
                <span class="player-name">${player.name}</span>
                ${player.isHost ? '<span style="color: #ffff00;"> [HOST]</span>' : ''}
            `;
            playersList.appendChild(playerDiv);
        });
    }

    setupPasswordSelection() {
        const passwordSelection = document.getElementById('password-selection');
        passwordSelection.style.display = 'block';

        const passwordOptions = document.getElementById('password-options');
        passwordOptions.innerHTML = '';

        // Generate 3 random passwords
        const PASSWORD_POOL = [
            'skibidi777', 'rizz999', 'sigma123', 'gyat456', 'fanum888',
            'mewing42', 'bussin99', 'slay321', 'yeet007', 'bruh404',
            'sus111', 'noob360', 'epic500', 'giga666', 'omega888',
            '676767676', 'SIXSEVEN!', '12341234', 'hello123!', 'noob1234',
            '999999999', 'abc123abc', 'YEET!007', 'SIGMA!23', 'BRUH!404',
            '111222333', 'xyz999xyz', 'GOAT!999', 'MEGA!777', '555666777'
        ];

        const shuffled = [...PASSWORD_POOL].sort(() => Math.random() - 0.5);
        const threePasswords = shuffled.slice(0, 3);

        threePasswords.forEach(password => {
            const btn = document.createElement('button');
            btn.className = 'password-btn';
            btn.textContent = password;
            btn.onclick = () => {
                // Select this password
                passwordOptions.querySelectorAll('.password-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                // Emit to server
                this.socket.emit('select-password', {
                    roomCode: this.roomCode,
                    playerId: this.socket.id,
                    playerName: this.playerName,
                    password: password
                });

                // Show confirmation
                document.getElementById('password-selected-msg').style.display = 'block';
            };
            passwordOptions.appendChild(btn);
        });
    }

    startHackerGame() {
        if (!this.isHost) return;

        // Use the existing start-game event that the server knows
        this.socket.emit('start-game');

        // The game-starting event will trigger startGame() which handles The Hacker mode
    }

    updatePlayersList(room) {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';
        
        room.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = player.isHost ? 'player-item host' : 'player-item';
            
            playerDiv.innerHTML = `
                <span class="player-name">${player.name}</span>
                ${player.isHost ? '<span class="player-badge">HOST</span>' : ''}
            `;
            
            playersList.appendChild(playerDiv);
        });
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        setTimeout(() => {
            errorDiv.textContent = '';
        }, 3000);
    }

    startGame() {
        if (this.gameMode === 'the-hacker') {
            this.startHackerGameClient();
        } else {
            // Quiz Defense game start
            document.getElementById('lobby-screen').style.display = 'none';
            document.getElementById('waiting-room').style.display = 'none';
            document.getElementById('game-wrapper').style.display = 'flex';

            document.getElementById('player-name-display').textContent = `Player: ${this.playerName}`;

            window.dispatchEvent(new CustomEvent('start-multiplayer-game', {
                detail: { multiplayer: this }
            }));
        }
    }

    startHackerGameClient() {
        // Hide waiting room
        document.getElementById('hacker-waiting-room').style.display = 'none';

        if (this.isHost) {
            // Show host dashboard
            document.getElementById('hacker-host-dashboard').style.display = 'flex';
        } else {
            // Show game container for players
            document.getElementById('hacker-game-container').style.display = 'flex';
        }

        // Dispatch event to start Hacker Scene
        window.dispatchEvent(new CustomEvent('start-hacker-game', {
            detail: {
                multiplayer: this,
                duration: this.gameDuration
            }
        }));
    }

    emitMonsterSpawned(monsterData) {
        this.socket.emit('monster-spawned', monsterData);
    }

    emitMonsterDamaged(data) {
        this.socket.emit('monster-damaged', data);
    }

    emitMonsterKilled(monsterId) {
        this.socket.emit('monster-killed', monsterId);
    }

    emitBaseDamaged(damage) {
        this.socket.emit('base-damaged', damage);
    }

    emitStatsUpdate(stats) {
        this.socket.emit('update-stats', stats);
    }

    setupQuestionTypeSelector() {
        const container = document.getElementById('question-types-list');
        container.innerHTML = '';

        // Initialize with all types selected
        this.selectedQuestionTypes = Object.keys(QUESTION_TYPES);

        // Setup toggle button
        const toggleBtn = document.getElementById('toggle-selector-btn');
        const selectorContent = document.getElementById('selector-content');

        toggleBtn.addEventListener('click', () => {
            selectorContent.classList.toggle('collapsed');
            if (selectorContent.classList.contains('collapsed')) {
                toggleBtn.textContent = '▶ Vis/Skjul';
            } else {
                toggleBtn.textContent = '▼ Vis/Skjul';
            }
        });

        // Create checkbox for each question type
        Object.entries(QUESTION_TYPES).forEach(([key, typeData]) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'question-type-item selected';
            itemDiv.dataset.typeKey = key;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `qt-${key}`;
            checkbox.checked = true;
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedQuestionTypes.push(key);
                    itemDiv.classList.add('selected');
                } else {
                    this.selectedQuestionTypes = this.selectedQuestionTypes.filter(k => k !== key);
                    itemDiv.classList.remove('selected');
                }
            });

            const label = document.createElement('label');
            label.className = 'question-type-label';
            label.htmlFor = `qt-${key}`;
            label.innerHTML = `
                <span class="question-type-name">${typeData.name}</span>
                <span class="question-type-category">${this.getCategoryDisplayName(typeData.category)}</span>
            `;

            // Make the whole div clickable
            itemDiv.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            container.appendChild(itemDiv);
        });

        // Setup select all / deselect all buttons
        document.getElementById('select-all-btn').addEventListener('click', () => {
            this.selectedQuestionTypes = Object.keys(QUESTION_TYPES);
            document.querySelectorAll('.question-type-item').forEach(item => {
                item.classList.add('selected');
                item.querySelector('input[type="checkbox"]').checked = true;
            });
        });

        document.getElementById('deselect-all-btn').addEventListener('click', () => {
            this.selectedQuestionTypes = [];
            document.querySelectorAll('.question-type-item').forEach(item => {
                item.classList.remove('selected');
                item.querySelector('input[type="checkbox"]').checked = false;
            });
        });
    }

    getCategoryDisplayName(category) {
        const categoryNames = {
            'addition': 'Addisjon',
            'subtraction': 'Subtraksjon',
            'multiplication': 'Multiplikasjon',
            'placeValue': 'Plassverdiar',
            'decimal': 'Desimaltal',
            'fractionDecimal': 'Brøk til desimal',
            'decimalComparison': 'Samanlikning',
            'decimalArithmetic': 'Desimalrekneoperasjonar'
        };
        return categoryNames[category] || category;
    }

    handleGameModeUpdate(gameMode) {
        const previousMode = this.gameMode;
        this.gameMode = gameMode;

        // Store in localStorage for persistence
        localStorage.setItem(`room-${this.roomCode}-mode`, gameMode);

        // Stop polling if we were
        if (this.gameModePolling) {
            clearInterval(this.gameModePolling);
            this.gameModePolling = null;
        }

        // If game mode changed or we're showing wrong waiting room, update
        if (previousMode !== gameMode ||
            (gameMode === 'the-hacker' && document.getElementById('waiting-room').style.display !== 'none') ||
            (gameMode === 'quiz-defense' && document.getElementById('hacker-waiting-room').style.display !== 'none')) {

            // Hide both waiting rooms first
            document.getElementById('waiting-room').style.display = 'none';
            document.getElementById('hacker-waiting-room').style.display = 'none';

            // Show the correct one
            const room = { players: this.players };
            this.showWaitingRoom(room);
        }
    }

    leaveRoom() {
        location.reload();
    }
}

export default MultiplayerManager;