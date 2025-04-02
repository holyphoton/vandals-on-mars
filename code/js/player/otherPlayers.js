// otherPlayers.js - Handles rendering and management of other players - 2025-03-19

/**
 * OtherPlayersManager class for handling other players in the game
 */
class OtherPlayersManager {
    /**
     * Create a new other players manager
     * @param {Game} game - Reference to the main game
     * @param {THREE.Scene} scene - Reference to the Three.js scene
     * @param {MarsGlobe} globe - Reference to the Mars globe
     */
    constructor(game, scene, globe) {
        this.game = game;
        this.scene = scene;
        this.globe = globe;
        
        // Player models indexed by username
        this.players = new Map();
        
        // Keep track of last update time for each player
        this.lastUpdateTimes = new Map();
        
        // Set timeout for removing inactive players (5 minutes)
        this.inactivityTimeout = 300000; // Increased from 10 seconds to 5 minutes
        
        // Initialize models
        this.initialize();
    }
    
    /**
     * Initialize the manager
     */
    initialize() {
        console.log('OtherPlayersManager initialized');
        
        // Set up a check for inactive players
        setInterval(() => this.removeInactivePlayers(), 5000);
        
        // Set up periodic debug info display
        setInterval(() => {
            console.log('CURRENT PLAYERS:', Array.from(this.players.keys()));
            console.log('SCENE CHILDREN COUNT:', this.scene.children.length);
        }, 10000);
    }
    
    /**
     * Create a player character model (BB8-inspired)
     * @returns {THREE.Group} The player model group
     */
    createPlayerModel() {
        const group = new THREE.Group();
        
        // Main body - white sphere
        const bodyGeometry = new THREE.SphereGeometry(2, 16, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(body);
        
        // Blue line decorations - put them back on the sphere
        this.addBlueLines(body);
        
        // Add blue cube head on top of the sphere - lower by 20%
        const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0x196bb7,
            emissive: 0x196bb7,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.8
        });
        const cubeHead = new THREE.Mesh(cubeGeometry, cubeMaterial);
        // Position the cube on top of the sphere (lowered by 20%)
        cubeHead.position.set(0, 2.0, 0); // Changed from 2.5 to 2.0
        group.add(cubeHead);
        
        // Create a sub-group for the cannon and rings that will be rotated together
        const cannonGroup = new THREE.Group();
        // Attach the cannon group to the cube head
        cubeHead.add(cannonGroup);
        
        // Rotate the cannon group up by 15 degrees (changed from 30)
        cannonGroup.rotation.x = Math.PI / 12; // Changed from PI/6 to PI/12
        
        // Muzzle for shooting - white color and 2x length
        const muzzleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3.0, 12); // Doubled length from 1.5 to 3.0
        const muzzleMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.2
        });
        const muzzle = new THREE.Mesh(muzzleGeometry, muzzleMaterial);
        
        // Position in front - adjust to go slightly inside the cube
        muzzle.position.set(0, 0, -2.0); // Changed from -2.5 to -2.0 to move it 0.5 units into the cube
        muzzle.rotation.set(Math.PI/2, 0, 0); // Keep X rotation for cylinder orientation
        cannonGroup.add(muzzle);
        
        // Add a hole at the end of the muzzle to look like a real cannon
        const holeGeometry = new THREE.TorusGeometry(0.25, 0.05, 12, 12);
        const holeMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,  // Black color for the hole
            roughness: 0.3,
            metalness: 0.0
        });
        const hole = new THREE.Mesh(holeGeometry, holeMaterial);
        
        // Fix the hole alignment - attach directly to the muzzle at its end
        hole.position.set(0, 0, -1.5); // Position at the end of the muzzle
        hole.rotation.set(0, Math.PI/2, 0); // Align properly with the muzzle end
        muzzle.add(hole); // Add to muzzle instead of cannonGroup for proper alignment
        
        return group;
    }
    
    /**
     * Add blue glowing lines to the player model
     * @param {THREE.Mesh} container - The container to add the lines to
     */
    addBlueLines(container) {
        // Create a sub-group for the blue rings
        const ringsGroup = new THREE.Group();
        
        // Rotate the entire rings group by 45 degrees on X axis
        ringsGroup.rotation.x = Math.PI / 4; // 45 degrees
        
        // Horizontal equator line
        const equatorGeometry = new THREE.TorusGeometry(2.1, 0.2, 16, 32);
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0x196bb7,
            emissive: 0x196bb7,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.8
        });
        const equator = new THREE.Mesh(equatorGeometry, lineMaterial);
        ringsGroup.add(equator);
        
        // Vertical meridian line
        const meridianGeometry = new THREE.TorusGeometry(2.1, 0.2, 16, 32);
        const meridian = new THREE.Mesh(meridianGeometry, lineMaterial);
        meridian.rotation.set(Math.PI/2, 0, 0);
        ringsGroup.add(meridian);
        
        // Add the rings group to the container
        container.add(ringsGroup);
    }
    
    /**
     * Create a name tag for a player
     * @param {string} username - Username to display
     * @returns {THREE.Group} - The name tag group
     */
    createNameTag(username) {
        const group = new THREE.Group();
        
        // Create a canvas for the username text
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        // Draw background
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw text
        context.font = 'bold 32px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = 'white';
        context.fillText(username, canvas.width/2, canvas.height/2);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create sprite material
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        
        // Create sprite
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(4, 1, 1);
        sprite.position.set(0, 4, 0);
        
        group.add(sprite);
        return group;
    }
    
    /**
     * Update or create a player in the scene
     * @param {string} username - Player's username
     * @param {Object} position - Player's position {x, y, z}
     * @param {Object} rotation - Player's rotation {x, y, z}
     * @param {Object} [quaternion] - Optional quaternion for more accurate rotation
     */
    updatePlayer(username, position, rotation, quaternion) {
        // Don't render the local player
        if (username === this.game.getUsername()) {
            return;
        }
        
        // Create new player if it doesn't exist
        if (!this.players.has(username)) {
            console.log(`Creating new player model for ${username}`);
            
            // Create player model group
            const playerGroup = new THREE.Group();
            
            // Add character model
            const model = this.createPlayerModel();
            playerGroup.add(model);
            
            // Add name tag
            const nameTag = this.createNameTag(username);
            playerGroup.add(nameTag);
            
            // Lift the model slightly above the surface to avoid z-fighting
            const direction = new THREE.Vector3(position.x, position.y, position.z).normalize();
            const liftedPosition = new THREE.Vector3(
                position.x + direction.x * 0.5, // Reduced from 2 to 0.5 units outward
                position.y + direction.y * 0.5, // Reduced from 2 to 0.5 units outward
                position.z + direction.z * 0.5  // Reduced from 2 to 0.5 units outward
            );
            
            // Set initial position
            playerGroup.position.set(liftedPosition.x, liftedPosition.y, liftedPosition.z);
            
            // Add to scene and map
            this.scene.add(playerGroup);
            this.players.set(username, playerGroup);
            console.log(`Player ${username} added to scene. Total players: ${this.players.size}`);
        }
        
        // Get player model
        const playerModel = this.players.get(username);
        
        try {
            // Calculate surface normal (direction from center to position)
            const direction = new THREE.Vector3(position.x, position.y, position.z).normalize();
            
            // Lift the position to ensure the model is above the surface (0.5 units)
            const liftedPosition = new THREE.Vector3(
                position.x + direction.x * 0.5, // Reduced from 2 to 0.5 units outward
                position.y + direction.y * 0.5, // Reduced from 2 to 0.5 units outward
                position.z + direction.z * 0.5  // Reduced from 2 to 0.5 units outward
            );
            
            // Update position with lifted position
            playerModel.position.set(liftedPosition.x, liftedPosition.y, liftedPosition.z);
            
            // Apply orientation based on surface normal
            playerModel.lookAt(0, 0, 0); // Look at center of globe
            
            // Apply quaternion if available (after lookAt to override it)
            if (quaternion) {
                // Create THREE.js quaternion from data
                const playerQuaternion = new THREE.Quaternion(
                    quaternion.x,
                    quaternion.y,
                    quaternion.z,
                    quaternion.w
                );
                
                // Apply the quaternion
                playerModel.quaternion.copy(playerQuaternion);
            }
            
            // Make sure player is aligned with the surface normal
            playerModel.up.copy(direction);
            
            // Update name tag to face camera
            this.updateNameTagOrientation(username);
            
            // Update last update time
            this.lastUpdateTimes.set(username, Date.now());
            
            // Add a debug line from center to character to verify position
            if (!playerModel.debugLine) {
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    liftedPosition
                ]);
                const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
                const debugLine = new THREE.Line(lineGeometry, lineMaterial);
                this.scene.add(debugLine);
                playerModel.debugLine = debugLine;
            } else {
                // Update existing debug line
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    liftedPosition
                ]);
                playerModel.debugLine.geometry.dispose();
                playerModel.debugLine.geometry = lineGeometry;
            }
        } catch (error) {
            console.error(`Error updating player ${username}:`, error);
        }
    }
    
    /**
     * Update the name tag to always face the camera
     * @param {string} username - Player's username
     */
    updateNameTagOrientation(username) {
        if (!this.players.has(username) || !this.game.playerCamera) {
            return;
        }
        
        const playerModel = this.players.get(username);
        const nameTag = playerModel.children[1]; // Assuming name tag is the second child
        
        if (nameTag) {
            // Name tags automatically face the camera when using sprites
            // No additional orientation required
        }
    }
    
    /**
     * Remove players who haven't updated in a while
     */
    removeInactivePlayers() {
        const now = Date.now();
        
        this.lastUpdateTimes.forEach((lastUpdateTime, username) => {
            if (now - lastUpdateTime > this.inactivityTimeout) {
                console.log(`Removing inactive player: ${username}`);
                this.removePlayer(username);
            }
        });
    }
    
    /**
     * Remove a player from the scene
     * @param {string} username - Player's username to remove
     */
    removePlayer(username) {
        if (this.players.has(username)) {
            const playerModel = this.players.get(username);
            
            // Remove debug line if it exists
            if (playerModel.debugLine) {
                this.scene.remove(playerModel.debugLine);
            }
            
            this.scene.remove(playerModel);
            this.players.delete(username);
            this.lastUpdateTimes.delete(username);
        }
    }
    
    /**
     * Update all player animations
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime = 0.016) {
        // No animation updates needed in this version
    }
}

// Export the class
window.OtherPlayersManager = OtherPlayersManager; 