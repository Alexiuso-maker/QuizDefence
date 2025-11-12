import { io } from 'socket.io-client';

class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.playerName = null;
        this.isHost = false;
        this.players = [];
        this.gameScene = null;
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
        document.getElementById('weapon-panel').style.display = 'block';
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

    leaveRoom() {
        location.reload();
    }
}

export default MultiplayerManager;