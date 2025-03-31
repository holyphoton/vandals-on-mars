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
        
        // Flag to track if we've received initial powerups from server
        this.initialPowerupsReceived = false;
        
        // Register known powerup types
        this.registerPowerupTypes();
    }
    
    /**
     * Initialize the manager
     */
    initialize() {
        console.log('PowerupManager initialized');
        
        // Register for WebSocket message handling if game has a WebSocket
        if (this.game && this.game.addMessageHandler) {
            this.game.addMessageHandler('powerup_data', this.handlePowerupData.bind(this));
            this.game.addMessageHandler('all_powerups', this.handleAllPowerups.bind(this));
            this.game.addMessageHandler('powerup_collected', this.handlePowerupCollected.bind(this));
            console.log('Registered WebSocket message handlers for powerups');
        } else {
            console.warn('Game WebSocket message handler registration not available');
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
            
            // Send collection event to server
            this.sendPowerupCollectedToServer(powerup);
            
            // Schedule removal
            setTimeout(() => {
                this.removePowerup(powerup);
            }, 500); // Small delay to allow for effects
        }
    }
    
    /**
     * Handle powerup data received from the server
     * @param {Object} data The powerup data
     */
    handlePowerupData(data) {
        try {
            // Skip if already in our collection
            if (this.powerups.has(data.id)) {
                // Just update if needed
                return;
            }
            
            // Skip if already collected
            if (data.isCollected) {
                console.log(`Skipping already collected powerup from server: ${data.id}`);
                return;
            }
            
            console.log(`Received powerup data from server: ${data.type} (ID: ${data.id})`);
            
            // Create a powerup from the data
            const powerup = this.createPowerupFromData(data);
            
            if (!powerup) {
                console.error(`Failed to create powerup from server data: ${data.id}`);
            } else {
                console.log(`Created powerup from server data: ${powerup.id} (${powerup.type})`);
            }
        } catch (error) {
            console.error('Error handling powerup data from server:', error);
        }
    }
    
    /**
     * Handle all powerups data received from the server
     * @param {Object} data The all_powerups message data
     */
    handleAllPowerups(data) {
        try {
            if (!data.powerups || !Array.isArray(data.powerups)) {
                console.error('Invalid powerups data received:', data);
                return;
            }
            
            console.log(`Received all powerups from server: ${data.powerups.length} powerups`);
            
            // Clear existing powerups if this is our first sync
            if (!this.initialPowerupsReceived) {
                console.log('First powerup sync - clearing existing powerups');
                this.clearAllPowerups();
                this.initialPowerupsReceived = true;
            }
            
            // Process each powerup
            let createdCount = 0;
            let skippedCount = 0;
            
            for (const powerupData of data.powerups) {
                // Skip if invalid data
                if (!powerupData || !powerupData.id || !powerupData.type) {
                    console.warn('Skipping invalid powerup data:', powerupData);
                    continue;
                }
                
                // Skip if already in our collection
                if (this.powerups.has(powerupData.id)) {
                    skippedCount++;
                    continue;
                }
                
                // Skip if already collected
                if (powerupData.isCollected) {
                    skippedCount++;
                    continue;
                }
                
                try {
                    // Create powerup from data
                    const powerup = this.createPowerupFromData(powerupData);
                    if (powerup) {
                        createdCount++;
                    }
                } catch (createError) {
                    console.error(`Error creating powerup ${powerupData.id}:`, createError);
                }
            }
            
            if (createdCount > 0 || skippedCount > 0) {
                console.log(`Processed server powerups: ${createdCount} created, ${skippedCount} skipped`);
            }
        } catch (error) {
            console.error('Error handling all powerups from server:', error);
        }
    }
    
    /**
     * Handle powerup collected message from server
     * @param {Object} data The powerup_collected message data
     */
    handlePowerupCollected(data) {
        try {
            const powerupId = data.powerupId;
            
            // Skip if not in our collection
            if (!this.powerups.has(powerupId)) {
                return;
            }
            
            console.log(`Powerup collected by another player: ${powerupId}`);
            
            // Get the powerup
            const powerup = this.powerups.get(powerupId);
            
            // Mark as collected
            powerup.isCollected = true;
            
            // Schedule for removal
            setTimeout(() => {
                this.removePowerup(powerup);
            }, 500);
        } catch (error) {
            console.error('Error handling powerup collected from server:', error);
        }
    }
    
    /**
     * Send powerup collected event to server
     * @param {Powerup} powerup The collected powerup
     */
    sendPowerupCollectedToServer(powerup) {
        try {
            // Check for multiplayer setting
            const isMultiplayer = this.game.isMultiplayer !== false; // Default to true if undefined
            
            // Find the appropriate WebSocket to use
            let socket = null;
            
            // Try different possible socket properties
            if (this.game.webSocket && this.game.webSocket.readyState === WebSocket.OPEN) {
                socket = this.game.webSocket;
            } else if (this.game.socket && this.game.socket.readyState === WebSocket.OPEN) {
                socket = this.game.socket;
            }
            
            // Return if we're not in multiplayer mode or no socket is available
            if (!isMultiplayer || !socket) {
                return;
            }
            
            // Find the player ID
            const playerId = this.game.playerId || 
                            (this.game.persistence && this.game.persistence.playerId) || 
                            'unknown_player';
            
            // Create the collection message
            const powerupData = {
                type: 'powerup_collected',
                powerupId: powerup.id,
                powerupType: powerup.type,
                playerId: playerId
            };
            
            // Send the message
            socket.send(JSON.stringify(powerupData));
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