// powerup.js - Base Powerup class and common functionality - 2025-04-01

/**
 * Base class for all powerups in the game
 * Provides common functionality for rendering, lifecycle, and interaction
 */
class Powerup {
    /**
     * Constructor for the base Powerup class
     * @param {Object} params Configuration parameters for the powerup
     * @param {Object} params.position Vector3 position in the world
     * @param {Object} params.quaternion Quaternion for orientation
     * @param {String} params.id Unique ID for this powerup instance
     * @param {String} params.type Type identifier for this powerup
     * @param {Number} params.size Size of the powerup (default: 1)
     * @param {String} params.color Color of the powerup (default: white)
     * @param {Number} params.lifespan How long the powerup exists in ms (null = permanent)
     */
    constructor(params = {}) {
        this.id = params.id || this.generateId();
        this.type = params.type || 'base_powerup';
        this.position = params.position || { x: 0, y: 0, z: 0 };
        this.quaternion = params.quaternion || { x: 0, y: 0, z: 0, w: 1 };
        this.size = params.size || 1;
        this.color = params.color || '#FFFFFF';
        this.lifespan = params.lifespan || null; // null = permanent
        this.createdAt = Date.now();
        this.mesh = null;
        this.isCollected = false;
        this.text = params.text || '';
        
        // Effect parameters can be overridden by specific powerup types
        this.effectAmount = params.effectAmount || 0;
        this.effectDuration = params.effectDuration || 0;
        this.effectTarget = params.effectTarget || 'player';
        
        // Internal state
        this._isExpired = false;
        this._isVisible = true;
    }
    
    /**
     * Generate a unique ID for this powerup
     * @returns {String} Unique ID
     */
    generateId() {
        // Generate a unique ID in the format powerup_xxxxx_yyyyy
        // Similar to the billboard ID generation
        let powerupId;
        
        if (window.Helpers && typeof window.Helpers.generateId === 'function') {
            powerupId = window.Helpers.generateId('powerup');
        } else {
            // Fallback implementation
            const randomNumbers = Math.floor(10000 + Math.random() * 90000);
            const alphabet = 'abcdefghijklmnopqrstuvwxyz';
            let randomAlphabets = '';
            for (let i = 0; i < 5; i++) {
                randomAlphabets += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
            }
            powerupId = `powerup_${randomNumbers}_${randomAlphabets}`;
        }
        
        return powerupId;
    }
    
    /**
     * Initialize the powerup in the 3D scene
     * @param {THREE.Scene} scene The scene to add the powerup to
     * @returns {THREE.Object3D} The created mesh
     */
    initialize(scene) {
        if (!scene) {
            console.error('Cannot initialize powerup: Scene is undefined');
            return null;
        }
        
        // Create a glowing box mesh for the powerup
        const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
        const material = new THREE.MeshPhongMaterial({
            color: this.color,
            emissive: this.color,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8,
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Store the base position (on planet surface)
        this.basePosition = new THREE.Vector3(
            this.position.x,
            this.position.y,
            this.position.z
        );
        
        // Set initial position
        this.mesh.position.copy(this.basePosition);
        
        // Apply quaternion precisely as provided
        this.mesh.quaternion.set(
            this.quaternion.x,
            this.quaternion.y,
            this.quaternion.z,
            this.quaternion.w
        );
        
        // Add user data to the mesh for easy lookup
        this.mesh.userData = {
            id: this.id,
            type: this.type,
            powerupReference: this
        };
        
        // Add text label if specified
        if (this.text) {
            this.addTextLabel();
        }
        
        // Add to scene
        scene.add(this.mesh);
        
        // Setup animation
        this.setupAnimation();
        
        return this.mesh;
    }
    
    /**
     * Add a text label to the powerup
     */
    addTextLabel() {
        // Create a canvas for the text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 256;
        
        // Draw background
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw text in ALL CAPS
        context.font = 'Bold 40px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = 'white';
        context.fillText(this.text.toUpperCase(), canvas.width / 2, canvas.height / 2);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Create text plane slightly above the powerup
        const labelGeo = new THREE.PlaneGeometry(this.size * 1.2, this.size * 0.6);
        this.label = new THREE.Mesh(labelGeo, material);
        
        // Position the label above the powerup
        this.label.position.set(0, this.size * 0.8, 0);
        
        // Rotate the plane 180 degrees to flip the text so it reads correctly
        this.label.rotation.set(0, Math.PI, 0);
        
        // Add label to mesh
        this.mesh.add(this.label);
        
        // Setup label update function - will be called in update method
        this.updateLabel = (camera) => {
            if (this.label) {
                // Start with the base flipped rotation (180 degrees around Y-axis)
                this.label.rotation.set(0, Math.PI, 0);
                
                // Only adjust the label to face the camera's horizontal direction
                if (camera && camera.position) {
                    // Get world positions
                    const worldPos = new THREE.Vector3();
                    this.mesh.getWorldPosition(worldPos);
                    
                    // Get direction from powerup to camera (horizontal only)
                    const toCamera = new THREE.Vector3().subVectors(camera.position, worldPos);
                    
                    // Calculate horizontal angle for the label to face the camera
                    // while staying aligned with the powerup's up direction
                    const angle = Math.atan2(toCamera.x, toCamera.z);
                    
                    // Apply the camera-facing angle on top of the 180-degree flip
                    this.label.rotation.y = Math.PI + angle;
                }
            }
        };
    }
    
    /**
     * Setup animation for the powerup
     */
    setupAnimation() {
        // Base class animates the powerup with rotation and floating
        if (this.mesh) {
            // For tracking float animation
            this.floatPhase = Math.random() * Math.PI * 2; // Random starting phase
            this.floatSpeed = 0.5 + Math.random() * 0.5; // Random float speed
            this.floatHeight = 0.3; // Maximum float height variation
            
            // Store original quaternion for reference
            this.originalQuaternion = new THREE.Quaternion().copy(this.mesh.quaternion);
            
            // Animation function to be called in the update loop
            this.animate = (delta) => {
                // Reset orientation to original quaternion to prevent drift
                this.mesh.quaternion.copy(this.originalQuaternion);
                
                // Rotate the powerup around its local Y axis (the up vector on the planet surface)
                const localRotation = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 1, 0), // Y-axis in local space
                    delta * 0.5
                );
                this.mesh.quaternion.multiply(localRotation);
                
                // Floating up/down motion
                this.floatPhase += delta * this.floatSpeed;
                // Calculate vertical offset based on sine wave
                const verticalOffset = Math.sin(this.floatPhase) * this.floatHeight;
                
                // Get normalized direction from planet center to powerup (the up vector)
                const upVector = this.basePosition.clone().normalize();
                
                // Calculate new position: base position + offset along up vector
                const newPosition = this.basePosition.clone().add(
                    upVector.multiplyScalar(verticalOffset)
                );
                
                // Update position with the float effect
                this.mesh.position.copy(newPosition);
                
                // Pulsing effect
                const pulseScale = 0.95 + 0.1 * Math.sin(Date.now() * 0.003);
                this.mesh.scale.set(pulseScale, pulseScale, pulseScale);
            };
        }
    }
    
    /**
     * Update the powerup state
     * @param {Number} delta Time delta in seconds
     */
    update(delta) {
        // Check if the powerup has expired
        if (this.lifespan !== null && Date.now() - this.createdAt > this.lifespan) {
            this._isExpired = true;
        }
        
        // Animation update
        if (this.animate && this._isVisible) {
            this.animate(delta);
        }
        
        // Update label orientation if needed
        if (this.updateLabel && this._isVisible) {
            // Try to find camera from different possible paths
            let camera = null;
            
            // Global game object is accessible through window
            if (window.game) {
                if (window.game.camera) {
                    camera = window.game.camera;
                } else if (window.game.playerCamera && window.game.playerCamera.camera) {
                    camera = window.game.playerCamera.camera;
                }
            }
            
            if (camera) {
                this.updateLabel(camera);
            }
        }
    }
    
    /**
     * Check if this powerup has been collected
     * @returns {Boolean} True if collected
     */
    hasBeenCollected() {
        return this.isCollected;
    }
    
    /**
     * Check if this powerup has expired
     * @returns {Boolean} True if expired
     */
    hasExpired() {
        return this._isExpired;
    }
    
    /**
     * Apply the powerup effect to the target (player, etc.)
     * @param {Object} target The target to apply the effect to
     * @returns {Boolean} True if effect was applied successfully
     */
    applyEffect(target) {
        console.log(`Base powerup effect applied to ${this.effectTarget}`);
        this.isCollected = true;
        return true;
    }
    
    /**
     * Clean up this powerup
     * @param {THREE.Scene} scene The scene to remove the powerup from
     */
    cleanup(scene) {
        if (this.mesh && scene) {
            scene.remove(this.mesh);
            
            // Dispose of geometries and materials
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(material => material.dispose());
                } else {
                    this.mesh.material.dispose();
                }
            }
            
            // Clean up label if exists
            if (this.label) {
                if (this.label.geometry) {
                    this.label.geometry.dispose();
                }
                
                if (this.label.material) {
                    if (this.label.material.map) {
                        this.label.material.map.dispose();
                    }
                    this.label.material.dispose();
                }
            }
            
            this.mesh = null;
            this.label = null;
        }
    }
    
    /**
     * Convert this powerup to a data object for serialization
     * @returns {Object} Data representation of this powerup
     */
    toData() {
        return {
            id: this.id,
            type: this.type,
            position: { ...this.position },
            quaternion: { ...this.quaternion },
            size: this.size,
            color: this.color,
            text: this.text,
            lifespan: this.lifespan,
            createdAt: this.createdAt,
            isCollected: this.isCollected,
            effectAmount: this.effectAmount,
            effectDuration: this.effectDuration,
            effectTarget: this.effectTarget
        };
    }
    
    /**
     * Create a powerup from data object
     * @param {Object} data Data representation of a powerup
     * @returns {Powerup} New powerup instance
     */
    static fromData(data) {
        return new Powerup(data);
    }
}

// Register Powerup class globally if in browser environment
if (typeof window !== 'undefined') {
    window.Powerup = Powerup;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Powerup;
} 