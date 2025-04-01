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
        this.jump = false;
        
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
            jump: [' '], // Space
            switchWeapon: ['q'], // Switch weapon binding
            editBillboard: ['b'] // Edit billboard text
        };
        
        // Initialize controls
        this.initialize();
    }

    /**
     * Initialize controls
     */
    initialize() {
        console.log('Initializing player controls, mobile:', this.isMobile);
        
        // IMPORTANT: Add touch handlers for shooting FIRST, before other event listeners
        // to ensure they get priority
        document.addEventListener('touchstart', (event) => {
            // Check if not touching joysticks or other UI elements
            const touch = event.touches[0];
            
            console.log("Touch detected at", touch.clientX, touch.clientY);
            
            // Check if touch is on any NippleJS or joystick elements
            if (this.isTouchingJoystick(touch)) {
                console.log("Touch on joystick - ignoring");
                return; // Don't shoot if touching joysticks
            }
            
            // Check if touch is on UI element
            if (this.isTouchingUI(touch)) {
                console.log("Touch on UI element - ignoring");
                return; // Don't shoot if touching UI
            }
            
            console.log("Touch valid for shooting, proceeding...");
            
            // Ensure proper lockstate before shooting
            if (this.playerCamera.manualControlActive && !this.playerCamera.isLocked) {
                console.log("Setting lock state for manual controls");
                // Create proper CustomEvent with detail to prevent errors
                const fakeEvent = new CustomEvent("lockchange", {
                    detail: { locked: true }
                });
                document.dispatchEvent(fakeEvent);
            }
            
            // Log weapon state
            if (!this.weaponManager) {
                console.error("WeaponManager not available");
                return;
            }
            
            console.log("WeaponManager available, checking weapon type");
            console.log("Active weapon index:", this.weaponManager.activeWeaponIndex);
            console.log("Is billboard gun active:", this.weaponManager.isBillboardGunActive());
            console.log("Is shooter gun active:", this.weaponManager.isShooterGunActive());
            
            // Special handling for touch shooting
            this.handleTouchShooting();
        }, true); // Use capture phase to ensure this runs before other handlers
        
        // Keyboard event listeners
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);
        
        // Create bound references to event handlers
        this._boundOnClick = this.onClick.bind(this);
        this._boundOnMouseDown = this.onMouseDown.bind(this);
        this._boundOnMouseUp = this.onMouseUp.bind(this);
        
        // Mouse events - ensure we're capturing events properly
        document.addEventListener('click', this._boundOnClick, false);
        
        // Use these listeners for continuous firing
        window.addEventListener('mousedown', this._boundOnMouseDown, false);
        window.addEventListener('mouseup', this._boundOnMouseUp, false);
        
        // Add document level event listener as fallback
        document.addEventListener('mouseup', this._boundOnMouseUp, false);
        
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
                
                // Reduce sensitivity by 30%
                const sensitivityFactor = 0.7; // 70% of original sensitivity (30% reduction)
                const adjustedX = x * sensitivityFactor;
                const adjustedY = y * sensitivityFactor;
                
                // Update camera movement
                this.touchControls.camera = { 
                    x: adjustedX, 
                    y: adjustedY,
                    rawX: x, // Keep raw values for reference if needed
                    rawY: y
                };
                
                // Update camera rotation using the camera's joystick method
                if (this.playerCamera && typeof this.playerCamera.updateCameraFromJoystick === 'function') {
                    this.playerCamera.updateCameraFromJoystick(this.touchControls.camera);
                }
            });
            
            this.joysticks.right.on('end', () => {
                // Reset camera movement on release
                this.touchControls.camera = { x: 0, y: 0, rawX: 0, rawY: 0 };
            });
        }
        
        // Set up fire button
        const fireButton = document.getElementById('fire-button');
        if (fireButton) {
            // Handle touch start - start firing
            fireButton.addEventListener('touchstart', (event) => {
                event.preventDefault(); // Prevent default touch behavior
                
                // Add active state for visual feedback
                fireButton.classList.add('active');
                
                console.log("Fire button pressed");
                
                // Fire the active weapon
                if (this.weaponManager) {
                    // Call our touch shooting handler
                    this.handleTouchShooting();
                }
            });
            
            // Handle touch end - stop firing
            fireButton.addEventListener('touchend', (event) => {
                event.preventDefault();
                
                // Remove active state
                fireButton.classList.remove('active');
                
                console.log("Fire button released");
            });
            
            // Also handle touch cancel in case finger moves off button
            fireButton.addEventListener('touchcancel', (event) => {
                fireButton.classList.remove('active');
            });
        }
        
        // Set up mobile action buttons
        this.setupMobileActionButtons();
    }

    /**
     * Set up mobile action buttons for weapon switching and billboard editing
     */
    setupMobileActionButtons() {
        // Get button elements
        const switchWeaponButton = document.getElementById('mobile-switch-weapon');
        const editBillboardButton = document.getElementById('mobile-edit-billboard');
        
        // Add event listener for weapon switching
        if (switchWeaponButton) {
            switchWeaponButton.addEventListener('touchend', (event) => {
                event.preventDefault(); // Prevent default touch behavior
                
                // Switch weapon if weapon manager exists
                if (this.weaponManager) {
                    this.weaponManager.switchWeapon();
                    this.updateAmmoDisplay();
                    
                    // Add visual feedback
                    switchWeaponButton.classList.add('active');
                    setTimeout(() => {
                        switchWeaponButton.classList.remove('active');
                    }, 200);
                }
            });
        }
        
        // Add event listener for billboard editing
        if (editBillboardButton) {
            editBillboardButton.addEventListener('touchend', (event) => {
                event.preventDefault(); // Prevent default touch behavior
                
                // Show billboard popup if game exists
                if (window.game) {
                    window.game.showBillboardPopup();
                    
                    // Add visual feedback
                    editBillboardButton.classList.add('active');
                    setTimeout(() => {
                        editBillboardButton.classList.remove('active');
                    }, 200);
                }
            });
        }
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
     * Check if a touch is touching any joystick element
     * @param {Touch} touch - Touch object
     * @returns {boolean} - True if touching joystick
     */
    isTouchingJoystick(touch) {
        // Check container elements
        const leftJoystickEl = document.getElementById('left-joystick');
        const rightJoystickEl = document.getElementById('right-joystick');
        const mobileControls = document.getElementById('mobile-controls');
        
        // Check if touching any of the container elements
        if (this.isTouchingElement(touch, leftJoystickEl) || 
            this.isTouchingElement(touch, rightJoystickEl) ||
            this.isTouchingElement(touch, mobileControls)) {
            return true;
        }
        
        // Also check NippleJS elements which might extend beyond containers
        const nippleElements = document.querySelectorAll('.nipple, .front, .back, .collection');
        for (let i = 0; i < nippleElements.length; i++) {
            if (this.isTouchingElement(touch, nippleElements[i])) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if a touch is touching any UI element
     * @param {Touch} touch - Touch object
     * @returns {boolean} - True if touching UI
     */
    isTouchingUI(touch) {
        // Check mobile action buttons first
        const mobileActionButtons = document.getElementById('mobile-action-buttons');
        if (this.isTouchingElement(touch, mobileActionButtons)) {
            console.log("Touch on mobile action buttons");
            return true;
        }

        // Get the exact element being touched
        const touchedElement = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!touchedElement) {
            console.log("No element found at touch point");
            return false;
        }
        
        console.log("Element at touch point:", touchedElement.tagName, 
                    touchedElement.id ? `#${touchedElement.id}` : '', 
                    touchedElement.className ? `.${touchedElement.className.replace(/ /g, '.')}` : '');
        
        // IMPORTANT: Check for canvas, render, or game elements - NEVER block shooting on these
        if (touchedElement.tagName === 'CANVAS' || 
            touchedElement.id === 'game-canvas' || 
            touchedElement.id === 'renderCanvas' ||
            touchedElement.classList.contains('game-container')) {
            console.log("Touch on game canvas/render area - ALLOW shooting");
            return false;
        }
        
        // Check specific actionable UI elements that should block shooting
        const blockingElements = [
            'mobile-switch-weapon',
            'mobile-edit-billboard',
            'billboard-popup',
            'ammo-display',
            'billboard-count',
            'weapon-indicator-container',
            'fire-button'
        ];
        
        // Check if the element or any parent has a blocking ID
        let currentElement = touchedElement;
        while (currentElement) {
            if (currentElement.id && blockingElements.includes(currentElement.id)) {
                console.log(`Touch on blocking UI element #${currentElement.id}`);
                return true;
            }
            
            // Only check the first level of game-ui - don't block entire UI container
            if (currentElement.id === 'game-ui') {
                // Only block if touching specific controls inside game-ui, not the container itself
                const controlElements = currentElement.querySelectorAll('.ammo-display, .billboard-count, .gun-indicator');
                for (const control of controlElements) {
                    if (this.isTouchingElement(touch, control)) {
                        console.log("Touch on specific UI control within game-ui");
                        return true;
                    }
                }
                // If we're here, we're touching game-ui but not any specific control
                console.log("Touch on game-ui container but not on controls - ALLOW shooting");
                return false;
            }
            
            currentElement = currentElement.parentElement;
        }
        
        // Check input elements
        if (touchedElement.tagName === 'INPUT' || 
            touchedElement.tagName === 'BUTTON' || 
            touchedElement.tagName === 'TEXTAREA') {
            console.log("Touch on form element");
            return true;
        }
        
        // Check specific UI classes
        const uiClassNames = [
            'popup-container', 'gun-indicator', 
            'nipple', 'front', 'back', 'collection'
        ];
        
        if (touchedElement.classList) {
            for (const className of uiClassNames) {
                if (touchedElement.classList.contains(className)) {
                    console.log(`Touch on element with UI class ${className}`);
                    return true;
                }
            }
        }
        
        // If we got here, it's not a UI element
        console.log("Touch is NOT on UI element - ALLOW shooting");
        return false;
    }

    /**
     * Handle key down events
     * @param {KeyboardEvent} event - Key event
     */
    onKeyDown(event) {
        // Skip key handling if input or textarea is focused
        if (document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || 
             document.activeElement.tagName === 'TEXTAREA')) {
            return;
        }
        
        // Get key name (lowercase for consistency)
        const key = event.key.toLowerCase();
        
        // Mark key as pressed
        this.keys[key] = true;
        
        // Handle key bindings for movement
        if (this.keyBindings.forward.includes(key)) this.moveForward = true;
        if (this.keyBindings.backward.includes(key)) this.moveBackward = true;
        if (this.keyBindings.left.includes(key)) this.moveLeft = true;
        if (this.keyBindings.right.includes(key)) this.moveRight = true;
        if (this.keyBindings.sprint.includes(key)) this.sprint = true;
        if (this.keyBindings.jump.includes(key)) this.jump = true;
        
        // Toggle camera view
        if (this.keyBindings.toggleCamera.includes(key)) {
            if (this.playerCamera) {
                this.playerCamera.toggleCameraView();
            }
        }
        
        // Switch weapon
        if (this.keyBindings.switchWeapon.includes(key)) {
            if (this.weaponManager) {
                this.weaponManager.switchWeapon();
                this.updateAmmoDisplay();
            }
        }
        
        // Edit billboard text
        if (this.keyBindings.editBillboard.includes(key)) {
            if (window.game) {
                window.game.showBillboardPopup();
            }
        }
        
        // Admin command: Reveal billboards (Alt+R)
        if (key === 'r' && event.altKey) {
            if (window.Helpers) {
                Helpers.executeAdminCommand('reveal_billboards');
                Helpers.showNotification('Admin command: Revealing all billboards');
            }
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
     * Handle click events for weapon firing
     * @param {MouseEvent} event - Mouse event
     */
    onClick(event) {
        // Only handle left mouse button (button 0) or touch events
        if (event instanceof MouseEvent && event.button !== 0) return;
        
        // Check if we're clicking on an input element
        if (event.target && (event.target.tagName === 'INPUT' || 
            event.target.tagName === 'TEXTAREA' || 
            event.target.tagName === 'BUTTON')) {
            // Don't handle the click if it's on an input, textarea, or button
            return;
        }
        
        // If pointer is not locked and in first person, request lock (for non-mobile)
        if (!this.playerCamera.isLocked && this.playerCamera.isFirstPerson && !this.isMobile) {
            this.playerCamera.requestPointerLock();
            return;
        }
        
        // If manual control is active, simulate a "locked" state and dispatch fake lockchange event
        if (this.playerCamera.manualControlActive) {
            // Create a proper CustomEvent with detail property to avoid "Cannot read properties of undefined (reading 'locked')" error
            const fakeEvent = new CustomEvent("lockchange", {
                detail: { locked: true }
            });
            document.dispatchEvent(fakeEvent);
        }
        
        // If we have a weapon manager and using billboard gun, fire it once
        if (this.weaponManager && this.weaponManager.isBillboardGunActive()) {
            this.weaponManager.fire();
            this.updateAmmoDisplay();
        }
    }

    /**
     * Called when the mouse button is pressed down
     * @param {MouseEvent} event - The mouse event
     */
    onMouseDown(event) {
        // Only handle left mouse button (button 0)
        if (event.button !== 0) return;
        
        // If we have a weapon manager, start continuous firing
        if (this.weaponManager && this.weaponManager.isShooterGunActive()) {
            this.weaponManager.startContinuousFire();
            // Update ammo display
            this.updateAmmoDisplay();
        }
    }

    /**
     * Called when the mouse button is released
     * @param {MouseEvent} event - The mouse event
     */
    onMouseUp(event) {
        // Only handle left mouse button (button 0)
        if (event.button !== 0) return;
        
        // If we have a weapon manager, stop continuous firing
        if (this.weaponManager && this.weaponManager.isShooterGunActive()) {
            this.weaponManager.stopContinuousFire();
            // Update ammo display
            this.updateAmmoDisplay();
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
        this.jump = this.isKeyPressed(this.keyBindings.jump);
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
     * Handles change in pointer lock state
     * @param {Event} event - The pointer lock change event
     */
    onLockChange(event) {
        // Update lock state based on document pointer lock element
        const isLocked = document.pointerLockElement === this.playerCamera.element;
        this.playerCamera.isLocked = isLocked;
        
        // If manual control is active, always consider the pointer locked
        if (this.playerCamera.manualControlActive) {
            this.playerCamera.isLocked = true;
        }
        
        // Update body class for cursor styling
        if (this.playerCamera.isLocked) {
            document.body.classList.add('fps-active');
        } else {
            document.body.classList.remove('fps-active');
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
        // For mobile, we always use manual controls
        if (!this.playerCamera.isFirstPerson || 
            (!this.playerCamera.isLocked && !this.playerCamera.manualControlActive && !this.isMobile)) {
            return;
        }
        
        // Get movement
        const movement = this.getMovement();
        
        // Get speed
        const speed = this.getSpeed() * deltaTime;
        
        // Update camera position
        this.playerCamera.move(movement.z, movement.x, speed);
    }

    /**
     * Set the weapon manager reference
     * @param {WeaponManager} weaponManager - Reference to the weapon manager
     */
    setWeaponManager(weaponManager) {
        this.weaponManager = weaponManager;
        this.updateAmmoDisplay();
    }

    /**
     * Updates the ammo display based on weapon manager state
     */
    updateAmmoDisplay() {
        if (this.weaponManager) {
            this.weaponManager.updateWeaponIndicator();
        }
    }

    /**
     * Handle touch shooting with specific handling for mobile
     */
    handleTouchShooting() {
        if (!this.weaponManager) {
            console.error("WeaponManager not available for touch shooting");
            return;
        }
        
        // Determine which gun to fire based on active weapon
        if (this.weaponManager.isBillboardGunActive()) {
            console.log("Firing billboard gun on touch");
            this.weaponManager.fire();
        } else if (this.weaponManager.isShooterGunActive()) {
            console.log("Firing shooter gun on touch");
            
            // Try multiple approaches to guarantee the shooter gun fires
            try {
                // Try direct shooter gun access first
                if (this.weaponManager.shooterGun) {
                    console.log("Shooting method 1: Direct access to shooterGun.fire()");
                    
                    // Get ammo info before firing
                    const beforeAmmo = this.weaponManager.shooterGun.ammo;
                    console.log("Ammo before firing:", beforeAmmo);
                    
                    // Call fire directly
                    const success = this.weaponManager.shooterGun.fire();
                    
                    // Check if firing was successful
                    const afterAmmo = this.weaponManager.shooterGun.ammo;
                    console.log("Firing success:", success, "Ammo after:", afterAmmo);
                    
                    if (beforeAmmo === afterAmmo) {
                        console.log("Direct firing didn't reduce ammo, trying alternative method");
                        // Try firing through the weaponManager as fallback
                        this.weaponManager.fire();
                    }
                } else {
                    // Fallback to standard fire method
                    console.log("Shooting method 2: Standard weaponManager.fire()");
                    this.weaponManager.fire();
                }
            } catch (error) {
                console.error("Error firing shooter gun:", error);
                // Final fallback: simulate desktop mouse clicking
                try {
                    console.log("Shooting method 3: Simulating desktop click events");
                    this.onMouseDown({ button: 0 });
                    setTimeout(() => this.onMouseUp({ button: 0 }), 200);
                } catch (e) {
                    console.error("All shooting methods failed:", e);
                }
            }
        }
        
        // Update ammo display after firing
        this.updateAmmoDisplay();
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerControls;
} 