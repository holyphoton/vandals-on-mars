# Vandals On Mars - Development Notes

## Project Overview
"Vandals On Mars" is a browser-based multiplayer FPS game where players claim territory on a 3D Mars planet by planting and growing billboards. Players can shoot rival billboards to shrink them and grow their own, utilize power-ups, and compete for leaderboard positions.

## Project Directory Structure

```
vandals-on-mars/
├── code/                           # Main code directory
│   ├── index.html                  # Entry point HTML file
│   ├── css/                        # CSS styles
│   │   └── styles.css              # Main stylesheet
│   ├── js/                         # JavaScript code
│   │   ├── main.js                 # Main application entry point
│   │   ├── config.js               # Configuration loader and constants
│   │   ├── world/                  # World-related code
│   │   │   ├── globe.js            # Mars globe rendering and management
│   │   │   ├── environment.js      # Environmental elements (sky, sun, earth)
│   │   │   └── terrain.js          # Terrain generation (craters, rocks)
│   │   ├── player/                 # Player-related code
│   │   │   ├── movement.js         # Player movement controls
│   │   │   ├── camera.js           # First-person camera handling
│   │   │   └── controls.js         # Input handling (keyboard, mouse, touch)
│   │   ├── billboard/              # Billboard features (for later stages)
│   │   │   ├── billboard.js        # Billboard class and management
│   │   │   └── interaction.js      # Billboard interaction logic
│   │   ├── weapons/                # Weapon systems (for later stages)
│   │   │   └── tweet-gun.js        # Tweet gun implementation
│   │   ├── powerups/               # Power-up systems (for later stages)
│   │   │   └── powerup.js          # Power-up base class and types
│   │   ├── networking/             # Multiplayer functionality (for later stages)
│   │   │   ├── client.js           # WebSocket client implementation
│   │   │   └── sync.js             # Game state synchronization
│   │   ├── ui/                     # User interface (for later stages)
│   │   │   ├── hud.js              # Heads-up display
│   │   │   ├── menu.js             # Game menus
│   │   │   └── leaderboard.js      # Leaderboard UI
│   │   └── utils/                  # Utility functions
│   │       ├── math.js             # Math helpers (spherical coordinates)
│   │       └── helpers.js          # Miscellaneous helper functions
│   └── assets/                     # Game assets
│       ├── textures/               # Texture files
│       │   ├── mars.jpg            # Mars surface texture
│       │   ├── sky.jpg             # Sky background texture
│       │   └── billboard.jpg       # Billboard texture
│       ├── models/                 # 3D models
│       └── sounds/                 # Sound effects (for later stages)
├── server.js                       # WebSocket server (existing)
├── config.json                     # Game configuration
├── package.json                    # Node.js dependencies
└── README.md                       # Project documentation
```

## Development Stages and Milestones

### Stage 1: Static World Design
**Goal**: Render a 3D Mars globe with terrain features and implement first-person movement.
**Tasks**:
1. Set up basic HTML and Three.js environment
2. Create a spherical Mars globe with texture
3. Add terrain features (craters, rocks)
4. Implement sky with sun and Earth
5. Develop first-person camera and WASD + mouse controls
6. Implement proper spherical coordinate movement

### Stage 2: Billboard Mechanics
**Goal**: Implement the core billboard planting and interaction system.
**Tasks**:
1. Create billboard class and rendering
2. Implement billboard placement on the Mars surface
3. Add billboard content display
4. Develop billboard sizing and growth mechanics
5. Implement billboard decay system

### Stage 3: Shooting and Damage
**Goal**: Create the shooting mechanics for damaging billboards.
**Tasks**:
1. Implement tweet gun and ammo system
2. Add shooting and hit detection
3. Create billboard damage and growth effects
4. Implement ammo regeneration
5. Add visual feedback for shooting and hits

### Stage 4: Multiplayer and Networking
**Goal**: Implement multiplayer functionality.
**Tasks**:
1. Develop client-server communication
2. Implement player synchronization
3. Create billboard ownership and synchronization
4. Add player-to-player interaction
5. Implement basic anti-cheat measures

### Stage 5: Power-ups and Economy
**Goal**: Add power-ups and the Mars Credits economy.
**Tasks**:
1. Create power-up system and spawning
2. Implement all power-up types
3. Add Mars Credits earning and spending
4. Create power-up shop UI
5. Balance power-up effects and costs

### Stage 6: UI and Polish
**Goal**: Finalize the user interface and add polish.
**Tasks**:
1. Create HUD with ammo and status
2. Implement leaderboard
3. Add menus and settings
4. Create tutorial and onboarding
5. Add sounds and visual effects
6. Optimize performance

## Development Best Practices
- Split files when they exceed 200 lines
- Split functions when they exceed 20 lines
- Add top-of-file comments for every file
- Use console.log() liberally for debugging
- Reference README.md structure without modifying it

## Implementation Progress

### Stage 1: Static World Design
Completed implementation of:
- Basic project structure and organization
- HTML/CSS setup with loading screen and start screen
- Three.js setup with renderer and scene
- Configuration system with default values
- Mars globe with procedural texture (pending real texture)
- Environment with stars, sun, and Earth
- Terrain generation with craters and rocks
- First-person camera system with proper spherical coordinate handling
- WASD keyboard and mouse movement on the globe surface
- Mobile touch controls with NippleJS joysticks
- Utility functions for spherical coordinate math
- Helper functions for various common tasks

Outstanding tasks:
- Obtain and integrate actual texture maps for Mars, Earth, and sky
- Fine-tune terrain generation parameters
- Adjust lighting and colors for better visual appearance
- Optimize performance for mobile devices

### Ready for Testing:
The basic application can be run using:
```
cd code
npx http-server
```
Then open a browser to http://localhost:8080 

## Server Restart Procedures

After making code changes, both the HTTP server and WebSocket server should be restarted to ensure all clients receive the updated code and synchronize properly. Follow these standard procedures:

### Restarting the HTTP Server
```
cd /Users/jugalmistry/Data/Projects/vandals-on-mars/vandals-on-mars && pkill -f "http-server" || true && npx http-server code -c-1 -p 8081 &
```

This command:
1. Changes to the project root directory
2. Kills any existing HTTP server processes
3. Starts a new HTTP server with caching disabled (-c-1) on port 8081
4. Runs the server in the background (&)

### Restarting the WebSocket Server
```
cd /Users/jugalmistry/Data/Projects/vandals-on-mars/vandals-on-mars && pkill -f "node server.js" || true && node server.js &
```

This command:
1. Changes to the project root directory
2. Kills any existing WebSocket server processes
3. Starts a new WebSocket server
4. Runs the server in the background (&)

### Important Notes
- Always restart both servers after code changes to ensure synchronization
- The WebSocket server must be running for multiplayer functionality
- The `-c-1` flag for HTTP server disables caching, ensuring clients get the latest code
- After restarting servers, refresh the browser to load updated code 

## ID Generation System

### Overview
The game uses standardized ID formats for both players and billboards:
- Player IDs: `player_xxxxx_yyyyy` 
- Billboard IDs: `billboard_xxxxx_yyyyy`

Where:
- `xxxxx` is a 5-digit random number (between 10000-99999)
- `yyyyy` is a 5-character random alphabetic string (lowercase)

### Implementation Details
The ID generation has been centralized in the `Helpers` utility class to ensure consistency across the codebase:

1. **Core Generation Function**:
   - `Helpers.generateId(prefix)`: Creates IDs in the format `prefix_xxxxx_yyyyy`
   - Takes a prefix parameter (`player` or `billboard`)
   - Handles both the numeric and alphabetic component generation

2. **Specialized Helper Methods**:
   - `Helpers.generatePlayerId()`: Uses the core function with "player" prefix
   - `Helpers.generateUUID()`: Uses the core function with "billboard" prefix

3. **Fallback Logic**:
   - All ID generation points include fallback implementations if Helpers is not available
   - Maintains the same ID format for consistency
   - Present in `main.js`, `guns.js`, and `persistence.js`

### Implementation Benefits
- **Consistency**: All IDs follow the same format throughout the application
- **Maintainability**: Changes to ID format only need to be made in one place
- **Reduced Redundancy**: No duplicate code for ID generation
- **Robustness**: Fallback mechanisms ensure proper operation even if helpers are unavailable

### Usage Examples
To generate a player ID:
```javascript
const playerId = Helpers.generatePlayerId();
```

To generate a billboard ID:
```javascript
const billboardId = Helpers.generateUUID();
```

Fallback pattern example:
```javascript
let playerId;
if (window.Helpers && typeof window.Helpers.generatePlayerId === 'function') {
    playerId = window.Helpers.generatePlayerId();
} else {
    // Fallback implementation
    const randomNumbers = Math.floor(10000 + Math.random() * 90000);
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    let randomAlphabets = '';
    for (let i = 0; i < 5; i++) {
        randomAlphabets += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    playerId = `player_${randomNumbers}_${randomAlphabets}`;
}
```

### Modified Files
- `/code/js/utils/helpers.js`: Added centralized ID generation functions
- `/code/js/utils/persistence.js`: Updated to use centralized player ID generation
- `/code/js/main.js`: Updated fallback logic in `getBillboardDataForSync()`
- `/code/js/weapons/guns.js`: Updated `generateUUID()` and fallback logic in `placeBillboard()` 