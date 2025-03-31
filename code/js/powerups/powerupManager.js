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
        
        // Nothing to do here yet until we implement server-side spawning
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
            
            // Adjust position to be on the planet surface
            const normalizedPos = new THREE.Vector3(position.x, position.y, position.z).normalize();
            const planetRadius = CONFIG.world.radius || 100;
            
            // Scale normalized position to planet radius
            normalizedPos.multiplyScalar(planetRadius);
            
            // Use normalized position on planet surface
            position.x = normalizedPos.x;
            position.y = normalizedPos.y;
            position.z = normalizedPos.z;
            
            // Calculate proper orientation (quaternion) for the powerup
            // Make it stand upright on the planet surface
            const up = new THREE.Vector3(position.x, position.y, position.z).normalize();
            const quaternion = this.calculateQuaternion(up);
            
            // Create powerup with calculated position and quaternion
            params.position = position;
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
        // Similar to the server-side quaternion calculation
        try {
            // Create a THREE.js quaternion
            const quaternion = new THREE.Quaternion();
            
            // Find a reference vector different from up
            // Use world up (0,1,0) as the reference unless up is too close to it
            let reference = new THREE.Vector3(0, 1, 0);
            const worldUpDot = Math.abs(up.y); // Dot product with (0,1,0)
            
            if (worldUpDot > 0.9) {
                // If up is too close to world up, use world right instead
                reference = new THREE.Vector3(1, 0, 0);
            }
            
            // Calculate right vector (cross product of up and reference)
            const right = new THREE.Vector3().crossVectors(up, reference).normalize();
            
            // Calculate forward vector (cross product of right and up)
            const forward = new THREE.Vector3().crossVectors(right, up).normalize();
            
            // Create a rotation matrix from right, up, forward
            const rotMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
            
            // Extract quaternion from rotation matrix
            quaternion.setFromRotationMatrix(rotMatrix);
            
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
            
            const position = { x, y, z };
            
            // Calculate quaternion for proper orientation
            const up = new THREE.Vector3(x, y, z).normalize();
            const quaternion = this.calculateQuaternion(up);
            
            // Create powerup with calculated position and quaternion
            params.position = position;
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