// persistence.js - Player data persistence functionality - 2025-03-25

/**
 * Provides functions for saving and loading player data to ensure
 * persistence between game sessions.
 */
class PlayerPersistence {
    /**
     * Initialize the persistence system
     * @param {Game} game - Reference to the game instance
     */
    constructor(game) {
        this.game = game;
        this.playerId = null;
        this.autoSaveInterval = null;
        this.autoSaveDelay = CONFIG.persistence.autoSaveDelay * 1000; // Convert to milliseconds
        this.isInitialized = false;
        
        console.log(`PlayerPersistence initialized with auto-save delay: ${this.autoSaveDelay/1000}s`);
    }
    
    /**
     * Initialize the persistence system
     * Generates or retrieves player ID and loads player data
     * @returns {Promise} - Resolves when initialization is complete
     */
    async initialize() {
        // Check if player ID exists in localStorage
        this.playerId = localStorage.getItem('vandalsOnMarsPlayerId');
        
        // If no player ID exists, generate and save a new one
        if (!this.playerId) {
            this.playerId = this.generatePlayerId();
            localStorage.setItem('vandalsOnMarsPlayerId', this.playerId);
            console.log(`New player ID generated: ${this.playerId}`);
        } else {
            console.log(`Existing player ID found: ${this.playerId}`);
            // Try to load saved player data
            await this.loadPlayerData();
        }
        
        // Set up auto-save interval
        this.startAutoSave();
        
        this.isInitialized = true;
        return this.playerId;
    }
    
    /**
     * Generate a unique player ID
     * @returns {string} - A new unique ID
     */
    generatePlayerId() {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Start the auto-save interval
     */
    startAutoSave() {
        // Clear any existing interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Set up new interval
        this.autoSaveInterval = setInterval(() => {
            this.savePlayerData();
        }, this.autoSaveDelay);
        
        console.log(`Auto-save started with interval: ${this.autoSaveDelay/1000}s`);
    }
    
    /**
     * Stop the auto-save interval
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    /**
     * Save player's data to the server
     */
    savePlayerData() {
        if (!this.game || !this.game.socket || !this.playerId) {
            console.warn('Cannot save player data: game, socket or player ID not available');
            return;
        }
        
        // Get player's current ammo from WeaponManager
        let shootingAmmo = 0;
        let billboardAmmo = 0;
        
        if (this.game.weaponManager) {
            if (this.game.weaponManager.shooterGun) {
                shootingAmmo = this.game.weaponManager.shooterGun.ammo;
            }
            if (this.game.weaponManager.billboardGun) {
                billboardAmmo = this.game.weaponManager.billboardGun.ammo;
            }
        }
        
        // Get player's position
        let playerPosition = null;
        if (this.game.playerCamera) {
            playerPosition = this.game.playerCamera.camera.position.clone();
        }
        
        // Get billboard text
        const billboardText = this.game.getBillboardText ? this.game.getBillboardText() : 
                             (this.game.billboardText || `${this.game.username}'s Turf`);
        
        // Prepare data object
        const playerData = {
            type: 'player_save_data',
            playerId: this.playerId,
            username: this.game.username,
            billboardText: billboardText,
            position: playerPosition ? {
                x: playerPosition.x,
                y: playerPosition.y,
                z: playerPosition.z
            } : null,
            shootingAmmo: shootingAmmo,
            billboardAmmo: billboardAmmo,
            timestamp: Date.now()
        };
        
        // Send data to server
        if (this.game.socket.readyState === WebSocket.OPEN) {
            this.game.socket.send(JSON.stringify(playerData));
            console.log('Player data saved to server:', playerData);
        } else {
            console.warn('Socket not open, player data not saved');
        }
    }
    
    /**
     * Load player's data from the server
     * @returns {Promise} - Resolves when data is loaded
     */
    async loadPlayerData() {
        return new Promise((resolve, reject) => {
            if (!this.game || !this.playerId) {
                console.warn('Cannot load player data: game or player ID not available');
                reject('Game not available');
                return;
            }
            
            console.log('Attempting to load data for player ID:', this.playerId);
            
            // If socket doesn't exist or isn't open yet, set up a retry mechanism
            if (!this.game.socket || this.game.socket.readyState !== WebSocket.OPEN) {
                console.log('Socket not open yet, waiting for connection...');
                
                // Set a maximum wait time
                const maxWaitTime = 5000; // 5 seconds
                const startTime = Date.now();
                
                // Check socket status periodically
                const checkSocket = setInterval(() => {
                    // If we've waited too long, give up
                    if (Date.now() - startTime > maxWaitTime) {
                        clearInterval(checkSocket);
                        console.warn('Timed out waiting for socket connection');
                        reject('Socket connection timeout');
                        return;
                    }
                    
                    // If socket is now ready, proceed with loading
                    if (this.game.socket && this.game.socket.readyState === WebSocket.OPEN) {
                        clearInterval(checkSocket);
                        console.log('Socket now connected, proceeding with player data load');
                        // Continue with the loading process (call this method again)
                        this.loadPlayerData().then(resolve).catch(reject);
                    }
                }, 200); // Check every 200ms
                
                return; // Exit the current execution, the retry mechanism will call again
            }
            
            // Set up a one-time listener for the response
            const loadTimeout = setTimeout(() => {
                this.game.socket.removeEventListener('message', onLoadResponse);
                reject('Load player data timed out');
            }, 5000);
            
            const onLoadResponse = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Check if this is a player data response for our request
                    if (data.type === 'player_data_response' && data.playerId === this.playerId) {
                        clearTimeout(loadTimeout);
                        this.game.socket.removeEventListener('message', onLoadResponse);
                        
                        console.log('Received player data response:', data);
                        
                        // Check if data was found on server
                        if (data.found) {
                            // Apply the loaded data
                            this.applyPlayerData(data);
                            resolve(data);
                        } else {
                            console.log('No existing data found for player ID:', this.playerId);
                            resolve(null); // Return null for no data
                        }
                    }
                } catch (error) {
                    console.error('Error parsing player data response:', error);
                }
            };
            
            // Add the listener
            this.game.socket.addEventListener('message', onLoadResponse);
            
            // Send request for player data
            const loadRequest = {
                type: 'player_load_data',
                playerId: this.playerId
            };
            
            // Send the request
            this.game.socket.send(JSON.stringify(loadRequest));
            console.log('Requested player data from server for ID:', this.playerId);
        });
    }
    
    /**
     * Apply loaded player data to the game
     * @param {Object} data - The loaded player data
     */
    applyPlayerData(data) {
        if (!data || !this.game) {
            console.warn('Cannot apply player data: data or game not available');
            return;
        }
        
        console.log('Applying loaded player data:', data);
        
        // Set username if available
        if (data.username) {
            this.game.username = data.username;
            console.log(`Username set to: ${data.username}`);
        }
        
        // Set billboard text if available
        if (data.billboardText) {
            this.game.billboardText = data.billboardText;
            window.billboardText = data.billboardText;
            console.log(`Billboard text set to: ${data.billboardText}`);
        }
        
        // Store position for later application when game starts
        // We won't immediately apply position because the camera might not be ready
        if (data.position) {
            this.savedPosition = new THREE.Vector3(
                data.position.x,
                data.position.y,
                data.position.z
            );
            console.log(`Saved player position: (${this.savedPosition.x}, ${this.savedPosition.y}, ${this.savedPosition.z})`);
            
            // Apply position once the game starts and player is ready
            const applyPositionWhenReady = () => {
                if (this.game.playerCamera && this.game.gameStarted) {
                    this.game.playerCamera.camera.position.copy(this.savedPosition);
                    console.log(`Applied saved position to player camera`);
                    clearInterval(positionInterval);
                }
            };
            
            // Try to apply position at intervals until successful
            const positionInterval = setInterval(applyPositionWhenReady, 500);
        }
        
        // Store ammo values for application when weapons are ready
        if (data.shootingAmmo !== undefined || data.billboardAmmo !== undefined) {
            // Store values for later reference
            this.savedAmmoData = {
                shootingAmmo: data.shootingAmmo,
                billboardAmmo: data.billboardAmmo
            };
            
            // Set up an interval to apply ammo once weapon manager is ready
            const applyAmmoWhenReady = () => {
                if (this.game.weaponManager) {
                    if (data.shootingAmmo !== undefined && this.game.weaponManager.shooterGun) {
                        this.game.weaponManager.shooterGun.ammo = data.shootingAmmo;
                        console.log(`Applied shooting ammo: ${data.shootingAmmo}`);
                    }
                    
                    if (data.billboardAmmo !== undefined && this.game.weaponManager.billboardGun) {
                        this.game.weaponManager.billboardGun.ammo = data.billboardAmmo;
                        console.log(`Applied billboard ammo: ${data.billboardAmmo}`);
                    }
                    
                    // Update the weapon indicators
                    this.game.weaponManager.updateWeaponIndicator();
                    clearInterval(ammoInterval);
                }
            };
            
            // Try to apply ammo at intervals until successful
            const ammoInterval = setInterval(applyAmmoWhenReady, 500);
        }
    }
    
    /**
     * Save ammo data specifically (called after shooting)
     */
    saveAmmoData() {
        if (!this.game || !this.game.weaponManager || !this.playerId) {
            return;
        }
        
        // Get player's current ammo from WeaponManager
        let shootingAmmo = 0;
        let billboardAmmo = 0;
        
        if (this.game.weaponManager.shooterGun) {
            shootingAmmo = this.game.weaponManager.shooterGun.ammo;
        }
        if (this.game.weaponManager.billboardGun) {
            billboardAmmo = this.game.weaponManager.billboardGun.ammo;
        }
        
        // Prepare data object
        const ammoData = {
            type: 'player_save_ammo',
            playerId: this.playerId,
            shootingAmmo: shootingAmmo,
            billboardAmmo: billboardAmmo,
            timestamp: Date.now()
        };
        
        // Send data to server
        if (this.game.socket && this.game.socket.readyState === WebSocket.OPEN) {
            this.game.socket.send(JSON.stringify(ammoData));
            console.log('Ammo data saved:', ammoData);
        }
    }
    
    /**
     * Save billboard text specifically
     * @param {string} text - The billboard text to save
     */
    saveBillboardText(text) {
        if (!this.game || !this.game.socket || !this.playerId) {
            return;
        }
        
        // Prepare data object
        const textData = {
            type: 'player_save_billboard_text',
            playerId: this.playerId,
            billboardText: text,
            timestamp: Date.now()
        };
        
        // Send data to server
        if (this.game.socket.readyState === WebSocket.OPEN) {
            this.game.socket.send(JSON.stringify(textData));
            console.log('Billboard text saved:', textData);
        }
    }
}

// Export if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlayerPersistence };
} 