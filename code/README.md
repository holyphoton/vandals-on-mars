# Vandals On Mars - Game Client

## Overview
This is the client-side implementation for "Vandals On Mars," a browser-based multiplayer FPS game where players claim territory on a 3D Mars planet by planting and growing billboards.

## Current Status
Stage 1 is implemented: Static World Design with 3D Mars globe, sky, stars, sun, Earth, and first-person movement using WASD + mouse.

## How to Run
1. Make sure you have Node.js installed
2. Navigate to this directory in the terminal
3. Run a local web server:
   ```
   npx http-server
   ```
4. Open a web browser and go to http://localhost:8080

## Controls
- WASD or Arrow Keys: Move
- Mouse: Look around
- Click: Start game / Request pointer lock
- P: Pause game
- T: Toggle between first-person and orbit camera (for testing)
- Escape: Exit pointer lock

## Mobile Controls
- Left joystick: Move
- Right joystick: Look around
- Tap anywhere else: Start game / Request pointer lock

## Development
See the `dev-notes.md` file in this directory for details on the development plan and implementation progress.

## Assets
The game currently uses procedurally generated textures. External texture files can be added to the `assets/textures/` directory:
- `mars.jpg`: Mars surface texture
- `mars-bump.jpg`: Mars bump map (optional)
- `earth.jpg`: Earth texture
- `sky.jpg`: Sky/space background texture 