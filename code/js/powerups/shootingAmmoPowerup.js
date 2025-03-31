// shootingAmmoPowerup.js - Shooting Ammo Powerup - 2025-04-01

/**
 * Shooting Ammo Powerup
 * Gives the player additional shooting ammo when collected
 * Appears as a glowing box with "Ammo" text
 */
class ShootingAmmoPowerup extends Powerup {
    /**
     * Constructor for ShootingAmmoPowerup
     * @param {Object} params Configuration parameters
     */
    constructor(params = {}) {
        // Set default parameters for this powerup type
        const shootingAmmoParams = {
            ...params,
            type: 'shooting_ammo',
            text: params.text || 'Ammo',
            color: params.color || '#FF5500',
            size: params.size || 1.5,
            effectAmount: params.effectAmount || 100, // Default +100 ammo
            effectTarget: 'player'
        };
        
        // Call parent constructor
        super(shootingAmmoParams);
    }
    
    /**
     * Apply this powerup's effect (add ammo to player)
     * @param {Object} game The game object to apply the effect to
     * @returns {Boolean} True if effect was applied successfully
     */
    applyEffect(game) {
        if (!game) {
            console.error('Cannot apply shooting ammo powerup: Game object is undefined');
            return false;
        }
        
        // Get weaponManager from game object
        const weaponManager = game.weaponManager;
        
        if (!weaponManager) {
            console.error('Cannot apply shooting ammo powerup: WeaponManager not found in game object');
            return false;
        }
        
        // Get current ammo from the shooter gun
        if (!weaponManager.shooterGun) {
            console.error('Cannot apply shooting ammo powerup: ShooterGun not found in WeaponManager');
            return false;
        }
        
        // Get current ammo and max ammo directly from the shooter gun
        const currentAmmo = weaponManager.shooterGun.ammo || 0;
        const maxAmmo = weaponManager.shooterGun.maxAmmo || 500;
        
        // Calculate new ammo value (don't exceed max)
        const newAmmo = Math.min(currentAmmo + this.effectAmount, maxAmmo);
        const ammoAdded = newAmmo - currentAmmo;
        
        // Update the ammo value directly in the shooter gun
        weaponManager.shooterGun.ammo = newAmmo;
        
        // Force update the UI
        weaponManager.updateWeaponIndicator();
        
        // Mark as collected
        this.isCollected = true;
        
        // Log the effect
        console.log(`Shooting Ammo powerup collected! Added ${ammoAdded} ammo (${currentAmmo} → ${newAmmo})`);
        
        // Save to server if persistence is available
        this.saveAmmoToServer(game, newAmmo);
        
        return true;
    }
    
    /**
     * Save the updated ammo value to the server
     * @param {Object} game The game object
     * @param {Number} newAmmo The new ammo value to save
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
            
            // Get current billboard ammo from weaponManager
            let billboardAmmo = 0;
            
            if (game.weaponManager && game.weaponManager.billboardGun) {
                billboardAmmo = game.weaponManager.billboardGun.ammo;
            }
            
            // Create data to send to server
            const ammoData = {
                type: 'player_save_ammo',
                playerId: playerId,
                shootingAmmo: newAmmo,
                billboardAmmo: billboardAmmo
            };
            
            console.log('Saving ammo to server:', ammoData);
            
            // Send to server if WebSocket is available
            if (game.webSocket && game.webSocket.readyState === WebSocket.OPEN) {
                game.webSocket.send(JSON.stringify(ammoData));
                console.log('Saved updated ammo to server (via webSocket)');
            } else if (game.socket && game.socket.readyState === WebSocket.OPEN) {
                // Try alternate socket property name
                game.socket.send(JSON.stringify(ammoData));
                console.log('Saved updated ammo to server (via socket)');
            } else {
                console.warn('WebSocket not available, ammo not saved to server');
            }
        } catch (error) {
            console.error('Error saving ammo to server:', error);
        }
    }
    
    /**
     * Create a ShootingAmmoPowerup from data object
     * @param {Object} data Data representation of a powerup
     * @returns {ShootingAmmoPowerup} New powerup instance
     */
    static fromData(data) {
        return new ShootingAmmoPowerup(data);
    }
}

// Register ShootingAmmoPowerup class globally if in browser environment
if (typeof window !== 'undefined') {
    window.ShootingAmmoPowerup = ShootingAmmoPowerup;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShootingAmmoPowerup;
} 