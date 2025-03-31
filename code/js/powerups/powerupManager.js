// powerupManager.js - Manages powerups, spawning, and interactions - 2025-04-01

/**
 * Manages a collection of powerups in the game world
 * Handles spawning, expiration, collision detection, and cleanup
 */
class PowerupManager {
    /**
     * Constructor for PowerupManager
     * @param {Object} game Reference to the main game instance
     * @param {THREE.Scene} scene Reference to the game scene
     */
    constructor(game, scene) {
        this.game = game;
        this.scene = scene;
        this.powerups = new Map(); // Map of id -> powerup
        this.powerupTypes = new Map(); // Map of type -> class constructor
        
        // Configuration
        this.collisionDistance = 2.5; // Distance for powerup collection
        this.checkInterval = 100; // How often to check for collisions (ms)
        this.lastCheckTime = 0;
        
        // Register known powerup types
        this.registerPowerupTypes();
    }
    
    /**
     * Initialize the manager
     */
    initialize() {
        console.log('PowerupManager initialized');
        
        // Set up event listeners for server-spawned powerups
        if (this.game && this.game.webSocket) {
            this.setupServerPowerupSync();
        } else {
            console.log('No WebSocket connection available, powerups will not sync with server');
        }
    }
    
    /**
     * Register known powerup types
     */
    registerPowerupTypes() {
        // Register the ShootingAmmoPowerup class
        if (typeof ShootingAmmoPowerup !== 'undefined') {
            this.registerPowerupType('shooting_ammo', ShootingAmmoPowerup);
        }
        
        // Register the BillboardAmmoPowerup class
        if (typeof BillboardAmmoPowerup !== 'undefined') {
            this.registerPowerupType('billboard_ammo', BillboardAmmoPowerup);
        }
        
        console.log(`Registered ${this.powerupTypes.size} powerup types`);
    }
    
    /**
     * Register a new powerup type
     * @param {String} type The powerup type identifier
     * @param {Function} constructor The constructor function for this type
     */
    registerPowerupType(type, constructor) {
        this.powerupTypes.set(type, constructor);
    }
    
    /**
     * Create a new powerup of the specified type
     * @param {String} type The powerup type to create
     * @param {Object} params Additional parameters for the powerup
     * @returns {Powerup} The created powerup instance
     */
    createPowerup(type, params = {}) {
        try {
            // Get the constructor for this type
            const PowerupClass = this.powerupTypes.get(type);
            
            if (!PowerupClass) {
                console.error(`Unknown powerup type: ${type}`);
                return null;
            }
            
            // Create new powerup instance
            const powerup = new PowerupClass(params);
            
            // Initialize and add to scene
            powerup.initialize(this.scene);
            
            // Add to managed collection
            this.powerups.set(powerup.id, powerup);
            
            console.log(`Created ${type} powerup: ${powerup.id}`);
            return powerup;
        }
        catch (error) {
            console.error(`Error creating powerup of type ${type}:`, error);
            return null;
        }
    }
    
    /**
     * Create a powerup instance from data object
     * @param {Object} data Powerup data object
     * @returns {Powerup} The created powerup, or null if type unknown
     */
    createPowerupFromData(data) {
        if (!data || !data.type) {
            console.error('Invalid powerup data');
            return null;
        }
        
        try {
            // Get constructor for this type
            const PowerupClass = this.powerupTypes.get(data.type);
            
            if (!PowerupClass) {
                console.error(`Unknown powerup type in data: ${data.type}`);
                return null;
            }
            
            // Create from data (using static factory method)
            const powerup = PowerupClass.fromData(data);
            
            // Initialize and add to scene
            powerup.initialize(this.scene);
            
            // Add to managed collection
            this.powerups.set(powerup.id, powerup);
            
            console.log(`Created ${data.type} powerup from data: ${powerup.id}`);
            return powerup;
        }
        catch (error) {
            console.error('Error creating powerup from data:', error);
            return null;
        }
    }
    
    /**
     * Create a powerup at a position ahead of the player
     * @param {String} type The powerup type to create
     * @param {Number} distance How far ahead of player to place the powerup
     * @param {Object} params Additional parameters for the powerup
     * @returns {Powerup} The created powerup
     */
    createPowerupAheadOfPlayer(type, distance = 20, params = {}) {
        try {
            // Get player position and direction - check all possible locations
            let player = null;
            
            // Check all possible player/camera locations in the game object
            if (this.game.playerCamera && this.game.playerCamera.camera) {
                player = this.game.playerCamera.camera;
                console.log('Found player position in this.game.playerCamera.camera');
            } else if (this.game.player) {
                player = this.game.player;
                console.log('Found player position in this.game.player');
            } else if (this.game.camera) {
                player = this.game.camera;
                console.log('Found player position in this.game.camera');
            }
            
            if (!player || !player.position) {
                console.error('Cannot create powerup: Player position not found');
                console.error('Game object structure:', JSON.stringify({
                    hasPlayerCamera: !!this.game.playerCamera,
                    hasCamera: this.game.playerCamera ? !!this.game.playerCamera.camera : false,
                    hasPlayer: !!this.game.player,
                    hasDirectCamera: !!this.game.camera
                }));
                return null;
            }
            
            // Calculate position ahead of player
            // Start with player's position
            const position = {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            };
            
            // Get direction vector (normalized)
            const direction = new THREE.Vector3(0, 0, -1);
            
            // Apply camera rotation to direction vector
            if (player.quaternion) {
                direction.applyQuaternion(player.quaternion);
            } else if (player.rotation) {
                // Create temporary euler from player rotation
                const euler = new THREE.Euler(
                    player.rotation.x || 0,
                    player.rotation.y || 0,
                    player.rotation.z || 0,
                    'YXZ'
                );
                
                // Apply rotation to direction
                direction.applyEuler(euler);
            }
            
            // Scale direction by distance
            direction.multiplyScalar(distance);
            
            // Add to player position
            position.x += direction.x;
            position.y += direction.y;
            position.z += direction.z;
            
            // First, position exactly on the planet surface (for base position)
            const normalizedPos = new THREE.Vector3(position.x, position.y, position.z).normalize();
            const planetRadius = CONFIG.world.radius || 100;
            
            // Create base position on planet surface (no floating offset yet)
            const basePos = normalizedPos.clone().multiplyScalar(planetRadius);
            
            // Calculate floating offset along the surface normal
            const floatingOffset = 1.0; // 1.0 units above surface
            
            // Apply floating offset to create final position
            const finalPos = {
                x: basePos.x + normalizedPos.x * floatingOffset,
                y: basePos.y + normalizedPos.y * floatingOffset,
                z: basePos.z + normalizedPos.z * floatingOffset
            };
            
            // Calculate proper orientation (quaternion) for the powerup
            // Make it stand upright on the planet surface
            const up = normalizedPos;
            const quaternion = this.calculateQuaternion(up);
            
            console.log(`Creating powerup at position:`, finalPos, `with quaternion:`, quaternion);
            
            // Create powerup with calculated position and quaternion
            params.position = finalPos;
            params.quaternion = quaternion;
            
            return this.createPowerup(type, params);
        }
        catch (error) {
            console.error('Error creating powerup ahead of player:', error);
            return null;
        }
    }
    
    /**
     * Calculate quaternion for proper orientation on planet surface
     * @param {THREE.Vector3} up Normalized direction from planet center to position
     * @returns {Object} Quaternion object with x,y,z,w components
     */
    calculateQuaternion(up) {
        try {
            // SIMPLIFIED ORIENTATION APPROACH (matching billboard implementation):
            // 1. Calculate up vector (normal to surface) - already provided as parameter
            
            // 2. Find a forward direction (any perpendicular to up)
            // We'll use world up to help find a stable direction
            const worldUp = new THREE.Vector3(0, 1, 0);
            
            // If upVector is too close to worldUp, use a different reference
            const reference = Math.abs(up.dot(worldUp)) > 0.9 
                ? new THREE.Vector3(1, 0, 0) 
                : worldUp;
            
            // 3. Calculate right vector
            const rightVector = new THREE.Vector3().crossVectors(up, reference).normalize();
            
            // 4. Calculate the true forward vector
            const forwardVector = new THREE.Vector3().crossVectors(rightVector, up).normalize();
            
            // 5. Create the rotation matrix
            const matrix = new THREE.Matrix4().makeBasis(rightVector, up, forwardVector);
            
            // 6. Extract quaternion from rotation matrix
            const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
            
            // Convert to plain object for consistency
            return {
                x: quaternion.x,
                y: quaternion.y,
                z: quaternion.z,
                w: quaternion.w
            };
        }
        catch (error) {
            console.error('Error calculating quaternion:', error);
            
            // Return identity quaternion as fallback
            return { x: 0, y: 0, z: 0, w: 1 };
        }
    }
    
    /**
     * Spawn a powerup at a random position on the planet
     * @param {String} type The powerup type to spawn
     * @param {Object} params Additional parameters for the powerup
     * @returns {Powerup} The spawned powerup
     */
    spawnRandomPowerup(type, params = {}) {
        try {
            // Get world radius from CONFIG
            const radius = CONFIG.world.radius || 100;
            
            // Generate random spherical coordinates
            const theta = Math.random() * Math.PI * 2; // 0 to 2π
            const phi = Math.acos(2 * Math.random() - 1); // 0 to π
            
            // Convert to Cartesian coordinates
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            // Create base position on planet surface (no floating offset yet)
            const basePos = new THREE.Vector3(x, y, z);
            const normalizedDir = basePos.clone().normalize();
            
            // Add floating offset along the surface normal
            const floatingOffset = 1.0; // 1.0 units above surface
            
            // Calculate final position with floating offset
            const finalPos = {
                x: basePos.x + normalizedDir.x * floatingOffset,
                y: basePos.y + normalizedDir.y * floatingOffset,
                z: basePos.z + normalizedDir.z * floatingOffset
            };
            
            // Calculate quaternion for proper orientation
            const quaternion = this.calculateQuaternion(normalizedDir);
            
            console.log(`Spawning random powerup at position:`, finalPos, `with quaternion:`, quaternion);
            
            // Create powerup with calculated position and quaternion
            params.position = finalPos;
            params.quaternion = quaternion;
            
            return this.createPowerup(type, params);
        }
        catch (error) {
            console.error('Error spawning random powerup:', error);
            return null;
        }
    }
    
    /**
     * Update all managed powerups
     * @param {Number} delta Time delta in seconds
     */
    update(delta) {
        // Skip if no powerups
        if (this.powerups.size === 0) {
            return;
        }
        
        const now = Date.now();
        
        // Only check for collisions periodically to avoid performance impact
        const shouldCheckCollisions = now - this.lastCheckTime > this.checkInterval;
        
        if (shouldCheckCollisions) {
            this.lastCheckTime = now;
            this.checkCollisions();
        }
        
        // Update each powerup
        for (const powerup of this.powerups.values()) {
            // Update animation and state
            powerup.update(delta);
            
            // Check for expired powerups
            if (powerup.hasExpired() || powerup.hasBeenCollected()) {
                this.removePowerup(powerup);
            }
        }
    }
    
    /**
     * Check for collisions between the player and powerups
     */
    checkCollisions() {
        // Find player position from all possible sources
        let playerPos = null;
        
        // Check all possible player/camera locations
        if (this.game.playerCamera && this.game.playerCamera.camera && this.game.playerCamera.camera.position) {
            playerPos = this.game.playerCamera.camera.position;
        } else if (this.game.player && this.game.player.position) {
            playerPos = this.game.player.position;
        } else if (this.game.camera && this.game.camera.position) {
            playerPos = this.game.camera.position;
        }
        
        // If no player position available, skip collision checks
        if (!playerPos) {
            return;
        }
        
        // Check each powerup for collision with player
        for (const powerup of this.powerups.values()) {
            // Skip already collected powerups
            if (powerup.hasBeenCollected()) {
                continue;
            }
            
            // Calculate distance between player and powerup
            const powerupPos = powerup.mesh ? powerup.mesh.position : powerup.position;
            
            const dx = playerPos.x - powerupPos.x;
            const dy = playerPos.y - powerupPos.y;
            const dz = playerPos.z - powerupPos.z;
            
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // If player is close enough, collect the powerup
            if (distance <= this.collisionDistance) {
                this.collectPowerup(powerup);
            }
        }
    }
    
    /**
     * Collect a powerup and apply its effects
     * @param {Powerup} powerup The powerup to collect
     */
    collectPowerup(powerup) {
        if (!powerup || powerup.hasBeenCollected()) {
            return;
        }
        
        // Apply powerup effect to the game object itself rather than just the player
        // This ensures the powerup can access everything it needs including weaponManager
        const success = powerup.applyEffect(this.game);
        
        // If effect was applied successfully, mark for removal
        if (success) {
            // Play collection sound if available
            if (this.game.audio && typeof this.game.audio.playSound === 'function') {
                this.game.audio.playSound('powerup_collect');
            }
            
            // Send collection event to server if multiplayer
            this.sendPowerupCollectedToServer(powerup);
            
            // Schedule removal
            setTimeout(() => {
                this.removePowerup(powerup);
            }, 500); // Small delay to allow for effects
        }
    }
    
    /**
     * Set up event listeners for server-spawned powerups
     */
    setupServerPowerupSync() {
        // Ensure we have a game object with WebSocket
        if (!this.game || !this.game.webSocket) {
            console.warn('Cannot set up powerup sync: WebSocket not available');
            return;
        }
        
        // Get a reference to the WebSocket
        const webSocket = this.game.webSocket;
        
        // Create a message event handler
        const handleSocketMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle powerup data messages
                if (data.type && data.type.startsWith('powerup_')) {
                    this.handlePowerupMessage(data);
                }
            } catch (error) {
                // Only log if it's a parsing error for valid JSON data
                if (event.data && typeof event.data === 'string' && event.data.includes('powerup')) {
                    console.error('Error parsing powerup WebSocket message:', error);
                }
            }
        };
        
        // Add event listener to WebSocket
        webSocket.addEventListener('message', handleSocketMessage);
        
        console.log('Set up server powerup sync successfully');
    }
    
    /**
     * Handle powerup-related messages from the server
     * @param {Object} data - The message data
     */
    handlePowerupMessage(data) {
        if (!data || !data.type) return;
        
        // Handle different message types
        if (data.type === 'powerup_removed') {
            // Handle powerup removal
            this.removePowerupById(data.id);
        } else if (data.id && data.position && data.quaternion) {
            // This looks like powerup data - try to create or update
            this.handlePowerupData(data);
        }
    }
    
    /**
     * Handle powerup data from the server
     * @param {Object} data - The powerup data
     */
    handlePowerupData(data) {
        // Check if we already have this powerup
        if (this.powerups.has(data.id)) {
            console.log(`Powerup ${data.id} already exists, updating`);
            // TODO: Update existing powerup if needed
            return;
        }
        
        // Create a new powerup from the data
        const powerup = this.createPowerupFromData(data);
        
        if (powerup) {
            console.log(`Created powerup from server data: ${data.type} (${data.id})`);
        } else {
            console.error(`Failed to create powerup from server data: ${data.type} (${data.id})`);
        }
    }
    
    /**
     * Remove a powerup by ID (used for server sync)
     * @param {String} id - The ID of the powerup to remove
     */
    removePowerupById(id) {
        // Get the powerup from our collection
        const powerup = this.powerups.get(id);
        
        if (powerup) {
            console.log(`Removing powerup by ID: ${id}`);
            this.removePowerup(powerup);
        } else {
            console.warn(`Powerup with ID ${id} not found for removal`);
        }
    }
    
    /**
     * Send powerup collected event to server
     * @param {Powerup} powerup The collected powerup
     */
    sendPowerupCollectedToServer(powerup) {
        try {
            // Only send if multiplayer and websocket available
            if (!this.game.isMultiplayer || !this.game.webSocket || 
                this.game.webSocket.readyState !== WebSocket.OPEN) {
                return;
            }
            
            const powerupData = {
                type: 'powerup_collected',
                powerupId: powerup.id,
                powerupType: powerup.type,
                playerId: this.game.playerId || ''
            };
            
            this.game.webSocket.send(JSON.stringify(powerupData));
            console.log(`Sent powerup collection event to server: ${powerup.id}`);
        }
        catch (error) {
            console.error('Error sending powerup collection to server:', error);
        }
    }
    
    /**
     * Remove a powerup from the scene and manager
     * @param {Powerup} powerup The powerup to remove
     */
    removePowerup(powerup) {
        if (!powerup) {
            return;
        }
        
        // Call cleanup to remove from scene
        powerup.cleanup(this.scene);
        
        // Remove from managed collection
        this.powerups.delete(powerup.id);
    }
    
    /**
     * Remove all powerups
     */
    clearAllPowerups() {
        for (const powerup of this.powerups.values()) {
            powerup.cleanup(this.scene);
        }
        
        this.powerups.clear();
        console.log('All powerups cleared');
    }
    
    /**
     * Get the number of active powerups
     * @returns {Number} Count of active powerups
     */
    getPowerupCount() {
        return this.powerups.size;
    }
    
    /**
     * Create a Shooting Ammo powerup ahead of the player
     * @param {Number} distance Distance ahead of player (default 20)
     * @returns {Powerup} The created powerup
     */
    createShootingAmmoPowerup(distance = 20) {
        return this.createPowerupAheadOfPlayer('shooting_ammo', distance);
    }
    
    /**
     * Create a Billboard Ammo powerup ahead of the player
     * @param {Number} distance Distance ahead of player (default 20)
     * @returns {Powerup} The created powerup
     */
    createBillboardAmmoPowerup(distance = 20) {
        return this.createPowerupAheadOfPlayer('billboard_ammo', distance);
    }
}

// Register PowerupManager class globally if in browser environment
if (typeof window !== 'undefined') {
    window.PowerupManager = PowerupManager;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PowerupManager;
} 