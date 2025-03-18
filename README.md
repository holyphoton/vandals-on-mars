# Vandals On Mars

**Version**: 1.1  
**Date**: March 18, 2025  

A fast-paced, multiplayer FPS where vandals claim territory on a 3D spherical Mars globe by planting and growing billboards with tweets, memes, or sponsored links. Players shoot rival billboards to shrink them and grow their own, using absurd power-ups and a shrinking decay mechanic. Mobile-friendly with NippleJS controls.

## Overview
- **Genre**: Multiplayer FPS / Territory Control  
- **Platform**: Browser-based (desktop and mobile web)  
- **Setting**: A surreal, low-poly Mars globe in 3D space  
- **Core Loop**: Plant billboards, shrink rivals to grow yours, hunt power-ups, and maintain turf to dominate the leaderboard.  
- **Vibe**: Chaotic, absurd, social media-infused vandalism on a wraparound Martian sphere.

## Core Mechanics

### 1. Planting Billboards
- **Action**: Shoot a “tweet gun” to plant a billboard on the Mars globe’s surface.  
- **Starting Size**: 5x5 units (25 points).  
- **Limit**: Max 3 billboards per player (unlocked via vibe points: 1000 vibe = +1 slot).  
- **Global Cap**: 500 billboards total (configurable in JSON), oldest removed if exceeded.  
- **Content**: 280-character input (tweet, meme, URL) at planting, defaults to “VandalX’s Turf” if blank.

### 2. Shooting Rival Billboards
- **Mechanic**: Hold fire for 1 second (20 ammo) to deal 1 damage, shrinking the rival billboard by 1 unit and growing yours by +0.5 units.  
- **Effect**: Shrinking reduces rival score; growing increases yours.  
- **Range**: 50 units (configurable).

### 3. Size Decay
- **Rule**: Billboards shrink 10% every 24 hours if no damage dealt that day.  
- **Reset**: 1 damage (20 ammo) resets decay timer for all player billboards.  
- **Math**: 10x10 (100 points) → 9x9 (81 points) after 1 day (configurable).

### 4. Scoring and Leaderboard
- **Size Points**: Area = width × height (e.g., 5x5 = 25, 50x50 = 2500).  
- **Vibe Points**: Engagement bonuses (see below).  
- **Total Score**: Size + Vibe Points.  
- **Leaderboard**: Top 10 by total score, refreshed hourly.

### 5. Billboard Content
- **Input**: 280-character text (e.g., “Mars is ours!” or “https://x.com/user/status/123”).  
- **Display**: Plain text on billboard; URLs clickable in tooltip (new tab).  
- **No Fetching**: No X content pulled—browser handles links.  
- **Future**: Placeholder for `localStorage` images.

## World Design
- **Structure**: A 3D spherical Mars globe, navigable as a wraparound surface.  
- **Coordinate System**: Spherical coordinates (radius, theta, phi):  
  - Radius: Distance from center (default 100 units, configurable).  
  - Theta: Longitude (0 to 2π radians).  
  - Phi: Latitude (0 to π radians).  
  - Players can walk a straight line (e.g., equator) and return to start.  
- **Volume**: Adjustable radius in JSON (e.g., 100 → 200 units doubles surface area: 4πr²).  
- **Visuals**: Low-poly terrain with craters, procedural or static.

## Ammo Economy
- **Starting Ammo**: 200 at login, max cap 500 (configurable).  
- **Regen**: +10 ammo every 30 seconds (1200/hour = 60 seconds shooting, configurable).  
- **Shooting Cost**: 20 ammo = 1 damage (1-second burst, configurable).  
- **Mars Credits (MC)**:  
  - +5 MC per damage, +100 MC daily login (configurable).  
  - $1 = 100 MC (base rate).

## Power-Ups
Power-ups drop randomly and are purchasable, max 1 active per player (except stackable ammo).

### List of Power-Ups
1. **Martian Jetpack (Speed Boost)**  
   - Effect: 2x run speed (10 units/second) for 15 seconds.  
   - Drop: 1-2 per 5-min cycle (20% chance).  
   - Cost: 150 MC ($1.50).  
   - Sponsor: “Red Bull Wings.”

2. **Cosmic Spotlight (Neon Glow)**  
   - Effect: Neon glow, 2x vibe points from likes (+10/like) for 10 minutes.  
   - Drop: 1 per 5-min cycle (10% chance).  
   - Cost: 200 MC ($2).  
   - Sponsor: “Pepsi Neon Blast.”

3. **Force Field (Billboard Shield)**  
   - Effect: 1 billboard immune for 5 minutes.  
   - Drop: 1-2 per 5-min cycle (15% chance).  
   - Cost: 250 MC ($2.50).  
   - Sponsor: “Tesla Energy Shield.”

4. **Martian Munitions (Ammo Surge)**  
   - Effect: +200 ammo, +20 ammo/30s for 5 minutes.  
   - Drop: 2-3 per 5-min cycle (25% chance).  
   - Cost: 100 MC ($1).  
   - Sponsor: “Coca-Cola Ammo Drop.”

5. **Sandstorm Blaster (Chaos Grenade)**  
   - Effect: Scramble 50% of billboard sizes in 20-meter radius for 30 seconds.  
   - Drop: 1 per 5-min cycle (5% chance).  
   - Cost: 300 MC ($3).  
   - Sponsor: “Monster Energy Storm.”

6. **Mega Fertilizer (Growth Spike)**  
   - Effect: +5 units to 1 billboard, 2x growth (+1 unit/damage) for 10 seconds.  
   - Drop: 1-2 per 5-min cycle (15% chance).  
   - Cost: 200 MC ($2).  
   - Sponsor: “Starbucks Growth Brew.”

7. **Mirage Maker (Holo-Decoy)**  
   - Effect: Fake 5x5 billboard, lasts 3 minutes or 5 hits.  
   - Drop: 1 per 5-min cycle (10% chance).  
   - Cost: 150 MC ($1.50).  
   - Sponsor: “Nike Phantom Sign.”

8. **Laser Overdrive (Rapid Fire)**  
   - Effect: 40 shots/second, no ammo cost, for 10 seconds.  
   - Drop: 1-2 per 5-min cycle (20% chance).  
   - Cost: 250 MC ($2.50).  
   - Sponsor: “SpaceX Pulse Cannon.”

### Drop Mechanics
- **Cycle**: 5-10 power-ups spawn every 5 minutes (configurable).  
- **Chance**: 25% Ammo, 20% Speed/Rapid, 15% Shield/Growth, 10% Neon/Holo, 5% Chaos.  
- **Visuals**: Glowing icons on globe surface.

### Purchase Rules
- **Shop**: In-game menu, 1-minute cooldown.  
- **Stacking**: Ammo stacks; others override.

## Scoring Math

### Size Points
- **Formula**: Area = width × height (max 50x50 = 2500).  
- **Growth**: +0.5 units per 1 damage (configurable).  
- **Examples**: 10 damage = 10x10 (100 points); 200 damage = 50x50.

### Vibe Points
- **Sources**:  
  - Likes: +5 per like, max 10/day/player.  
  - Challenges: +50-200 (e.g., “20 damage = 100 vibe”).  
  - Sponsor Ad: +100/day.  
- **Perks**: 1000 vibe = +1 slot; 2000 vibe = 2x growth for 1 hour.  
- **Reset**: Weekly (configurable).

## Configurable Variables (JSON)
Stored in `config.json`:
```json
{
  "world": {
    "radius": 100,
    "dayNightCycle": 600,
    "maxBillboards": 500
  },
  "player": {
    "runSpeed": 5,
    "startAmmo": 200,
    "ammoCap": 500,
    "ammoRegen": 10,
    "ammoPerDamage": 20,
    "billboardSlots": 1,
    "shootRange": 50
  },
  "billboard": {
    "startSize": 5,
    "maxSize": 50,
    "growthPerDamage": 0.5,
    "decayRate": 0.1,
    "decayInterval": 86400
  },
  "powerUps": {
    "spawnCycle": 300,
    "spawnCount": [5, 10]
  },
  "economy": {
    "mcPerDamage": 5,
    "mcDailyBonus": 100
  }
}
```

## Sponsor Integration
- **Permanent Billboards**: $500 each, 5-10 slots, unshrinkable.  
- **Temporary Boosts**: Branded power-ups (e.g., “Red Bull Wings”).  
- **Ads**: Sponsor URLs in billboards = +100 vibe/day.

## Gameplay Flow
- **Login**: 200 ammo, 1 slot, plant 5x5 billboard on globe.  
- **Hour 1**: Regen 1200 ammo (60 damage), 5 power-ups (~50 damage) → 35x35 (1225 points), +550 MC, +50 vibe.  
- **Day 2**: Skip → 31.5x31.5 (992 points); 1 shot resets decay.  
- **Goal**: Max 3x 50x50 billboards (7500 points) + vibe to lead.

## Technical Specifications

### Language and Libraries
- **Core**: HTML5/JavaScript, Three.js, NippleJS.  
- **Multiplayer**: WebSockets (Node.js `ws`).  
- **Config**: JSON (`config.json`).  
- **Tools**: Cursor (cursor.sh), optional Claude/Grok.

### Server Requirements
- **Minimal**: Node.js server, 1GB RAM (~100 players), no storage (stateless).

### Client Requirements
- **Browser**: Chrome, Firefox, Edge, Safari (WebGL + touch).  
- **Mobile**: iOS/Android with NippleJS.

### Mobile Compatibility
- **Controls**: Desktop (WASD + mouse), Mobile (NippleJS joysticks).  
- **UI**: Scaled for touch.  
- **Performance**: 30-60 FPS on mid-range devices.

### Development Notes
- **Globe**: Three.js sphere geometry.  
- **Assets**: Low-poly Mars texture, power-up icons.  
- **Testing**: Tweak JSON for balance.

## Development Best Practices
1. **Planning Complex Changes**: When planning a complex code change, always start with a plan of action (e.g., steps, files affected) and ask for approval before proceeding.  
2. **Simple Changes**: For simple changes, implement directly but think step-by-step about the change’s impact and logic.  
3. **File Size**: When a file grows too long (e.g., >200 lines), split it into smaller, focused files (e.g., `world.js`, `player.js`).  
4. **Function Size**: When a function exceeds 20 lines, break it into smaller, single-purpose functions (e.g., `movePlayer()` → `updatePosition()`, `rotateCamera()`).  
5. **Debugging Depth**: When debugging, gather sufficient data (e.g., logs, variable states) to deeply understand the issue before acting.  
6. **Logging and Tracing**: Add `console.log()` or tracing liberally to track flow and state (e.g., “Player moved to x,y,z”). If logs pinpoint the issue, fix it. If uncertain, hypothesize 4-6 causes, narrow to 1-2 likely ones, then add logging to confirm or fix the most probable cause.  
7. **Markdown Reference**: Use provided Markdown files (e.g., this doc) as structural guides for code; do not edit them.  
8. **File Comments**: Add/update a top-of-file comment for every new or changed file (e.g., `// Added Mars globe rendering - 2025-03-18`).

## Additional Rules
- **Fairness**: 1-minute grace period for new billboards.  
- **Content**: No filtering—280 chars, URLs clickable.  
- **Balance**: Caps on billboards (500), size (50x50), ammo (500).