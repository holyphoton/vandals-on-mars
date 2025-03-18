// controls.js - Input handling (keyboard, mouse, touch) - 2025-03-18

/**
 * PlayerControls class for handling all player input (keyboard, mouse, touch)
 */
class PlayerControls {
    /**
     * Create new player controls
     * @param {PlayerCamera} playerCamera - Reference to the player camera
     */
    constructor(playerCamera) {
        this.playerCamera = playerCamera;
        
        // Input state
        this.keys = {};
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.sprint = false;
        
        // Touch controls
        this.joysticks = null;
        this.touchControls = {
            movement: { x: 0, y: 0 },
            camera: { x: 0, y: 0 }
        };
        
        // Mobile detection
        this.isMobile = Helpers.isMobile();
        
        // Key bindings
        this.keyBindings = {
            forward: ['w', 'ArrowUp'],
            backward: ['s', 'ArrowDown'],
            left: ['a', 'ArrowLeft'],
            right: ['d', 'ArrowRight'],
            sprint: ['Shift'],
            toggleCamera: ['t'],
            jump: [' '] // Space
        };
        
        // Initialize controls
        this.initialize();
    }

    /**
     * Initialize controls
     */
    initialize() {
        console.log('Initializing player controls, mobile:', this.isMobile);
        
        // Keyboard event listeners
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);
        
        // Mouse events
        document.addEventListener('click', this.onClick.bind(this), false);
        
        // Touch controls for mobile
        if (this.isMobile) {
            this.setupTouchControls();
        }
        
        // Listen for pointer lock changes to show/hide UI
        document.addEventListener('lockchange', this.onLockChange.bind(this), false);
    }

    /**
     * Set up touch controls for mobile devices
     */
    setupTouchControls() {
        // Show mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = 'block';
        }
        
        // Set up joysticks using NippleJS
        this.joysticks = Helpers.setupJoysticks('left-joystick', 'right-joystick');
        
        // Set up left joystick for movement
        if (this.joysticks.left) {
            this.joysticks.left.on('move', (event, data) => {
                // Normalize joystick input
                const x = data.vector.x;
                const y = data.vector.y;
                
                // Update movement
                this.touchControls.movement = { x, y };
            });
            
            this.joysticks.left.on('end', () => {
                // Reset movement on release
                this.touchControls.movement = { x: 0, y: 0 };
            });
        }
        
        // Set up right joystick for camera
        if (this.joysticks.right) {
            this.joysticks.right.on('move', (event, data) => {
                // Normalize joystick input
                const x = data.vector.x;
                const y = data.vector.y;
                
                // Update camera movement
                this.touchControls.camera = { x, y };
                
                // TODO: Implement camera rotation on mobile
            });
            
            this.joysticks.right.on('end', () => {
                // Reset camera movement on release
                this.touchControls.camera = { x: 0, y: 0 };
            });
        }
        
        // Add tap to shoot
        document.addEventListener('touchstart', (event) => {
            // Check if not touching joysticks
            const touch = event.touches[0];
            const leftJoystickEl = document.getElementById('left-joystick');
            const rightJoystickEl = document.getElementById('right-joystick');
            
            // Simple bounding box check
            const isTouchingLeftJoystick = this.isTouchingElement(touch, leftJoystickEl);
            const isTouchingRightJoystick = this.isTouchingElement(touch, rightJoystickEl);
            
            if (!isTouchingLeftJoystick && !isTouchingRightJoystick) {
                // Simulate a click/shoot action
                this.onClick(event);
            }
        });
    }

    /**
     * Check if a touch is touching an element
     * @param {Touch} touch - Touch object
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} - True if touching
     */
    isTouchingElement(touch, element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
        );
    }

    /**
     * Handle key down events
     * @param {KeyboardEvent} event - Key event
     */
    onKeyDown(event) {
        // Store key state
        this.keys[event.key.toLowerCase()] = true;
        
        // Update movement flags
        this.updateMovementFlags();
        
        // Special keys
        if (this.isKeyPressed(this.keyBindings.toggleCamera)) {
            this.playerCamera.toggleControls();
        }
    }

    /**
     * Handle key up events
     * @param {KeyboardEvent} event - Key event
     */
    onKeyUp(event) {
        // Update key state
        this.keys[event.key.toLowerCase()] = false;
        
        // Update movement flags
        this.updateMovementFlags();
    }

    /**
     * Handle mouse click events
     * @param {MouseEvent} event - Mouse event
     */
    onClick(event) {
        // Ignore if not left click
        if (event.button !== 0) return;
        
        // Request pointer lock on click
        if (!this.playerCamera.isLocked && this.playerCamera.isFirstPerson) {
            console.log("Controls: trying to request pointer lock");
            this.playerCamera.requestPointerLock();
            
            // If manual control is active, we should also trigger a "locked" state
            // to allow the game to function normally
            if (this.playerCamera.manualControlActive) {
                console.log("Controls: manual control already active, simulating lock");
                
                // Dispatch a fake lockchange event
                const fakeEvent = new CustomEvent('lockchange', { 
                    detail: { locked: true, manual: true }
                });
                document.dispatchEvent(fakeEvent);
            }
            
            event.preventDefault();
        }
        
        // Handle firing (in first-person mode and locked or manual controls)
        if ((this.playerCamera.isLocked || this.playerCamera.manualControlActive) && 
            this.playerCamera.isFirstPerson) {
            // Handle shooting (will be implemented in later stages)
            // this.fireTweetGun();
            console.log("Controls: would fire weapon here");
        }
    }

    /**
     * Update movement flags based on current key states
     */
    updateMovementFlags() {
        this.moveForward = this.isKeyPressed(this.keyBindings.forward);
        this.moveBackward = this.isKeyPressed(this.keyBindings.backward);
        this.moveLeft = this.isKeyPressed(this.keyBindings.left);
        this.moveRight = this.isKeyPressed(this.keyBindings.right);
        this.sprint = this.isKeyPressed(this.keyBindings.sprint);
    }

    /**
     * Check if any key in a binding is pressed
     * @param {Array} keys - Array of keys to check
     * @returns {boolean} - True if any key is pressed
     */
    isKeyPressed(keys) {
        return keys.some(key => this.keys[key.toLowerCase()]);
    }

    /**
     * Handle pointer lock change
     * @param {CustomEvent} event - Lock change event
     */
    onLockChange(event) {
        const isLocked = event.detail?.locked || false;
        
        // Toggle UI elements based on lock state
        const gameUI = document.getElementById('game-ui');
        if (gameUI) {
            gameUI.style.display = isLocked ? 'block' : 'none';
        }
        
        // Show/hide start screen
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.style.display = isLocked ? 'none' : 'flex';
        }
    }

    /**
     * Get current movement vector
     * @returns {Object} - { x, z } movement vector
     */
    getMovement() {
        let x = 0;
        let z = 0;
        
        // Handle keyboard input
        if (this.moveForward) z = 1;
        if (this.moveBackward) z = -1;
        if (this.moveLeft) x = 1;
        if (this.moveRight) x = -1;
        
        // Handle touch input (mobile)
        if (this.isMobile && this.touchControls.movement) {
            x = this.touchControls.movement.x || 0;
            x = -x;
            z = this.touchControls.movement.y || 0;
            
            // Invert z for forward/backward
            z = -z;
        }
        
        // Normalize diagonal movement
        if (x !== 0 && z !== 0) {
            const length = Math.sqrt(x * x + z * z);
            x /= length;
            z /= length;
        }
        
        return { x, z };
    }

    /**
     * Get current run/walk speed
     * @returns {number} - Current speed
     */
    getSpeed() {
        // Get base speed from config
        const baseSpeed = CONFIG.player.runSpeed;
        
        // Apply sprint multiplier if sprinting
        return this.sprint ? baseSpeed * 2 : baseSpeed;
    }

    /**
     * Update the controls (called once per frame)
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Allow movement if in first-person mode AND EITHER pointer-locked OR using manual controls
        if (!this.playerCamera.isFirstPerson || 
            (!this.playerCamera.isLocked && !this.playerCamera.manualControlActive)) {
            return;
        }
        
        // Get movement
        const movement = this.getMovement();
        
        // Get speed
        const speed = this.getSpeed() * deltaTime;
        
        // Update camera position
        this.playerCamera.move(movement.z, movement.x, speed);
        
        // Log movement debug info if actually moving
        if (movement.x !== 0 || movement.z !== 0) {
            console.log("Moving with inputs:", {
                forward: this.moveForward,
                backward: this.moveBackward,
                left: this.moveLeft,
                right: this.moveRight,
                vector: movement,
                speed: speed,
                locked: this.playerCamera.isLocked,
                manual: this.playerCamera.manualControlActive
            });
        }
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerControls;
} 