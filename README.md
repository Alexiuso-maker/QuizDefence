# Quiz Defense - Multiplayer Math Game

## Project Overview

Quiz Defense is a cooperative multiplayer tower defense game where students answer math questions to get ammunition to defend against UFO waves. Built with Phaser 3, Socket.io, and Vite. All text is in Norwegian Nynorsk.

## Tech Stack

- **Framework**: Phaser 3.90.0 (WebGL game engine)
- **Build Tool**: Vite 7.2.2
- **Multiplayer**: Socket.io client connecting to `https://quiz-defense.onrender.com`
- **Node.js**: 18.20.8 (note: Vite recommends 20.19+)
- **Language**: Norwegian Nynorsk (nn)

## Project Structure

```
QuizDefense/
├── src/
│   ├── scenes/
│   │   └── GameScene.js      # Main game logic (1500+ lines)
│   ├── multiplayer.js         # Socket.io multiplayer manager
│   ├── main.js                # Entry point, Phaser initialization
│   └── style.css              # All UI styling
├── index.html                 # Main HTML with lobby, waiting room, game UI
├── assets/
│   └── monsters/              # UFO sprites (ufo-a/b/c/d.png)
└── dist/                      # Built files
```

## How to Build & Run

```bash
cd QuizDefense
npm install
npm run dev    # Development server
npm run build  # Production build
```

## Game Flow

1. **Lobby Screen** → Player enters name, creates/joins room with 4-digit code
2. **Waiting Room** → Host sees all players and question type selector
3. **Game Starts** → Waves of UFOs spawn, players answer questions for ammo
4. **Between Waves** → Boss fight, then upgrade selection with 30s countdown
5. **Game Over** → Base health reaches 0, return to lobby

## Core Game Mechanics

### Wave System
- **Normal waves**: 30 UFOs per player (increases +2 per wave)
- **Boss waves**: Every wave ends with a boss (3x health multiplier)
- **Spawn intervals**: Start 5000ms → 3000ms, reduces -200ms per wave, min 1000ms/500ms
- **Spawn scaling**: Linear with player count (`interval / playerCount`)
- **Lanes**: 15 lanes for UFO spawning
- **UFO speed**: BASE_MONSTER_SPEED = 10.5 (reduced 30% from original)
- **UFO spawn position**: y=20 (visible immediately)
- **Boss spawn position**: y=50 (immediately visible)

### Health System
- **Base health**: `10 × playerCount` (scales linearly)
- **Monster damage**: 10 per UFO reaching base
- **Boss health**: `normal UFO health × 3 × playerCount`

### Ammo System
- **Start**: 0 ammo
- **Max ammo**: 5 + (upgrade level × 3)
- **Correct answer**: Fill to max (not +2)
- **Max ammo display**: Shows `/10` (hardcoded in HTML, upgrades change actual max)

### Upgrade System (Between Waves)
- **Countdown**: 30 seconds per player (independent timers)
- **Auto-select**: Random upgrade if timer expires
- **Can answer questions**: During countdown for ammo
- **Wave countdown display**: Shows "Neste bølgje startar om: Xs" after selection

### 15 Available Upgrades (All in Nynorsk)
1. **Skadebonus** - +5 damage per level
2. **Maks ammunisjon** - Increases max ammo capacity
3. **Kritisk treff** - Chance for 2x damage
4. **Gjennomtrengande** - Bullets pierce multiple UFOs
5. **Angrepshastigheit** - Faster fire rate
6. **Tilbakestøyt** - Slow UFOs on hit
7. **Kritisk skade** - Increases crit damage multiplier
8. **Eksplosiv ammunisjon** - Area damage
9. **Hastigheitsreduksjon** - Greater slow effect
10. **Bonus gull** - More gold per kill
11. **Gratis ammunisjon** - Chance for free shots
12. **Livstjuveri** - Heal base on kills
13. **Bølgjebonus** - Bonus at wave start
14. **Helseregenerering** - Passive healing
15. **Superkritisk** - Ultra-rare massive crits

## Question System

### Modular Question Type System

Located in `GameScene.js` lines 237-376. Export `QUESTION_TYPES` object.

### 8 Question Types (All Norwegian Nynorsk)

1. **additionCrossing10** - "Addisjon over 10"
   - Numbers 4-9 + result 10-30
   - Example: "7 + 15" = 22

2. **subtractionCrossing10** - "Subtraksjon over 10"
   - Cross tens boundary
   - Example: "15 - 8" = 7

3. **subtractionCrossing20** - "Subtraksjon over 20"
   - Cross twenties boundary
   - Example: "25 - 7" = 18

4. **multiplication1to5** - "Multiplikasjon 1-5"
   - Tables 1-5
   - Example: "4 × 5" = 20

5. **multiplication6to9** - "Multiplikasjon 6-9"
   - Tables 6-9
   - Example: "7 × 8" = 56

6. **placeValueOnes** - "Einarplassen"
   - "Kva tal står på einarplassen? 1234"
   - Answer: 4

7. **placeValueTens** - "Tidelsplassen"
   - "Kva tal står på tidelsplassen? 1234"
   - Answer: 3

8. **placeValueHundreds** - "Hundredelsplassen"
   - "Kva tal står på hundredelsplassen? 1234"
   - Answer: 2

9. **placeValueThousands** - "Tusendelsplassen"
   - "Kva tal står på tusendelsplassen? 1234"
   - Answer: 1

### Question Type Selection (NEW FEATURE)

**Location**: Waiting room (host only)

**Features**:
- Shows all 8 question types with names and categories
- All selected by default
- Click cards or checkboxes to toggle
- "Vel alle" / "Vel ingen" buttons
- Selected types stored in `multiplayer.selectedQuestionTypes`
- Game generates questions only from selected types

**Implementation**:
- `multiplayer.js`: `setupQuestionTypeSelector()` (lines 179-243)
- `GameScene.js`: `generateQuestion()` accepts `allowedTypes` parameter (line 378)
- `GameScene.js`: `generateNewQuestion()` uses selected types (line 896)

### Adding New Question Types

```javascript
export const QUESTION_TYPES = {
    yourNewType: {
        name: 'Display Name in Nynorsk',
        category: 'addition|subtraction|multiplication|placeValue',
        generate: () => {
            // Your logic here
            return {
                question: 'Question text',
                answer: 'correct answer as string'
            };
        }
    }
};
```

Also update `getCategoryDisplayName()` in `multiplayer.js` if adding new category.

## Multiplayer Synchronization

### Server Events (Socket.io)

**Outgoing** (client → server):
- `create-room` - Host creates room
- `join-room` - Player joins with code
- `start-game` - Host starts game
- `monster-spawned` - Host spawns UFO
- `monster-damaged` - Player damages UFO
- `monster-killed` - UFO dies
- `base-damaged` - UFO reaches base
- `update-stats` - Player stats changed

**Incoming** (server → client):
- `room-created` - Room code assigned
- `room-updated` - Player list changed
- `room-error` - Error message
- `game-starting` - Game begins
- `monster-spawned` - Sync UFO spawn
- `monster-damaged` - Sync UFO damage
- `monster-killed` - Sync UFO death
- `base-damaged` - Sync base damage
- `player-stats-updated` - Sync player stats

### Only Host Spawns Monsters

```javascript
this.isHost = this.multiplayer.isHost;
if (this.isHost && !this.isInCountdown) {
    // Spawn logic only runs on host
}
```

All other clients receive `monster-spawned` events and sync.

## Key Files Deep Dive

### `GameScene.js` (Main Game Logic)

**Constants** (lines 4-10):
```javascript
const LANES = 15;
const BASE_MONSTER_SPEED = 10.5;
const BASE_HEALTH = 10;
const MONSTER_DAMAGE = 10;
const BOSS_HEALTH_MULTIPLIER = 3;
```

**Important Methods**:
- `create()` - Initialize game, set up multiplayer listeners
- `update()` - Game loop, monster spawning logic
- `spawnMonster()` - Create UFO with lane/speed
- `spawnBoss()` - Create boss with 3x health
- `generateNewQuestion()` - Get new math question
- `checkAnswer()` - Validate answer, give ammo
- `shootBullet()` - Fire at monsters
- `showUpgradeModal()` - Between-wave upgrade selection
- `selectUpgrade()` - Apply upgrade, close modal
- `startWaveCountdown()` - 30s countdown before next wave
- `endCountdown()` - Start new wave

**Critical Variables**:
- `monstersPerWave` - How many UFOs to spawn
- `monstersSpawnedThisWave` - Prevents over-spawning
- `monstersThisWave` - How many killed
- `isInCountdown` - Prevents spawning during prep time
- `myUpgrades` - Player's upgrade levels

### `multiplayer.js` (Multiplayer Manager)

**Key Properties**:
- `socket` - Socket.io connection
- `roomCode` - 4-digit room code
- `isHost` - Is this player the host
- `players` - Array of player objects
- `selectedQuestionTypes` - Array of enabled question type keys
- `gameScene` - Reference to Phaser GameScene

**Key Methods**:
- `connect()` - Connect to server
- `setupSocketListeners()` - Register all event handlers
- `createRoom(playerName)` - Host creates room
- `joinRoom(roomCode, playerName)` - Join existing room
- `showWaitingRoom(room)` - Display waiting screen
- `setupQuestionTypeSelector()` - Populate question type checkboxes
- `startGame()` - Hide lobby, show game canvas

### `index.html` (UI Structure)

**Screens**:
1. `#lobby-screen` - Create/join room
2. `#waiting-room` - Player list + question selector (host)
3. `#game-container` - Phaser canvas
4. `#question-panel` - Side panel with math questions
5. `#players-stats-panel` - Team statistics
6. `#upgrade-modal` - Upgrade selection
7. `#wave-countdown-display` - Countdown after upgrade
8. `#game-over-modal` - Final stats

## Known Issues & Technical Debt

1. **Node.js Version**: Using 18.20.8, Vite recommends 20.19+
2. **Chunk Size**: 1.28 MB bundle (could use code-splitting)
3. **Ammo Display**: HTML shows `/10` but max ammo changes with upgrades
4. **No Server Code**: This is client-only, server at `quiz-defense.onrender.com`

## Recent Changes (Latest Session)

### Full Nynorsk Translation
- Changed `<html lang="en">` → `<html lang="nn">`
- Translated all UI: lobby, buttons, upgrades, tooltips
- All 15 upgrades now in Nynorsk

### Question Type Selection Menu
- Added selector UI in waiting room (host only)
- Shows all 8 question types with categories
- Select/deselect which types appear in game
- Stored in `multiplayer.selectedQuestionTypes`
- Question generation respects selection

### Balance Changes
- Reduced UFO speed 30% (15 → 10.5)
- Boss health 8x → 3x
- UFO count per wave: 50 → 30 per player (+2 per wave)
- Increased lanes from 6 → 15
- Base health scales linearly with players
- Spawn intervals scale with player count

### Fixed Bugs
- Boss spawning immediately with 1 player
- 20+ UFOs spawning (added `monstersSpawnedThisWave` counter)
- UFOs spawning during upgrade selection
- Boss not spawning on wave 2
- Weapon panel crash (removed reference)
- Wrong answer auto-clears input field

## Development Tips

### Testing Multiplayer Locally
1. Run `npm run dev`
2. Open multiple browser tabs to `localhost:5173`
3. Create room in one tab (host)
4. Join with room code in other tabs

### Debugging
- Check browser console for game logs
- Monitor Network tab for Socket.io events
- Use `console.log()` liberally in GameScene.js

### Common Tasks

**Add new upgrade**:
1. Add to `UPGRADES` object (line 25-233 in GameScene.js)
2. Include Nynorsk name and description
3. Add `getBonus(level)` or `getDescription(level)` function

**Adjust difficulty**:
- Change constants at top of GameScene.js
- Modify spawn interval calculation (~line 875)
- Adjust `monstersPerWave` calculation (~line 305)

**Add new question type**:
1. Add to `QUESTION_TYPES` export (line 237)
2. Include `name`, `category`, `generate()` function
3. Update `getCategoryDisplayName()` in multiplayer.js if new category

## Future Enhancements (Not Implemented)

- Boss sprites (currently using scaled UFOs)
- More question types (division, fractions, etc.)
- Persistent user accounts / stats
- Sound effects and music
- Power-ups and special abilities
- More diverse enemy types
- Wave preview before spawn

## Contact & Server

**Server**: `https://quiz-defense.onrender.com`
- Backend code not included in this repo
- Handles room creation, player sync, event broadcasting

---

**Last Updated**: 2025-11-13
**Build Status**: ✅ Passing (Vite 7.2.2)
**Game Status**: Fully playable, recently added question type selection
