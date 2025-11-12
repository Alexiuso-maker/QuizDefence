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
        this.ammo = 9999; // Changed from 0 - start with full ammo for testing
        this.selectedWeapon = 'basic';
        this.questionsAnswered = 0;
        this.totalShots = 0;
        this.nextMonsterId = 0;
        
        // Monster tracking
        this.monsters = new Map(); // monsterId -> monster
        
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
            feedbackText.textContent = '✓ Correct! +' + AMMO_PER_QUESTION + ' Ammo';
            feedbackText.className = 'feedback-correct';
            
            // Add ammo
            this.addAmmo(AMMO_PER_QUESTION);
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
        this.ammo = Math.min(this.ammo + amount, MAX_AMMO);
        
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
        
        // Only host spawns monsters
        if (this.isHost && time > this.lastSpawnTime + this.spawnInterval) {
            // Check if we should spawn boss (end of wave)
            if (this.monstersThisWave >= this.monstersPerWave && !this.bossActive) {
                this.spawnBoss();
                this.bossActive = true;
                this.lastSpawnTime = time;
            } else if (!this.bossActive) {
                // Spawn multiple monsters based on player count (2 per player)
                const playerCount = this.multiplayer.players.length;
                const spawnsPerInterval = 2 * playerCount;

                for (let i = 0; i < spawnsPerInterval; i++) {
                    this.spawnNormalMonster();
                }
                this.lastSpawnTime = time;
            }
        }
        
        // Move monsters
        this.monsterGroup.getChildren().forEach(monster => {
            if (!monster.active) return;
            
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
        
        // Spend ammo
        this.ammo -= weapon.cost;
        this.updateAmmoDisplay();
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
        
        // Apply damage
        let health = monster.getData('health');
        health -= weapon.damage;
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
        
        // Apply freeze effect if freeze weapon
        if (weapon.freeze && monster.getData('speedMultiplier') === 1) {
            monster.setData('speedMultiplier', 0.3);
            monster.setTint(0x9b59b6); // Purple for freeze
            
            // Remove freeze after 4 seconds
            this.time.delayedCall(4000, () => {
                if (monster.active) {
                    monster.setData('speedMultiplier', 1);
                    const isBoss = monster.getData('isBoss');
                    if (isBoss) {
                        monster.setTint(0xff6b6b); // Back to red for boss
                    } else {
                        monster.clearTint();
                    }
                }
            });
        }
        
        // Show damage number
        const damageText = this.add.text(monster.x, monster.y, `-${weapon.damage}`, {
            fontSize: '24px',
            color: '#e74c3c',
            fontWeight: 'bold'
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
        
        // Track wave progress
        if (isBoss) {
            // Boss killed! Start next wave
            this.bossActive = false;
            this.monstersThisWave = 0;
            this.difficulty++;
            this.waveText.setText(`Wave: ${this.difficulty}`);

            // Make it harder - scale with player count
            const playerCount = this.multiplayer.players.length;
            this.spawnInterval = Math.max(300, this.spawnInterval - 50);
            // Base monsters per wave: 2 per player, plus extra based on difficulty
            const difficultyBonus = Math.floor(this.difficulty / 3);
            this.monstersPerWave = (2 * playerCount) + (difficultyBonus * playerCount);
            
            // Sync wave change to other players
            this.multiplayer.socket.emit('wave-completed', {
                roomCode: this.multiplayer.roomCode,
                newWave: this.difficulty,
                newSpawnInterval: this.spawnInterval,
                newMonstersPerWave: this.monstersPerWave
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