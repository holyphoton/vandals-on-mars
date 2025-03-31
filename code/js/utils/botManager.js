// botManager.js - Bot management for autonomous billboards - 2025-03-26

/**
 * Bot Manager for handling automated billboard placement
 */
class BotManager {
    /**
     * Initialize the Bot Manager
     * @param {Game} game - The main game instance
     */
    constructor(game) {
        this.game = game;
        this.globe = game.globe;
        this.scene = game.scene;
        this.config = null;
        this.botBillboards = new Map(); // Map of bot billboard IDs to billboard data
        this.isInitialized = false;
        this.lastSpawnTime = Date.now();
        this.botPlayerId = "bot_system_player";
        this.respawnCheckerId = null; // Track the interval for checking respawns
        this.spawnTimerId = null; // Track the spawning timer
        
        // Queue for billboards that couldn't be created due to weaponManager not being available
        this.pendingBillboards = [];
        
        // Special bot billboards player ID
        this.botIdPrefix = "bot";
        
        // Create a reference to this for use in callbacks
        const self = this;
        
        // Configuration defaults
        this.maxBots = 20;
        this.spawnInterval = 3000;
        this.checkInterval = 5000;
        
        console.log('BotManager instance created');
    }
    
    /**
     * Load bot configuration
     * @returns {Promise} - Resolves when configuration is loaded
     */
    async loadConfig() {
        try {
            const response = await fetch('/bot-config.json');
            if (!response.ok) {
                throw new Error(`Failed to load bot configuration: ${response.status} ${response.statusText}`);
            }
            
            const rawConfig = await response.json();
            
            // Store the raw config but also extract main properties for easy access
            this.config = rawConfig;
            
            // Extract configuration directly from the root level
            this.spawnInterval = rawConfig.spawnInterval || 3000;
            this.maxBots = rawConfig.maxBots || 20;
            this.checkInterval = rawConfig.checkInterval || 5000;
            
            console.log(`Loaded config values: maxBots=${this.maxBots}, spawnInterval=${this.spawnInterval}ms, checkInterval=${this.checkInterval}ms`);
            
            console.log('Bot configuration loaded successfully');
            return this.config;
        } catch (error) {
            console.error('Error loading bot configuration:', error);
            
            // Use default configuration
            this.config = {
                spawnInterval: 3000,
                maxBots: 20,
                checkInterval: 5000
            };
            
            console.log('Using default bot configuration');
            return this.config;
        }
    }
    
    /**
     * Initialize the bot manager
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('BotManager already initialized');
            return;
        }

        console.log('Initializing BotManager...');
        
        // Load configuration
        await this.loadConfig();
        
        // Initialize collections
        this.pendingBillboards = [];
        this.botBillboards = new Map();
        
        // Set initialization flag
        this.isInitialized = true;
        
        console.log(`BotManager initialized with maxBots=${this.maxBots}`);
        
        // Start the main billboard maintenance process
        this.startBillboardMaintenance();
    }
    
    /**
     * Start the billboard maintenance process
     * This handles both checking current count and spawning new billboards
     */
    startBillboardMaintenance() {
        // Set up recurring check interval
        console.log(`Setting up billboard check interval (${this.checkInterval}ms)`);
        this.respawnCheckerId = setInterval(() => {
            console.log('Scheduled billboard maintenance check triggered');
            this.maintainBillboards();
        }, this.checkInterval);
        
        // Do an initial check right away
        this.maintainBillboards();
    }
    
    /**
     * Stop the billboard maintenance process
     */
    stopBillboardMaintenance() {
        // Clear intervals
        if (this.respawnCheckerId) {
            clearInterval(this.respawnCheckerId);
            this.respawnCheckerId = null;
        }
        
        if (this.spawnTimerId) {
            clearInterval(this.spawnTimerId);
            this.spawnTimerId = null;
        }
        
        console.log('Billboard maintenance stopped');
    }
    
    /**
     * Maintain the billboard count at the configured level
     */
    maintainBillboards() {
        if (!this.isInitialized) {
            console.warn('Cannot maintain billboards: BotManager not initialized');
            return;
        }
        
        // Get accurate count of billboards
        this.getBillboardCount().then(count => {
            console.log(`Current bot billboard count: ${count}/${this.maxBots}`);
            
            // If we already have a spawn timer running, don't start another one
            if (this.spawnTimerId) {
                console.log('Billboard spawning already in progress');
                return;
            }
            
            // If we need more billboards, start spawning
            if (count < this.maxBots) {
                const neededBillboards = this.maxBots - count;
                console.log(`Need to spawn ${neededBillboards} more billboards`);
                
                // Spawn one billboard immediately
                this.spawnBotBillboard();
                
                // Set up interval for spawning remaining billboards
                let spawnedCount = 1;
                
                this.spawnTimerId = setInterval(() => {
                    // Get current count again to ensure we don't exceed maxBots
                    const currentCount = this.botBillboards.size;
                    
                    if (currentCount < this.maxBots) {
                        // Spawn another billboard
                        console.log(`Spawning billboard ${spawnedCount + 1}/${neededBillboards} (interval: ${this.spawnInterval}ms)`);
                        this.spawnBotBillboard();
                        spawnedCount++;
                    } else {
                        // We've reached the max, stop spawning
                        console.log(`Reached target billboard count (${currentCount}/${this.maxBots}), stopping spawn interval`);
                        clearInterval(this.spawnTimerId);
                        this.spawnTimerId = null;
                    }
                    
                    // If we've spawned all needed billboards, clear the interval
                    if (spawnedCount >= neededBillboards) {
                        console.log('Finished spawning all needed billboards');
                        clearInterval(this.spawnTimerId);
                        this.spawnTimerId = null;
                    }
                }, this.spawnInterval);
            } else {
                console.log(`No additional billboards needed, already at max (${count}/${this.maxBots})`);
            }
        });
    }
    
    /**
     * Get an accurate count of bot billboards
     * @returns {Promise<number>} - Resolves with the current billboard count
     */
    async getBillboardCount() {
        // Get the count from our local tracking
        const trackedCount = this.botBillboards.size;
        
        // Perform a real-time check of billboards in the game
        let actualCount = 0;
        
        // Check method 1: Look in game.billboards if available
        if (this.game && this.game.billboards && Array.isArray(this.game.billboards)) {
            const gameBotBillboards = this.game.billboards.filter(b => 
                b.id && b.id.startsWith('bot_')
            );
            actualCount = gameBotBillboards.length;
            console.log(`Found ${actualCount} bot billboards in game.billboards array`);
        }
        
        // Check method 2: Look in billboardGun.billboards if available
        if (this.game && this.game.weaponManager && this.game.weaponManager.billboardGun && 
            this.game.weaponManager.billboardGun.billboards) {
            
            const gunBotBillboards = this.game.weaponManager.billboardGun.billboards.filter(b => 
                b.id && b.id.startsWith('bot_')
            );
            
            // If we found billboards here, update the count if it's higher
            if (gunBotBillboards.length > actualCount) {
                actualCount = gunBotBillboards.length;
                console.log(`Found ${actualCount} bot billboards in billboardGun.billboards array`);
            }
        }
        
        // If there's a discrepancy, log it and use the higher count to be safe
        if (actualCount !== trackedCount) {
            console.warn(`Billboard count mismatch: tracked=${trackedCount}, actual=${actualCount}`);
            
            // Use the higher of the two counts to ensure we don't create too many
            return Math.max(trackedCount, actualCount);
        }
        
        return trackedCount;
    }
    
    /**
     * Update method - called each frame
     * @param {number} delta - Time delta since last frame
     */
    update(delta) {
        if (!this.isInitialized) {
            return;
        }

        // Process any pending billboards that need to be created
        if (this.pendingBillboards && this.pendingBillboards.length > 0) {
            this.processPendingBillboards();
        }
    }
    
    /**
     * Process any pending billboards that couldn't be created earlier
     */
    processPendingBillboards() {
        if (this.pendingBillboards.length === 0) return;
        
        // Check if weaponManager is now available and initialized
        if (this.game && 
            this.game.weaponManager && 
            this.game.weaponManager.isInitialized && 
            typeof this.game.weaponManager.addBillboard === 'function') {
            
            console.log(`Attempting to create ${this.pendingBillboards.length} pending bot billboards`);
            
            // Process each pending billboard
            const billboardsToRetry = [];
            let successCount = 0;
            
            for (const billboardData of this.pendingBillboards) {
                try {
                    // Ensure billboard has quaternion data
                    if (!billboardData.quaternion && billboardData.position) {
                        billboardData.quaternion = this.calculateQuaternion(
                            new THREE.Vector3(
                                billboardData.position.x,
                                billboardData.position.y,
                                billboardData.position.z
                            )
                        );
                        console.log(`Added quaternion to pending billboard ${billboardData.id}:`, billboardData.quaternion);
                    }
                    
                    // Try to create the billboard now
                    this.game.weaponManager.addBillboard(billboardData);
                    
                    // If successful, sync with server
                    if (this.game.syncBillboardData) {
                        this.game.syncBillboardData(billboardData);
                    }
                    
                    console.log(`Pending bot billboard created: "${billboardData.text}"`);
                    successCount++;
                } catch (error) {
                    // If still failed, keep in retry queue
                    console.error(`Failed to create pending billboard: ${billboardData.id}`, error);
                    billboardsToRetry.push(billboardData);
                }
            }
            
            // Update pending billboards with those that still failed
            this.pendingBillboards = billboardsToRetry;
            
            if (this.pendingBillboards.length === 0) {
                console.log(`All ${successCount} pending billboards processed successfully`);
            } else {
                console.log(`Created ${successCount} pending billboards, ${this.pendingBillboards.length} still pending`);
            }
        } else if (this.pendingBillboards.length > 0) {
            // Log why we still can't process pending billboards
            const missingComponents = [];
            if (!this.game) missingComponents.push("game instance");
            else if (!this.game.weaponManager) missingComponents.push("weaponManager");
            else if (!this.game.weaponManager.isInitialized) missingComponents.push("weaponManager not initialized");
            else if (typeof this.game.weaponManager.addBillboard !== 'function') missingComponents.push("addBillboard method");
            
            console.log(`Cannot process ${this.pendingBillboards.length} pending billboards yet. Missing: ${missingComponents.join(', ')}`);
        }
    }
    
    /**
     * Spawn a new bot billboard at a random location
     */
    spawnBotBillboard() {
        if (!this.isInitialized || !this.config) return;
        
        // Generate random position on globe
        const position = this.getRandomPositionOnGlobe();
        
        // Skip distance check for now to ensure billboards can spawn
        // We can add it back later with proper configuration
        
        // Get random text from messages array
        const messages = this.config.messages || ["Bot Billboard"];
        const text = messages[Math.floor(Math.random() * messages.length)];
        
        // Set default owner
        const owner = "Mars Bot";
        
        // Use billboardSize from config
        const width = this.config.billboardSize?.width || 2;
        const height = this.config.billboardSize?.height || 1;
        const health = this.config.health || 100;
        
        // Generate billboard ID using our helpers
        let billboardId;
        if (window.Helpers && typeof window.Helpers.generateId === 'function') {
            billboardId = window.Helpers.generateId('bot');
        } else {
            // Fallback implementation
            const randomNumbers = Math.floor(10000 + Math.random() * 90000);
            const alphabet = 'abcdefghijklmnopqrstuvwxyz';
            let randomAlphabets = '';
            for (let i = 0; i < 5; i++) {
                randomAlphabets += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
            }
            billboardId = `bot_${randomNumbers}_${randomAlphabets}`;
        }
        
        // Get random color from colors array
        const colors = this.config.colors || ["#FF5733", "#33FF57", "#3357FF"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Calculate quaternion for proper orientation on the globe
        const quaternion = this.calculateQuaternion(position);
        
        console.log(`Creating bot billboard with quaternion:`, quaternion);
        
        // Create billboard data
        const billboardData = {
            type: 'billboard_data',
            id: billboardId,
            position: position,
            quaternion: quaternion, // Add quaternion data for proper orientation
            width: width,
            height: height,
            health: health,
            text: text,
            color: color,
            owner: owner,
            player_id: 'bot_system',
            billboard_category: 'bot',
            timestamp: Date.now()
        };
        
        // Add to internal tracking list using Map
        this.botBillboards.set(billboardId, billboardData);
        
        // Check if weaponManager is available AND initialized
        if (this.game && 
            this.game.weaponManager && 
            this.game.weaponManager.isInitialized && 
            typeof this.game.weaponManager.addBillboard === 'function') {
            try {
                // Create in game
                this.game.weaponManager.addBillboard(billboardData);
                
                // Sync with server
                if (this.game.syncBillboardData) {
                    this.game.syncBillboardData(billboardData);
                }
                
                console.log(`Bot billboard created: "${text}" by ${owner}`);
                return true;
            } catch (error) {
                console.error("Error creating bot billboard:", error);
                this.pendingBillboards.push(billboardData);
                return false;
            }
        } else {
            // Log detailed debugging information about why we couldn't create the billboard
            console.warn("Could not create bot billboard - weaponManager not available");
            
            // Log what components are missing
            const missingComponents = [];
            if (!this.game) missingComponents.push("game instance");
            else if (!this.game.weaponManager) missingComponents.push("weaponManager");
            else if (!this.game.weaponManager.isInitialized) missingComponents.push("weaponManager not initialized");
            else if (typeof this.game.weaponManager.addBillboard !== 'function') missingComponents.push("addBillboard method");
            
            console.log(`Missing components for bot billboard creation: ${missingComponents.join(', ')}`);
            
            // Add to pending list to try again later
            this.pendingBillboards.push(billboardData);
            return false;
        }
    }
    
    /**
     * Get a random position on the globe's surface
     * @returns {THREE.Vector3} - The random position
     */
    getRandomPositionOnGlobe() {
        // Generate random spherical coordinates
        const radius = this.globe.radius;
        const theta = Math.random() * Math.PI * 2; // 0 to 2π
        const phi = Math.acos(2 * Math.random() - 1); // 0 to π
        
        // Convert to Cartesian coordinates
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        return new THREE.Vector3(x, y, z);
    }
    
    /**
     * Check if a position is too close to existing billboards
     * @param {THREE.Vector3} position - Position to check
     * @returns {boolean} - True if too close to any existing billboard
     */
    isTooCloseToExistingBillboards(position) {
        // Use a default minimum distance of 20 units
        const minDistance = 20;
        
        // Check against bot billboards (our botBillboards is now a Map)
        for (const [_, billboard] of this.botBillboards) {
            const billboardPos = new THREE.Vector3(
                billboard.position.x,
                billboard.position.y,
                billboard.position.z
            );
            
            if (position.distanceTo(billboardPos) < minDistance) {
                return true;
            }
        }
        
        // Check against player billboards if available
        if (this.game && this.game.weaponManager && 
            this.game.weaponManager.billboardGun && 
            this.game.weaponManager.billboardGun.billboards) {
            
            for (const billboard of this.game.weaponManager.billboardGun.billboards) {
                if (billboard.mesh) {
                    const billboardPos = billboard.mesh.position;
                    if (position.distanceTo(billboardPos) < minDistance) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Calculate quaternion for a billboard at the given position
     * @param {THREE.Vector3} position - Position of the billboard
     * @returns {THREE.Quaternion} - The calculated quaternion
     */
    calculateQuaternion(position) {
        // Create a quaternion to orient the billboard perpendicular to the surface
        const up = position.clone().normalize(); // Direction from center to position
        
        // Create a rotation that points the billboard normal along the "up" vector
        // We need to determine a suitable "forward" direction perpendicular to "up"
        // For simplicity, we'll use a technique to find a perpendicular vector
        const forward = new THREE.Vector3(1, 0, 0);
        if (Math.abs(up.x) > 0.99) {
            forward.set(0, 1, 0);
        }
        
        // Make forward perpendicular to up
        forward.sub(up.clone().multiplyScalar(forward.dot(up))).normalize();
        
        // Create quaternion from the forward and up vectors
        const quaternion = new THREE.Quaternion();
        const matrix = new THREE.Matrix4().lookAt(
            new THREE.Vector3(0, 0, 0), // Origin
            forward, // Direction to look
            up // Up direction
        );
        
        quaternion.setFromRotationMatrix(matrix);
        
        return {
            x: quaternion.x,
            y: quaternion.y,
            z: quaternion.z,
            w: quaternion.w
        };
    }
    
    /**
     * Get a random text from the configured texts
     * @returns {string} - Random billboard text
     */
    getRandomText() {
        const texts = this.config.texts;
        return texts[Math.floor(Math.random() * texts.length)];
    }
    
    /**
     * Get a random sender name from the configured bot senders
     * @returns {string} - Random sender name
     */
    getRandomSender() {
        const senders = this.config.botSenders;
        return senders[Math.floor(Math.random() * senders.length)];
    }
    
    /**
     * Get a random number in a range
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} - Random number in range
     */
    getRandomInRange(min, max) {
        return min + Math.random() * (max - min);
    }
    
    /**
     * Save bot billboards to the bot-specific file
     */
    saveBotBillboards() {
        // Convert the Map to an array for sending to the server
        const billboardsArray = Array.from(this.botBillboards.values());
        
        console.log(`Saving ${billboardsArray.length} bot billboards to server`);
        
        // We'll send a request to the server to handle the file saving
        fetch('/save-bot-billboards', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(billboardsArray)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to save bot billboards');
            }
            return response.json();
        })
        .then(data => {
            console.log("Bot billboards saved:", data);
        })
        .catch(error => {
            console.error("Error saving bot billboards:", error);
        });
    }
    
    /**
     * Handle billboard removal
     * @param {string} billboardId - ID of the removed billboard
     */
    onBillboardRemoved(billboardId) {
        // Check if this is one of our bot billboards
        if (this.botBillboards.has(billboardId)) {
            console.log(`Bot billboard removed: ${billboardId}`);
            
            // Log current count before removal
            const beforeCount = this.botBillboards.size;
            console.log(`Bot billboard count before removal: ${beforeCount}`);
            
            // Remove from our tracking
            this.botBillboards.delete(billboardId);
            
            // Log count after removal
            const afterCount = this.botBillboards.size;
            console.log(`Bot billboard count after removal: ${afterCount}`);
            
            // Save updated billboard list
            this.saveBotBillboards();
            
            // Trigger a maintenance check shortly after removal
            setTimeout(() => {
                console.log(`Billboard ${billboardId} was shot down - checking if need to spawn more`);
                this.maintainBillboards();
            }, 1500);
        } else {
            // This isn't one of our tracked billboards
            console.log(`Billboard ${billboardId} removed but not in bot tracking`);
        }
    }
}

// Export the BotManager class
window.BotManager = BotManager; 