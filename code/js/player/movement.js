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
        
        // Get camera position and direction
        const cameraPosition = this.camera.camera.position.clone();
        const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.camera.quaternion);
        
        // Calculate movement vector based on keyboard input
        const movement = new THREE.Vector3();
        
        if (this.moveForward) {
            movement.add(cameraDirection);
        }
        if (this.moveBackward) {
            movement.sub(cameraDirection);
        }
        
        // For left/right movement, get the right vector by crossing the camera direction with the world up
        const right = new THREE.Vector3();
        right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
        
        if (this.moveRight) {
            movement.add(right);
        }
        if (this.moveLeft) {
            movement.sub(right);
        }
        
        // If there's movement, normalize and apply it
        if (movement.lengthSq() > 0) {
            movement.normalize();
            movement.multiplyScalar(this.playerSpeed * deltaTime);
            
            // Project the movement vector onto the tangent plane of the sphere at the player's position
            const radialDirection = cameraPosition.clone().normalize();
            
            // Remove any component in the radial direction
            const dotProduct = movement.dot(radialDirection);
            movement.sub(radialDirection.multiplyScalar(dotProduct));
            
            // Update position
            this.camera.camera.position.add(movement);
            
            // Constrain to sphere surface plus player height and jump height
            const distanceFromCenter = this.camera.camera.position.length();
            const targetDistance = this.globe.radius + this.playerHeight + this.jumpHeight;
            
            // Normalize the position and scale to the correct distance
            this.camera.camera.position.normalize().multiplyScalar(targetDistance);
        }
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