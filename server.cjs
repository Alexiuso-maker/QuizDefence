const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "https://timeplaner.no",
            "http://timeplaner.no",
            "https://www.timeplaner.no",
            "http://www.timeplaner.no"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Store active rooms
const rooms = new Map();

// Generate random 4-digit room code
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}


io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create a new room
    socket.on('create-room', (playerName) => {
        const roomCode = generateRoomCode();
        
        const room = {
            code: roomCode,
            host: socket.id,
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true,
                ready: false
            }],
            gameStarted: false,
            gameState: null
        };
        
        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`Room created: ${roomCode} by ${playerName}`);
        
        socket.emit('room-created', { roomCode, room });
    });

    // Join existing room
    socket.on('join-room', (data) => {
        const { roomCode, playerName } = data;
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('room-error', 'Room not found');
            return;
        }
        
        if (room.gameStarted) {
            socket.emit('room-error', 'Game already started');
            return;
        }
        
        // Add player to room
        room.players.push({
            id: socket.id,
            name: playerName,
            isHost: false,
            ready: false
        });
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`${playerName} joined room ${roomCode}`);
        
        // Notify everyone in room
        io.to(roomCode).emit('room-updated', room);
    });

    // Player ready
    socket.on('player-ready', () => {
        const roomCode = socket.roomCode;
        const room = rooms.get(roomCode);
        
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.ready = true;
                io.to(roomCode).emit('room-updated', room);
            }
        }
    });

    // Start game (host only)
    socket.on('start-game', () => {
        const roomCode = socket.roomCode;
        const room = rooms.get(roomCode);
        
        if (room && room.host === socket.id) {
            room.gameStarted = true;
            console.log(`Game starting in room ${roomCode}`);
            io.to(roomCode).emit('game-starting');
        }
    });

    // Sync monster spawn
    socket.on('monster-spawned', (monsterData) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            socket.to(roomCode).emit('monster-spawned', monsterData);
        }
    });

    // Sync monster damage
    socket.on('monster-damaged', (data) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            socket.to(roomCode).emit('monster-damaged', data);
        }
    });

    // Sync monster killed
    socket.on('monster-killed', (monsterId) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            socket.to(roomCode).emit('monster-killed', monsterId);
        }
    });

    // Sync base damage
    socket.on('base-damaged', (damage) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            socket.to(roomCode).emit('base-damaged', damage);
        }
    });

    // Update player stats
    socket.on('update-stats', (stats) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            socket.to(roomCode).emit('player-stats-updated', {
                playerId: socket.id,
                stats: stats
            });
        }
    });

    // Sync monster positions from host
    socket.on('sync-monster-positions', (positions) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            socket.to(roomCode).emit('sync-monster-positions', positions);
        }
    });

    // Sync all monsters (full state)
    socket.on('sync-all-monsters', (monstersData) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            socket.to(roomCode).emit('sync-all-monsters', monstersData);
        }
    });

    // Wave completed (boss killed)
    socket.on('wave-completed', (data) => {
        const { roomCode, killerId, newWave, newSpawnInterval, newMonstersPerWave, newBaseSpawnInterval, newMinSpawnInterval } = data;
        if (roomCode) {
            // Broadcast to all players in room
            io.to(roomCode).emit('wave-completed', {
                killerId,
                newWave,
                newSpawnInterval,
                newMonstersPerWave,
                newBaseSpawnInterval,
                newMinSpawnInterval
            });
        }
    });

    // Countdown ended (upgrade phase over)
    socket.on('countdown-ended', (data) => {
        const { roomCode, triggerId } = data;
        if (roomCode) {
            // Broadcast to all players in room
            io.to(roomCode).emit('countdown-ended', { triggerId });
        }
    });

    // Question types updated (host selects question types)
    socket.on('question-types-updated', (data) => {
        const { roomCode, questionTypes } = data;
        if (roomCode) {
            // Broadcast to all other players in the room
            socket.to(roomCode).emit('question-types-updated', {
                questionTypes
            });
        }
    });

    // Hacker game: Update player score
    socket.on('update-player-score', (data) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            // Broadcast to all players including host
            io.to(roomCode).emit('player-score-updated', data);
        }
    });

    // Hacker game: Select password (player action)
    socket.on('select-password', (data) => {
        const roomCode = socket.roomCode || data.roomCode;
        if (roomCode) {
            // Broadcast to all players
            io.to(roomCode).emit('password-selected', {
                playerId: data.playerId,
                playerName: data.playerName,
                password: data.password
            });
        }
    });

    // Hacker game: Password selected (legacy event, kept for compatibility)
    socket.on('password-selected', (data) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            // Broadcast to all players
            io.to(roomCode).emit('password-selected', data);
        }
    });

    // Hacker game: Hack attempt
    socket.on('hack-attempt', (data) => {
        const { roomCode, targetId, hackerId, hackerName, password } = data;
        if (roomCode) {
            // Send to target player
            io.to(targetId).emit('hack-attempt', {
                hackerId,
                hackerName,
                password
            });
        }
    });

    // Hacker game: Remove shield
    socket.on('remove-shield', (data) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            io.to(roomCode).emit('remove-shield', data);
        }
    });

    // Hacker game: Activate shield
    socket.on('activate-shield', (data) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            io.to(roomCode).emit('activate-shield', data);
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        const roomCode = socket.roomCode;
        if (roomCode) {
            const room = rooms.get(roomCode);
            if (room) {
                // Remove player
                room.players = room.players.filter(p => p.id !== socket.id);
                
                // If host left, assign new host or delete room
                if (room.host === socket.id) {
                    if (room.players.length > 0) {
                        room.host = room.players[0].id;
                        room.players[0].isHost = true;
                    } else {
                        rooms.delete(roomCode);
                        console.log(`Room ${roomCode} deleted`);
                        return;
                    }
                }
                
                // Notify remaining players
                io.to(roomCode).emit('room-updated', room);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});