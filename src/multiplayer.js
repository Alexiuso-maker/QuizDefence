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
        this.selectedQuestionTypes = null; // Will store selected question type keys
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
            this.showWaitingRoom(data.room);
        });

        // Room updated
        this.socket.on('room-updated', (room) => {
            this.players = room.players;
            
            const isPlayerInRoom = room.players.some(p => p.id === this.socket.id);
            if (isPlayerInRoom && document.getElementById('lobby-screen').style.display !== 'none') {
                this.showWaitingRoom(room);
            }

            this.updatePlayersList(room);
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
    }

    createRoom(playerName) {
        this.playerName = playerName;
        this.socket.emit('create-room', playerName);
    }

    joinRoom(roomCode, playerName) {
        this.playerName = playerName;
        this.roomCode = roomCode.toUpperCase();
        this.socket.emit('join-room', { roomCode: this.roomCode, playerName });
    }

    startGameAsHost() {
        if (this.isHost) {
            this.socket.emit('start-game');
        }
    }

    showWaitingRoom(room) {
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('waiting-room').style.display = 'flex';
        document.getElementById('display-room-code').textContent = this.roomCode;

        if (this.isHost) {
            document.getElementById('start-game-btn').style.display = 'block';
            document.getElementById('question-type-selector').style.display = 'block';
            this.setupQuestionTypeSelector();
        }

        this.updatePlayersList(room);
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
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('waiting-room').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        document.getElementById('question-panel').style.display = 'block';
        document.getElementById('players-stats-panel').style.display = 'block';

        document.getElementById('player-name-display').textContent = `Player: ${this.playerName}`;

        window.dispatchEvent(new CustomEvent('start-multiplayer-game', {
            detail: { multiplayer: this }
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

    leaveRoom() {
        location.reload();
    }
}

export default MultiplayerManager;