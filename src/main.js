import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import MultiplayerManager from './multiplayer.js';

// --- Configuration ---
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

let game = null;
let multiplayerManager = null;

// Setup lobby controls
document.addEventListener('DOMContentLoaded', () => {
    // Initialize multiplayer
    multiplayerManager = new MultiplayerManager();
    multiplayerManager.connect();

    setupPanelToggles(); // Setup panel toggle buttons

    // Get references to lobby buttons
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const hostNameInput = document.getElementById('host-name');
    const joinNameInput = document.getElementById('join-name');
    const roomCodeInput = document.getElementById('room-code-input');

    // Create room button handler
    createRoomBtn.onclick = () => {
        const playerName = hostNameInput.value.trim();
        if (playerName) {
            // Disable buttons to prevent spam
            createRoomBtn.disabled = true;
            joinRoomBtn.disabled = true;
            multiplayerManager.createRoom(playerName);
        } else {
            multiplayerManager.showError('Please enter your name');
        }
    };
    
    // Join room button handler
    joinRoomBtn.onclick = () => {
        const playerName = joinNameInput.value.trim();
        const roomCode = roomCodeInput.value.trim();
        
        if (!playerName) {
            multiplayerManager.showError('Please enter your name');
            return;
        }
        
        if (!roomCode) {
            multiplayerManager.showError('Please enter a room code');
            return;
        }
        
        // Disable buttons to prevent spam
        createRoomBtn.disabled = true;
        joinRoomBtn.disabled = true;
        multiplayerManager.joinRoom(roomCode, playerName);
    };
    
    // Start game button (host only)
    document.getElementById('start-game-btn').onclick = () => {
        multiplayerManager.startGameAsHost();
    };
    
    // Leave room button
    document.getElementById('leave-room-btn').onclick = () => {
        multiplayerManager.leaveRoom();
    };
    
    // Listen for game start event from multiplayer manager
    window.addEventListener('start-multiplayer-game', (event) => {
        startPhaserGame(event.detail.multiplayer);
    });
});

function setupPanelToggles() {
    document.querySelectorAll('.panel-toggle').forEach(button => {
        button.onclick = () => {
            const panel = button.closest('.panel');
            panel.classList.toggle('collapsed');
        };
    });
}

function startPhaserGame(multiplayer) {
    // --- Initialize Phaser Game ---
    const config = {
        type: Phaser.AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent: 'game-container',
        physics: {
            default: 'arcade',
            arcade: {
                debug: false
            }
        },
        scene: GameScene,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    };
    
    game = new Phaser.Game(config);
    
    // Pass multiplayer manager to the game scene so it can send/receive events
    game.registry.set('multiplayer', multiplayer);
}