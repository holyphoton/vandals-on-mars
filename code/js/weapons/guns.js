// guns.js - Weapon system implementation - 2025-03-20

// Import CONFIG from config.js is not needed - it's already global

/**
 * Base Gun class - Abstract parent for all weapon types
 */
class Gun {
    /**
     * Base class for all guns
     * @param {THREE.Scene} scene - The scene to add the gun to
     * @param {PlayerCamera} playerCamera - The player's camera
     * @param {Object} options - Optional settings
     */
    constructor(scene, playerCamera, options = {}) {
        this.scene = scene;
        this.playerCamera = playerCamera;
        this.options = options;
        this.ammo = options.ammo || 30;
        this.maxAmmo = options.maxAmmo || 100;
        this.fireRate = options.fireRate || 0.2; // seconds between shots
        this.lastFired = 0;
        this.gunModel = null;
    }
    
    /**
     * Creates a gun model (to be implemented by subclasses)
     */
    createGunModel() {
        // Base implementation - create a default gun model
        this.gunModel = new THREE.Group();
        
        // Create a simple box as a placeholder
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
        const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const box = new THREE.Mesh(geometry, material);
        this.gunModel.add(box);
        
        // Position the gun at the bottom right of the screen
        this.gunModel.position.set(0.2, -0.15, -0.4);
    }
    
    /**
     * Adds the gun model to the scene - attaching it to the camera
     */
    addToScene() {
        if (this.gunModel) {
            console.log(`Adding ${this.constructor.name} to scene`);
            
            // Make sure we have access to the camera
            if (!this.playerCamera || !this.playerCamera.camera) {
                console.error('Cannot add gun to scene: playerCamera or camera not available', {
                    hasPlayerCamera: !!this.playerCamera,
                    hasCamera: this.playerCamera ? !!this.playerCamera.camera : false
                });
                return;
            }
            
            // Make sure we remove it first in case it was already added
            if (this.gunModel.parent) {
                console.log(`Removing ${this.constructor.name} from previous parent`);
                this.gunModel.parent.remove(this.gunModel);
            }
            
            // Add the gun model to the camera
            this.playerCamera.camera.add(this.gunModel);
            
            // Set the visibility based on whether it's the active weapon
            this.gunModel.visible = true;
            
            // Force update position
            this.gunModel.position.set(0.3, -0.3, -0.5);
            
            console.log(`${this.constructor.name} added to camera:`, {
                isVisible: this.gunModel.visible,
                hasParent: !!this.gunModel.parent,
                parentIsCamera: this.gunModel.parent === this.playerCamera.camera
            });
        } else {
            console.error(`${this.constructor.name} model not created before adding to scene`);
        }
    }
    
    /**
     * Fire the gun - to be implemented by subclasses
     */
    fire() {
        const now = Date.now();
        if (now - this.lastFired < this.fireRate) {
            return false;
        }
        
        this.lastFired = now;
        
        // Play sound if implemented
        this.playSound();
        
        return true;
    }
    
    /**
     * Play sound effect - to be implemented by subclasses
     */
    playSound() {
        // Default empty implementation
    }
    
    /**
     * Get camera direction as a normalized vector
     * @returns {Vector3} Direction vector
     */
    getCameraDirection() {
        return new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerCamera.camera.quaternion);
    }
    
    /**
     * Update gun state
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        // Update gun position to follow camera if needed
    }
}

/**
 * BillboardGun class - Places billboards on the Mars globe
 */
class BillboardGun extends Gun {
    /**
     * Create a new billboard gun
     * @param {PlayerCamera} playerCamera - The player camera
     * @param {THREE.Scene} scene - The game scene
     * @param {MarsGlobe} globe - The Mars globe
     * @param {Object} options - Optional configuration
     */
    constructor(playerCamera, scene, globe, options = {}) {
        super(scene, playerCamera);
        
        // Store globe reference
        this.globe = globe;
        
        // Billboard properties
        this.placedBillboards = []; // Array to track billboards
        this.ammo = options.ammo || 5; // Number of billboards that can be placed
        this.maxAmmo = options.maxAmmo || 5;
        
        // Set up text canvas for billboard textures
        this.textCanvas = document.createElement('canvas');
        this.textCanvas.width = 512; // Doubled from 256
        this.textCanvas.height = 256; // Doubled from 128
        this.textContext = this.textCanvas.getContext('2d');
        
        // Create the gun model
        this.createGunModel();
        this.addToScene();
        
        console.log('Billboard gun created with ammo:', this.ammo);
    }
    
    /**
     * Creates a gun model
     */
    createGunModel() {
        // Create a gun model - a simple shape for now
        this.gunModel = new THREE.Group();
        
        // Gun body
        const gunBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.15, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x3366cc })
        );
        gunBody.position.z = -0.1;
        this.gunModel.add(gunBody);
        
        // Billboard projector
        const projector = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 0.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x66ccff })
        );
        projector.rotation.x = Math.PI / 2;
        projector.position.z = -0.25;
        this.gunModel.add(projector);
        
        // Fixed position relative to the screen/camera - positioned to be visible at bottom right
        this.gunModel.position.set(0.3, -0.3, -0.5);
    }
    
    /**
     * Places a billboard at the specified position
     * @param {THREE.Vector3} position - The position to place the billboard
     * @param {THREE.Vector3} cameraPosition - The current camera position for orientation
     */
    placeBillboard(position, cameraPosition) {
        // Create a billboard group that contains sign and legs
        const billboardGroup = new THREE.Group();
        
        // Get billboard text from game if available, with fallbacks
        let billboardText = "Default Turf";
        
        // First try the window.billboardText (set in save function)
        if (window.billboardText) {
            billboardText = window.billboardText;
        }
        // Next try the game object's method
        else if (window.game && typeof window.game.getBillboardText === 'function') {
            billboardText = window.game.getBillboardText();
        }
        // Finally, use username if available
        else if (window.game && window.game.username) {
            billboardText = `${window.game.username}'s Turf`;
        }
        
        console.log("Using billboard text:", billboardText);
        
        // Generate unique ID for the billboard
        const billboardId = this.generateUUID();
        
        // Get player_id from localStorage or generate a fallback
        let playerId = localStorage.getItem('vandalsOnMarsPlayerId');
        if (!playerId && window.game && window.game.persistence) {
            playerId = window.game.persistence.playerId;
        }
        if (!playerId) {
            // Fallback if player ID is not available
            if (window.Helpers && typeof window.Helpers.generatePlayerId === 'function') {
                playerId = window.Helpers.generatePlayerId();
            } else {
                // Fallback implementation in case Helpers is not available
                const randomNumbers = Math.floor(10000 + Math.random() * 90000);
                const alphabet = 'abcdefghijklmnopqrstuvwxyz';
                let randomAlphabets = '';
                for (let i = 0; i < 5; i++) {
                    randomAlphabets += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
                }
                playerId = `player_${randomNumbers}_${randomAlphabets}`;
            }
        }
        
        // Create a billboard object for tracking
        const billboard = {
            id: billboardId,
            mesh: billboardGroup,
            position: position.clone(),
            width: 5, // Initial width
            height: 5, // Initial height
            health: 100,
            text: billboardText,
            owner: window.game ? window.game.getUsername() : "Anonymous",
            player_id: playerId,
            billboard_category: "player"
        };
        
        // Create text texture for the billboard
        const textTexture = this.createTextTexture(billboardText);
        
        // Create the sign part of the billboard (the actual display)
        const signGeometry = new THREE.PlaneGeometry(3.0, 2.0); // Width x Height
        const signMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            map: textTexture,
            transparent: true
        });
        const signMesh = new THREE.Mesh(signGeometry, signMaterial);
        
        // Position the sign halfway up the legs
        signMesh.position.y = 2.8;
        billboardGroup.add(signMesh);
        
        // Create legs for the billboard
        const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4.0, 8);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333 // Dark gray
        });
        
        // Left leg - positioned at lower left corner of sign
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-1.2, 0, 0);
        billboardGroup.add(leftLeg);
        
        // Right leg - positioned at lower right corner of sign
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(1.2, 0, 0);
        billboardGroup.add(rightLeg);
        
        // Set position from data
        const posVector = new THREE.Vector3(
            position.x || 0,
            position.y || 0,
            position.z || 0
        );
        billboardGroup.position.copy(posVector);
        
        // Orient the billboard properly on the planet surface
        if (this.globe && this.globe.globe) {
            const globeCenter = this.globe.globe.position.clone();
            
            // SIMPLIFIED ORIENTATION APPROACH:
            // 1. Calculate up vector (normal to surface)
            const upVector = position.clone().sub(globeCenter).normalize();
            
            // 2. Find a forward direction (any perpendicular to up)
            // We'll use world up to help find a stable direction
            const worldUp = new THREE.Vector3(0, 1, 0);
            
            // If upVector is too close to worldUp, use a different reference
            const reference = Math.abs(upVector.dot(worldUp)) > 0.9 
                ? new THREE.Vector3(1, 0, 0) 
                : worldUp;
            
            // 3. Calculate right vector
            const rightVector = new THREE.Vector3().crossVectors(upVector, reference).normalize();
            
            // 4. Calculate the true forward vector
            const forwardVector = new THREE.Vector3().crossVectors(rightVector, upVector).normalize();
            
            // 5. Create the rotation matrix
            const matrix = new THREE.Matrix4().makeBasis(rightVector, upVector, forwardVector);
            billboardGroup.quaternion.setFromRotationMatrix(matrix);
            
            // 6. After setting upright orientation, rotate to face roughly toward camera
            // Get direction toward camera in the plane perpendicular to up
            const toCameraFlat = cameraPosition.clone().sub(position);
            // Remove the component in the up direction
            toCameraFlat.sub(upVector.clone().multiplyScalar(toCameraFlat.dot(upVector)));
            toCameraFlat.normalize();
            
            // Find angle between forward and toCameraFlat
            const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(billboardGroup.quaternion);
            // Project onto plane perpendicular to up
            currentForward.sub(upVector.clone().multiplyScalar(currentForward.dot(upVector))).normalize();
            
            // Find rotation angle using dot and cross products
            const dot = currentForward.dot(toCameraFlat);
            const cross = new THREE.Vector3().crossVectors(currentForward, toCameraFlat);
            const angle = Math.atan2(cross.length(), dot) * Math.sign(cross.dot(upVector));
            
            // Rotate around the up vector
            const rotationMatrix = new THREE.Matrix4().makeRotationAxis(upVector, angle);
            billboardGroup.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(rotationMatrix));
        } else {
            // No globe reference, just face the camera
            billboardGroup.lookAt(cameraPosition);
        }
        
        // Add the billboard to the scene
        this.scene.add(billboardGroup);
        
        // Add to tracked billboards
        this.placedBillboards.push(billboard);
        
        // Sync with server if game is multiplayer enabled
        this.syncBillboard(billboard);
        
        return billboard;
    }
    
    /**
     * Create a billboard from server data
     * @param {Object} data - Billboard data received from server
     * @returns {Object} - The created billboard object
     */
    createBillboardFromData(data) {
        // Check if we have valid data
        if (!data || !data.id) {
            console.error('Invalid billboard data received:', data);
            return null;
        }
        
        // Extract data with fallbacks for missing properties
        const id = data.id;
        const position = data.position || { x: 0, y: 0, z: 0 };
        const rotation = data.rotation || { x: 0, y: 0, z: 0 };
        const quaternion = data.quaternion || { x: 0, y: 0, z: 0, w: 1 };
        const text = data.text || "Mars Billboard";
        const owner = data.owner || "Anonymous";
        const timestamp = data.timestamp || Date.now();
        const health = data.health !== undefined ? data.health : 100; // Get health with fallback
        const player_id = data.player_id || "unknown"; // Add player_id with fallback
        const billboard_category = data.billboard_category || "player"; // Add billboard_category with fallback
        
        console.log(`Creating billboard from data - ID: ${id}, Text: "${text}", Owner: ${owner}`);
        console.log(`Position: (${position.x}, ${position.y}, ${position.z})`);
        console.log(`Health: ${health}`); // Log health value
        console.log(`Player ID: ${player_id}, Billboard Category: ${billboard_category}`); // Log new fields
        if (data.quaternion) {
            console.log(`Quaternion: (${quaternion.x}, ${quaternion.y}, ${quaternion.z}, ${quaternion.w})`);
        } else {
            console.log(`Rotation: (${rotation.x}, ${rotation.y}, ${rotation.z})`);
        }
        
        // Create a billboard group that contains sign and legs (like in placeBillboard)
        const billboardGroup = new THREE.Group();
        
        // Create text texture for the billboard
        const textTexture = this.createTextTexture(text);
        
        // Create the sign part of the billboard (the actual display)
        const signGeometry = new THREE.PlaneGeometry(3.0, 2.0); // Width x Height
        const signMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            map: textTexture,
            transparent: true
        });
        const signMesh = new THREE.Mesh(signGeometry, signMaterial);
        
        // Position the sign a bit higher above the legs to ensure visibility
        signMesh.position.y = 2.8; // This is where the sign is positioned relative to the legs
        billboardGroup.add(signMesh);
        
        // Create legs for the billboard
        const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4.0, 8);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333 // Dark gray
        });
        
        // Left leg - positioned at lower left corner of sign
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-1.2, 0, 0);
        billboardGroup.add(leftLeg);
        
        // Right leg - positioned at lower right corner of sign
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(1.2, 0, 0);
        billboardGroup.add(rightLeg);
        
        // Initial position from data
        const posVector = new THREE.Vector3(
            position.x || 0,
            position.y || 0,
            position.z || 0
        );
        
        // If we have a globe reference, ensure the billboard is properly positioned above the surface
        if (this.globe && this.globe.globe) {
            const globeCenter = this.globe.globe.position.clone();
            const radius = this.globe.radius || 10; // Default radius if not defined
            
            // Get direction from center to billboard position
            const centerToBillboard = posVector.clone().sub(globeCenter);
            const distance = centerToBillboard.length();
            centerToBillboard.normalize();
            
            // Ensure the billboard is at correct distance from center (radius + offset)
            // Using a larger offset (2.0) to ensure it's visible above surface
            const correctPosition = globeCenter.clone().add(
                centerToBillboard.multiplyScalar(radius + 0.1) // Using 0.1 to match the offset in fire method
            );
            
            console.log(`Billboard ${id} - Adjusting position to ensure above surface`);
            console.log(`  Original: (${posVector.x.toFixed(2)}, ${posVector.y.toFixed(2)}, ${posVector.z.toFixed(2)})`);
            console.log(`  Adjusted: (${correctPosition.x.toFixed(2)}, ${correctPosition.y.toFixed(2)}, ${correctPosition.z.toFixed(2)})`);
            
            // Update the position
            posVector.copy(correctPosition);
        }
        
        // Set the final position
        billboardGroup.position.copy(posVector);
        
        // Use quaternion for rotation if available (more accurate) otherwise use Euler rotation
        if (data.quaternion) {
            billboardGroup.quaternion.set(
                quaternion.x,
                quaternion.y,
                quaternion.z,
                quaternion.w
            );
            console.log(`Applied quaternion rotation for better orientation`);
        } else {
            billboardGroup.rotation.set(
                rotation.x || 0,
                rotation.y || 0,
                rotation.z || 0
            );
            console.log(`Applied Euler rotation as fallback`);
        }
        
        // Apply health-based scaling
        const healthScale = 0.5 + (health / 100) * 0.5;
        billboardGroup.scale.set(healthScale, healthScale, healthScale);
        console.log(`Applied health-based scaling: ${healthScale.toFixed(2)} based on health: ${health}`);
        
        // Add it to the scene
        this.scene.add(billboardGroup);
        
        // Store billboard data
        const billboardObject = {
            id,
            mesh: billboardGroup,
            position: posVector.clone(),
            rotation: new THREE.Euler(rotation.x || 0, rotation.y || 0, rotation.z || 0),
            quaternion: new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
            text: text,
            owner: owner,
            timestamp: timestamp,
            health: health, // Store the health value
            width: data.width || 5,
            height: data.height || 5,
            player_id: player_id,
            billboard_category: billboard_category
        };
        
        // Add to placed billboards array
        this.placedBillboards.push(billboardObject);
        
        // Log for debugging
        console.log(`Billboard added - ID: ${id}, Total billboards: ${this.placedBillboards.length}`);
        console.log(`Text for this billboard: "${text}"`);
        
        return billboardObject;
    }
    
    /**
     * Updates an existing billboard with server data
     * @param {Object} data - Billboard data from server
     */
    updateBillboard(data) {
        // Find the billboard in our local array
        const index = this.placedBillboards.findIndex(b => b.id === data.id);
        if (index === -1) {
            console.warn(`Billboard ${data.id} not found in local array`);
            return null;
        }
        
        const billboard = this.placedBillboards[index];
        const mesh = billboard.mesh;
        
        if (!mesh) {
            console.warn(`Billboard ${data.id} has no mesh`);
            return null;
        }
        
        console.log(`Updating billboard ${data.id} with data (preserving original text: "${billboard.text}")`);
        
        // Update properties
        billboard.width = data.width || billboard.width;
        billboard.height = data.height || billboard.height;
        
        // Important: Update health value which affects scaling
        const oldHealth = billboard.health;
        billboard.health = data.health !== undefined ? data.health : billboard.health;
        
        // Update player_id and billboard_category if provided
        if (data.player_id) {
            billboard.player_id = data.player_id;
        }
        if (data.billboard_category) {
            billboard.billboard_category = data.billboard_category;
        }
        
        // Log health change
        if (oldHealth !== billboard.health) {
            console.log(`Billboard health changed from ${oldHealth} to ${billboard.health}`);
        }
        
        // DO NOT update text or owner - preserve the original values
        // billboard.text and billboard.owner remain unchanged
        console.log(`Preserved original billboard text: "${billboard.text}" and owner: "${billboard.owner}"`);
        
        // Update position if provided
        if (data.position) {
            const newPosition = new THREE.Vector3(
                data.position.x,
                data.position.y,
                data.position.z
            );
            billboard.position.copy(newPosition);
            mesh.position.copy(newPosition);
        }
        
        // Update rotation/orientation if quaternion is provided
        if (data.quaternion) {
            mesh.quaternion.set(
                data.quaternion.x,
                data.quaternion.y,
                data.quaternion.z,
                data.quaternion.w
            );
            console.log(`Updated billboard ${data.id} orientation with quaternion data`);
        }
        
        // Scale according to health/size
        const healthScale = 0.5 + (billboard.health / 100) * 0.5;
        mesh.scale.set(healthScale, healthScale, healthScale);
        console.log(`Applied scaling ${healthScale.toFixed(2)} based on health ${billboard.health}`);
        
        // NEVER update the text after initial creation
        // The text is preserved from the original creation
        
        return billboard;
    }
    
    /**
     * Sync billboard with the server
     * @param {Object} billboard - The billboard to sync
     */
    syncBillboard(billboard) {
        if (!window.game || !window.game.syncBillboardData) {
            console.log('Game or sync function not available');
            return;
        }
        
        window.game.syncBillboardData(billboard);
    }
    
    /**
     * Generate a UUID for a billboard
     * @returns {string} - Unique identifier
     */
    generateUUID() {
        // Use helper if available
        if (window.Helpers && typeof window.Helpers.generateUUID === 'function') {
            return window.Helpers.generateUUID();
        }
        
        // Simple implementation if helper not available
        // Generate a billboard ID with the required format
        const randomNumbers = Math.floor(10000 + Math.random() * 90000);
        const alphabet = 'abcdefghijklmnopqrstuvwxyz';
        let randomAlphabets = '';
        for (let i = 0; i < 5; i++) {
            randomAlphabets += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        
        return `billboard_${randomNumbers}_${randomAlphabets}`;
    }
    
    /**
     * Creates a text texture for the billboard
     * @param {string} text - The text to display on the billboard
     * @returns {THREE.Texture} - The texture containing the text
     */
    createTextTexture(text) {
        console.log(`Creating new text texture with text: "${text}"`);
        
        // Create a canvas element for the texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        
        // Get the 2D context and configure it
        const context = canvas.getContext('2d');
        
        // Clean the canvas with a white background
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Border for the sign
        context.strokeStyle = '#333333';
        context.lineWidth = 8;
        context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
        
        // Gradient background for text area
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height - 16);
        gradient.addColorStop(0, '#efefef');
        gradient.addColorStop(1, '#dddddd');
        context.fillStyle = gradient;
        context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
        
        // Configure text style
        const fontSize = Math.min(32, 500 / (text.length > 20 ? text.length / 2 : 10)); // Adaptive font size
        context.font = `bold ${fontSize}px Arial, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#000000';
        
        // Word wrapping function
        const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
            const words = text.split(' ');
            let line = '';
            const lines = [];
            
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = context.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
            
            // Calculate the starting y position
            const totalHeight = lines.length * lineHeight;
            let startY = y - (totalHeight / 2) + (lineHeight / 2);
            
            // Draw each line
            for (let i = 0; i < lines.length; i++) {
                context.fillText(lines[i], x, startY);
                startY += lineHeight;
            }
        };
        
        // Draw the wrapped text
        wrapText(
            context,
            text,
            canvas.width / 2,
            canvas.height / 2,
            canvas.width - 40,
            fontSize * 1.2
        );
        
        // Create a texture from the canvas
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        texture.generateUniqueID = Math.random(); // Ensure unique texture
        
        return texture;
    }
    
    /**
     * Updates the gun state
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // No need to update model position since it's attached to the camera
        // The gun is properly parented to the camera
    }

    /**
     * Fires the billboard gun
     * @returns {boolean} - Whether the gun was fired successfully
     */
    fire() {
        // Check ammo
        if (this.ammo <= 0) {
            console.log("Out of ammo!");
            return false;
        }
        
        // Get ray from camera center
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.playerCamera.camera);
        
        // Store camera position for billboard orientation
        const cameraPosition = this.playerCamera.camera.position.clone();
        
        // Direction vector from camera
        const direction = this.playerCamera.camera.getWorldDirection(new THREE.Vector3());
        
        // Calculate placement position - place it farther away (10 units) from camera
        const placementDistance = 10;
        let targetPosition = cameraPosition.clone().add(
            direction.clone().multiplyScalar(placementDistance)
        );
        
        // Debug the placement position
        console.log("Billboard placement - Camera pos:", cameraPosition);
        console.log("Billboard placement - Target pos:", targetPosition);
        
        // If we have a globe reference, project to surface
        if (this.globe && this.globe.globe) {
            const globeCenter = this.globe.globe.position.clone();
            const radius = this.globe.radius || 10; // Default radius if not defined
            
            // Get direction from center to target
            const centerToTarget = targetPosition.clone().sub(globeCenter);
            
            // Get distance from center to target
            const distanceToTarget = centerToTarget.length();
            
            // Normalize and scale to radius for surface position
            centerToTarget.normalize();
            const surfacePosition = globeCenter.clone().add(centerToTarget.multiplyScalar(radius + 0.1)); // Slight offset above surface
            
            console.log("Billboard placement - Surface pos:", surfacePosition);
            
            // Place billboard at this surface position
            this.placeBillboard(surfacePosition, cameraPosition);
        } else {
            // No globe, just place at the target position
            this.placeBillboard(targetPosition, cameraPosition);
        }
        
        // Decrease ammo
        this.ammo--;
        
        // Play sound and visual effect
        this.playSound();
        
        console.log(`Billboard placed! Ammo remaining: ${this.ammo}/${this.maxAmmo}`);
        return true;
    }

    /**
     * Sync billboard removal with the server
     * @param {Object} billboard - The billboard to remove
     */
    syncBillboardRemoval(billboard) {
        if (!window.game || !window.game.socket || window.game.socket.readyState !== WebSocket.OPEN) {
            console.log('Game or socket not available for removal sync');
            return;
        }
        
        const removalData = {
            type: 'billboard_remove',
            id: billboard.id,
            timestamp: Date.now()
        };
        
        window.game.socket.send(JSON.stringify(removalData));
        console.log('Sent billboard removal sync to server:', billboard.id);
    }
    
    /**
     * Remove billboard from local tracking
     * @param {string} billboardId - ID of the billboard to remove
     */
    removeBillboard(billboardId) {
        const index = this.placedBillboards.findIndex(b => b.id === billboardId);
        if (index !== -1) {
            const billboard = this.placedBillboards[index];
            
            // Remove from scene if it exists
            if (billboard.mesh) {
                this.scene.remove(billboard.mesh);
            }
            
            // Remove from tracking array
            this.placedBillboards.splice(index, 1);
            console.log(`Billboard ${billboardId} removed from tracking`);
            return true;
        }
        
        return false;
    }

    /**
     * Clear all billboards from the scene
     */
    clearBillboards() {
        console.log(`Clearing ${this.placedBillboards.length} billboards from scene`);
        
        // Remove all billboards from scene
        this.placedBillboards.forEach(billboard => {
            if (billboard.mesh) {
                this.scene.remove(billboard.mesh);
            }
        });
        
        // Clear tracking array
        this.placedBillboards = [];
        
        console.log('All billboards cleared');
    }
}

/**
 * ShooterGun class - Fires projectiles that can destroy billboards
 */
class ShooterGun extends Gun {
    /**
     * Creates a new shooter gun
     * @param {THREE.Scene} scene - The scene to add the gun to
     * @param {PlayerCamera} playerCamera - The player's camera
     * @param {Array} billboards - Array of billboards for collision detection
     * @param {Object} options - Optional configuration
     */
    constructor(scene, playerCamera, billboards, options = {}) {
        super(scene, playerCamera, options);

        // Set default options for the shooter gun
        this.options = {
            ammo: 100,
            maxAmmo: 500,
            fireRate: 0.1, // seconds between shots
            bulletSpeed: 20,
            bulletSize: 0.1,
            ...options
        };

        // Ensure billboards is an array, use direct reference to maintain updates
        this.billboards = billboards || [];
        console.log("ShooterGun initialized with billboards array:", this.billboards);
        
        this.bullets = [];
        this.lastFired = 0;
        this.isFiring = false;
        this.ammo = this.options.ammo; // Set initial ammo
        this.maxAmmo = this.options.maxAmmo;
        this.fireRate = this.options.fireRate * 1000; // Convert seconds to milliseconds
        
        // Create the gun model
        this.createGunModel();
        this.addToScene();
    }

    /**
     * Creates a gun model
     */
    createGunModel() {
        // Create a gun model
        this.gunModel = new THREE.Group();
        
        // Gun body
        const gunBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.15, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xcc3333 })
        );
        gunBody.position.z = -0.2;
        this.gunModel.add(gunBody);
        
        // Gun barrel
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8),
            new THREE.MeshStandardMaterial({ color: 0x666666 })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.4;
        this.gunModel.add(barrel);
        
        // Fixed position relative to the screen/camera - positioned to be visible at bottom right
        this.gunModel.position.set(0.3, -0.3, -0.5);
    }

    /**
     * Starts continuous firing of the gun
     */
    startContinuousFire() {
        this.isFiring = true;
    }

    /**
     * Stops continuous firing of the gun
     */
    stopContinuousFire() {
        this.isFiring = false;
    }

    /**
     * Fires a bullet from the gun
     */
    fire() {
        const now = Date.now();
        
        // Check if enough time has passed since last fire
        if (now - this.lastFired < this.fireRate) {
            return false;
        }
        
        // Check ammo
        if (this.ammo <= 0) {
            console.log("ShooterGun: Out of ammo!");
            return false;
        }
        
        // Set last fired time
        this.lastFired = now;
        
        // Decrease ammo
        this.ammo--;
        
        // Create bullet
        const bulletGeometry = new THREE.SphereGeometry(this.options.bulletSize, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Position the bullet at the gun's position
        const direction = this.getCameraDirection();
        const cameraPosition = new THREE.Vector3();
        this.playerCamera.camera.getWorldPosition(cameraPosition);
        
        // Create a slight right and down offset for the bullet's starting position
        const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.2);
        const down = new THREE.Vector3(0, -0.1, 0);
        
        // Apply the offset to the bullet position
        bullet.position.copy(cameraPosition).add(right).add(down);
        
        // Store direction and creation time with the bullet
        bullet.userData = {
            direction: direction,
            createdAt: now,
            velocity: direction.clone().multiplyScalar(this.options.bulletSpeed)
        };
        
        // Add bullet to scene and tracking array
        this.scene.add(bullet);
        this.bullets.push(bullet);
        
        // Create muzzle flash effect
        this.createMuzzleFlash();
        
        // Play sound
        this.playSound();
        
        return true;
    }

    /**
     * Creates a muzzle flash effect
     */
    createMuzzleFlash() {
        // Simple muzzle flash implementation
        const flash = new THREE.PointLight(0xffff00, 2, 1);
        flash.position.copy(this.gunModel.position);
        flash.position.z -= 0.5; // Position at the end of the barrel
        this.scene.add(flash);
        
        // Remove the flash after a short time
        setTimeout(() => {
            this.scene.remove(flash);
        }, 50);
    }

    /**
     * Updates the gun and its bullets
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Continuously fire if the gun is in firing state
        if (this.isFiring) {
            this.fire();
        }
        
        // Update all bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Move bullet forward
            bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(deltaTime));
            
            // Check for collisions with billboards
            let collided = false;
            
            // Only check billboards that exist
            if (this.billboards && this.billboards.length > 0) {
                // Debug billboard count
                if (Math.random() < 0.01) { // Only log occasionally
                    console.log(`Checking collision against ${this.billboards.length} billboards`);
                }
                
                for (let j = 0; j < this.billboards.length; j++) {
                    const billboard = this.billboards[j];
                    
                    // Skip invalid billboards
                    if (!billboard || !billboard.mesh) {
                        console.log("Skipping invalid billboard at index", j);
                        continue;
                    }
                    
                    // Get billboard position
                    const billboardPosition = billboard.mesh.position.clone();
                    
                    // Calculate distance between bullet and billboard
                    const distance = bullet.position.distanceTo(billboardPosition);
                    
                    // Debug distances occasionally
                    if (Math.random() < 0.005) {
                        // console.log(`Bullet distance to billboard ${j}: ${distance.toFixed(2)} units`);
                    }
                    
                    // Increase hit radius significantly for the taller billboard structure
                    const hitRadius = 3.0; // Increased from 1.5 to better match the larger structure
                    
                    // If close enough, consider it a hit
                    if (distance < hitRadius) {
                        console.log(`Hit detected! Distance: ${distance.toFixed(2)}, Billboard index: ${j}`);
                        
                        // Store the bullet position before removing it
                        const bulletPosition = bullet.position.clone();
                        
                        // Remove bullet from scene and array FIRST
                        this.scene.remove(bullet);
                        this.bullets.splice(i, 1);
                        
                        // THEN create explosion at the stored bullet position
                        this.createBulletImpactEffect(bulletPosition);
                        
                        // Show hit effect and reduce billboard health
                        this.showHitEffect(billboard);
                        
                        collided = true;
                        break;
                    }
                }
            } else {
                // Debug if no billboards exist
                if (Math.random() < 0.01) { // Only log occasionally
                    // console.log("No billboards to check collisions against");
                }
            }
            
            // Remove bullets that have been flying for too long
            if (!collided) {
                const now = Date.now();
                const age = now - bullet.userData.createdAt;
                if (age > 5000) { // 5 seconds
                    this.scene.remove(bullet);
                    this.bullets.splice(i, 1);
                }
            }
        }
    }

    /**
     * Shows a hit effect when a bullet hits a billboard
     * @param {Object} billboard - The billboard that was hit
     */
    showHitEffect(billboard) {
        if (!billboard || !billboard.mesh) {
            console.log("Invalid billboard object in showHitEffect");
            return;
        }
        
        // Get the signMesh (first child of the billboard group)
        const signMesh = billboard.mesh.children[0];
        
        // Decrease billboard health
        if (typeof billboard.health === 'undefined') {
            billboard.health = 100;
        }
        
        // Standard damage amount
        const damageAmount = 5;
        billboard.health -= damageAmount;
        console.log(`Billboard hit! Health reduced to: ${billboard.health}`);
        
        // Scale billboard based on health - scale the entire group
        const healthScale = 0.5 + (billboard.health / 100) * 0.5;
        billboard.mesh.scale.set(healthScale, healthScale, healthScale);
        
        // Log billboard children for debugging
        console.log(`Billboard has ${billboard.mesh.children.length} children`);
        
        // DO NOT update billboard text - keep original owner and text
        // This prevents the ownership change issue
        
        // Flash the billboard red
        if (signMesh && signMesh.material) {
            const originalColor = signMesh.material.color.clone();
            const damageColor = new THREE.Color(1, billboard.health / 100, billboard.health / 100);
            
            signMesh.material.color = damageColor;
            signMesh.material.emissive = new THREE.Color(0.5, 0, 0);
            
            // Reset after a short time
            setTimeout(() => {
                if (signMesh.material) {
                    signMesh.material.color = originalColor;
                    signMesh.material.emissive = new THREE.Color(0, 0, 0);
                }
            }, 200);
        }
        
        // Add a hit light
        const hitLight = new THREE.PointLight(0xff0000, 2, 5);
        hitLight.position.copy(billboard.mesh.position);
        this.scene.add(hitLight);
        
        // Remove light after 200ms
        setTimeout(() => {
            this.scene.remove(hitLight);
        }, 200);
        
        // Create impact particles
        this.createBulletImpactEffect(billboard.mesh.position);
        
        // === NEW FEATURE: GROW PLAYER'S BILLBOARDS ===
        // Only grow player billboards if the hit billboard is not owned by the player
        if (this.weaponManager && this.weaponManager.billboardGun) {
            // Check if the hit billboard is not owned by the player
            const playerId = window.game?.persistence?.playerId;
            if (playerId && billboard.player_id !== playerId) {
                this.growPlayerBillboards(damageAmount);
            }
        }
        
        // Sync the updated billboard (health/scale) with the server
        if (window.game && typeof window.game.syncBillboardData === 'function') {
            window.game.syncBillboardData(billboard);
            console.log(`Synced damaged billboard with server. Health: ${billboard.health}`);
        }
        
        // If health is zero or less, destroy the billboard
        if (billboard.health <= 0) {
            console.log("Billboard destroyed due to health reaching zero");
            this.destroyBillboard(billboard);
        }
    }

    /**
     * Grows all player-owned billboards based on damage caused to other billboards
     * @param {number} damageAmount - The amount of damage caused
     */
    growPlayerBillboards(damageAmount) {
        // Get growth per damage value from config
        const growthPerDamage = CONFIG.billboard?.growthPerDamage || 0.5;
        const maxSize = CONFIG.billboard?.maxSize || 50;
        
        // Calculate growth amount for this damage
        const growthAmount = growthPerDamage * damageAmount;
        
        // Get player ID
        const playerId = window.game?.persistence?.playerId;
        if (!playerId) {
            console.log("Cannot grow billboards: player ID not found");
            return;
        }
        
        // Find all billboards owned by the player
        const playerBillboards = [];
        if (this.weaponManager && this.weaponManager.billboardGun) {
            this.weaponManager.billboardGun.placedBillboards.forEach(billboard => {
                if (billboard.player_id === playerId) {
                    playerBillboards.push(billboard);
                    console.log(`Found player billboard to grow: ${billboard.id}, owned by player ${playerId}`);
                }
            });
        }
        
        console.log(`Growing ${playerBillboards.length} player billboards by ${growthAmount} units`);
        
        // Grow each player billboard
        playerBillboards.forEach(billboard => {
            if (!billboard || !billboard.mesh) return;
            
            // Get current width and height
            let currentWidth = billboard.width || CONFIG.billboard.startSize;
            let currentHeight = billboard.height || CONFIG.billboard.startSize;
            
            // Calculate new width and height, ensuring they don't exceed max size
            let newWidth = Math.min(currentWidth + growthAmount, maxSize);
            let newHeight = Math.min(currentHeight + growthAmount, maxSize);
            
            // Update billboard dimensions in the data object
            billboard.width = newWidth;
            billboard.height = newHeight;
            
            console.log(`Billboard ${billboard.id} grown to ${billboard.width}x${billboard.height}`);
            
            // Calculate scale factors based on ratio to starting size
            const startSize = CONFIG.billboard.startSize;
            const widthScale = newWidth / startSize;
            const heightScale = newHeight / startSize;
            
            // Get information about the planet
            let globeCenter = new THREE.Vector3(0, 0, 0);   // Default center
            let globeRadius = 100; // Default radius
            
            if (this.globe && this.globe.globe) {
                globeCenter = this.globe.globe.position.clone();
                globeRadius = this.globe.radius || 100;
            }
            
            // Calculate the original surface normal and position
            // This is the direction from center to the billboard
            const surfaceNormal = new THREE.Vector3().subVectors(billboard.position, globeCenter).normalize();
            
            // Calculate the surface position where the billboard's legs should be planted
            // Add a ground sink factor that increases with billboard size
            // This creates a more grounded look for larger billboards by sinking legs slightly into the ground
            const groundSinkFactor = -0.2 * (heightScale / 10); // Negative offset that increases with size
            const surfacePosition = globeCenter.clone().add(
                surfaceNormal.clone().multiplyScalar(globeRadius + groundSinkFactor) // Negative offset to sink into ground
            );
            
            // 1. Get all child meshes
            const signMesh = billboard.mesh.children[0]; // Billboard panel
            const leftLeg = billboard.mesh.children[1];  // Left leg 
            const rightLeg = billboard.mesh.children[2]; // Right leg
            
            // 2. Scale the sign mesh for width and height
            if (signMesh) {
                signMesh.scale.set(widthScale, heightScale, 1);
            }
            
            // 3. Scale the legs for height (maintain their width)
            if (leftLeg && rightLeg) {
                // Scale legs for height
                leftLeg.scale.y = heightScale;
                rightLeg.scale.y = heightScale;
                
                // Adjust leg positions to maintain proportional distance from center
                leftLeg.position.x = -1.2 * widthScale;
                rightLeg.position.x = 1.2 * widthScale;
                
                // Adjust sign position to sit on top of the taller legs
                signMesh.position.y = 2.8 * heightScale;
            }
            
            // 4. Position the entire billboard mesh precisely
            
            // Calculate how far from the surface the CENTER of the billboard should be
            // This ensures the LEGS remain partially sunk into the surface position
            const originalHeight = 4.0; // Original height in the model
            const totalHeight = originalHeight * heightScale; // New scaled height
            const centerOffset = totalHeight / 2; // Distance from base to center
            
            // Position the billboard with its base slightly sunk into the surface position
            // and its center offset outward along the surface normal
            billboard.mesh.position.copy(surfacePosition);
            billboard.mesh.position.add(surfaceNormal.clone().multiplyScalar(centerOffset));
            
            // Update the billboard's stored position
            billboard.position = billboard.mesh.position.clone();
            billboard.quaternion = billboard.mesh.quaternion.clone();
            
            // Sync the updated billboard with the server
            if (window.game && typeof window.game.syncBillboardData === 'function') {
                window.game.syncBillboardData(billboard);
                console.log(`Synced grown billboard with server. Size: ${billboard.width}x${billboard.height}`);
            }
        });
    }

    /**
     * Destroys a billboard
     * @param {Object} billboard - The billboard to destroy
     */
    destroyBillboard(billboard) {
        if (!billboard || !billboard.mesh) return;
        
        console.log("Billboard destroyed!");
        
        // Store the billboard ID before animation starts
        const billboardId = billboard.id;
        
        // Create explosion effect at the billboard's position
        this.createExplosion(billboard.mesh.position);
        
        // Trigger the falling animation
        this.animateBillboardDestruction(billboard);
        
        // Sync billboard removal with the server
        if (this.weaponManager && this.weaponManager.billboardGun) {
            this.weaponManager.billboardGun.syncBillboardRemoval(billboard);
        }
        
        // Remove from billboards array after a delay (animation will remove from scene)
        setTimeout(() => {
            const index = this.billboards.indexOf(billboard);
            if (index !== -1) {
                this.billboards.splice(index, 1);
                console.log("Billboard removed from tracking array");
            }
        }, 1100); // Just after the animation finishes
    }

    /**
     * Creates an explosion effect
     * @param {THREE.Vector3} position - The position of the explosion
     */
    createExplosion(position) {
        // Create a light flash
        const explosionLight = new THREE.PointLight(0xffaa00, 3, 5);
        explosionLight.position.copy(position);
        this.scene.add(explosionLight);
        
        // Fade out and remove the light
        let intensity = 3;
        const fadeInterval = setInterval(() => {
            intensity -= 0.1;
            explosionLight.intensity = intensity;
            
            if (intensity <= 0) {
                clearInterval(fadeInterval);
                this.scene.remove(explosionLight);
            }
        }, 50);
    }

    /**
     * Animates the destruction of a billboard
     * @param {Object} billboard - The billboard to animate
     */
    animateBillboardDestruction(billboard) {
        if (!billboard || !billboard.mesh) return;
        
        const mesh = billboard.mesh;
        const startScale = mesh.scale.clone();
        const startRotation = mesh.rotation.clone();
        const startPosition = mesh.position.clone();
        
        // Find the up vector (normal to planet surface)
        let upVector = new THREE.Vector3(0, 1, 0);
        if (this.globe && this.globe.globe) {
            const globeCenter = this.globe.globe.position.clone();
            upVector = startPosition.clone().sub(globeCenter).normalize();
        }
        
        // Create rotation axis perpendicular to up vector
        const rotationAxis = new THREE.Vector3(1, 0, 0);
        if (Math.abs(rotationAxis.dot(upVector)) > 0.9) {
            rotationAxis.set(0, 0, 1); // Use a different axis if too close to up
        }
        rotationAxis.crossVectors(rotationAxis, upVector).normalize();
        
        let progress = 0;
        const duration = 1000; // ms
        const startTime = performance.now();
        
        const animate = () => {
            const currentTime = performance.now();
            progress = Math.min(1, (currentTime - startTime) / duration);
            
            // Scale down slightly
            mesh.scale.copy(startScale).multiplyScalar(1 - progress * 0.3);
            
            // Rotate to fall over
            const fallAngle = progress * Math.PI / 2; // 90 degrees in radians
            const fallQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, fallAngle);
            mesh.quaternion.premultiply(fallQuat);
            
            // Move down slightly (falling effect)
            mesh.position.copy(startPosition).sub(upVector.clone().multiplyScalar(progress * 0.5));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Remove from scene when animation completes
                this.scene.remove(mesh);
            }
        };
        
        animate();
    }

    /**
     * Creates a bullet impact explosion effect
     * @param {THREE.Vector3} position - The position of the impact
     */
    createBulletImpactEffect(position) {
        // Create a flash of light at impact point
        const impactLight = new THREE.PointLight(0xffaa00, 2, 3);
        impactLight.position.copy(position);
        this.scene.add(impactLight);
        
        // Create particle explosion
        const particleCount = 10;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            // Small sphere for each particle
            const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xff3300,
                transparent: true,
                opacity: 0.8
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(position);
            
            // Random velocity for each particle
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            );
            velocity.normalize().multiplyScalar(0.05);
            
            particle.userData.velocity = velocity;
            particle.userData.lifetime = 300; // milliseconds
            particle.userData.born = Date.now();
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate and remove particles
        const animateParticles = () => {
            const now = Date.now();
            let allDone = true;
            
            particles.forEach(particle => {
                const age = now - particle.userData.born;
                
                if (age < particle.userData.lifetime) {
                    // Move particle
                    particle.position.add(particle.userData.velocity);
                    
                    // Fade out
                    const opacity = 1 - (age / particle.userData.lifetime);
                    particle.material.opacity = opacity;
                    
                    allDone = false;
                } else if (particle.parent) {
                    // Remove expired particle
                    this.scene.remove(particle);
                }
            });
            
            // Remove light after short time
            if (now - impactLight.userData.born > 150) {
                this.scene.remove(impactLight);
            } else {
                allDone = false;
            }
            
            // Continue animation if needed
            if (!allDone) {
                requestAnimationFrame(animateParticles);
            }
        };
        
        // Store creation time for the light
        impactLight.userData = { born: Date.now() };
        
        // Start animation
        requestAnimationFrame(animateParticles);
    }
}

/**
 * WeaponManager class for handling all weapons
 */
class WeaponManager {
    /**
     * Create a new weapon manager
     * @param {PlayerCamera} playerCamera - Reference to player camera
     * @param {THREE.Scene} scene - Three.js scene
     * @param {MarsGlobe} globe - Mars globe reference
     */
    constructor(playerCamera, scene, globe) {
        console.log('Creating WeaponManager');
        
        this.playerCamera = playerCamera;
        this.scene = scene;
        this.globe = globe;
        
        this.weapons = [];
        this.activeWeaponIndex = 0;
        this.billboardGun = null; // Expose billboard gun
        this.shooterGun = null; // Expose shooter gun
        
        // Create weapons
        this.initializeWeapons();
        
        // Update weapon indicators
        this.updateWeaponIndicator();
        
        // Flag to indicate when the weapon manager is fully initialized and ready for use
        this.isInitialized = false;
    }
    
    /**
     * Initialize all weapons
     */
    initializeWeapons() {
        console.log('Initializing weapons');
        
        // Get gun configuration values from CONFIG
        const gunConfig = CONFIG.player.gun || {};
        const startingAmmoBillboard = gunConfig.startingAmmoBillboard || 3;
        const maxAmmoBillboard = gunConfig.maxAmmoBillboard || 5;
        const startingAmmoShooting = gunConfig.startingAmmoShooting || 200;
        const maxAmmoShooting = gunConfig.maxAmmoShooting || 500;
        
        console.log('Gun configuration:', {
            startingAmmoBillboard,
            maxAmmoBillboard,
            startingAmmoShooting,
            maxAmmoShooting
        });
        
        // Create billboard gun
        this.billboardGun = new BillboardGun(
            this.playerCamera,
            this.scene,
            this.globe,
            {
                ammo: startingAmmoBillboard,
                maxAmmo: maxAmmoBillboard
            }
        );
        this.weapons.push(this.billboardGun);
        
        // Create shooter gun (for destroying billboards)
        this.shooterGun = new ShooterGun(
            this.scene,
            this.playerCamera,
            this.billboardGun ? this.billboardGun.placedBillboards : [],
            {
                ammo: startingAmmoShooting,
                maxAmmo: maxAmmoShooting,
                fireRate: 0.1 // 10 shots per second
            }
        );
        this.weapons.push(this.shooterGun);
        
        // We need to set the weapon manager in the shooter gun for billboard updates
        if (this.shooterGun) {
            this.shooterGun.weaponManager = this;
        }
        
        // Set first weapon as active
        this.activeWeaponIndex = 0;
        this.updateWeaponVisibility();
        
        console.log(`Initialized ${this.weapons.length} weapons`);
        
        // Set the initialization flag to true
        this.isInitialized = true;
        console.log('WeaponManager is fully initialized and ready for use');
    }
    
    /**
     * Update the weapon indicator in the UI
     */
    updateWeaponIndicator() {
        console.log("Updating weapon indicator UI");
        
        // First, make sure the container is visible
        const weaponContainer = document.getElementById('weapon-indicator-container');
        const gameUI = document.getElementById('game-ui');
        
        if (gameUI) {
            gameUI.style.display = 'block';
            console.log("Game UI container display set to block");
        } else {
            console.warn("Game UI container not found");
        }
        
        if (weaponContainer) {
            weaponContainer.style.display = 'flex';
            console.log("Weapon indicator container display set to flex");
        } else {
            console.warn("Weapon indicator container not found");
        }
        
        const billboardIndicator = document.querySelector('.gun-indicator[data-weapon="billboard"]');
        const shooterIndicator = document.querySelector('.gun-indicator[data-weapon="shooter"]');
        const ammoDisplay = document.querySelector('.ammo-display');
        const billboardCount = document.querySelector('.billboard-count');
        
        console.log("UI Elements found:", {
            billboardIndicator: !!billboardIndicator,
            shooterIndicator: !!shooterIndicator,
            ammoDisplay: !!ammoDisplay,
            billboardCount: !!billboardCount
        });
        
        // Skip if elements don't exist yet
        if (!billboardIndicator || !shooterIndicator || !ammoDisplay || !billboardCount) {
            console.warn("Cannot update weapon indicator: UI elements not found");
            return;
        }
        
        // Update the active weapon indicator
        if (this.isBillboardGunActive()) {
            billboardIndicator.classList.add('active');
            shooterIndicator.classList.remove('active');
            console.log("Billboard gun indicator activated");
        } else {
            billboardIndicator.classList.remove('active');
            shooterIndicator.classList.add('active');
            console.log("Shooter gun indicator activated");
        }
        
        // Update ammo display
        const ammoInfo = this.getAmmoInfo();
        if (ammoInfo) {
            ammoDisplay.textContent = `Ammo: ${ammoInfo.ammo}/${ammoInfo.maxAmmo}`;
            billboardCount.textContent = `Billboards: ${ammoInfo.billboards}/${ammoInfo.maxBillboards}`;
            // console.log("Ammo display updated:", ammoInfo);
        }
    }
    
    /**
     * Get the active weapon
     * @returns {Gun} The active weapon
     */
    getActiveWeapon() {
        return this.weapons[this.activeWeaponIndex];
    }
    
    /**
     * Check if the billboard gun is active
     * @returns {boolean} True if billboard gun is active
     */
    isBillboardGunActive() {
        return this.activeWeaponIndex === 0;
    }
    
    /**
     * Check if the shooter gun is active
     * @returns {boolean} True if shooter gun is active
     */
    isShooterGunActive() {
        return this.activeWeaponIndex === 1;
    }
    
    /**
     * Switch to the next weapon
     */
    switchWeapon() {
        // First stop any continuous firing from the shooter gun
        this.stopContinuousFire();
        
        // Switch weapon
        this.activeWeaponIndex = (this.activeWeaponIndex + 1) % this.weapons.length;
        
        // Update indicators
        this.updateWeaponIndicator();
        
        console.log(`Switched to weapon: ${this.isBillboardGunActive() ? 'Billboard Gun' : 'Shooter Gun'}`);
        
        // Make sure both guns are visible in the scene
        this.updateWeaponVisibility();
    }
    
    /**
     * Update weapon visibility based on active weapon
     */
    updateWeaponVisibility() {
        // Ensure both weapons are created
        if (!this.billboardGun || !this.shooterGun) {
            console.warn("Cannot update weapon visibility: weapons not fully initialized");
            return;
        }
        
        // Ensure gun models exist
        if (!this.billboardGun.gunModel || !this.shooterGun.gunModel) {
            console.warn("Cannot update weapon visibility: gun models not created");
            return;
        }

        //console.log("Updating weapon visibility - active index:", this.activeWeaponIndex);
        
        // Make sure both guns are added to the scene if not already
        if (!this.billboardGun.gunModel.parent) {
            console.log("Billboard gun not in scene - adding it");
            this.billboardGun.addToScene();
        }
        
        if (!this.shooterGun.gunModel.parent) {
            console.log("Shooter gun not in scene - adding it");
            this.shooterGun.addToScene();
        }
        
        // Set visibility based on active weapon
        this.billboardGun.gunModel.visible = this.isBillboardGunActive();
        this.shooterGun.gunModel.visible = this.isShooterGunActive();
        
        /*console.log("Weapon visibility updated:", {
            billboard: this.billboardGun.gunModel.visible,
            shooter: this.shooterGun.gunModel.visible,
            billboardParent: this.billboardGun.gunModel.parent ? "attached" : "detached",
            shooterParent: this.shooterGun.gunModel.parent ? "attached" : "detached"
        });*/

        // Force gun model position update
        if (this.billboardGun.gunModel) {
            this.billboardGun.gunModel.position.set(0.3, -0.3, -0.5);
        }
        
        if (this.shooterGun.gunModel) {
            this.shooterGun.gunModel.position.set(0.3, -0.3, -0.5);
        }
    }
    
    /**
     * Fire the active weapon
     */
    fire() {
        const activeWeapon = this.getActiveWeapon();
        if (activeWeapon) {
            const success = activeWeapon.fire();
            
            // If firing was successful, save ammo data
            if (success && window.game && window.game.persistence) {
                window.game.persistence.saveAmmoData();
            }
        }
    }
    
    /**
     * Start continuous fire for the active weapon
     */
    startContinuousFire() {
        if (this.isShooterGunActive()) {
            this.shooterGun.startContinuousFire();
        }
    }
    
    /**
     * Stop continuous fire for the shooter gun
     */
    stopContinuousFire() {
        // Make sure the shooter gun stops firing regardless of which gun is active
        this.shooterGun.stopContinuousFire();
    }
    
    /**
     * Update the weapon manager and active weapons
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
       
        
        // Make sure shooterGun always has the latest reference to billboards
        if (this.shooterGun && this.billboardGun) {
            // This is critical: ensure the reference is shared
            this.shooterGun.billboards = this.billboardGun.placedBillboards;
        }
        
        // Update both weapons
        this.billboardGun.update(deltaTime);
        this.shooterGun.update(deltaTime);
        
        // Ensure billboards reference stays synchronized
        this.shooterGun.billboards = this.billboardGun.placedBillboards;
        
        // Update visibility
        this.updateWeaponVisibility();
        
        
    }
    
    /**
     * Get ammo information for UI display
     * @returns {Object} Object containing billboard and shooter gun ammo info
     */
    getAmmoInfo() {
        if (!this.shooterGun || !this.billboardGun) {
            return {
                ammo: "0/0",
                maxAmmo: "0",
                billboards: "0",
                maxBillboards: "0"
            };
        }
        
        return {
            ammo: this.shooterGun.ammo,
            maxAmmo: this.shooterGun.maxAmmo,
            billboards: this.billboardGun.ammo,
            maxBillboards: this.billboardGun.maxAmmo
        };
    }

    /**
     * Create billboard from data - delegates to billboardGun
     * @param {Object} data - Billboard data from server
     */
    createBillboardFromData(data) {
        if (this.billboardGun && typeof this.billboardGun.createBillboardFromData === 'function') {
            return this.billboardGun.createBillboardFromData(data);
        } else {
            console.warn('BillboardGun not available or missing createBillboardFromData method');
            return null;
        }
    }
    
    /**
     * Update an existing billboard - delegates to billboardGun
     * @param {Object} data - Billboard data from server
     */
    updateBillboard(data) {
        if (this.billboardGun && typeof this.billboardGun.updateBillboard === 'function') {
            return this.billboardGun.updateBillboard(data);
        } else {
            console.warn('BillboardGun not available or missing updateBillboard method');
            return null;
        }
    }

    /**
     * Remove billboard by ID
     * @param {string} billboardId - ID of billboard to remove
     */
    removeBillboard(billboardId) {
        if (this.billboardGun && typeof this.billboardGun.removeBillboard === 'function') {
            return this.billboardGun.removeBillboard(billboardId);
        } else {
            console.warn('BillboardGun not available or missing removeBillboard method');
            return false;
        }
    }
    
    /**
     * Clear all billboards - delegates to billboardGun
     */
    clearBillboards() {
        if (this.billboardGun && typeof this.billboardGun.clearBillboards === 'function') {
            this.billboardGun.clearBillboards();
            return true;
        } else {
            console.warn('BillboardGun not available or missing clearBillboards method');
            return false;
        }
    }

    /**
     * Add a billboard from data (helper method for external systems like bots)
     * @param {Object} billboardData - Billboard data
     * @returns {Object|null} The created billboard or null if failed
     */
    addBillboard(billboardData) {
        // Make sure we're initialized first
        if (!this.isInitialized) {
            console.warn('WeaponManager not fully initialized, cannot add billboard yet');
            throw new Error('WeaponManager not initialized');
        }
        
        // Make sure billboardGun is available
        if (!this.billboardGun) {
            console.warn('Billboard gun not available, cannot add billboard');
            throw new Error('Billboard gun not available');
        }
        
        // Check if the billboardData is valid
        if (!billboardData || !billboardData.id) {
            console.warn('Invalid billboard data provided to addBillboard', billboardData);
            throw new Error('Invalid billboard data');
        }
        
        try {
            // Create the billboard using the billboard gun
            const billboard = this.billboardGun.createBillboardFromData(billboardData);
            if (billboard) {
                console.log(`Billboard successfully added: ${billboardData.id}`);
                return billboard;
            } else {
                console.warn(`Billboard gun failed to create billboard: ${billboardData.id}`);
                throw new Error('Billboard creation failed');
            }
        } catch (error) {
            console.error(`Error adding billboard ${billboardData?.id}:`, error);
            throw error;
        }
    }
}