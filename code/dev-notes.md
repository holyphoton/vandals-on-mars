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

## Billboard Data Storage Separation

### Overview
The game now maintains separate storage for player-created billboards and bot-generated billboards:
- Player billboards are stored in `billboard-data.json`
- Bot billboards are stored in `billboard-data-bots.json` 

### Implementation Details
The separation was implemented through multiple changes in the server code:

1. **Modified Loading Logic**:
   - `loadBillboardData()`: Now filters out bot billboards when loading from `billboard-data.json`
   - `loadBotBillboardData()`: Exclusively loads bot billboards from `billboard-data-bots.json`

2. **Modified Saving Logic**:
   - `saveBillboardData()`: Now filters out bot billboards before saving to `billboard-data.json`
   - `saveBotBillboardData()`: Exclusively saves bot billboards to `billboard-data-bots.json`

3. **Bot Billboard API Endpoint**:
   - Removed the call to `saveBillboardData()` in the `/save-bot-billboards` endpoint
   - This ensures bot billboards are only saved to their dedicated file

4. **WebSocket Message Handlers**:
   - Modified billboard update and removal event handlers to save to the appropriate file based on billboard type
   - Bot billboards (IDs starting with "bot_") are only saved to the bot-specific file
   - Player billboards are only saved to the main billboard data file

### Implementation Benefits
- **Clean Data Separation**: Player billboards and bot billboards are now stored in separate files
- **Improved Performance**: Reduced file sizes make reading and writing faster
- **Easier Management**: Administrators can more easily view and manage player content separately from bot content
- **Reduced Redundancy**: Bot billboards are no longer duplicated in both files

### Modified Files
- `/server.js`: Updated file handling logic to separate billboard types

### How to Identify Billboard Types
Billboards are differentiated by their ID prefix:
- Bot billboards always start with "bot_" (e.g., "bot_31707_xhqri")
- Player billboards start with "billboard_" (e.g., "billboard_54870_gtlzx")

This allows for easy filtering when loading, saving, and processing billboards. 

## Server-Side Bot Billboard System

### Overview
The game includes a server-managed bot billboard system that automatically spawns billboards across the Mars planet surface. These billboards contain various humorous messages and are managed entirely server-side to ensure consistent behavior across all clients.

### Key Components
1. **Bot Configuration**: 
   - Located in `code/bot-config.json`
   - Controls spawn rates, maximum counts, and billboard content
   - Centralized configuration now loaded from a single location

2. **Server Management**:
   - Bot billboards are spawned, tracked, and removed on the server
   - `checkBotBillboards()` function ensures counts stay within configured limits
   - Regular trimming of excess billboards to maintain performance
   - Saved in separate `billboard-data-bots.json` file to keep player data clean

### Quaternion Calculation for Billboard Orientation
A critical aspect of billboard placement is ensuring they stand upright relative to the planet's surface. This requires proper quaternion calculation:

```javascript
function calculateQuaternion(position) {
  // Normalized position vector (direction from center to position) - this is the "up" vector
  const length = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
  const up = {
    x: position.x / length,
    y: position.y / length,
    z: position.z / length
  };
  
  // Find a reference vector different from up
  // Use world up (0,1,0) as the reference unless up is too close to it
  let reference;
  const worldUpDot = Math.abs(up.y); // Dot product with (0,1,0)
  
  if (worldUpDot > 0.9) {
    // If up is too close to world up, use world right instead
    reference = { x: 1, y: 0, z: 0 };
  } else {
    reference = { x: 0, y: 1, z: 0 };
  }
  
  // Calculate right vector (cross product of up and reference)
  const right = {
    x: up.y * reference.z - up.z * reference.y,
    y: up.z * reference.x - up.x * reference.z,
    z: up.x * reference.y - up.y * reference.x
  };
  
  // Normalize right vector
  const rightLength = Math.sqrt(right.x * right.x + right.y * right.y + right.z * right.z);
  const rightNorm = {
    x: right.x / rightLength,
    y: right.y / rightLength,
    z: right.z / rightLength
  };
  
  // Calculate forward vector (cross product of right and up)
  const forward = {
    x: rightNorm.y * up.z - rightNorm.z * up.y,
    y: rightNorm.z * up.x - rightNorm.x * up.z,
    z: rightNorm.x * up.y - rightNorm.y * up.x
  };
  
  // Create a rotation matrix and convert to quaternion
  // Matrix rows are rightNorm, up, forward (right-handed system)
  const rotMatrix = [
    rightNorm.x, up.x, forward.x, 0,
    rightNorm.y, up.y, forward.y, 0,
    rightNorm.z, up.z, forward.z, 0,
    0, 0, 0, 1
  ];
  
  // Convert rotation matrix to quaternion
  // Algorithm based on THREE.js implementation
  const m11 = rotMatrix[0], m12 = rotMatrix[1], m13 = rotMatrix[2];
  const m21 = rotMatrix[4], m22 = rotMatrix[5], m23 = rotMatrix[6];
  const m31 = rotMatrix[8], m32 = rotMatrix[9], m33 = rotMatrix[10];
  
  const trace = m11 + m22 + m33;
  let qx, qy, qz, qw;
  
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    qx = (m32 - m23) * s;
    qy = (m13 - m31) * s;
    qz = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
    qw = (m32 - m23) / s;
    qx = 0.25 * s;
    qy = (m12 + m21) / s;
    qz = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
    qw = (m13 - m31) / s;
    qx = (m12 + m21) / s;
    qy = 0.25 * s;
    qz = (m23 + m32) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
    qw = (m21 - m12) / s;
    qx = (m13 + m31) / s;
    qy = (m23 + m32) / s;
    qz = 0.25 * s;
  }
  
  return { x: qx, y: qy, z: qz, w: qw };
}
```

#### Implementation Notes
- The quaternion calculation is critical for proper billboard orientation
- Order of operations in cross product math must be precise
- The coordinate system must be properly right-handed
- Matrix construction must match THREE.js convention for consistency
- The quaternion represents a rotation that makes the billboard stand perpendicular to the surface

### Bot Billboard Lifecycle
1. **Spawning**: 
   - Random position generated using `getRandomPositionOnGlobe()`
   - Orientation calculated using the quaternion function above
   - Random content selected from configured messages
   - Added to server-side arrays and database

2. **Monitoring**:
   - Regular checks against maximum count (controlled by interval)
   - Oldest billboards trimmed when maximum is exceeded
   - New billboards spawned when count is below maximum

3. **Client Synchronization**:
   - Billboards distributed to clients via WebSocket
   - New clients receive full billboard data on connection
   - Real-time updates broadcasted on changes

### File Paths
- Server management code: `server.js`
- Bot configuration: `code/bot-config.json`
- Bot billboard data storage: `billboard-data-bots.json`

### Modified Files
- `server.js`: Added comprehensive bot billboard management
- `code/js/utils/botManager.js`: Removed client-side spawning, now receiving from server
- `code/bot-config.json`: Centralized configuration 

## Server-Side Powerup System

### Overview
Similar to the bot billboard system, the game now includes a server-managed powerup system that automatically spawns powerups across the Mars planet surface. These powerups provide gameplay benefits like ammo replenishment and are now fully managed server-side to ensure consistent behavior across all clients.

### Key Components
1. **Powerup Configuration**: 
   - Located in `code/powerups-config.json`
   - Controls spawn rates, maximum counts, and powerup properties
   - Each powerup type has its own configuration for independent management
   - Configuration includes customizable weight, lifespan, visual properties, and effect values

2. **Server Management**:
   - Powerups are spawned, tracked, and removed by the server
   - `checkPowerups()` function ensures counts stay within configured limits
   - Regular checks for expired powerups based on their lifespan
   - Powerups float 2 units above the planet surface for better visibility
   - Saved in separate `powerups-data.json` file

3. **Type-specific Configuration**:
   - Each powerup type maintains independent settings:
     - Maximum count (`maxPowerups`)
     - Spawn interval (`spawnInterval`)
     - Spawn chance (`spawnChance`)
     - Minimum distance from other powerups (`minDistance`)
   - Different powerup types can have different spawn rates and densities
   - Weighted random selection based on `weight` property

### Powerup Data Structure
The server maintains two data structures for powerups:
- `powerups`: An array of all active powerups
- `powerupsByType`: A map organizing powerups by their type for easier type-specific operations

### Implementation Details
1. **Powerup Spawning**:
   - `spawnPowerup()`: Selects a random powerup type based on configured weights
   - `spawnPowerupOfType()`: Spawns a specific type of powerup
   - Each powerup type has its own spawning timer (`powerupSpawningTimers`)
   - Powerups are positioned with proper orientation using quaternion calculation

2. **Expiration & Management**:
   - Powerups expire based on their `lifespan` property
   - `checkPowerups()` function periodically removes expired powerups
   - Excess powerups are trimmed if maximum count is exceeded
   - Type-specific checks ensure each powerup type stays within its limits

3. **Client Synchronization**:
   - New powerups are broadcast to all clients via WebSocket
   - Powerup removal events notify all clients when a powerup is collected or expires
   - New clients receive all existing powerups on connection

4. **Collection Handling**:
   - Client sends `powerup_collected` event when a player collects a powerup
   - Server processes the event, removes the powerup, and broadcasts the removal
   - Both main array and type-specific arrays are updated for consistency

### File Paths
- Server management code: `server.js`
- Powerup configuration: `code/powerups-config.json`
- Powerup data storage: `powerups-data.json`
- Client-side powerup code: `code/js/powerups/powerupManager.js`

### Modified Files
- `server.js`: Added comprehensive powerup management system
- `code/js/powerups/powerupManager.js`: Updated to handle server-spawned powerups
- `code/js/main.js`: Added powerup message handling
- `code/powerups-config.json`: Updated for type-specific configuration

### Powerup Types
Currently, the system supports two types of powerups:
1. **Shooting Ammo** (`shooting_ammo`):
   - Replenishes shooting ammunition when collected
   - Configured with higher spawn rate (60% weight)
   - 30 maximum instances with 3-second spawn interval

2. **Billboard Ammo** (`billboard_ammo`):
   - Provides billboard placement capability when collected
   - Configured with lower spawn rate (40% weight)
   - 20 maximum instances with 6-second spawn interval

The system is designed to be easily extensible, allowing new powerup types to be added by simply updating the configuration file. 

## Render.com Deployment Guide

### Overview
This guide documents how "Vandals on Mars" is deployed to Render.com with persistent storage and WebSocket support.

### Configuration Files
1. **render.yaml**:
   - Defines the web service configuration
   - Configures persistent disk storage for game data
   - Sets up proper environment variables

2. **package.json**:
   - Includes Express and WebSocket dependencies
   - Defines scripts for both production and development environments

### Server Configuration
- Static files are served from the `/code` directory
- Persistent data is stored at `/opt/render/project/src/data`
- Server serves both HTTP and WebSocket traffic on the same port
- Environment variables are loaded from `.env.local` in development

### WebSocket Configuration
- The server uses the same port for both HTTP and WebSocket traffic
- Client WebSocket connection uses "auto" URL setting in `config.json` to detect proper protocol
- Automatic protocol detection supports both local development and production

### Local Development Setup
1. **Environment Variables**:
   - Create a `.env.local` file for local configuration
   - Environment handled with dotenv package

2. **Startup Scripts**:
   - `start.sh`: Production startup script
   - `start-dev.sh`: Development startup with auto-reload

3. **Data Directory**:
   - Local data directory created automatically under project root
   - Configurable via environment variables

### Deployed URL
The game is deployed and accessible at:
https://vandals-on-mars.onrender.com/

### Troubleshooting
If WebSocket connections fail:
- Check that client is using correct protocol (wss:// for HTTPS, ws:// for HTTP)
- Verify port configuration matches between client and server
- Ensure "auto" setting is enabled in client config
- Check Render.com logs for any connection refusal errors 