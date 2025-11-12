import Phaser from 'phaser';

// --- Game Constants ---
const LANES = 6;
const BASE_MONSTER_SPEED = 15; // Slower UFOs
const BASE_HEALTH = 10;
const MONSTER_DAMAGE = 10;
const MAX_AMMO = 999; // Changed from 10 - now effectively unlimited
const AMMO_PER_QUESTION = 2;

// Boss constants
const BOSS_SPAWN_INTERVAL = 15; // Boss every 10 monsters
const BOSS_SIZE_MULTIPLIER = 2.5; // 2.5x bigger
const BOSS_HEALTH_MULTIPLIER = 8; // 8x more health
const BOSS_SPEED_MULTIPLIER = 0.8; // Slower but tankier

// Weapon configurations
const WEAPONS = {
    basic: { damage: 15, cost: 1, color: 0x3498db, name: 'Basic Shot' },
    power: { damage: 50, cost: 3, color: 0xe74c3c, name: 'Power Shot' },
    freeze: { damage: 20, cost: 2, color: 0x9b59b6, name: 'Freeze Shot', freeze: true }
};

// Upgrade System
const UPGRADES = {
    damage: {
        id: 'damage',
        name: 'Damage Boost',
        description: 'Increase your shot damage',
        icon: '⚡',
        maxLevel: Infinity,
        getBonus: (level) => level * 5,
        getDescription: (level) => `+${level * 5} damage per shot (Next: +${(level + 1) * 5})`
    },
    critical: {
        id: 'critical',
        name: 'Critical Strike',
        description: 'Chance to deal massive damage',
        icon: '💥',
        maxLevel: Infinity,
        getBonus: (level) => {
            const chance = Math.min(10 + (level * 5), 50);
            const multiplier = 2 + (level * 0.25);
            return { chance, multiplier };
        },
        getDescription: (level) => {
            const current = Math.min(10 + (level * 5), 50);
            const next = Math.min(10 + ((level + 1) * 5), 50);
            const multCurrent = 2 + (level * 0.25);
            const multNext = 2 + ((level + 1) * 0.25);
            return `${current}% chance for ${multCurrent.toFixed(1)}x damage (Next: ${next}% for ${multNext.toFixed(1)}x)`;
        }
    },
    pierce: {
        id: 'pierce',
        name: 'Pierce Shot',
        description: 'Shots hit multiple enemies in a lane',
        icon: '🎯',
        maxLevel: 3,
        getBonus: (level) => Math.min(level, 3),
        getDescription: (level) => {
            if (level === 0) return 'Hit +1 enemy behind target (Next: +1 pierce)';
            if (level === 1) return 'Hit +1 enemy (Next: +2 enemies)';
            if (level === 2) return 'Hit +2 enemies (Next: All in lane)';
            return 'Hit ALL enemies in lane (MAX)';
        }
    },
    executioner: {
        id: 'executioner',
        name: 'Executioner',
        description: 'Instantly kill low-health enemies',
        icon: '💀',
        maxLevel: Infinity,
        getBonus: (level) => 20 + (level * 10),
        getDescription: (level) => {
            const current = 20 + (level * 10);
            const next = 20 + ((level + 1) * 10);
            return `Kill enemies below ${current}% HP (Next: ${next}%)`;
        }
    },
    slow: {
        id: 'slow',
        name: 'Slow',
        description: 'Slow down enemies (stacks with team)',
        icon: '🐌',
        maxLevel: Infinity,
        getBonus: (level) => level * 0.2,
        getDescription: (level) => {
            const current = (level * 0.2).toFixed(1);
            const next = ((level + 1) * 0.2).toFixed(1);
            return `50% slow for ${current}s (Next: ${next}s)`;
        }
    },
    freeze: {
        id: 'freeze',
        name: 'Freeze',
        description: 'Completely stop enemies (stacks with team)',
        icon: '❄️',
        maxLevel: Infinity,
        getBonus: (level) => level * 0.1,
        getDescription: (level) => {
            const current = (level * 0.1).toFixed(1);
            const next = ((level + 1) * 0.1).toFixed(1);
            return `100% stop for ${current}s (Next: ${next}s)`;
        }
    },
    splash: {
        id: 'splash',
        name: 'Splash Damage',
        description: 'Damage enemies near your target',
        icon: '💢',
        maxLevel: Infinity,
        getBonus: (level) => Math.min(25 + (level * 25), 100),
        getDescription: (level) => {
            const current = Math.min(25 + (level * 25), 100);
            const next = Math.min(25 + ((level + 1) * 25), 100);
            return `${current}% damage to nearby enemies (Next: ${next}%)`;
        }
    },
    maxAmmo: {
        id: 'maxAmmo',
        name: 'Max Ammo',
        description: 'Increase ammo capacity',
        icon: '📦',
        maxLevel: Infinity,
        getBonus: (level) => 10 + (level * 3),
        getDescription: (level) => {
            const current = 10 + (level * 3);
            const next = 10 + ((level + 1) * 3);
            return `Max ammo: ${current} (Next: ${next})`;
        }
    },
    bonusAmmo: {
        id: 'bonusAmmo',
        name: 'Bonus Ammo',
        description: 'Extra ammo per correct answer',
        icon: '🎁',
        maxLevel: Infinity,
        getBonus: (level) => level,
        getDescription: (level) => `+${2 + level} ammo per answer (Next: +${2 + level + 1})`
    },
    efficientShooter: {
        id: 'efficientShooter',
        name: 'Efficient Shooter',
        description: 'Chance for free shots',
        icon: '♻️',
        maxLevel: Infinity,
        getBonus: (level) => Math.min(level * 5, 50),
        getDescription: (level) => {
            const current = Math.min(level * 5, 50);
            const next = Math.min((level + 1) * 5, 50);
            return `${current}% free shots (Next: ${next}%)`;
        }
    },
    startingAmmo: {
        id: 'startingAmmo',
        name: 'Starting Ammo',
        description: 'Begin waves with bonus ammo',
        icon: '🚀',
        maxLevel: Infinity,
        getBonus: (level) => level * 3,
        getDescription: (level) => {
            const current = level * 3;
            const next = (level + 1) * 3;
            return `Start with +${current} ammo (Next: +${next})`;
        }
    },
    scavenger: {
        id: 'scavenger',
        name: 'Ammo Scavenger',
        description: 'Chance to gain ammo on kill',
        icon: '🔍',
        maxLevel: Infinity,
        getBonus: (level) => Math.min(10 + (level * 5), 50),
        getDescription: (level) => {
            const current = Math.min(10 + (level * 5), 50);
            const next = Math.min(10 + ((level + 1) * 5), 50);
            return `${current}% chance for +1 ammo on kill (Next: ${next}%)`;
        }
    },
    baseHealth: {
        id: 'baseHealth',
        name: 'Base Health',
        description: 'Increase base maximum health',
        icon: '💚',
        maxLevel: Infinity,
        getBonus: (level) => 2 + (level * 2),
        getDescription: (level) => {
            const current = BASE_HEALTH + (2 + (level * 2));
            const next = BASE_HEALTH + (2 + ((level + 1) * 2));
            return `Base HP: ${current} (Next: ${next})`;
        }
    },
    lifeSteal: {
        id: 'lifeSteal',
        name: 'Life Steal',
        description: 'Heal base on kills',
        icon: '💖',
        maxLevel: 4,
        getBonus: (level) => Math.max(5 - level, 2),
        getDescription: (level) => {
            const current = Math.max(5 - level, 2);
            const next = Math.max(5 - level - 1, 2);
            return `Heal 1 HP per ${current} kills (Next: per ${next} kills)`;
        }
    },
    bossKiller: {
        id: 'bossKiller',
        name: 'Boss Killer',
        description: 'Extra damage to bosses',
        icon: '👑',
        maxLevel: Infinity,
        getBonus: (level) => 50 + (level * 50),
        getDescription: (level) => {
            const current = 50 + (level * 50);
            const next = 50 + ((level + 1) * 50);
            return `+${current}% boss damage (Next: +${next}%)`;
        }
    },
    prepTime: {
        id: 'prepTime',
        name: 'Extended Prep',
        description: 'More time between waves',
        icon: '⏰',
        maxLevel: Infinity,
        getBonus: (level) => 10 + (level * 2),
        getDescription: (level) => {
            const current = 10 + (level * 2);
            const next = 10 + ((level + 1) * 2);
            return `${current}s prep time (Next: ${next}s)`;
        }
    }
};

// --- Question Generator ---
function generateQuestion(difficulty) {
    const operations = ['+', '-', '*'];
    const operation = operations[Phaser.Math.Between(0, Math.min(difficulty - 1, 2))];
    
    let num1, num2, question, answer;
    
    switch(operation) {
        case '+':
            num1 = Phaser.Math.Between(difficulty * 5, difficulty * 15);
            num2 = Phaser.Math.Between(1, difficulty * 10);
            question = `${num1} + ${num2}`;
            answer = num1 + num2;
            break;
        case '-':
            num1 = Phaser.Math.Between(difficulty * 10, difficulty * 20);
            num2 = Phaser.Math.Between(1, difficulty * 10);
            question = `${num1} - ${num2}`;
            answer = num1 - num2;
            break;
        case '*':
            num1 = Phaser.Math.Between(2, difficulty + 5);
            num2 = Phaser.Math.Between(2, Math.min(difficulty + 3, 12));
            question = `${num1} × ${num2}`;
            answer = num1 * num2;
            break;
    }
    
    return { question, answer: answer.toString() };
}

// --- Main Game Scene ---
export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Load UFO enemy sprites
        this.load.image('ufo-a', '/assets/monsters/enemy-ufo-a.png');
        this.load.image('ufo-b', '/assets/monsters/enemy-ufo-b.png');
        this.load.image('ufo-c', '/assets/monsters/enemy-ufo-c.png');
        this.load.image('ufo-d', '/assets/monsters/enemy-ufo-d.png');
        
        // Load boss sprites (you can add these when you have the images)
        // this.load.image('boss-1', '/assets/monsters/boss-1.png');
        // this.load.image('boss-2', '/assets/monsters/boss-2.png');
    }

    create() {
        // Get multiplayer manager
        this.multiplayer = this.game.registry.get('multiplayer');
        this.multiplayer.gameScene = this;
        
        // Set up game world
        this.cameras.main.setBackgroundColor('#1a1a2e');
        
        // Initialize game state
        this.score = 0;
        this.baseHealth = BASE_HEALTH;
        this.lastSpawnTime = 0;
        // Adjust spawn interval and monsters per wave based on player count
        const playerCount = this.multiplayer.players.length;
        this.spawnInterval = Math.max(300, 1200 - (playerCount * 150)); // Faster with more players
        this.difficulty = 1;
        this.monstersKilled = 0;
        this.monstersSpawned = 0; // Track total spawned for boss timing
        this.monstersPerWave = 2 * playerCount; // 2 monsters per player per wave
        this.monstersThisWave = 0; // Track kills this wave
        this.bossActive = false; // Is boss currently active?
         this.isPaused = false;
        this.ammo = 0; // Start with 0 ammo, must answer questions
        this.selectedWeapon = 'basic';
        this.questionsAnswered = 0;
        this.totalShots = 0;
        this.nextMonsterId = 0;
        this.killsSinceLastHeal = 0; // For life steal tracking

        // Monster tracking
        this.monsters = new Map(); // monsterId -> monster

        // Player upgrades tracking
        this.myUpgrades = {}; // My upgrade levels { upgradeId: level }
        Object.keys(UPGRADES).forEach(key => {
            this.myUpgrades[key] = 0;
        });

        // Wave countdown state
        this.isInCountdown = false;
        this.countdownTime = 0;
        
        // Player stats tracking
        this.playerStats = new Map();
        this.initializePlayerStats();
        
        // Set up lanes
        this.setupLanes();
        
        // Create monster group
        this.monsterGroup = this.physics.add.group();
        
        // Set up UI
        this.setupUI();
        this.setupQuestionPanel();
        this.setupWeaponPanel();
        
        // Create base visual
        this.createBase();
        
        // Generate first question
        this.generateNewQuestion();
        
        // Only host spawns monsters
        this.isHost = this.multiplayer.isHost;
        
        // Set up socket event listeners
        this.setupSocketListeners();
        
        // Set up periodic sync of monster positions (host only)
        if (this.isHost) {
            this.time.addEvent({
                delay: 100, // Sync every 100ms (10 times per second)
                callback: () => {
                    const positions = [];
                    this.monsters.forEach((monster) => {
                        if (monster.active) {
                            positions.push({
                                id: monster.getData('id'),
                                y: monster.y
                            });
                        }
                    });
                    this.multiplayer.socket.emit('sync-monster-positions', positions);
                    
                    // Every 2 seconds, send full monster data to catch any missing monsters
                    if (this.time.now % 2000 < 100) {
                        const allMonsters = [];
                        this.monsters.forEach((monster) => {
                            if (monster.active) {
                                allMonsters.push({
                                    id: monster.getData('id'),
                                    lane: monster.getData('lane'),
                                    x: monster.x,
                                    y: monster.y,
                                    ufoType: monster.texture.key,
                                    health: monster.getData('health'),
                                    maxHealth: monster.getData('maxHealth'),
                                    speed: monster.getData('speed'),
                                    difficulty: monster.getData('difficulty'),
                                    isBoss: monster.getData('isBoss') || false
                                });
                            }
                        });
                        this.multiplayer.socket.emit('sync-all-monsters', allMonsters);
                    }
                },
                loop: true
            });
        }
    }

    setupSocketListeners() {
        // Listen for position sync updates
        this.multiplayer.socket.on('sync-monster-positions', (positions) => {
            // Only non-hosts apply these corrections
            if (this.isHost) return;
            
            positions.forEach(data => {
                const monster = this.monsters.get(data.id);
                if (monster && monster.active) {
                    // Smoothly correct position with a tween
                    this.tweens.add({
                        targets: monster,
                        y: data.y,
                        duration: 80, // Faster correction (80ms)
                        ease: 'Linear'
                    });
                }
            });
        });

        // Listen for full monster sync (missing monsters)
        this.multiplayer.socket.on('sync-all-monsters', (monstersData) => {
            if (this.isHost) return; // Host doesn't need to sync from itself
            
            console.log('Received full monster sync:', monstersData.length, 'monsters');
            
            // Check for monsters we're missing
            monstersData.forEach(data => {
                if (!this.monsters.has(data.id)) {
                    console.log('Creating missing monster:', data.id);
                    this.createMonster(data);
                }
            });
        });

        // Listen for wave completion (boss killed)
        this.multiplayer.socket.on('wave-completed', (data) => {
            if (this.isHost) return; // Host already handled this
            
            console.log('Wave completed! New wave:', data.newWave);
            
            this.bossActive = false;
            this.monstersThisWave = 0;
            this.difficulty = data.newWave;
            this.waveText.setText(`Wave: ${this.difficulty}`);
            this.spawnInterval = data.newSpawnInterval;
            this.monstersPerWave = data.newMonstersPerWave;
        });
    }

    initializePlayerStats() {
        this.multiplayer.players.forEach(player => {
            this.playerStats.set(player.id, {
                name: player.name,
                score: 0,
                ammo: 0,
                kills: 0
            });
        });
        this.updatePlayersStatsPanel();
    }

    setupLanes() {
        this.lanePositions = [];
        const laneWidth = 1280 / LANES;
        
        // Create lane backgrounds and positions
        for (let i = 0; i < LANES; i++) {
            const x = (i * laneWidth) + (laneWidth / 2);
            this.lanePositions.push(x);
            
            // Alternate lane colors
            const color = (i % 2 === 0) ? 0x0f3460 : 0x16213e;
            const lane = this.add.rectangle(x, 720 / 2, laneWidth - 2, 720, color, 0.3);
            lane.setDepth(-2);
            
            // Lane number at top
            this.add.text(x, 30, `${i + 1}`, {
                fontSize: '20px',
                color: '#666666'
            }).setOrigin(0.5);
        }
    }

    createBase() {
        // Base visual at bottom
        const baseHeight = 80;
        const base = this.add.rectangle(
            1280 / 2,
            720 - baseHeight / 2,
            1280,
            baseHeight,
            0x2c3e50
        );
        base.setDepth(-1);
        
        // Add fortress details
        for (let i = 0; i < 10; i++) {
            const x = (i * 1280 / 10) + (1280 / 20);
            this.add.rectangle(x, 720 - baseHeight - 15, 40, 30, 0x34495e);
        }
        
        // Base label
        this.add.text(1280 / 2, 720 - 40, 'KNOWLEDGE FORTRESS', {
            fontSize: '28px',
            color: '#ecf0f1',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Base health bar background
        this.baseHealthBarBg = this.add.rectangle(
            1280 / 2,
            720 - 90,
            400,
            20,
            0x7f8c8d
        );
        
        // Base health bar fill
        this.baseHealthBarFill = this.add.rectangle(
            1280 / 2,
            720 - 90,
            400,
            20,
            0x27ae60
        );
    }

    setupUI() {
        // Score display
        this.scoreText = this.add.text(20, 20, 'Team Score: 0', {
            fontSize: '28px',
            color: '#f39c12',
            fontWeight: 'bold'
        });
        
        // Base health display
        this.healthText = this.add.text(1280 - 20, 20, `Base: ${this.baseHealth}`, {
            fontSize: '28px',
            color: '#e74c3c',
            fontWeight: 'bold'
        }).setOrigin(1, 0);
        
        // Wave/Difficulty display
        this.waveText = this.add.text(1280 / 2, 20, 'Wave: 1', {
            fontSize: '24px',
            color: '#3498db',
            fontWeight: 'bold'
        }).setOrigin(0.5, 0);
    }

    setupQuestionPanel() {
        const submitButton = document.getElementById('submit-button');
        const answerInput = document.getElementById('answer-input');
        const nextQuestionBtn = document.getElementById('next-question-btn');
        
        // Submit handler
        submitButton.onclick = () => {
            const answer = answerInput.value.trim();
            if (answer && this.currentQuestion) {
                this.checkAnswer(answer);
            }
        };
        
        // Enter key handler
        answerInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                submitButton.click();
            }
        };
        
        // Next question button
        nextQuestionBtn.onclick = () => {
            this.generateNewQuestion();
        };
        
        // Update ammo display
        this.updateAmmoDisplay();
    }

    setupWeaponPanel() {
        const weaponButtons = document.querySelectorAll('.weapon-btn');
        
        weaponButtons.forEach(btn => {
            btn.onclick = () => {
                const weapon = btn.dataset.weapon;
                const cost = parseInt(btn.dataset.cost);
                
                // Check if player has enough ammo
                if (this.ammo >= cost) {
                    // Remove active class from all buttons
                    weaponButtons.forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    btn.classList.add('active');
                    // Set selected weapon
                    this.selectedWeapon = weapon;
                } else {
                    // Flash red if not enough ammo
                    btn.style.background = 'rgba(231, 76, 60, 0.5)';
                    setTimeout(() => {
                        btn.style.background = '';
                    }, 200);
                }
            };
        });
    }

    showUpgradeModal() {
        // Pause game
        this.isInCountdown = true;

        // Get 3 random upgrades
        const upgradeKeys = Object.keys(UPGRADES);
        const shuffled = Phaser.Utils.Array.Shuffle([...upgradeKeys]);
        const selectedUpgrades = shuffled.slice(0, 3);

        // Show modal
        const modal = document.getElementById('upgrade-modal');
        const upgradeOptions = document.getElementById('upgrade-options');
        upgradeOptions.innerHTML = '';

        selectedUpgrades.forEach(upgradeId => {
            const upgrade = UPGRADES[upgradeId];
            const currentLevel = this.myUpgrades[upgradeId];
            const isMaxLevel = currentLevel >= upgrade.maxLevel;

            const card = document.createElement('div');
            card.className = 'upgrade-card' + (isMaxLevel ? ' max-level' : '');
            card.innerHTML = `
                <div class="upgrade-icon">${upgrade.icon}</div>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-level">Level ${currentLevel}${isMaxLevel ? ' (MAX)' : ` → ${currentLevel + 1}`}</div>
                <div class="upgrade-description">${upgrade.description}</div>
                <div class="upgrade-effect">${upgrade.getDescription(currentLevel)}</div>
            `;

            if (!isMaxLevel) {
                card.onclick = () => this.selectUpgrade(upgradeId);
            }

            upgradeOptions.appendChild(card);
        });

        modal.style.display = 'flex';

        // Start countdown
        const prepTime = 10 + (this.myUpgrades.prepTime * 2);
        this.startCountdown(prepTime);
    }

    selectUpgrade(upgradeId) {
        // Increase upgrade level
        this.myUpgrades[upgradeId]++;

        console.log(`Selected upgrade: ${UPGRADES[upgradeId].name} (Level ${this.myUpgrades[upgradeId]})`);

        // Apply immediate effects
        if (upgradeId === 'baseHealth') {
            const bonus = UPGRADES.baseHealth.getBonus(this.myUpgrades.baseHealth);
            const newMaxHealth = BASE_HEALTH + bonus;
            const healthDiff = newMaxHealth - (BASE_HEALTH + UPGRADES.baseHealth.getBonus(this.myUpgrades.baseHealth - 1));
            this.baseHealth = Math.min(this.baseHealth + healthDiff, newMaxHealth);
            this.healthText.setText(`Base: ${this.baseHealth}`);
            this.applyBaseDamageEffects(); // Update health bar visual
        }

        if (upgradeId === 'maxAmmo') {
            const newMax = UPGRADES.maxAmmo.getBonus(this.myUpgrades.maxAmmo);
            // Update max ammo display
            document.querySelector('.ammo-max').textContent = `/${newMax}`;
        }

        // Close modal
        document.getElementById('upgrade-modal').style.display = 'none';

        // Clear the countdown interval if still running
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        // Continue countdown without modal, but end it early
        // Let countdown run for remaining time in background so players can still answer questions
    }

    startCountdown(seconds) {
        this.countdownTime = seconds;
        const countdownDisplay = document.getElementById('countdown-seconds');
        countdownDisplay.textContent = this.countdownTime;

        // Update countdown every second
        const countdownInterval = setInterval(() => {
            this.countdownTime--;
            countdownDisplay.textContent = this.countdownTime;

            if (this.countdownTime <= 0) {
                clearInterval(countdownInterval);
                this.endCountdown();
            }
        }, 1000);

        // Store interval so we can clear it if upgrade selected early
        this.countdownInterval = countdownInterval;
    }

    endCountdown() {
        // Close modal if still open
        document.getElementById('upgrade-modal').style.display = 'none';

        // End countdown state
        this.isInCountdown = false;

        // Apply starting ammo bonus
        const startingAmmoBonus = UPGRADES.startingAmmo.getBonus(this.myUpgrades.startingAmmo);
        if (startingAmmoBonus > 0) {
            this.addAmmo(startingAmmoBonus);
        }

        console.log('Wave starting! Prep time over.');
    }

    generateNewQuestion() {
        this.currentQuestion = generateQuestion(this.difficulty);
        document.getElementById('question-text').textContent = this.currentQuestion.question;
        document.getElementById('answer-input').value = '';
        document.getElementById('feedback-text').textContent = '';
        document.getElementById('answer-input').focus();
    }

    checkAnswer(answer) {
        const feedbackText = document.getElementById('feedback-text');
        const isCorrect = answer === this.currentQuestion.answer;

        if (isCorrect) {
            // Calculate ammo gain with bonus ammo upgrade
            const baseAmmo = AMMO_PER_QUESTION;
            const bonusAmmo = UPGRADES.bonusAmmo.getBonus(this.myUpgrades.bonusAmmo);
            const totalAmmo = baseAmmo + bonusAmmo;

            feedbackText.textContent = `✓ Correct! +${totalAmmo} Ammo`;
            feedbackText.className = 'feedback-correct';

            // Add ammo
            this.addAmmo(totalAmmo);
            this.questionsAnswered++;
            
            // Update stats
            this.updateMyStats();
            
            // Generate new question after delay
            this.time.delayedCall(800, () => {
                this.generateNewQuestion();
            });
        } else {
            feedbackText.textContent = '✗ Incorrect! Try again!';
            feedbackText.className = 'feedback-incorrect';
            
            // Clear feedback after delay
            this.time.delayedCall(1500, () => {
                feedbackText.textContent = '';
            });
        }
    }

    addAmmo(amount) {
        const oldAmmo = this.ammo;
        const maxAmmo = UPGRADES.maxAmmo.getBonus(this.myUpgrades.maxAmmo);
        this.ammo = Math.min(this.ammo + amount, maxAmmo);
        
        if (this.ammo > oldAmmo) {
            this.updateAmmoDisplay();
            this.updateMyStats();
            
            // Animation
            const ammoDisplay = document.getElementById('ammo-display');
            ammoDisplay.classList.add('ammo-gain-animation');
            setTimeout(() => {
                ammoDisplay.classList.remove('ammo-gain-animation');
            }, 300);
        }
    }

    updateAmmoDisplay() {
        document.getElementById('ammo-count').textContent = this.ammo;
        
        // Color code based on ammo level
        const ammoCount = document.getElementById('ammo-count');
        if (this.ammo >= 7) {
            ammoCount.style.color = '#2ecc71'; // Green
        } else if (this.ammo >= 4) {
            ammoCount.style.color = '#f39c12'; // Orange
        } else {
            ammoCount.style.color = '#e74c3c'; // Red
        }
    }

    updateMyStats() {
        const myStats = {
            score: this.score,
            ammo: this.ammo,
            kills: this.monstersKilled
        };
        this.multiplayer.emitStatsUpdate(myStats);
    }

    updatePlayerStats(data) {
        const stats = this.playerStats.get(data.playerId);
        if (stats) {
            Object.assign(stats, data.stats);
            this.updatePlayersStatsPanel();
        }
    }

    updatePlayersStatsPanel() {
        const statsContainer = document.getElementById('players-stats-list');
        statsContainer.innerHTML = '';
        
        this.playerStats.forEach((stats, playerId) => {
            const statDiv = document.createElement('div');
            statDiv.className = 'player-stat-item';
            
            statDiv.innerHTML = `
                <div class="player-stat-name">${stats.name}</div>
                <div class="player-stat-info">
                    <span class="player-stat-ammo">🔫 ${stats.ammo}/10</span>
                </div>
                <div class="player-stat-info">
                    <span class="player-stat-score">Score: ${stats.score}</span>
                </div>
            `;
            
            statsContainer.appendChild(statDiv);
        });
    }

    update(time, delta) {
        if (this.isPaused) return;

        // Only host spawns monsters (pause during countdown)
        if (this.isHost && !this.isInCountdown && time > this.lastSpawnTime + this.spawnInterval) {
            // Check if we should spawn boss (end of wave)
            if (this.monstersThisWave >= this.monstersPerWave && !this.bossActive) {
                this.spawnBoss();
                this.bossActive = true;
                this.lastSpawnTime = time;
            } else if (!this.bossActive) {
                // Spawn monsters (1-2 per interval depending on player count)
                const playerCount = this.multiplayer.players.length;
                // Spawn 1 UFO normally, +1 more for every 2 players
                const spawnsPerInterval = 1 + Math.floor(playerCount / 2);

                for (let i = 0; i < spawnsPerInterval; i++) {
                    this.spawnNormalMonster();
                }
                this.lastSpawnTime = time;
            }
        }
        
        // Move monsters
        this.monsterGroup.getChildren().forEach(monster => {
            if (!monster.active) return;

            // Check and update status effects
            const currentTime = Date.now();
            const freezeEnd = monster.getData('freezeEnd') || 0;
            const slowEnd = monster.getData('slowEnd') || 0;
            const isBoss = monster.getData('isBoss');

            if (currentTime < freezeEnd) {
                // Still frozen
                monster.setData('speedMultiplier', 0);
                monster.setTint(0x00ffff);
            } else if (currentTime < slowEnd) {
                // Freeze expired, but still slowed
                monster.setData('speedMultiplier', 0.5);
                monster.setTint(0x9b59b6);
            } else {
                // All effects expired
                monster.setData('speedMultiplier', 1);
                if (isBoss) {
                    monster.setTint(0xff6b6b);
                } else {
                    monster.clearTint();
                }
            }

            // Apply speed with status effects
            const speed = monster.getData('speed') * monster.getData('speedMultiplier');
            monster.y += (speed * delta) / 1000;
            
            // Update health bar position
            if (monster.healthBar) {
                this.updateHealthBar(monster);
            }
            
            // Check if reached base (only host checks)
            if (this.isHost && monster.y >= 720 - 100) {
                this.damageBase(monster.getData('damage'));
                this.destroyMonster(monster);
            }
        });
    }

    spawnNormalMonster() {
        // Choose random lane
        const lane = Phaser.Math.Between(0, LANES - 1);
        const x = this.lanePositions[lane];
        
        // Choose a random UFO type
        const ufoTypes = ['ufo-a', 'ufo-b', 'ufo-c', 'ufo-d'];
        const randomUfo = Phaser.Utils.Array.GetRandom(ufoTypes);
        
        // Generate unique monster ID
        const monsterId = `${this.multiplayer.socket.id}-${this.nextMonsterId++}`;
        
        // INCREASED HEALTH: Was 30 + (difficulty * 10), now much higher
        const baseHealth = 10 + (this.difficulty * 5);
        
        // Monster data for sync
        const monsterData = {
            id: monsterId,
            lane: lane,
            x: x,
            y: -40,
            ufoType: randomUfo,
            health: baseHealth,
            speed: BASE_MONSTER_SPEED + (this.difficulty * 8),
            difficulty: this.difficulty,
            isBoss: false
        };
        
        // Create locally
        this.createMonster(monsterData);
        
        // Sync to other players
        this.multiplayer.emitMonsterSpawned(monsterData);
    }

    spawnBoss() {
        // Choose middle lane for dramatic effect
        const lane = Math.floor(LANES / 2);
        const x = this.lanePositions[lane];
        
        // Use a different sprite for boss (or the same with different color)
        const ufoTypes = ['ufo-c', 'ufo-d']; // Use the cooler looking ones for bosses
        const bossUfo = Phaser.Utils.Array.GetRandom(ufoTypes);
        
        // Generate unique monster ID
        const monsterId = `BOSS-${this.multiplayer.socket.id}-${this.nextMonsterId++}`;

        // BOSS STATS: Much tankier - scales with player count
        const playerCount = this.multiplayer.players.length;
        const bossHealth = (50 + (this.difficulty * 50)) * BOSS_HEALTH_MULTIPLIER * playerCount;
        const bossSpeed = (BASE_MONSTER_SPEED + (this.difficulty * 5)) * 0.4; // Even slower! (40% speed)
        
        // Boss data
        const bossData = {
            id: monsterId,
            lane: lane,
            x: x,
            y: -80,
            ufoType: bossUfo,
            health: bossHealth,
            speed: bossSpeed,
            difficulty: this.difficulty,
            isBoss: true
        };
        
        // Create locally
        this.createMonster(bossData);
        
        // Sync to other players
        this.multiplayer.emitMonsterSpawned(bossData);
        
        // BOSS WARNING!
        this.showBossWarning();
        
        console.log(`Boss spawned with ${bossHealth} HP at wave ${this.difficulty}`);
    }

    showBossWarning() {
        // Big warning text
        const warningText = this.add.text(1280 / 2, 300, `⚠️ WAVE ${this.difficulty} BOSS! ⚠️`, {
            fontSize: '64px',
            color: '#e74c3c',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Subtitle
        const subtitleText = this.add.text(1280 / 2, 370, 'DEFEAT THE BOSS TO ADVANCE!', {
            fontSize: '32px',
            color: '#f39c12',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Pulse animation for both texts
        this.tweens.add({
            targets: [warningText, subtitleText],
            scale: 1.2,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                warningText.destroy();
                subtitleText.destroy();
            }
        });
        
        // Screen shake
        this.cameras.main.shake(500, 0.02);
    }

    spawnSyncedMonster(monsterData) {
        // Create monster from sync data
        this.createMonster(monsterData);
    }

    createMonster(data) {
        // Create monster sprite
        const monster = this.add.sprite(data.x, data.y, data.ufoType);
        
        // Check if boss
        const isBoss = data.isBoss || false;
        
        if (isBoss) {
            monster.setScale(BOSS_SIZE_MULTIPLIER); // Much bigger!
            monster.setTint(0xff6b6b); // Red tint for boss
        } else {
            monster.setScale(0.8);
        }
        
        monster.setInteractive();
        monster.setDepth(1);
        
        // Add to physics group
        this.monsterGroup.add(monster);
        
        // Set monster data
        monster.setData({
            id: data.id,
            lane: data.lane,
            health: data.health,
            maxHealth: data.health,
            speed: data.speed,
            speedMultiplier: 1,
            damage: isBoss ? MONSTER_DAMAGE * 3 : MONSTER_DAMAGE, // Bosses hurt more
            difficulty: data.difficulty,
            isBoss: isBoss
        });
        
        // Store in monster map
        this.monsters.set(data.id, monster);
        
        // Add health bar
        this.addHealthBar(monster);
        
        // Boss label
        if (isBoss) {
            const bossLabel = this.add.text(monster.x, monster.y - 60, '👑 BOSS', {
                fontSize: '20px',
                color: '#ffd700',
                fontWeight: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            
            monster.bossLabel = bossLabel;
        }
        
        // Click handler - shoot with current weapon
        monster.on('pointerdown', () => this.shootMonster(monster));
    }

    shootMonster(monster) {
        if (!monster.active || this.isPaused) return;
        
        const weapon = WEAPONS[this.selectedWeapon];
        
        // Check if enough ammo
        if (this.ammo < weapon.cost) {
            // Flash feedback - not enough ammo
            const ammoDisplay = document.getElementById('ammo-display');
            ammoDisplay.style.background = 'rgba(231, 76, 60, 0.5)';
            setTimeout(() => {
                ammoDisplay.style.background = '';
            }, 200);
            return;
        }
        
        // Check for efficient shooter (free shot chance)
        const efficientChance = UPGRADES.efficientShooter.getBonus(this.myUpgrades.efficientShooter);
        const isFreeShot = Math.random() * 100 < efficientChance;

        if (!isFreeShot) {
            // Spend ammo
            this.ammo -= weapon.cost;
            this.updateAmmoDisplay();
        } else {
            // Show free shot indicator
            const freeText = this.add.text(monster.x, 720 - 120, 'FREE SHOT!', {
                fontSize: '16px',
                color: '#2ecc71',
                fontWeight: 'bold'
            }).setOrigin(0.5);

            this.tweens.add({
                targets: freeText,
                y: freeText.y - 30,
                alpha: 0,
                duration: 1000,
                onComplete: () => freeText.destroy()
            });
        }

        this.totalShots++;
        this.updateMyStats();

        // Fire projectile
        this.fireProjectile(monster, weapon);
    }

    addHealthBar(monster) {
        const graphics = this.add.graphics();
        monster.healthBar = graphics;
        this.updateHealthBar(monster);
    }

    updateHealthBar(monster) {
        if (!monster.healthBar) return;
        
        const isBoss = monster.getData('isBoss') || false;
        const bar = monster.healthBar;
        bar.clear();
        
        const width = isBoss ? 100 : 50; // Bigger health bar for bosses
        const height = isBoss ? 12 : 8;
        const x = monster.x - width / 2;
        const y = monster.y - (isBoss ? 50 : 30);
        
        // Background
        bar.fillStyle(0x000000, 0.5);
        bar.fillRect(x, y, width, height);
        
        // Health fill
        const healthRatio = monster.getData('health') / monster.getData('maxHealth');
        let color = isBoss ? 0xff6b6b : 0x27ae60; // Red for boss, green for normal
        if (!isBoss) {
            if (healthRatio <= 0.6) color = 0xf39c12; // Orange
            if (healthRatio <= 0.3) color = 0xe74c3c; // Red
        }
        
        bar.fillStyle(color);
        bar.fillRect(x, y, width * healthRatio, height);
        
        // Border
        bar.lineStyle(isBoss ? 2 : 1, 0xffffff, 0.5);
        bar.strokeRect(x, y, width, height);
        
        // Update boss label position
        if (monster.bossLabel) {
            monster.bossLabel.setPosition(monster.x, monster.y - 60);
        }
    }

    fireProjectile(monster, weapon) {
        if (!monster || !monster.active) return;
        
        // Create projectile at base
        const projectile = this.add.circle(monster.x, 720 - 100, 10, weapon.color);
        projectile.setStrokeStyle(3, 0xffffff);
        projectile.setDepth(10);
        
        // Add glow effect
        const glow = this.add.circle(monster.x, 720 - 100, 15, weapon.color, 0.3);
        glow.setDepth(9);
        
        // Different speeds based on weapon
        const duration = weapon.cost === 3 ? 200 : 300; // Power shot is faster
        
        // Animate to monster
        this.tweens.add({
            targets: [projectile, glow],
            y: monster.y,
            duration: duration,
            ease: 'Power2',
            onComplete: () => {
                projectile.destroy();
                glow.destroy();
                this.applyDamage(monster, weapon);
            }
        });
    }

    applyDamage(monster, weapon) {
        if (!monster || !monster.active) return;

        const isBoss = monster.getData('isBoss');

        // Calculate base damage with upgrades
        let baseDamage = weapon.damage;

        // Apply damage boost upgrade
        const damageBoost = UPGRADES.damage.getBonus(this.myUpgrades.damage);
        baseDamage += damageBoost;

        // Apply boss killer upgrade (only if boss)
        if (isBoss) {
            const bossKillerBonus = UPGRADES.bossKiller.getBonus(this.myUpgrades.bossKiller);
            baseDamage = baseDamage * (1 + bossKillerBonus / 100);
        }

        // Check for critical hit
        let finalDamage = baseDamage;
        let isCritical = false;
        if (this.myUpgrades.critical > 0) {
            const critData = UPGRADES.critical.getBonus(this.myUpgrades.critical);
            if (Math.random() * 100 < critData.chance) {
                finalDamage = baseDamage * critData.multiplier;
                isCritical = true;
            }
        }

        // Check for executioner (instant kill at low HP)
        const executionerThreshold = UPGRADES.executioner.getBonus(this.myUpgrades.executioner);
        const healthPercent = (monster.getData('health') / monster.getData('maxHealth')) * 100;
        const isExecuted = healthPercent <= executionerThreshold;

        // Apply damage
        let health = monster.getData('health');
        if (isExecuted && !isBoss) {
            health = 0; // Instant kill
        } else {
            health -= finalDamage;
        }
        monster.setData('health', health);

        // Sync damage to other players
        const monsterId = monster.getData('id');
        this.multiplayer.emitMonsterDamaged({
            monsterId: monsterId,
            newHealth: health,
            weaponType: this.selectedWeapon
        });

        // Flash effect
        this.tweens.add({
            targets: monster,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 2
        });

        // Apply slow/freeze effects (not on bosses)
        if (!isBoss) {
            // Freeze upgrade
            if (this.myUpgrades.freeze > 0) {
                const freezeDuration = UPGRADES.freeze.getBonus(this.myUpgrades.freeze) * 1000;
                this.applyStatusEffect(monster, 'freeze', freezeDuration);
            }

            // Slow upgrade
            if (this.myUpgrades.slow > 0) {
                const slowDuration = UPGRADES.slow.getBonus(this.myUpgrades.slow) * 1000;
                this.applyStatusEffect(monster, 'slow', slowDuration);
            }

            // Weapon freeze (old freeze weapon)
            if (weapon.freeze) {
                this.applyStatusEffect(monster, 'freeze', 100); // 0.1s freeze
            }
        }

        // Apply splash damage to nearby enemies
        if (this.myUpgrades.splash > 0) {
            const splashPercent = UPGRADES.splash.getBonus(this.myUpgrades.splash);
            const splashDamage = finalDamage * (splashPercent / 100);
            this.applySplashDamage(monster, splashDamage);
        }

        // Apply pierce damage to enemies behind
        if (this.myUpgrades.pierce > 0) {
            const pierceCount = UPGRADES.pierce.getBonus(this.myUpgrades.pierce);
            this.applyPierceDamage(monster, finalDamage, pierceCount);
        }

        // Show damage number
        let damageColor = '#e74c3c';
        let damageSize = '24px';
        let damageLabel = `-${Math.round(finalDamage)}`;

        if (isCritical) {
            damageColor = '#f39c12';
            damageSize = '32px';
            damageLabel = `CRIT! -${Math.round(finalDamage)}`;
        }

        if (isExecuted && !isBoss) {
            damageColor = '#9b59b6';
            damageSize = '28px';
            damageLabel = 'EXECUTED!';
        }

        const damageText = this.add.text(monster.x, monster.y, damageLabel, {
            fontSize: damageSize,
            color: damageColor,
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
            targets: damageText,
            y: monster.y - 40,
            alpha: 0,
            duration: 1000,
            onComplete: () => damageText.destroy()
        });

        // Update health bar
        this.updateHealthBar(monster);

        // Check if dead
        if (health <= 0) {
            this.killMonster(monster);
        }
    }

    applyStatusEffect(monster, type, duration) {
        if (!monster || !monster.active) return;

        const currentTime = Date.now();

        if (type === 'freeze') {
            // Stack freeze duration
            const existingFreezeEnd = monster.getData('freezeEnd') || currentTime;
            const newFreezeEnd = Math.max(currentTime, existingFreezeEnd) + duration;
            monster.setData('freezeEnd', newFreezeEnd);
            monster.setData('speedMultiplier', 0); // Completely frozen
            monster.setTint(0x00ffff); // Cyan for freeze
        } else if (type === 'slow') {
            // Stack slow duration
            const existingSlowEnd = monster.getData('slowEnd') || currentTime;
            const newSlowEnd = Math.max(currentTime, existingSlowEnd) + duration;
            monster.setData('slowEnd', newSlowEnd);
            // Don't change speed here, will be handled in update
            if (monster.getData('speedMultiplier') !== 0) {
                monster.setData('speedMultiplier', 0.5); // 50% slow
                monster.setTint(0x9b59b6); // Purple for slow
            }
        }
    }

    applySplashDamage(centerMonster, splashDamage) {
        const splashRadius = 100;
        this.monsters.forEach(monster => {
            if (!monster.active || monster === centerMonster) return;

            const distance = Phaser.Math.Distance.Between(
                centerMonster.x, centerMonster.y,
                monster.x, monster.y
            );

            if (distance <= splashRadius) {
                let health = monster.getData('health');
                health -= splashDamage;
                monster.setData('health', health);

                // Show splash damage
                const splashText = this.add.text(monster.x, monster.y, `-${Math.round(splashDamage)}`, {
                    fontSize: '18px',
                    color: '#e67e22',
                    fontWeight: 'bold'
                }).setOrigin(0.5);

                this.tweens.add({
                    targets: splashText,
                    y: splashText.y - 30,
                    alpha: 0,
                    duration: 800,
                    onComplete: () => splashText.destroy()
                });

                this.updateHealthBar(monster);

                if (health <= 0) {
                    this.killMonster(monster);
                }
            }
        });
    }

    applyPierceDamage(hitMonster, pierceDamage, pierceCount) {
        const lane = hitMonster.getData('lane');

        // Find all monsters in the same lane behind the hit monster
        const monstersInLane = [];
        this.monsters.forEach(monster => {
            if (monster.active && monster !== hitMonster && monster.getData('lane') === lane) {
                if (monster.y < hitMonster.y) { // Behind (higher on screen)
                    monstersInLane.push(monster);
                }
            }
        });

        // Sort by y position (closest first)
        monstersInLane.sort((a, b) => b.y - a.y);

        // Pierce through up to pierceCount enemies (or all if level 3)
        const targetCount = pierceCount >= 3 ? monstersInLane.length : Math.min(pierceCount, monstersInLane.length);

        for (let i = 0; i < targetCount; i++) {
            const monster = monstersInLane[i];
            let health = monster.getData('health');
            health -= pierceDamage;
            monster.setData('health', health);

            // Show pierce damage
            const pierceText = this.add.text(monster.x, monster.y, `-${Math.round(pierceDamage)}`, {
                fontSize: '20px',
                color: '#3498db',
                fontWeight: 'bold'
            }).setOrigin(0.5);

            this.tweens.add({
                targets: pierceText,
                y: pierceText.y - 35,
                alpha: 0,
                duration: 900,
                onComplete: () => pierceText.destroy()
            });

            this.updateHealthBar(monster);

            if (health <= 0) {
                this.killMonster(monster);
            }
        }
    }

    syncMonsterDamage(data) {
        const monster = this.monsters.get(data.monsterId);
        if (monster && monster.active) {
            monster.setData('health', data.newHealth);
            this.updateHealthBar(monster);
            
            // Visual feedback
            this.tweens.add({
                targets: monster,
                alpha: 0.5,
                duration: 100,
                yoyo: true
            });
            
            // Check if dead
            if (data.newHealth <= 0) {
                this.killMonsterSync(monster);
            }
        }
    }

    killMonster(monster) {
        const monsterId = monster.getData('id');
        const isBoss = monster.getData('isBoss') || false;
        
        // Add score (bosses worth 5x more)
        const scoreGain = (isBoss ? 500 : 100) * monster.getData('difficulty');
        this.score += scoreGain;
        this.scoreText.setText(`Team Score: ${this.score}`);
        this.monstersKilled++;
        this.killsSinceLastHeal++;

        // Apply scavenger upgrade (chance for ammo on kill)
        if (this.myUpgrades.scavenger > 0) {
            const scavengerChance = UPGRADES.scavenger.getBonus(this.myUpgrades.scavenger);
            if (Math.random() * 100 < scavengerChance) {
                this.addAmmo(1);
                // Show scavenger proc
                const scavText = this.add.text(monster.x, monster.y + 20, '+1 AMMO', {
                    fontSize: '14px',
                    color: '#2ecc71',
                    fontWeight: 'bold'
                }).setOrigin(0.5);

                this.tweens.add({
                    targets: scavText,
                    y: scavText.y - 25,
                    alpha: 0,
                    duration: 800,
                    onComplete: () => scavText.destroy()
                });
            }
        }

        // Apply life steal upgrade (heal base every X kills)
        if (this.myUpgrades.lifeSteal > 0) {
            const killsNeeded = UPGRADES.lifeSteal.getBonus(this.myUpgrades.lifeSteal);
            if (this.killsSinceLastHeal >= killsNeeded) {
                this.killsSinceLastHeal = 0;
                const maxHealth = BASE_HEALTH + UPGRADES.baseHealth.getBonus(this.myUpgrades.baseHealth);
                if (this.baseHealth < maxHealth) {
                    this.baseHealth = Math.min(this.baseHealth + 1, maxHealth);
                    this.healthText.setText(`Base: ${this.baseHealth}`);
                    this.applyBaseDamageEffects();

                    // Show heal text
                    const healText = this.add.text(1280 / 2, 720 - 150, '+1 HP', {
                        fontSize: '24px',
                        color: '#2ecc71',
                        fontWeight: 'bold',
                        stroke: '#000000',
                        strokeThickness: 3
                    }).setOrigin(0.5);

                    this.tweens.add({
                        targets: healText,
                        y: healText.y - 40,
                        alpha: 0,
                        duration: 1500,
                        onComplete: () => healText.destroy()
                    });
                }
            }
        }

        // Track wave progress
        if (isBoss) {
            // Boss killed! Start next wave
            this.bossActive = false;
            this.monstersThisWave = 0;
            this.difficulty++;
            this.waveText.setText(`Wave: ${this.difficulty}`);

            // Make it harder - 10% more monsters each wave
            this.spawnInterval = Math.max(300, this.spawnInterval - 50);
            // Increase monsters per wave by 10% each wave (rounded up)
            this.monstersPerWave = Math.ceil(this.monstersPerWave * 1.10);
            
            // Sync wave change to other players
            this.multiplayer.socket.emit('wave-completed', {
                roomCode: this.multiplayer.roomCode,
                newWave: this.difficulty,
                newSpawnInterval: this.spawnInterval,
                newMonstersPerWave: this.monstersPerWave
            });

            // Show upgrade modal (slight delay for dramatic effect)
            this.time.delayedCall(1500, () => {
                this.showUpgradeModal();
            });
        } else {
            // Normal monster killed
            this.monstersThisWave++;
        }
        
        this.updateMyStats();
        
        // Show score gain
        if (isBoss) {
            const scoreText = this.add.text(monster.x, monster.y, `+${scoreGain} 👑`, {
                fontSize: '48px',
                color: '#ffd700',
                fontWeight: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            
            this.tweens.add({
                targets: scoreText,
                y: scoreText.y - 80,
                alpha: 0,
                duration: 2000,
                onComplete: () => scoreText.destroy()
            });
        }
        
        // Sync kill to other players
        this.multiplayer.emitMonsterKilled(monsterId);
        
        // Death effect
        this.createDeathEffect(monster);
        
        this.time.delayedCall(300, () => {
            this.destroyMonster(monster);
        });
    }

    syncMonsterKill(monsterId) {
        const monster = this.monsters.get(monsterId);
        if (monster && monster.active) {
            this.killMonsterSync(monster);
        }
    }

    killMonsterSync(monster) {
        // Death effect without score
        this.createDeathEffect(monster);
        
        this.time.delayedCall(300, () => {
            this.destroyMonster(monster);
        });
    }

    createDeathEffect(monster) {
        const isBoss = monster.getData('isBoss') || false;
        
        // HIDE health bar immediately when death starts
        if (monster.healthBar) {
            monster.healthBar.setVisible(false);
        }
        if (monster.bossLabel) {
            monster.bossLabel.setVisible(false);
        }
        
        // Death animation
        this.tweens.add({
            targets: monster,
            scale: isBoss ? 4 : 2,
            alpha: 0,
            duration: isBoss ? 600 : 300
        });
        
        // Particles effect (more for bosses)
        const particleCount = isBoss ? 20 : 8;
        const particleColor = isBoss ? 0xffd700 : 0x2ecc71;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = this.add.circle(
                monster.x + Phaser.Math.Between(-20, 20),
                monster.y + Phaser.Math.Between(-20, 20),
                isBoss ? 8 : 5,
                particleColor
            );
            
            this.tweens.add({
                targets: particle,
                x: particle.x + Phaser.Math.Between(-100, 100),
                y: particle.y + Phaser.Math.Between(-100, 100),
                alpha: 0,
                duration: isBoss ? 1000 : 500,
                onComplete: () => particle.destroy()
            });
        }
        
        // Boss explosion effect
        if (isBoss) {
            this.cameras.main.shake(800, 0.03);
            this.cameras.main.flash(500, 255, 215, 0, false);
        }
    }

    destroyMonster(monster) {
        const monsterId = monster.getData('id');
        this.monsters.delete(monsterId);
        
        if (monster.healthBar) {
            monster.healthBar.destroy();
        }
        if (monster.bossLabel) {
            monster.bossLabel.destroy();
        }
        monster.destroy();
    }

    damageBase(amount) {
        this.baseHealth = Math.max(0, this.baseHealth - amount);
        this.healthText.setText(`Base: ${this.baseHealth}`);
        
        // Sync to other players
        if (this.isHost) {
            this.multiplayer.emitBaseDamaged(amount);
        }
        
        this.applyBaseDamageEffects();
        
        // Check game over
        if (this.baseHealth <= 0) {
            this.gameOver();
        }
    }

    syncBaseDamage(damage) {
        this.baseHealth = Math.max(0, this.baseHealth - damage);
        this.healthText.setText(`Base: ${this.baseHealth}`);
        this.applyBaseDamageEffects();
        
        if (this.baseHealth <= 0) {
            this.gameOver();
        }
    }

    applyBaseDamageEffects() {
        // Update base health bar
        const healthRatio = this.baseHealth / BASE_HEALTH;
        this.baseHealthBarFill.width = 400 * healthRatio;
        
        // Change color based on health
        if (healthRatio > 0.6) {
            this.baseHealthBarFill.fillColor = 0x27ae60; // Green
        } else if (healthRatio > 0.3) {
            this.baseHealthBarFill.fillColor = 0xf39c12; // Orange
        } else {
            this.baseHealthBarFill.fillColor = 0xe74c3c; // Red
        }
        
        // Screen shake
        this.cameras.main.shake(300, 0.01);
        
        // Red flash at base
        const flash = this.add.rectangle(
            1280 / 2,
            720 - 40,
            1280,
            80,
            0xe74c3c,
            0.5
        );
        
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });
    }

    gameOver() {
        this.isPaused = true;
        
        // Pause physics
        this.physics.pause();
        
        // Calculate accuracy
        const accuracy = this.totalShots > 0 ? 
            Math.round((this.monstersKilled / this.totalShots) * 100) : 0;
        
        // Show game over modal
        document.getElementById('final-score').textContent = `Team Score: ${this.score}`;
        document.getElementById('final-stats').innerHTML = `
            <div>Your Monsters Defeated: ${this.monstersKilled}</div>
            <div>Your Questions Answered: ${this.questionsAnswered}</div>
            <div>Waves Survived: ${this.difficulty}</div>
            <div>Your Accuracy: ${accuracy}%</div>
        `;
        
        // Show team stats
        let teamStatsHTML = '<h3>Team Performance</h3>';
        this.playerStats.forEach((stats) => {
            teamStatsHTML += `
                <div class="team-player-stat">
                    <span class="team-player-name">${stats.name}</span>
                    <span class="team-player-score">Score: ${stats.score} | Kills: ${stats.kills}</span>
                </div>
            `;
        });
        document.getElementById('team-stats').innerHTML = teamStatsHTML;
        
        document.getElementById('game-over-modal').style.display = 'block';
        
        // Restart button goes back to lobby
        document.getElementById('restart-button').onclick = () => {
            location.reload();
        };
    }
}