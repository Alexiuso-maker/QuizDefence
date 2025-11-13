import Phaser from 'phaser';
import { QUESTION_TYPES } from '../questionTypes.js';

// Helper: Format large numbers (100k, 1M, etc.)
function formatScore(score) {
    if (score >= 1000000) {
        const millions = score / 1000000;
        return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
    } else if (score >= 100000) {
        const thousands = Math.floor(score / 1000);
        return `${thousands}k`;
    } else if (score >= 10000) {
        const thousands = (score / 1000).toFixed(1);
        return `${thousands}k`;
    } else {
        return score.toString();
    }
}

// Password pool (age 11 appropriate)
const PASSWORD_POOL = [
    'skibidi777', 'rizz999', 'sigma123', 'gyat456', 'fanum888',
    'mewing42', 'bussin99', 'slay321', 'yeet007', 'bruh404',
    'sus111', 'noob360', 'epic500', 'giga666', 'omega888',
    '676767676', 'SIXSEVEN!', '12341234', 'hello123!', 'noob1234',
    '999999999', 'abc123abc', 'YEET!007', 'SIGMA!23', 'BRUH!404',
    '111222333', 'xyz999xyz', 'GOAT!999', 'MEGA!777', '555666777'
];

// Helper: Generate 3 wrong alternatives for multiple choice
function generateWrongAlternatives(correctAnswer, questionType) {
    const alternatives = new Set();

    // Special handling for decimal comparison questions
    if (questionType === 'decimalComparison') {
        // The answer is a decimal string like "6,35"
        // Generate similar-looking decimal numbers
        const parts = correctAnswer.split(',');
        if (parts.length === 2) {
            const whole = parseInt(parts[0]);
            const decimal = parts[1];

            // Generate alternatives
            alternatives.add(`${whole},${decimal.length === 1 ? decimal + '0' : decimal.substring(0, 1)}`);
            alternatives.add(`${whole + 1},${decimal}`);
            alternatives.add(`${whole - 1 >= 0 ? whole - 1 : whole + 2},${decimal}`);

            // Remove correct answer if accidentally added
            alternatives.delete(correctAnswer);

            // Add more if needed
            while (alternatives.size < 3) {
                const randWhole = Phaser.Math.Between(Math.max(0, whole - 2), whole + 2);
                const randDec = Phaser.Math.Between(0, 99).toString().padStart(decimal.length, '0');
                const alt = `${randWhole},${randDec}`;
                if (alt !== correctAnswer) {
                    alternatives.add(alt);
                }
            }
        } else {
            // Fallback for whole numbers in comparison
            const num = parseInt(correctAnswer);
            alternatives.add((num - 1).toString());
            alternatives.add((num + 1).toString());
            alternatives.add((num + 2).toString());
        }
    } else {
        // Parse correct answer for numeric questions
        const correctNum = parseFloat(correctAnswer.toString().replace(',', '.'));

        if (!isNaN(correctNum)) {
            // Numeric answer - generate nearby wrong answers
            const isDecimal = correctAnswer.includes(',');
            const variations = [-3, -2, -1, 1, 2, 3, -4, 4];
            const shuffled = Phaser.Utils.Array.Shuffle([...variations]);

            for (let variation of shuffled) {
                if (alternatives.size >= 3) break;
                const wrongAnswer = correctNum + variation;
                if (wrongAnswer !== correctNum && wrongAnswer >= 0) {
                    // Format back to Norwegian comma format if it was decimal
                    let formatted;
                    if (isDecimal) {
                        // Preserve decimal places
                        const decimalPlaces = correctAnswer.split(',')[1]?.length || 1;
                        formatted = wrongAnswer.toFixed(decimalPlaces).replace('.', ',');
                    } else {
                        formatted = Math.round(wrongAnswer).toString();
                    }
                    alternatives.add(formatted);
                }
            }

            // If we don't have enough, add more variations
            while (alternatives.size < 3) {
                const randomVariation = Phaser.Math.Between(-10, 10);
                const wrongAnswer = correctNum + randomVariation;
                if (wrongAnswer !== correctNum && wrongAnswer >= 0) {
                    let formatted;
                    if (isDecimal) {
                        const decimalPlaces = correctAnswer.split(',')[1]?.length || 1;
                        formatted = wrongAnswer.toFixed(decimalPlaces).replace('.', ',');
                    } else {
                        formatted = Math.round(wrongAnswer).toString();
                    }
                    alternatives.add(formatted);
                }
            }
        } else {
            // Non-numeric answer fallback
            alternatives.add('???');
            alternatives.add('Error');
            alternatives.add('N/A');
        }
    }

    return Array.from(alternatives).slice(0, 3);
}

// Main Hacker Game Scene
export default class HackerScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HackerScene' });
    }

    create() {
        // Get multiplayer manager
        this.multiplayer = this.game.registry.get('multiplayer');
        this.multiplayer.hackerScene = this;

        // Game state
        this.isHost = this.multiplayer.isHost;
        this.score = 0;
        this.gameStartTime = null;
        this.gameDuration = 0; // Will be set by host
        this.gameActive = false;
        this.currentQuestion = null;
        this.playerPassword = null;

        // Player data (for host dashboard or all players)
        this.playerScores = new Map(); // playerId -> {name, score, password, hasShield}
        this.hackLog = []; // Array of hack events

        // Powerups
        this.hasShield = false;
        this.cryptoMinerQuestionsLeft = 0;

        // Intervals to clean up
        this.matrixInterval = null;
        this.timerInterval = null;

        // Initialize player scores
        this.multiplayer.players.forEach(player => {
            this.playerScores.set(player.id, {
                name: player.name,
                score: 0,
                password: null,
                hasShield: false,
                isHost: player.isHost || false
            });
        });

        // Set up Matrix canvas if not host
        if (!this.isHost) {
            this.createMatrixEffect();
            this.setupPlayerUI();
        } else {
            this.setupHostDashboard();
        }

        // Set up socket listeners
        this.setupSocketListeners();

        console.log('HackerScene created, isHost:', this.isHost);
    }

    createMatrixEffect() {
        const canvas = document.getElementById('matrix-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const columns = Math.floor(canvas.width / 20);
        const drops = Array(columns).fill(1);

        const drawMatrix = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#00ff41';
            ctx.font = '15px monospace';

            for (let i = 0; i < drops.length; i++) {
                const text = String.fromCharCode(Math.random() * 128);
                ctx.fillText(text, i * 20, drops[i] * 20);

                if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        this.matrixInterval = setInterval(drawMatrix, 50);
    }

    setupPlayerUI() {
        // Set player name
        const nameElement = document.getElementById('hacker-player-name');
        if (nameElement) {
            nameElement.textContent = this.multiplayer.playerName;
        }

        // Update score display
        this.updateScoreDisplay();

        // Hide question panel initially
        const questionPanel = document.getElementById('hacker-question-panel');
        if (questionPanel) {
            questionPanel.style.display = 'none';
        }
    }

    setupHostDashboard() {
        // Display room code
        const roomCodeDisplay = document.getElementById('host-dashboard-room-code');
        if (roomCodeDisplay) {
            roomCodeDisplay.textContent = this.multiplayer.roomCode;
        }

        // Create Matrix effect for host
        const canvas = document.getElementById('host-matrix-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const columns = Math.floor(canvas.width / 20);
        const drops = Array(columns).fill(1);

        const drawMatrix = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#00ff41';
            ctx.font = '15px monospace';

            for (let i = 0; i < drops.length; i++) {
                const text = String.fromCharCode(Math.random() * 128);
                ctx.fillText(text, i * 20, drops[i] * 20);

                if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        this.matrixInterval = setInterval(drawMatrix, 50);

        // Update dashboard
        this.updateHostDashboard();

        // Set up controls
        const endBtn = document.getElementById('host-end-btn');
        if (endBtn) {
            endBtn.onclick = () => {
                this.endGame();
            };
        }
    }

    setupSocketListeners() {
        // Listen for room updates (new players joining)
        this.multiplayer.socket.on('room-updated', (room) => {
            console.log('[ROOM-UPDATED] Checking for new players');
            // Add any new players to playerScores map
            room.players.forEach(player => {
                if (!this.playerScores.has(player.id)) {
                    console.log(`[ROOM-UPDATED] Adding new player to scores: ${player.name}`);
                    this.playerScores.set(player.id, {
                        name: player.name,
                        score: 0,
                        password: null,
                        hasShield: false,
                        isHost: player.isHost || false
                    });
                }
            });
        });

        // Listen for late joiners connecting (so we can notify them if timer started)
        this.multiplayer.socket.on('late-joiner-connected', (data) => {
            console.log(`[LATE-JOINER] ${data.playerName} joined mid-game`);

            // If timer has already started, notify the late joiner
            if (this.timerStarted && this.isHost) {
                console.log('[LATE-JOINER] Timer already started - notifying late joiner');
                // Send game-timer-started event directly to the late joiner
                this.multiplayer.socket.emit('notify-late-joiner-timer-started', {
                    roomCode: this.multiplayer.roomCode,
                    lateJoinerId: data.playerId
                });
            }
        });

        // Listen for password selection from players
        this.multiplayer.socket.on('password-selected', (data) => {
            console.log(`[PASSWORD-SELECTED EVENT] Player: ${data.playerName}, ID: ${data.playerId}, Password: ${data.password}`);

            // CRITICAL: Update the multiplayer.passwordsSelected Map so host knows who has passwords
            this.multiplayer.passwordsSelected.set(data.playerId, true);
            console.log(`[PASSWORD-SELECTED] Updated passwordsSelected Map, player ${data.playerId} now has password`);

            const playerData = this.playerScores.get(data.playerId);
            if (playerData) {
                playerData.password = data.password;
                console.log(`[PASSWORD-SELECTED] Password stored in playerScores for ${data.playerName}`);
            } else {
                console.warn(`[PASSWORD-SELECTED] Player ${data.playerId} not found in playerScores map - adding them now`);
                // Add the player if they're not in the map (late joiner)
                this.playerScores.set(data.playerId, {
                    name: data.playerName,
                    score: 0,
                    password: data.password,
                    hasShield: false,
                    isHost: false
                });
            }

            // If I'm the one who selected password
            if (data.playerId === this.multiplayer.socket.id && this.gameActive && !this.isHost) {
                console.log(`[PASSWORD-SELECTED] This is MY password selection!`);
                if (this.timerStarted) {
                    // Late joiner - game already started, generate question immediately
                    console.log('[PASSWORD-SELECTED] Late joiner! Game already started - generating question now!');
                    this.generateNewQuestion();
                } else {
                    // Game hasn't started yet - wait for timer
                    console.log('[PASSWORD-SELECTED] Password selected! Waiting for game to start...');
                }
            }

            // Check if all passwords selected (for early start) - ONLY HOST DOES THIS
            if (this.isHost) {
                console.log('[PASSWORD-SELECTED] I am host - checking if all passwords selected');
                this.checkIfAllPasswordsSelectedAndStartTimer();
            }
        });

        // Listen for password countdown ticks
        this.multiplayer.socket.on('password-countdown-tick', (data) => {
            const secondsRemaining = data.secondsRemaining;
            console.log(`Password countdown: ${secondsRemaining} seconds remaining`);

            if (!this.isHost) {
                // Update countdown display
                const countdownDisplay = document.getElementById('hacker-countdown-display');
                const countdownTimer = document.getElementById('hacker-countdown-timer');

                if (countdownDisplay && countdownTimer) {
                    countdownDisplay.style.display = 'flex';
                    countdownTimer.textContent = secondsRemaining;
                }

                // Update UI for players without password
                if (!this.multiplayer.passwordsSelected.get(this.multiplayer.socket.id)) {
                    // Show countdown in password selection area
                    const passwordHint = document.querySelector('.password-hint');
                    if (passwordHint) {
                        passwordHint.textContent = `Vel eit passord - du har ${secondsRemaining} sekund${secondsRemaining !== 1 ? 'er' : ''} att! Dette treng du for å forsvare deg mot hack!`;
                    }
                }
            }
        });

        // Listen for game timer start
        this.multiplayer.socket.on('game-timer-started', () => {
            console.log('[GAME-TIMER-STARTED] ========== RECEIVED EVENT ==========');
            console.log(`[GAME-TIMER-STARTED] My socket ID: ${this.multiplayer.socket.id}`);
            console.log(`[GAME-TIMER-STARTED] Am I host? ${this.isHost}`);
            console.log(`[GAME-TIMER-STARTED] Game active? ${this.gameActive}`);
            console.log(`[GAME-TIMER-STARTED] Timer started? ${this.timerStarted}`);
            console.log('[GAME-TIMER-STARTED] Full passwordsSelected Map:', Array.from(this.multiplayer.passwordsSelected.entries()));

            if (!this.isHost) {
                // Mark that timer has started
                this.timerStarted = true;

                // Hide countdown display
                const countdownDisplay = document.getElementById('hacker-countdown-display');
                if (countdownDisplay) {
                    countdownDisplay.style.display = 'none';
                }

                // Check if I have a password
                const hasPassword = this.multiplayer.passwordsSelected.get(this.multiplayer.socket.id);
                console.log(`[GAME-TIMER-STARTED] Do I have password? ${hasPassword}`);
                console.log(`[GAME-TIMER-STARTED] Checking passwordsSelected Map for my ID (${this.multiplayer.socket.id})`);

                // If I have a password, start generating questions NOW
                if (hasPassword) {
                    console.log('[GAME-TIMER-STARTED] ✓ I have password - calling generateNewQuestion()!');
                    this.generateNewQuestion();
                } else {
                    // Show message that they can still join by selecting password
                    console.log('[GAME-TIMER-STARTED] ✗ No password yet - showing join message');
                    const feedbackDiv = document.getElementById('hacker-feedback');
                    if (feedbackDiv) {
                        feedbackDiv.innerHTML = '<p style="color: #ffff00;">Spelet har starta! Vel eit passord for å bli med!</p>';
                    }
                }
            } else {
                console.log('[GAME-TIMER-STARTED] I am host - not generating questions');
            }
        });

        // Listen for score updates
        this.multiplayer.socket.on('player-score-update', (data) => {
            const playerData = this.playerScores.get(data.playerId);
            if (playerData) {
                playerData.score = data.score;
            }

            if (this.isHost) {
                this.updateHostDashboard();
            } else if (data.playerId === this.multiplayer.socket.id) {
                this.score = data.score;
                this.updateScoreDisplay();
            }
        });

        // Listen for hack events
        this.multiplayer.socket.on('hack-event', (data) => {
            this.hackLog.push(data);

            // Update victim's score
            if (data.victimId === this.multiplayer.socket.id) {
                this.score = data.newVictimScore;
                this.updateScoreDisplay();
                this.showHackedNotification(data.hackerName, data.stolenPoints);
            }

            // Update hacker's score
            if (data.hackerId === this.multiplayer.socket.id) {
                this.score = data.newHackerScore;
                this.updateScoreDisplay();
            }

            // Update player scores map
            const victimData = this.playerScores.get(data.victimId);
            if (victimData) {
                victimData.score = data.newVictimScore;
            }

            const hackerData = this.playerScores.get(data.hackerId);
            if (hackerData) {
                hackerData.score = data.newHackerScore;
            }

            if (this.isHost) {
                this.updateHostDashboard();
            }
        });

        // Listen for crypto miner activations
        this.multiplayer.socket.on('crypto-miner-tick', (data) => {
            // Everyone with active crypto miner gets +1 point
            if (this.cryptoMinerQuestionsLeft > 0) {
                this.score++;
                this.updateScoreDisplay();
                this.emitScoreUpdate();
            }
        });
    }

    startGame(duration) {
        this.gameDuration = duration * 60 * 1000; // Convert minutes to milliseconds
        this.gameActive = true;
        this.timerStarted = false; // Track if timer has started
        this.passwordCountdown = 30; // 30 seconds for password selection

        // CRITICAL: Sync existing passwordsSelected state from multiplayer manager
        // This ensures we have passwords from players who selected before this scene was created
        console.log('[STARTGAME] Syncing existing password state from multiplayer manager...');
        console.log('[STARTGAME] passwordsSelected Map size:', this.multiplayer.passwordsSelected.size);
        console.log('[STARTGAME] passwordsSelected entries:', Array.from(this.multiplayer.passwordsSelected.entries()));

        // Check if I already have a password selected (might have selected in lobby before game started)
        const myPasswordAlreadySelected = this.multiplayer.passwordsSelected.get(this.multiplayer.socket.id);
        console.log(`[STARTGAME] Do I already have password? ${myPasswordAlreadySelected}`);

        // Show question panel (but disabled until password selected)
        if (!this.isHost) {
            document.getElementById('hacker-question-panel').style.display = 'block';
        }

        // Start 30-second countdown for password selection
        if (this.isHost) {
            console.log('Starting 30-second countdown for password selection...');
            this.startPasswordCountdown();
        } else {
            console.log('You have 30 seconds to select your password!');
        }

        console.log(`Game initialized! Duration: ${duration} minutes`);
    }

    startPasswordCountdown() {
        // Store start time for accurate countdown
        this.passwordCountdownStartTime = Date.now();
        const totalSeconds = 30;

        // Broadcast initial countdown to all players
        this.multiplayer.socket.emit('password-countdown-tick', {
            roomCode: this.multiplayer.roomCode,
            secondsRemaining: totalSeconds
        });

        // Check countdown every 100ms for accuracy
        this.passwordCountdownInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.passwordCountdownStartTime) / 1000);
            const remaining = Math.max(0, totalSeconds - elapsed);

            // Only broadcast if the second changed
            if (remaining !== this.passwordCountdown) {
                this.passwordCountdown = remaining;

                // Broadcast countdown to all players
                this.multiplayer.socket.emit('password-countdown-tick', {
                    roomCode: this.multiplayer.roomCode,
                    secondsRemaining: this.passwordCountdown
                });

                if (this.passwordCountdown <= 0) {
                    clearInterval(this.passwordCountdownInterval);
                    console.log('Password selection time is up! Starting game timer...');
                    this.startTimerNow();

                    // Notify all players that game timer has started
                    this.multiplayer.socket.emit('game-timer-started', {
                        roomCode: this.multiplayer.roomCode
                    });
                }
            }
        }, 100);
    }

    checkIfAllPasswordsSelectedAndStartTimer() {
        // Get all non-host players
        const nonHostPlayers = this.multiplayer.players.filter(p => !p.isHost);
        console.log(`[CHECK-PASSWORDS] Total non-host players: ${nonHostPlayers.length}`);

        nonHostPlayers.forEach(p => {
            const hasPassword = this.multiplayer.passwordsSelected.get(p.id);
            console.log(`[CHECK-PASSWORDS] Player ${p.name} (${p.id}): password = ${hasPassword}`);
        });

        // Check if all non-host players have selected passwords
        const allSelected = nonHostPlayers.every(p =>
            this.multiplayer.passwordsSelected.get(p.id)
        );

        console.log(`[CHECK-PASSWORDS] All passwords selected? ${allSelected}, Timer started? ${this.timerStarted}`);

        if (allSelected && !this.timerStarted) {
            console.log('[CHECK-PASSWORDS] All players selected passwords early! Starting timer NOW...');

            // Clear password countdown
            if (this.passwordCountdownInterval) {
                clearInterval(this.passwordCountdownInterval);
            }

            this.startTimerNow();

            // Notify all players that game timer has started
            this.multiplayer.socket.emit('game-timer-started', {
                roomCode: this.multiplayer.roomCode
            });
        }
    }

    startTimerNow() {
        if (this.timerStarted) return;

        this.timerStarted = true;
        this.gameStartTime = Date.now();
        this.startTimer();

        console.log('Timer started!');
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.gameStartTime;
            const remaining = Math.max(0, this.gameDuration - elapsed);

            if (remaining <= 0) {
                this.endGame();
                return;
            }

            // Update timer display
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (this.isHost) {
                const display = document.getElementById('host-timer-display');
                if (display) display.textContent = timeString;
            } else {
                const display = document.getElementById('hacker-timer');
                if (display) display.textContent = timeString;
            }
        }, 100);
    }

    generateNewQuestion() {
        console.log('[GENERATE-QUESTION] ========== CALLED ==========');
        console.log(`[GENERATE-QUESTION] gameActive: ${this.gameActive}`);
        console.log(`[GENERATE-QUESTION] isHost: ${this.isHost}`);

        if (!this.gameActive) {
            console.log('[GENERATE-QUESTION] ✗ BLOCKED - game not active');
            return;
        }

        // Don't generate questions if player hasn't selected password yet
        const hasPassword = this.multiplayer.passwordsSelected.get(this.multiplayer.socket.id);
        console.log(`[GENERATE-QUESTION] Do I have password? ${hasPassword}`);

        if (!this.isHost && !hasPassword) {
            console.log('[GENERATE-QUESTION] ✗ BLOCKED - no password selected yet');
            return;
        }

        console.log('[GENERATE-QUESTION] ✓ All checks passed - generating question now');

        // Use selected question types or all types
        const allowedTypes = this.multiplayer.selectedQuestionTypes;
        const questionTypeKeys = allowedTypes && allowedTypes.length > 0
            ? allowedTypes
            : Object.keys(QUESTION_TYPES);

        // Select random question type
        const randomType = questionTypeKeys[Phaser.Math.Between(0, questionTypeKeys.length - 1)];
        const questionData = QUESTION_TYPES[randomType].generate();

        // Generate wrong alternatives
        const wrongAlternatives = generateWrongAlternatives(questionData.answer, randomType);

        // Create full options array (1 correct + 3 wrong)
        const allOptions = [questionData.answer, ...wrongAlternatives];

        // Shuffle options
        const shuffledOptions = Phaser.Utils.Array.Shuffle([...allOptions]);

        this.currentQuestion = {
            question: questionData.question,
            correctAnswer: questionData.answer,
            options: shuffledOptions
        };

        // Display question
        this.displayQuestion();
    }

    displayQuestion() {
        const questionText = document.getElementById('hacker-question-text');
        const optionsContainer = document.getElementById('hacker-answer-options');
        const feedbackDiv = document.getElementById('hacker-feedback');

        if (!questionText || !optionsContainer || !feedbackDiv) {
            console.error('Question display elements not found!');
            return;
        }

        questionText.textContent = this.currentQuestion.question;
        feedbackDiv.textContent = '';
        optionsContainer.innerHTML = '';

        // Create 4 answer buttons
        this.currentQuestion.options.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.textContent = option;
            btn.onclick = () => this.checkAnswer(option, btn);
            optionsContainer.appendChild(btn);
        });
    }

    checkAnswer(selectedAnswer, buttonElement) {
        const isCorrect = selectedAnswer === this.currentQuestion.correctAnswer;

        // Disable all buttons
        const allButtons = document.querySelectorAll('.answer-btn');
        allButtons.forEach(btn => btn.disabled = true);

        if (isCorrect) {
            buttonElement.classList.add('correct');

            // Award 100 points
            this.score += 100;
            this.updateScoreDisplay();
            this.emitScoreUpdate();

            // Trigger crypto miner tick for others
            this.multiplayer.socket.emit('crypto-miner-tick', {
                roomCode: this.multiplayer.roomCode
            });

            // Decrement crypto miner counter if active
            if (this.cryptoMinerQuestionsLeft > 0) {
                this.cryptoMinerQuestionsLeft--;
                this.updateStatusIcons();
            }

            // Show reward after delay
            setTimeout(() => {
                this.rollReward();
            }, 1000);

        } else {
            buttonElement.classList.add('incorrect');

            // Just generate new question after delay (no penalty)
            setTimeout(() => {
                this.generateNewQuestion();
            }, 1500);
        }
    }

    rollReward() {
        const elapsed = Date.now() - this.gameStartTime;
        const isAfterOneMinute = elapsed >= 60000;

        const roll = Math.random() * 100;

        if (isAfterOneMinute) {
            // After 1 minute: 70% hack, 15% multiplier, 10% crypto, 5% shield
            if (roll < 70) {
                this.triggerHack();
            } else if (roll < 85) {
                this.triggerMultiplier();
            } else if (roll < 95) {
                this.triggerCryptoMiner();
            } else {
                this.triggerShield();
            }
        } else {
            // First minute: 60% points, 20% multiplier, 10% crypto, 10% shield
            if (roll < 60) {
                // Just continue (already got 100 points)
                this.generateNewQuestion();
            } else if (roll < 80) {
                this.triggerMultiplier();
            } else if (roll < 90) {
                this.triggerCryptoMiner();
            } else {
                this.triggerShield();
            }
        }
    }

    triggerHack() {
        // Show hack modal
        this.showHackModal();
    }

    showHackModal() {
        // Get top 5 players (exclude self and host)
        const sortedPlayers = Array.from(this.playerScores.entries())
            .filter(([id, data]) => {
                // Exclude self
                if (id === this.multiplayer.socket.id) return false;
                // Exclude host (host doesn't play)
                if (data.isHost) return false;
                return true;
            })
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 5);

        if (sortedPlayers.length === 0) {
            // No one to hack
            this.showRewardModal('NO TARGETS', 'No other players to hack!', '#ffff00');
            setTimeout(() => this.generateNewQuestion(), 2000);
            return;
        }

        // Weighted random selection
        const roll = Math.random() * 100;
        let target;

        if (roll < 40 && sortedPlayers[0]) {
            target = sortedPlayers[0];
        } else if (roll < 65 && sortedPlayers[1]) {
            target = sortedPlayers[1];
        } else if (roll < 85 && sortedPlayers[2]) {
            target = sortedPlayers[2];
        } else if (roll < 95 && sortedPlayers[3]) {
            target = sortedPlayers[3];
        } else if (sortedPlayers[4]) {
            target = sortedPlayers[4];
        } else {
            target = sortedPlayers[0]; // Fallback
        }

        const [targetId, targetData] = target;

        // Show hack modal
        const modal = document.getElementById('hack-modal');
        const targetNameSpan = document.getElementById('hack-target-name');
        const passwordOptions = document.getElementById('hack-password-options');

        if (!modal || !targetNameSpan || !passwordOptions) {
            console.error('Hack modal elements not found!');
            this.generateNewQuestion();
            return;
        }

        targetNameSpan.textContent = `TARGET: ${targetData.name.toUpperCase()}`;
        passwordOptions.innerHTML = '';

        // Get target's password and 2 random others
        const targetPassword = targetData.password;
        console.log(`[HACK] Target: ${targetData.name}, ID: ${targetId}`);
        console.log(`[HACK] Target password in playerScores:`, targetPassword);
        console.log(`[HACK] All playerScores:`, Array.from(this.playerScores.entries()).map(([id, data]) => ({
            id, name: data.name, hasPassword: !!data.password
        })));

        if (!targetPassword) {
            console.warn(`[HACK] ✗ Target ${targetData.name} has no password yet - cannot hack!`);
            this.showRewardModal('HACK FAILED', `${targetData.name} hasn't set password yet!`, '#ff0000');
            setTimeout(() => this.generateNewQuestion(), 2000);
            return;
        }

        console.log('[HACK] ✓ Target has password - showing hack modal');

        const otherPasswords = PASSWORD_POOL.filter(p => p !== targetPassword);
        const randomPasswords = Phaser.Utils.Array.Shuffle([...otherPasswords]).slice(0, 2);
        const allPasswords = [targetPassword, ...randomPasswords];
        const shuffledPasswords = Phaser.Utils.Array.Shuffle([...allPasswords]);

        // Create password buttons
        shuffledPasswords.forEach(password => {
            const btn = document.createElement('button');
            btn.className = 'password-btn';
            btn.textContent = password;
            btn.onclick = () => {
                modal.style.display = 'none';
                this.attemptHack(targetId, targetData, password === targetPassword);
            };
            passwordOptions.appendChild(btn);
        });

        modal.style.display = 'flex';
    }

    attemptHack(targetId, targetData, success) {
        if (success && !targetData.hasShield) {
            // Calculate stolen points
            const stolenPoints = Math.floor(targetData.score * 0.3);
            const newVictimScore = targetData.score - stolenPoints;
            const newHackerScore = this.score + stolenPoints;

            // Emit hack event
            this.multiplayer.socket.emit('hack-attempt', {
                roomCode: this.multiplayer.roomCode,
                hackerId: this.multiplayer.socket.id,
                hackerName: this.multiplayer.playerName,
                victimId: targetId,
                victimName: targetData.name,
                stolenPoints: stolenPoints,
                newVictimScore: newVictimScore,
                newHackerScore: newHackerScore
            });

            // Show success notification
            this.showRewardModal('HACK SUCCESSFUL!', `Stole ${stolenPoints} points from ${targetData.name}!`, '#00ff00');

        } else if (targetData.hasShield) {
            // Blocked by shield
            this.showRewardModal('BLOCKED!', `${targetData.name} has a shield!`, '#ff0000');

            // Remove target's shield via socket event
            this.multiplayer.socket.emit('remove-shield', {
                roomCode: this.multiplayer.roomCode,
                playerId: targetId
            });

        } else {
            // Wrong password
            this.showRewardModal('ACCESS DENIED!', 'Wrong password!', '#ff0000');
        }

        // Continue to next question
        setTimeout(() => {
            this.generateNewQuestion();
        }, 2000);
    }

    triggerMultiplier() {
        // Roll for x2, x3, or x4 (weighted: 60% x2, 30% x3, 10% x4)
        const roll = Math.random() * 100;
        let multiplier;

        if (roll < 60) {
            multiplier = 2;
        } else if (roll < 90) {
            multiplier = 3;
        } else {
            multiplier = 4;
        }

        // Apply multiplier to total score
        this.score = Math.floor(this.score * multiplier);
        this.updateScoreDisplay();
        this.emitScoreUpdate();

        // Show reward modal
        this.showRewardModal('MULTIPLIER!', `x${multiplier} - Your score multiplied!`, '#ffff00');

        setTimeout(() => {
            this.generateNewQuestion();
        }, 2000);
    }

    triggerCryptoMiner() {
        // Activate crypto miner for next 10 questions
        this.cryptoMinerQuestionsLeft = 10;
        this.updateStatusIcons();

        // Show reward modal
        this.showRewardModal('CRYPTO MINER!', 'Earn +1 point per question others answer (10 questions)', '#00ffff');

        setTimeout(() => {
            this.generateNewQuestion();
        }, 2500);
    }

    triggerShield() {
        // Activate shield for current player
        this.hasShield = true;

        // Update player data in map
        const myData = this.playerScores.get(this.multiplayer.socket.id);
        if (myData) {
            myData.hasShield = true;
        }

        // Notify server about shield activation
        this.multiplayer.socket.emit('activate-shield', {
            roomCode: this.multiplayer.roomCode,
            playerId: this.multiplayer.socket.id
        });

        this.updateStatusIcons();

        // Show reward modal
        this.showRewardModal('SHIELD ACTIVATED!', 'Blocks next hack attempt!', '#0088ff');

        setTimeout(() => {
            this.generateNewQuestion();
        }, 2000);
    }

    showRewardModal(title, message, color) {
        const modal = document.getElementById('reward-modal');
        const content = document.getElementById('reward-content');

        content.innerHTML = `
            <h2 style="color: ${color}; font-size: 48px; text-shadow: 0 0 20px ${color};">${title}</h2>
            <p style="color: #00ff41; font-size: 24px;">${message}</p>
        `;

        modal.style.display = 'flex';

        setTimeout(() => {
            modal.style.display = 'none';
        }, 2000);
    }

    showHackedNotification(hackerName, stolenPoints) {
        const modal = document.getElementById('reward-modal');
        const content = document.getElementById('reward-content');

        content.innerHTML = `
            <h2 style="color: #ff0000; font-size: 48px; text-shadow: 0 0 20px #ff0000; animation: glitch 0.5s infinite;">YOU'VE BEEN HACKED!</h2>
            <p style="color: #ff0000; font-size: 24px;">${hackerName} stole ${stolenPoints} points!</p>
        `;

        modal.style.display = 'flex';

        setTimeout(() => {
            modal.style.display = 'none';
        }, 3000);
    }

    updateScoreDisplay() {
        const scoreElement = document.getElementById('hacker-score');
        if (scoreElement) {
            scoreElement.textContent = this.score;
        }

        // Update rank
        const sortedScores = Array.from(this.playerScores.values())
            .sort((a, b) => b.score - a.score);
        const myRank = sortedScores.findIndex(p => p.name === this.multiplayer.playerName) + 1;

        const rankElement = document.getElementById('hacker-rank');
        if (rankElement) {
            rankElement.textContent = `#${myRank}`;
        }
    }

    updateStatusIcons() {
        const container = document.getElementById('hacker-status-icons');
        if (!container) return;

        container.innerHTML = '';

        // Shield icon
        if (this.hasShield) {
            const shieldDiv = document.createElement('div');
            shieldDiv.className = 'status-icon';
            shieldDiv.innerHTML = `
                🛡️
                <div class="status-icon-label">SHIELD</div>
            `;
            container.appendChild(shieldDiv);
        }

        // Crypto miner icon
        if (this.cryptoMinerQuestionsLeft > 0) {
            const minerDiv = document.createElement('div');
            minerDiv.className = 'status-icon';
            minerDiv.innerHTML = `
                ₿
                <div class="status-icon-label">MINER (${this.cryptoMinerQuestionsLeft})</div>
            `;
            container.appendChild(minerDiv);
        }
    }

    emitScoreUpdate() {
        this.multiplayer.socket.emit('update-player-score', {
            roomCode: this.multiplayer.roomCode,
            playerId: this.multiplayer.socket.id,
            playerName: this.multiplayer.playerName,
            score: this.score,
            isHost: this.multiplayer.isHost
        });
    }

    updatePlayerScore(data) {
        // Update the score in playerScores map
        const playerData = this.playerScores.get(data.playerId);
        if (playerData) {
            playerData.score = data.score;
        } else {
            // Player not in map yet, add them
            this.playerScores.set(data.playerId, {
                name: data.playerName || 'Unknown',
                score: data.score,
                password: null,
                hasShield: false,
                isHost: data.isHost || false
            });
        }

        // Update host dashboard if this is the host
        if (this.multiplayer.isHost) {
            this.updateHostDashboard();
        }
    }

    handleHackAttempt(data) {
        // Update victim's score
        const victimData = this.playerScores.get(data.victimId);
        if (victimData) {
            victimData.score = data.newVictimScore;
        }

        // Update hacker's score
        const hackerData = this.playerScores.get(data.hackerId);
        if (hackerData) {
            hackerData.score = data.newHackerScore;
        }

        // If this is me being hacked, update my score
        if (data.victimId === this.multiplayer.socket.id) {
            this.score = data.newVictimScore;
            this.updateScoreDisplay();
        }

        // If this is me hacking, update my score
        if (data.hackerId === this.multiplayer.socket.id) {
            this.score = data.newHackerScore;
            this.updateScoreDisplay();
        }

        // Add to hack log
        this.hackLog.push(data);

        // Update host dashboard
        if (this.multiplayer.isHost) {
            this.updateHostDashboard();
        }
    }

    handleRemoveShield(data) {
        // Remove shield from player
        const playerData = this.playerScores.get(data.playerId);
        if (playerData) {
            playerData.hasShield = false;
        }

        // If this is me, update my shield status
        if (data.playerId === this.multiplayer.socket.id) {
            this.hasShield = false;
            this.updateStatusIcons();
        }
    }

    handleActivateShield(data) {
        // Activate shield for player
        const playerData = this.playerScores.get(data.playerId);
        if (playerData) {
            playerData.hasShield = true;
        }
    }

    updateHostDashboard() {
        // Update leaderboard
        const leaderboard = document.getElementById('host-leaderboard');
        if (!leaderboard) return;

        const sortedPlayers = Array.from(this.playerScores.entries())
            .sort((a, b) => b[1].score - a[1].score);

        leaderboard.innerHTML = '';
        sortedPlayers.forEach(([id, data], index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            const shieldIcon = data.hasShield ? ' 🛡️' : '';
            const formattedScore = formatScore(data.score);
            item.innerHTML = `
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-name">${data.name}${shieldIcon}</span>
                <span class="leaderboard-score">${formattedScore}</span>
            `;
            leaderboard.appendChild(item);
        });

        // Update hack log
        const hackLogContainer = document.getElementById('host-hack-log');
        if (!hackLogContainer) return;

        hackLogContainer.innerHTML = '';
        [...this.hackLog].reverse().slice(0, 20).forEach(event => {
            const item = document.createElement('div');
            item.className = 'hack-log-item';
            const time = new Date(event.timestamp).toLocaleTimeString();
            const formattedPoints = formatScore(event.stolenPoints);
            item.innerHTML = `
                <div class="hack-log-time">${time}</div>
                <div>${event.hackerName} hacked ${event.victimName} for ${formattedPoints}</div>
            `;
            hackLogContainer.appendChild(item);
        });
    }

    endGame() {
        // Clear all intervals
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.matrixInterval) clearInterval(this.matrixInterval);
        this.gameActive = false;

        // Show game over modal
        const modal = document.getElementById('hacker-game-over-modal');
        const results = document.getElementById('hacker-final-results');

        const sortedPlayers = Array.from(this.playerScores.entries())
            .sort((a, b) => b[1].score - a[1].score);

        let resultsHTML = '<h3 style="color: #00ff41;">FINAL SCORES</h3>';
        sortedPlayers.forEach(([id, data], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            const formattedScore = formatScore(data.score);
            resultsHTML += `
                <div class="leaderboard-item">
                    <span class="leaderboard-rank">${medal} #${index + 1}</span>
                    <span class="leaderboard-name">${data.name}</span>
                    <span class="leaderboard-score">${formattedScore}</span>
                </div>
            `;
        });

        results.innerHTML = resultsHTML;
        modal.style.display = 'flex';

        document.getElementById('hacker-return-lobby-btn').onclick = () => {
            location.reload();
        };
    }

    update() {
        // Game loop (if needed)
    }
}
