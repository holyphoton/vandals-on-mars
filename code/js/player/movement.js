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
        this.gravity = 30;
        this.jumpForce = 10;
        this.playerHeight = 1.8;
        this.jumpHeight = 0; // Current height above surface
        
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
            case 'Space':
                if (this.canJump && !this.isJumping) {
                    this.isJumping = true;
                    this.jumpHeight = 0.1; // Start jump
                    this.canJump = false;
                }
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
     * Update player movement
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        if (!this.camera || !this.camera.camera || !this.globe) {
            console.warn("Camera or globe not available for movement");
            return;
        }
        
        // Handle jumping and gravity
        this.updateJumping(deltaTime);
        
        // Skip movement if camera is not properly set up
        if (!this.camera.isFirstPerson) {
            return;
        }
        
        // Get camera position
        const cameraPosition = this.camera.camera.position.clone();
        
        // Calculate local up vector (from planet center to player)
        const up = cameraPosition.clone().normalize();
        
        // Calculate movement direction in the tangent plane
        let moveDirection = new THREE.Vector3(0, 0, 0);
        
        // Get camera's forward direction in the tangent plane
        const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.camera.quaternion);
        const forward = cameraDirection.clone();
        
        // Project forward onto tangent plane by removing any component in the up direction
        const upComponent = up.clone().multiplyScalar(forward.dot(up));
        forward.sub(upComponent).normalize();
        
        // Calculate right vector as cross product of up and forward
        const right = new THREE.Vector3().crossVectors(up, forward).normalize();
        
        // Add movement components based on input
        if (this.moveForward) {
            moveDirection.add(forward);
        }
        if (this.moveBackward) {
            moveDirection.sub(forward);
        }
        if (this.moveRight) {
            moveDirection.add(right);
        }
        if (this.moveLeft) {
            moveDirection.sub(right);
        }
        
        // Apply movement if there is any
        if (moveDirection.lengthSq() > 0) {
            // Normalize and scale by speed and delta time
            moveDirection.normalize().multiplyScalar(this.playerSpeed * deltaTime);
            
            // Update position
            this.camera.camera.position.add(moveDirection);
            
            // Maintain constant distance from planet center (accounting for jump height)
            const targetDistance = this.globe.radius + this.playerHeight + this.jumpHeight;
            this.camera.camera.position.normalize().multiplyScalar(targetDistance);
            
            // Update the camera's spherical coordinates based on new position
            this.updateCameraSphericalCoordinates();
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
     * Handle jumping and gravity
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updateJumping(deltaTime) {
        if (this.isJumping) {
            // Apply an arc-like jump
            this.jumpHeight += this.velocity.y * deltaTime;
            
            // Apply gravity
            this.velocity.y -= this.gravity * deltaTime;
            
            // Check if we've landed
            if (this.jumpHeight <= 0) {
                this.jumpHeight = 0;
                this.isJumping = false;
                this.canJump = true;
                this.velocity.y = 0;
            }
            
            // Update camera position to account for jump height
            if (this.camera && this.camera.camera) {
                const position = this.camera.camera.position;
                const direction = position.clone().normalize();
                const targetDistance = this.globe.radius + this.playerHeight + this.jumpHeight;
                
                // Set new position with correct distance from center
                this.camera.camera.position.copy(direction.multiplyScalar(targetDistance));
                
                // Update camera orientation
                if (typeof this.camera.updateCameraPositionAndOrientation === 'function') {
                    this.camera.updateCameraPositionAndOrientation();
                }
            }
        } else if (!this.canJump) {
            // If we're falling (not jumping but not on ground)
            this.jumpHeight += this.velocity.y * deltaTime;
            this.velocity.y -= this.gravity * deltaTime;
            
            if (this.jumpHeight <= 0) {
                this.jumpHeight = 0;
                this.canJump = true;
                this.velocity.y = 0;
            }
        }
        
        // If we're starting a jump, set initial velocity
        if (this.isJumping && this.velocity.y === 0) {
            this.velocity.y = this.jumpForce;
        }
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerMovement;
} 