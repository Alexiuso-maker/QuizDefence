import Phaser from 'phaser';
import { QUESTION_TYPES } from './GameScene.js';

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
                hasShield: false
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
        // Listen for password selection from players
        this.multiplayer.socket.on('player-password-selected', (data) => {
            const playerData = this.playerScores.get(data.playerId);
            if (playerData) {
                playerData.password = data.password;
            }
            console.log('Password selected:', data.playerName, data.password);
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
        this.gameStartTime = Date.now();
        this.gameActive = true;

        // Show question panel
        if (!this.isHost) {
            document.getElementById('hacker-question-panel').style.display = 'block';
            this.generateNewQuestion();
        }

        // Start timer
        this.startTimer();

        console.log(`Game started! Duration: ${duration} minutes`);
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
        if (!this.gameActive) return;

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
        // Get top 5 players
        const sortedPlayers = Array.from(this.playerScores.entries())
            .filter(([id, data]) => id !== this.multiplayer.socket.id) // Exclude self
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
        if (!targetPassword) {
            console.warn('Target has no password yet - cannot hack!');
            this.showRewardModal('HACK FAILED', `${targetData.name} hasn't set password yet!`, '#ff0000');
            setTimeout(() => this.generateNewQuestion(), 2000);
            return;
        }

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
            score: this.score
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
                hasShield: false
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
            item.innerHTML = `
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-name">${data.name}${shieldIcon}</span>
                <span class="leaderboard-score">${data.score} pts</span>
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
            item.innerHTML = `
                <div class="hack-log-time">${time}</div>
                <div>${event.hackerName} hacked ${event.victimName} for ${event.stolenPoints} points</div>
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
            resultsHTML += `
                <div class="leaderboard-item">
                    <span class="leaderboard-rank">${medal} #${index + 1}</span>
                    <span class="leaderboard-name">${data.name}</span>
                    <span class="leaderboard-score">${data.score} pts</span>
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
