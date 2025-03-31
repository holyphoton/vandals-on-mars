// billboardAmmoPowerup.js - Billboard Ammo Powerup - 2025-04-01

/**
 * Billboard Ammo Powerup
 * Gives the player additional billboard ammo when collected
 * Appears as a glowing box with "Billboard" text
 */
class BillboardAmmoPowerup extends Powerup {
    /**
     * Constructor for BillboardAmmoPowerup
     * @param {Object} params Configuration parameters
     */
    constructor(params = {}) {
        // Set default parameters for this powerup type
        const billboardAmmoParams = {
            ...params,
            type: 'billboard_ammo',
            text: params.text || 'Billboard',
            color: params.color || '#33CC33', // Green color
            size: params.size || 1.5,
            effectAmount: params.effectAmount || 1, // Default +1 billboard ammo
            effectTarget: 'player'
        };
        
        // Call parent constructor
        super(billboardAmmoParams);
    }
    
    /**
     * Apply this powerup's effect (add billboard ammo to player)
     * @param {Object} game The game object to apply the effect to
     * @returns {Boolean} True if effect was applied successfully
     */
    applyEffect(game) {
        if (!game) {
            console.error('Cannot apply billboard ammo powerup: Game object is undefined');
            return false;
        }
        
        // Get weaponManager from game object
        const weaponManager = game.weaponManager;
        
        if (!weaponManager) {
            console.error('Cannot apply billboard ammo powerup: WeaponManager not found in game object');
            return false;
        }
        
        // Get current ammo from the billboard gun
        if (!weaponManager.billboardGun) {
            console.error('Cannot apply billboard ammo powerup: BillboardGun not found in WeaponManager');
            return false;
        }
        
        // Get current ammo and max ammo directly from the billboard gun
        const currentAmmo = weaponManager.billboardGun.ammo || 0;
        const maxAmmo = weaponManager.billboardGun.maxAmmo || 5;
        
        // Calculate new ammo value (don't exceed max)
        const newAmmo = Math.min(currentAmmo + this.effectAmount, maxAmmo);
        const ammoAdded = newAmmo - currentAmmo;
        
        // Update the ammo value directly in the billboard gun
        weaponManager.billboardGun.ammo = newAmmo;
        
        // Force update the UI
        weaponManager.updateWeaponIndicator();
        
        // Log the effect
        console.log(`Billboard Ammo powerup collected! Added ${ammoAdded} ammo (${currentAmmo} → ${newAmmo})`);
        
        // Save to server if persistence is available
        this.saveAmmoToServer(game, newAmmo);
        
        return true;
    }
    
    /**
     * Save the updated ammo value to the server
     * @param {Object} game The game object
     * @param {Number} newAmmo The new billboard ammo value to save
     */
    saveAmmoToServer(game, newAmmo) {
        try {
            // Try to find the player ID from the game object
            let playerId = null;
            
            if (game.playerId) {
                playerId = game.playerId;
            } else if (game.persistence && game.persistence.playerId) {
                playerId = game.persistence.playerId;
            }
            
            if (!playerId) {
                console.warn('Could not find player ID for server save');
                return;
            }
            
            // Get current shooting ammo from weaponManager
            let shootingAmmo = 0;
            
            if (game.weaponManager && game.weaponManager.shooterGun) {
                shootingAmmo = game.weaponManager.shooterGun.ammo;
            }
            
            // Create data to send to server
            const ammoData = {
                type: 'player_save_ammo',
                playerId: playerId,
                shootingAmmo: shootingAmmo,
                billboardAmmo: newAmmo
            };
            
            console.log('Saving billboard ammo to server:', ammoData);
            
            // Send to server if WebSocket is available
            if (game.webSocket && game.webSocket.readyState === WebSocket.OPEN) {
                game.webSocket.send(JSON.stringify(ammoData));
                console.log('Saved updated billboard ammo to server (via webSocket)');
            } else if (game.socket && game.socket.readyState === WebSocket.OPEN) {
                // Try alternate socket property name
                game.socket.send(JSON.stringify(ammoData));
                console.log('Saved updated billboard ammo to server (via socket)');
            } else {
                console.warn('WebSocket not available, ammo not saved to server');
            }
        } catch (error) {
            console.error('Error saving billboard ammo to server:', error);
        }
    }
    
    /**
     * Create a BillboardAmmoPowerup from data object
     * @param {Object} data Data representation of a powerup
     * @returns {BillboardAmmoPowerup} New powerup instance
     */
    static fromData(data) {
        console.log(`BillboardAmmoPowerup.fromData - Using exact position:`, data.position);
        return new BillboardAmmoPowerup(data);
    }
}

// Register BillboardAmmoPowerup class globally if in browser environment
if (typeof window !== 'undefined') {
    window.BillboardAmmoPowerup = BillboardAmmoPowerup;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BillboardAmmoPowerup;
} 