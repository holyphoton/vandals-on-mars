// movement.js - Player movement controls - 2025-03-18

/**
 * PlayerMovement class for handling player movement on the Mars globe
 */
class PlayerMovement {
    /**
     * Create a new player movement handler
     * @param {PlayerCamera} camera - Reference to the player camera
     * @param {MarsGlobe} globe - Reference to the Mars globe
     * @param {PlayerControls} controls - Reference to the player controls
     */
    constructor(camera, globe, controls) {
        this.camera = camera;
        this.globe = globe;
        this.scene = globe ? globe.scene : null;
        this.controls = controls;
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = true;
        this.isJumping = false;
        
        // Physics settings
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.playerSpeed = 10;
        this.gravity = 18;       // Reduced gravity to simulate Mars (was 30)
        this.jumpForce = 10.5;   // Reduced by 30% from 15 for more realistic jump height
        this.playerHeight = 1.8;
        this.jumpHeight = 0;     // Current height above surface
        
        // Collision settings
        this.playerRadius = 0.5; // Player collision radius
        this.terrain = null;     // Will be set by the main game
        this.lastValidPosition = null; // Store last valid position for collision recovery
        
        // First spawn handling
        this.isFirstMovement = true;
        this.initialFrameCount = 0;
        this.stableReferenceEstablished = false;
        
        // Auto-movement settings to prevent initial spin
        this.needsInitialMovement = true;
        this.initialMovementSteps = 0;
        this.initialMovementComplete = false;
        this.hasPerformedInitialJump = false; // Flag to track if we've done the initial teleport
        
        // Initialize
        this.setupKeyControls();
    }
    
    /**
     * Set up keyboard controls
     */
    setupKeyControls() {
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
    }
    
    /**
     * Handle key down events
     */
    onKeyDown(event) {
        // Skip if we're in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;
        }
    }
    
    /**
     * Handle key up events
     */
    onKeyUp(event) {
        // Skip if we're in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
        }
    }
    
    /**
     * Set the terrain reference for collision detection
     * @param {Terrain} terrain - The terrain instance
     */
    setTerrain(terrain) {
        this.terrain = terrain;
        console.log('Terrain reference set for collision detection');
    }
    
    /**
     * Update player movement
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        if (!this.camera || !this.camera.camera || !this.globe) {
            console.warn("Camera or globe not available for movement");
            return;
        }
        
        // Cap deltaTime to prevent extreme values that cause movement spikes
        deltaTime = Math.min(deltaTime, 0.1);
        
        // Read movement flags from controls
        this.moveForward = this.controls.moveForward;
        this.moveBackward = this.controls.moveBackward;
        this.moveLeft = this.controls.moveLeft;
        this.moveRight = this.controls.moveRight;
        
        // Handle first movement and auto-movement (initialization phase)
        this.handleInitialMovement(deltaTime);
        
        // Get current player position and orientation
        const cameraPosition = this.camera.camera.position.clone();
        
        // Skip if camera is not in first person mode
        if (!this.camera.isFirstPerson) {
            return;
        }
        
        // ===== STEP 1: Handle Jumping / Vertical Movement (completely independent) =====
        this.handleVerticalMovement(deltaTime, cameraPosition);
        
        // ===== STEP 2: Handle Horizontal Movement (completely independent) =====
        this.handleHorizontalMovement(deltaTime, cameraPosition);
        
        // Final step - update the camera's spherical coordinates for proper orientation
        this.updateCameraSphericalCoordinates();
    }
    
    /**
     * Handle vertical movement (jumping, falling) physics
     * @param {number} deltaTime - Time in seconds since last frame
     * @param {THREE.Vector3} cameraPosition - Current camera position 
     */
    handleVerticalMovement(deltaTime, cameraPosition) {
        // Check for jump input (space bar)
        if (this.controls.jump && this.canJump && !this.isJumping) {
            // Start jump
            this.isJumping = true;
            this.canJump = false;
            this.jumpHeight = 0.1; // Small initial height
            this.velocity.y = this.jumpForce;
            // console.log("Jump initiated, velocity:", this.velocity.y);
        }
        
        // Update jump physics if player is in the air
        const isInAir = this.isJumping || !this.canJump || this.jumpHeight > 0;
        
        if (isInAir) {
            // Apply velocity to jump height
            this.jumpHeight += this.velocity.y * deltaTime;
            
            // Apply gravity (always pulling down)
            this.velocity.y -= this.gravity * deltaTime;
            
           
            // Check if we've landed
            if (this.jumpHeight <= 0) {
                // Reset jump state
                this.jumpHeight = 0;
                this.isJumping = false;
                this.canJump = true;
                this.velocity.y = 0;
            }
        }
        
        // Always update the player's height from the planet surface regardless of movement state
        this.updatePlayerHeight();
    }
    
    /**
     * Update the player's height from the planet surface
     */
    updatePlayerHeight() {
        if (!this.camera || !this.camera.camera) return;
        
        const position = this.camera.camera.position;
        const direction = position.clone().normalize();
        const totalHeight = this.globe.radius + this.playerHeight + this.jumpHeight;
        
        // Set new position with correct distance from center
        this.camera.camera.position.copy(direction.multiplyScalar(totalHeight));
    }
    
    /**
     * Handle horizontal movement on planet surface
     * @param {number} deltaTime - Time in seconds since last frame 
     * @param {THREE.Vector3} cameraPosition - Current camera position
     */
    handleHorizontalMovement(deltaTime, cameraPosition) {
        // Calculate local up vector (from planet center to player)
        const up = cameraPosition.clone().normalize();
        
        // Check if we are near the equator and need to teleport past it
        if (this.handleEquatorCrossing()) {
            // We teleported, so skip the rest of the movement handling
            return;
        }
        
        // Calculate movement direction in the tangent plane
        const moveDirection = this.calculateMoveDirection(cameraPosition);
        
        // Only apply horizontal movement if there is any input
        if (moveDirection.lengthSq() > 0) {
            // Scale movement by speed and delta time
            moveDirection.normalize().multiplyScalar(this.playerSpeed * deltaTime);
            
            // Calculate new position
            const newPosition = cameraPosition.clone().add(moveDirection);
            
            // Check for collisions
            if (this.terrain) {
                const collision = this.terrain.checkCollision(newPosition, this.playerRadius);
                
                if (collision) {
                    // console.log(`Collision detected with ${collision.type}`);
                    this.handleCollision(collision, moveDirection, cameraPosition);
                    return;
                }
            }
            
            // Apply the movement if no collision
            this.camera.camera.position.copy(newPosition);
            
            // Maintain correct height from planet surface (with jump height)
            this.updatePlayerHeight();
            
            // Store last valid position for collision recovery
            this.lastValidPosition = this.camera.camera.position.clone();
        }
    }
    
    /**
     * Detect and handle equator proximity to prevent the flickering/slowdown issue
     * @returns {boolean} True if we teleported, false otherwise
     */
    handleEquatorCrossing() {
        if (!this.camera || !this.camera.spherical) {
            return false;
        }
        
        // Get current spherical coordinates
        const phi = this.camera.spherical.phi;
        
        // Equator is at phi = 90 degrees (π/2 radians)
        const equatorPhi = Math.PI / 2;
        
        // Calculate how close we are to the equator (in radians)
        const distanceToEquator = Math.abs(phi - equatorPhi);
        
        // Convert to degrees for easier debugging
        const distanceToDegrees = distanceToEquator * 180 / Math.PI;
        
        // Define multiple bands with different assist intensities
        // Very close: 0.5° from equator = stronger assist
        // Close: 1° from equator = moderate assist
        // Approaching: 1.5° from equator = gentle assist
        const veryCloseBand = 0.5 * Math.PI / 180; // 0.5 degrees in radians
        const closeBand = 1.0 * Math.PI / 180;     // 1.0 degrees in radians
        const approachingBand = 1.5 * Math.PI / 180; // 1.5 degrees in radians
        
        // Check if we are within any band and moving
        const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
        if (distanceToEquator < approachingBand && isMoving) {
            // Determine assist intensity based on proximity
            let assistIntensity = 0;
            let assistName = "";
            
            if (distanceToEquator < veryCloseBand) {
                // Very close to equator - stronger assist
                assistIntensity = 0.7; // 0.7 degrees
                assistName = "micro";
            } else if (distanceToEquator < closeBand) {
                // Close to equator - moderate assist
                assistIntensity = 0.4; // 0.4 degrees
                assistName = "mini";
            } else {
                // Approaching equator - gentle assist
                assistIntensity = 0.2; // 0.2 degrees
                assistName = "nano";
            }
            
            // Determine the direction we're moving (north to south or south to north)
            const movingTowardsSouth = phi < equatorPhi;
            
            // Store the current true heading before crossing the equator
            // Get camera's current true forward direction in world space
            const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.camera.quaternion);
            
            // Get current direction
            const moveDirection = this.calculateMoveDirection(this.camera.camera.position);
            
            // Only boost if we're actually moving toward the equator
            const upVector = this.camera.camera.position.clone().normalize();
            const movingTowardEquator = moveDirection.dot(upVector) * (movingTowardsSouth ? -1 : 1) < 0;
            
            if (movingTowardEquator && moveDirection.lengthSq() > 0) {
                // Save the true world-space forward direction before crossing
                const worldForward = cameraDirection.clone();
                
                // Calculate angular distance to boost (in radians)
                const angularBoost = assistIntensity * Math.PI / 180;
                
                // Convert angular distance to linear distance along the surface
                // Arc length = radius × angle
                const globeRadius = this.globe.radius;
                const surfaceDistance = globeRadius * angularBoost;
                
                // Calculate boost direction - normalized move direction
                const boostDirection = moveDirection.clone().normalize();
                
                // Apply precisely calculated boost
                const boostedPosition = this.camera.camera.position.clone().add(
                    boostDirection.multiplyScalar(surfaceDistance)
                );
                
                // Apply the position change
                this.camera.camera.position.copy(boostedPosition);
                
                // Maintain correct height from planet surface
                this.updatePlayerHeight();
                
                // After crossing, we need to recalculate spherical coordinates
                this.updateCameraSphericalCoordinates();
                
                // Preserve the original heading direction
                // This is critical to maintain orientation when crossing the equator
                
                // 1. Get the current up vector after crossing
                const newUpVector = this.camera.camera.position.clone().normalize();
                
                // 2. Project our stored world forward onto the new tangent plane
                const upComponent = newUpVector.clone().multiplyScalar(worldForward.dot(newUpVector));
                const tangentForward = worldForward.clone().sub(upComponent).normalize();
                
                // 3. Compute the new looking direction by preserving our heading
                const lookTarget = this.camera.camera.position.clone().add(tangentForward);
                
                // 4. Make the camera look in the preserved forward direction
                this.camera.camera.lookAt(lookTarget);
                this.camera.camera.up.copy(newUpVector);
                
                // We need to update the camera's internals to maintain consistency
                if (this.camera.updateCameraPositionAndOrientation) {
                    this.camera.updateCameraPositionAndOrientation();
                }
                
                // Update last valid position
                this.lastValidPosition = this.camera.camera.position.clone();
                
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Calculate movement direction based on input and camera orientation
     * @param {THREE.Vector3} cameraPosition - Current camera position
     * @returns {THREE.Vector3} Move direction vector
     */
    calculateMoveDirection(cameraPosition) {
        // Calculate local up vector (from planet center to player)
        const up = cameraPosition.clone().normalize();
        
        // Get camera's forward direction
        const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.camera.quaternion);
        const forward = cameraDirection.clone();
        
        // Project forward onto tangent plane
        const upComponent = up.clone().multiplyScalar(forward.dot(up));
        forward.sub(upComponent).normalize();
        
        // Calculate right vector (perpendicular to forward and up)
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();
        
        // Initialize move direction
        const moveDirection = new THREE.Vector3(0, 0, 0);
        
        // Add components based on input
        if (this.moveForward) moveDirection.add(forward);
        if (this.moveBackward) moveDirection.sub(forward);
        if (this.moveRight) moveDirection.add(right);
        if (this.moveLeft) moveDirection.sub(right);
        
        return moveDirection;
    }
    
    /**
     * Handle initialization-phase movement
     * @param {number} deltaTime - Time in seconds since last frame
     */
    handleInitialMovement(deltaTime) {
        if (this.isFirstMovement) {
            this.initialFrameCount++;
            
            // Wait for 30 frames to establish stability
            if (this.initialFrameCount >= 30 && !this.stableReferenceEstablished) {
                console.log('Stable reference position established after 30 frames');
                this.stableReferenceEstablished = true;
                this.lastValidPosition = this.camera.camera.position.clone();
                
                // Perform initial position adjustment if needed
                if (this.needsInitialMovement && !this.hasPerformedInitialJump) {
                    console.log('Ready to perform initial position teleport');
                    this.performInitialPositionJump();
                }
            }
            
            // Gradual increase in movement allowed
            if (this.initialFrameCount <= 30) {
                deltaTime *= 0.1; // Almost no movement at first
            } else if (this.initialFrameCount <= 60) {
                deltaTime *= 0.3; // Gradual increase
            } else {
                this.isFirstMovement = false;
                console.log('First movement period complete - switching to normal movement');
            }
        }
        
        // Handle automatic movement after the initial jump
        if (this.stableReferenceEstablished && 
            this.hasPerformedInitialJump && 
            this.needsInitialMovement && 
            !this.initialMovementComplete) {
            
            // Automatically move forward
            this.initialMovementSteps++;
            this.moveForward = true;
            
            console.log(`Auto-movement step ${this.initialMovementSteps}/5`);
            
            // After 5 steps, return control to player
            if (this.initialMovementSteps >= 5) {
                this.initialMovementComplete = true;
                this.needsInitialMovement = false;
                this.moveForward = false;
                console.log('Auto-movement complete - returning control to player');
            }
        }
    }
    
    /**
     * Handle collision with terrain features
     * @param {Object} collision - Collision data 
     * @param {THREE.Vector3} moveDirection - The attempted movement direction
     * @param {THREE.Vector3} currentPosition - Current position
     */
    handleCollision(collision, moveDirection, currentPosition) {
        if (!collision || !this.lastValidPosition) return;
        
        // Option 2: Slide along the obstacle (more natural)
        // Get direction to obstacle center
        const obstaclePosition = collision.feature.position;
        const obstacleDirection = obstaclePosition.clone().sub(currentPosition).normalize();
        
        // Calculate slide direction (perpendicular to obstacle direction)
        const slideDirection = new THREE.Vector3();
        slideDirection.crossVectors(obstacleDirection, new THREE.Vector3(0, 1, 0)).normalize();
        
        // Adjust slide direction to be tangent to planet surface
        const up = currentPosition.clone().normalize();
        const upComponent = up.clone().multiplyScalar(slideDirection.dot(up));
        slideDirection.sub(upComponent).normalize();
        
        // Scale slide movement
        const slideDistance = moveDirection.length() * 0.5; // Reduce speed when sliding
        slideDirection.multiplyScalar(slideDistance);
        
        // Apply slide movement (if it has a reasonable component in our desired direction)
        if (slideDirection.dot(moveDirection) > 0) {
            this.camera.camera.position.add(slideDirection);
            
            // Maintain correct height from planet center (plus jump height)
            this.updatePlayerHeight();
        }
    }
    
    /**
     * Update camera's spherical coordinates based on its current position
     */
    updateCameraSphericalCoordinates() {
        if (!this.camera || !this.camera.spherical) return;
        
        // Get position
        const position = this.camera.camera.position;
        
        // Update spherical coordinates
        this.camera.spherical.radius = position.length();
        this.camera.spherical.phi = Math.acos(position.y / this.camera.spherical.radius);
        this.camera.spherical.theta = Math.atan2(position.z, position.x);
    }
    
    /**
     * Perform an initial position jump to prevent spawn issues
     */
    performInitialPositionJump() {
        if (!this.stableReferenceEstablished || this.hasPerformedInitialJump) {
            return;
        }
        
        console.log('Performing initial position jump to prevent spawn issues');
        
        // Get current camera direction (looking direction)
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(this.camera.camera.quaternion);
        
        // We want to move along the surface, so remove the up/down component
        const upVector = this.camera.camera.position.clone().normalize();
        const forwardDir = cameraDirection.clone().sub(
            upVector.clone().multiplyScalar(cameraDirection.dot(upVector))
        ).normalize();
        
        // Get current position and calculate target position 3 units ahead
        const currentPos = this.camera.camera.position.clone();
        let jumpDistance = 3.0; // Default jump distance
        let jumpDirection = forwardDir.clone();
        
        // Try to find a valid position:
        // 1. First try jumping forward
        let targetPos = currentPos.clone().add(jumpDirection.multiplyScalar(jumpDistance));
        
        // Normalize to maintain distance from planet center
        const globeRadius = this.globe.radius;
        targetPos.normalize().multiplyScalar(globeRadius + this.playerHeight);
        
        // Check if target position would cause a collision
        const forwardCollision = this.terrain ? this.terrain.checkCollision(targetPos, this.playerRadius) : null;
        
        if (forwardCollision) {
            console.log('Forward path blocked, trying right direction');
            
            // 2. If forward is blocked, try right direction
            // Calculate right vector (perpendicular to forward and up)
            const rightDir = new THREE.Vector3().crossVectors(upVector, forwardDir).normalize();
            jumpDirection = rightDir;
            
            targetPos = currentPos.clone().add(rightDir.multiplyScalar(jumpDistance));
            targetPos.normalize().multiplyScalar(globeRadius + this.playerHeight);
            
            const rightCollision = this.terrain ? this.terrain.checkCollision(targetPos, this.playerRadius) : null;
            
            if (rightCollision) {
                console.log('Right path also blocked, using shorter forward jump');
                
                // 3. If right is also blocked, try shorter forward jump
                jumpDirection = forwardDir.normalize();
                jumpDistance = 1.5; // Shorter distance
                
                targetPos = currentPos.clone().add(jumpDirection.multiplyScalar(jumpDistance));
                targetPos.normalize().multiplyScalar(globeRadius + this.playerHeight);
            }
        }
        
        // Convert the target position to spherical coordinates
        const targetSpherical = new THREE.Spherical().setFromVector3(targetPos);
        
        // Update camera spherical coordinates
        this.camera.spherical.phi = targetSpherical.phi;
        this.camera.spherical.theta = targetSpherical.theta;
        
        // Update the camera position
        this.camera.updateCameraPositionAndOrientation();
        
        // Update last valid position
        this.lastValidPosition = this.camera.camera.position.clone();
        
        // Mark that we've done the initial jump
        this.hasPerformedInitialJump = true;
        
        console.log('Initial position jump complete');
        // console.log('New player position:', {
        //     x: targetPos.x.toFixed(2),
        //     y: targetPos.y.toFixed(2),
        //     z: targetPos.z.toFixed(2)
        // });
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerMovement;
} 