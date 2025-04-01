// camera.js - First-person camera handling - 2025-03-18

/**
 * PlayerCamera class for handling the player's first-person camera
 */
class PlayerCamera {
    /**
     * Create a new player camera
     * @param {THREE.Scene} scene - Three.js scene
     * @param {MarsGlobe} globe - Mars globe reference
     */
    constructor(scene, globe) {
        this.scene = scene;
        this.globe = globe;
        
        // Camera settings
        this.fov = 75;
        this.near = 0.1;
        this.far = 10000;
        
        // Player settings
        this.playerHeight = 1.8;
        this.mouseSensitivity = 0.002;
        
        // Movement state
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.isFirstPerson = true;
        this.isLocked = false;
        this.manualControlActive = false;
        
        // Mobile detection
        this.isMobile = Helpers && typeof Helpers.isMobile === 'function' ? Helpers.isMobile() : false;
        
        // Initialize position and lookAt vectors
        this.position = new THREE.Vector3();
        this.lookAt = new THREE.Vector3();
        
        // Generate random spawn location instead of fixed position
        const randomSpawnLocation = this.generateRandomSpawnLocation();
        
        // Spherical coordinates for orientation
        this.spherical = {
            // Position in spherical coordinates
            radius: this.globe ? this.globe.radius + this.playerHeight : 20,
            // Latitude angle (random instead of fixed at equator)
            phi: randomSpawnLocation.phi,
            // Longitude angle (random instead of fixed at 0)
            theta: randomSpawnLocation.theta,
            // Heading angle (rotation around the local up axis)
            heading: randomSpawnLocation.heading,
            // Pitch angle (looking up/down)
            pitch: 0
        };
        
        // Calculate position from spherical coordinates
        if (this.globe) {
            const radius = this.globe.radius + this.playerHeight;
            // Convert spherical to Cartesian coordinates
            this.position.set(
                radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta),
                radius * Math.cos(this.spherical.phi),
                radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta)
            );
            
            // Calculate lookAt point (forward direction)
            // Start with up vector from current position
            const up = this.position.clone().normalize();
            // Calculate forward direction based on heading
            const forward = new THREE.Vector3();
            // Get forward direction perpendicular to up, rotated by heading
            const axisY = new THREE.Vector3(0, 1, 0);
            const right = axisY.cross(up).normalize();
            const fwdHorizontal = up.clone().cross(right).normalize();
            
            // Apply heading rotation
            forward.copy(fwdHorizontal);
            
            // Set lookAt point
            this.lookAt.copy(this.position).add(forward);
        } else {
            // Fallback if globe is not available
            this.position.set(0, this.playerHeight, 0);
            this.lookAt.set(1, this.playerHeight, 0);
        }
        
        // Initialize camera
        this.initialize();
    }
    
    /**
     * Generate a random spawn location on the globe
     * @returns {Object} - Random spherical coordinates {phi, theta, heading}
     */
    generateRandomSpawnLocation() {
        // Avoid spawning too close to poles (within 15 degrees)
        const minPhi = Math.PI * 15/180;  // 15 degrees from north pole
        const maxPhi = Math.PI - minPhi;  // 15 degrees from south pole
        
        // Random phi (latitude) - avoid poles
        const phi = minPhi + Math.random() * (maxPhi - minPhi);
        
        // Random theta (longitude)
        const theta = Math.random() * Math.PI * 2;
        
        // Random initial heading (direction player is facing)
        const heading = Math.random() * Math.PI * 2;
        
        return { phi, theta, heading };
    }
    
    /**
     * Initialize camera and controls
     */
    initialize() {
        // Create perspective camera
        this.camera = new THREE.PerspectiveCamera(
            this.fov,
            window.innerWidth / window.innerHeight,
            this.near,
            this.far
        );
        
        // Set proper rotation order for FPS camera
        this.camera.rotation.order = 'YXZ';
        
        // Set initial position and orientation
        this.updateCameraPositionAndOrientation();
        
        // Mobile devices don't need pointer lock, use direct manual controls instead
        if (this.isMobile) {
            console.log('Mobile device detected, enabling manual controls without pointer lock');
            this.enableManualControl();
        } else {
            // Only check pointer lock support on non-mobile devices
            this.checkPointerLockSupport();
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Create a visible crosshair when in first-person mode
        this.createCrosshair();
    }
    
    /**
     * Check if pointer lock is supported
     * @returns {boolean} Whether pointer lock is supported
     */
    checkPointerLockSupport() {
        // Check if the browser supports pointer lock
        const hasPointerLock = 
            'pointerLockElement' in document ||
            'mozPointerLockElement' in document ||
            'webkitPointerLockElement' in document;
        
        if (!hasPointerLock) {
            console.warn('Your browser does not support Pointer Lock API');
            this.showNotification('First-person mode might not be fully supported in your browser', 5000);
            return false;
        }
        
        return true;
    }
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Prevent adding event listeners multiple times
        if (this._eventListenersInitialized) {
            console.warn('Camera event listeners already initialized, skipping');
            return;
        }
        
        // Only add mouse movement for non-mobile devices
        if (!this.isMobile) {
            // Mouse movement for camera rotation
            document.addEventListener('mousemove', this.onMouseMove.bind(this));
            
            // Pointer lock change events
            document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
            document.addEventListener('mozpointerlockchange', this.onPointerLockChange.bind(this));
            document.addEventListener('webkitpointerlockchange', this.onPointerLockChange.bind(this));
            
            // Pointer lock error events
            document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
            document.addEventListener('mozpointerlockerror', this.onPointerLockError.bind(this));
            document.addEventListener('webkitpointerlockerror', this.onPointerLockError.bind(this));
        }
        
        // Window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Mark as initialized
        this._eventListenersInitialized = true;
    }
    
    /**
     * Handle mouse movement for camera rotation
     */
    onMouseMove(event) {
        if (this.isLocked || this.manualControlActive) {
            // Get mouse movement deltas
            const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            
            // Update heading (Y-axis rotation) - this rotates around the local up vector
            this.spherical.heading -= movementX * this.mouseSensitivity;
            // Keep heading in the range [0, 2π]
            this.spherical.heading = (this.spherical.heading + Math.PI * 2) % (Math.PI * 2);
            
            // Update pitch (X-axis rotation) - looking up and down
            this.spherical.pitch -= movementY * this.mouseSensitivity;
            // Clamp pitch to ±45 degrees (π/4 radians)
            this.spherical.pitch = Math.max(-Math.PI/4, Math.min(Math.PI/4, this.spherical.pitch));
            
            // Apply the new orientation
            this.updateCameraPositionAndOrientation();
        }
    }
    
    /**
     * Handle pointer lock state change
     */
    onPointerLockChange() {
        const element = document.pointerLockElement || 
                        document.mozPointerLockElement || 
                        document.webkitPointerLockElement;
        
        if (element) {
            // Pointer is locked, enable controls
            this.isLocked = true;
            this.showCrosshair();
            
            // Add FPS active class to body to style cursor
            document.body.classList.add('fps-active');
            
            // Dispatch a custom event for listeners
            const lockEvent = new CustomEvent('lock-state-changed', {
                detail: { locked: true }
            });
            document.dispatchEvent(lockEvent);
        } else {
            // Pointer is unlocked, disable controls
            this.isLocked = false;
            this.hideCrosshair();
            
            // Disable any manual controls as well
            this.manualControlActive = false;
            
            // Remove FPS active class to restore normal cursor
            document.body.classList.remove('fps-active');
            
            // Reset any active movement to prevent continued camera movement
            if (this.velocity) {
                this.velocity.set(0, 0, 0);
            }
            
            // Dispatch a custom event for listeners
            const unlockEvent = new CustomEvent('lock-state-changed', {
                detail: { locked: false }
            });
            document.dispatchEvent(unlockEvent);
        }
    }
    
    /**
     * Handle pointer lock errors
     */
    onPointerLockError() {
        console.error('Error with pointer lock');
        this.showNotification('Failed to lock pointer. Click again or try manual controls.', 3000);
        
        // Activate manual controls as a fallback
        this.manualControlActive = true;
    }
    
    /**
     * Update when window resizes
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
    
    /**
     * Update camera position and orientation in the world
     */
    updateCameraPositionAndOrientation() {
        if (!this.globe) return;
        
        // 1. Calculate position based on spherical coordinates
        const sinPhi = Math.sin(this.spherical.phi);
        const cosPhi = Math.cos(this.spherical.phi);
        const sinTheta = Math.sin(this.spherical.theta);
        const cosTheta = Math.cos(this.spherical.theta);
        
        // Convert spherical to cartesian coordinates
        const x = this.spherical.radius * sinPhi * cosTheta;
        const y = this.spherical.radius * cosPhi;
        const z = this.spherical.radius * sinPhi * sinTheta;
        
        // Update camera position
        this.camera.position.set(x, y, z);
        
        // 2. Calculate the local coordinate system at this point on the sphere
        
        // The up vector points from the center of the planet to the camera position
        const up = new THREE.Vector3(x, y, z).normalize();
        
        // The forward vector is perpendicular to up and depends on heading
        // First, get the "north" direction at this position
        const north = new THREE.Vector3(0, 1, 0);
        if (Math.abs(Math.abs(this.spherical.phi) - Math.PI/2) < 0.001) {
            // If at poles, use a different reference vector
            north.set(1, 0, 0);
        }
        
        // Calculate east as the cross product of up and north
        const east = new THREE.Vector3().crossVectors(north, up).normalize();
        // Calculate north as the cross product of up and east
        const northCorrected = new THREE.Vector3().crossVectors(up, east).normalize();
        
        // Calculate the local forward direction based on heading and pitch
        const forward = new THREE.Vector3();
        
        // Apply heading rotation (around up axis)
        const rotatedNorth = northCorrected.clone();
        const rotatedEast = east.clone();
        
        // Using quaternion to rotate around the up vector
        const headingQuaternion = new THREE.Quaternion().setFromAxisAngle(up, this.spherical.heading);
        rotatedNorth.applyQuaternion(headingQuaternion);
        rotatedEast.applyQuaternion(headingQuaternion);
        
        // Forward direction is initially the rotated north
        forward.copy(rotatedNorth);
        
        // Apply pitch rotation (around local east axis)
        const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(rotatedEast, this.spherical.pitch);
        forward.applyQuaternion(pitchQuaternion);
        
        // Set the camera look-at direction
        const target = new THREE.Vector3().addVectors(this.camera.position, forward);
        this.camera.lookAt(target);
        
        // Ensure the camera's up vector is aligned with the local up
        this.camera.up.copy(up);
    }
    
    /**
     * Request pointer lock for first person camera
     */
    requestPointerLock() {
        // Check if already locked
        if (this.isLocked) return;
        
        // If on mobile, don't try to use pointer lock at all, just enable manual controls
        if (this.isMobile) {
            this.enableManualControl();
            return;
        }
        
        // If we're in manual control mode, just set the flag
        if (this.manualControlActive) {
            this.isLocked = true;
            
            // Dispatch a fake lockchange event
            const event = new CustomEvent('lockchange', { detail: { locked: true } });
            document.dispatchEvent(event);
            return;
        }
        
        try {
            // Set the element to request pointer lock on
            this.element = document.body;
            
            // Only request pointer lock if not clicking on input elements
            if (document.activeElement && 
                (document.activeElement.tagName === 'INPUT' || 
                 document.activeElement.tagName === 'TEXTAREA')) {
                console.log('Not requesting pointer lock while input is focused');
                return;
            }
            
            // Request pointer lock
            this.element.requestPointerLock = this.element.requestPointerLock ||
                                            this.element.mozRequestPointerLock ||
                                            this.element.webkitRequestPointerLock;
            if (this.element.requestPointerLock) {
                this.element.requestPointerLock();
            } else {
                console.warn('Pointer lock not supported');
                // Fall back to manual control mode
                this.enableManualControl();
            }
        } catch (error) {
            console.error('Error requesting pointer lock:', error);
            // Fall back to manual control mode
            this.enableManualControl();
        }
    }
    
    /**
     * Exit pointer lock
     */
    exitPointerLock() {
        if (document.exitPointerLock) {
            document.exitPointerLock();
        } else if (document.mozExitPointerLock) {
            document.mozExitPointerLock();
        } else if (document.webkitExitPointerLock) {
            document.webkitExitPointerLock();
        }
        
        this.isLocked = false;
    }
    
    /**
     * Create a crosshair element
     */
    createCrosshair() {
        // Remove ANY existing crosshair elements to prevent conflicts
        const existingCrosshairs = document.querySelectorAll('#crosshair, .crosshair, #shooter-crosshair, #billboard-crosshair');
        existingCrosshairs.forEach(element => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // Create shooter crosshair (circle)
        const shooterCrosshair = document.createElement('div');
        shooterCrosshair.id = 'shooter-crosshair';
        shooterCrosshair.className = 'custom-crosshair';
        shooterCrosshair.style.position = 'absolute';
        shooterCrosshair.style.top = '50%';
        shooterCrosshair.style.left = '50%';
        shooterCrosshair.style.transform = 'translate(-50%, -50%)';
        shooterCrosshair.style.width = '20px';
        shooterCrosshair.style.height = '20px';
        shooterCrosshair.style.border = '2px solid rgba(255, 255, 255, 0.8)';
        shooterCrosshair.style.borderRadius = '50%';
        shooterCrosshair.style.opacity = '0.7';
        shooterCrosshair.style.display = 'none'; // Hidden by default
        shooterCrosshair.style.zIndex = '10'; // Higher z-index to ensure it's on top
        shooterCrosshair.style.pointerEvents = 'none'; // Make sure it doesn't interfere with clicks
        document.body.appendChild(shooterCrosshair);
        
        // Create billboard crosshair (rectangle)
        const billboardCrosshair = document.createElement('div');
        billboardCrosshair.id = 'billboard-crosshair';
        billboardCrosshair.className = 'custom-crosshair';
        billboardCrosshair.style.position = 'absolute';
        billboardCrosshair.style.top = '50%';
        billboardCrosshair.style.left = '50%';
        billboardCrosshair.style.transform = 'translate(-50%, -50%)';
        billboardCrosshair.style.width = '24px';
        billboardCrosshair.style.height = '16px';
        billboardCrosshair.style.border = '2px solid rgba(51, 153, 255, 0.8)';
        billboardCrosshair.style.borderRadius = '3px';
        billboardCrosshair.style.opacity = '0.7';
        billboardCrosshair.style.display = 'none'; // Hidden by default
        billboardCrosshair.style.zIndex = '10'; // Higher z-index to ensure it's on top
        billboardCrosshair.style.pointerEvents = 'none'; // Make sure it doesn't interfere with clicks
        document.body.appendChild(billboardCrosshair);
        
        // Store references to both crosshairs
        this.shooterCrosshair = shooterCrosshair;
        this.billboardCrosshair = billboardCrosshair;
        
        // Default crosshair is the shooter crosshair
        this.crosshair = shooterCrosshair;
        
        // Also set up a MutationObserver to ensure our custom crosshairs aren't removed
        this.setupCrosshairObserver();
    }
    
    /**
     * Set up an observer to watch for crosshair changes/removals
     */
    setupCrosshairObserver() {
        // Create a new MutationObserver
        this.crosshairObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Check if our crosshairs were removed from the DOM
                if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                    let needsReinsertion = false;
                    
                    // Check if our crosshairs were removed
                    for (let i = 0; i < mutation.removedNodes.length; i++) {
                        const node = mutation.removedNodes[i];
                        if (node.id === 'shooter-crosshair' || node.id === 'billboard-crosshair') {
                            needsReinsertion = true;
                            break;
                        }
                    }
                    
                    // Re-insert our crosshairs if needed
                    if (needsReinsertion && this.shooterCrosshair && this.billboardCrosshair) {
                        if (!document.getElementById('shooter-crosshair')) {
                            document.body.appendChild(this.shooterCrosshair);
                        }
                        if (!document.getElementById('billboard-crosshair')) {
                            document.body.appendChild(this.billboardCrosshair);
                        }
                    }
                }
            });
        });
        
        // Start observing the body for removed nodes
        this.crosshairObserver.observe(document.body, { childList: true });
    }
    
    /**
     * Update crosshair shape based on selected weapon
     * @param {string} weaponType - Type of weapon ('billboard' or 'shooter')
     */
    updateCrosshairShape(weaponType) {
        if (!this.shooterCrosshair || !this.billboardCrosshair) return;
        
        // First hide both crosshairs to ensure no overlap
        this.shooterCrosshair.style.display = 'none';
        this.billboardCrosshair.style.display = 'none';
        
        if (weaponType === 'billboard') {
            // Update active crosshair reference
            this.crosshair = this.billboardCrosshair;
            // Only show if game is locked/active
            if (this.isLocked) {
                this.billboardCrosshair.style.display = 'block';
            }
        } else {
            // Update active crosshair reference
            this.crosshair = this.shooterCrosshair;
            // Only show if game is locked/active
            if (this.isLocked) {
                this.shooterCrosshair.style.display = 'block';
            }
        }
    }
    
    /**
     * Show the crosshair
     */
    showCrosshair() {
        // First hide both crosshairs to prevent overlap
        if (this.shooterCrosshair) {
            this.shooterCrosshair.style.display = 'none';
        }
        if (this.billboardCrosshair) {
            this.billboardCrosshair.style.display = 'none';
        }
        
        // Then only show the active crosshair
        if (this.crosshair) {
            this.crosshair.style.display = 'block';
        }
    }
    
    /**
     * Hide the crosshair
     */
    hideCrosshair() {
        if (this.shooterCrosshair) {
            this.shooterCrosshair.style.display = 'none';
        }
        if (this.billboardCrosshair) {
            this.billboardCrosshair.style.display = 'none';
        }
    }
    
    /**
     * Display a notification on screen
     */
    showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '10px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.background = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '10px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '9999';
        
        document.body.appendChild(notification);
        
        // Remove after the specified duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }
    
    /**
     * Move the camera on the spherical surface
     * @param {number} forwardBackward - Forward/backward movement (-1 to 1)
     * @param {number} leftRight - Left/right movement (-1 to 1)
     * @param {number} speed - Movement speed
     */
    move(forwardBackward, leftRight, speed) {
        if (!this.isFirstPerson || !this.globe) return;
        
        const actualSpeed = speed || 0.1;
        
        // Calculate forward and right directions in the tangent plane
        
        // Get the up vector (from planet center to camera)
        const up = this.camera.position.clone().normalize();
        
        // Calculate forward vector based on camera direction, but projected to tangent plane
        const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const forward = cameraDirection.clone();
        
        // Project forward onto tangent plane by removing any component in the up direction
        const upComponent = up.clone().multiplyScalar(forward.dot(up));
        forward.sub(upComponent).normalize();
        
        // Calculate right by cross product of up and forward
        const right = new THREE.Vector3().crossVectors(up, forward).normalize();
        
        // Apply movement in the tangent plane
        const movement = new THREE.Vector3();
        
        if (forwardBackward !== 0) {
            movement.addScaledVector(forward, forwardBackward * actualSpeed);
        }
        
        if (leftRight !== 0) {
            movement.addScaledVector(right, leftRight * actualSpeed);
        }
        
        // If there's movement, apply it
        if (movement.lengthSq() > 0) {
            // Move the camera
            this.camera.position.add(movement);
            
            // Maintain constant distance from planet center (spherical.radius)
            this.camera.position.normalize().multiplyScalar(this.spherical.radius);
            
            // Update spherical coordinates based on new position
            const position = this.camera.position;
            this.spherical.phi = Math.acos(position.y / this.spherical.radius);
            this.spherical.theta = Math.atan2(position.z, position.x);
            
            // Update camera orientation to maintain level horizon
            this.updateCameraPositionAndOrientation();
        }
    }
    
    /**
     * Update the camera each frame
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Any per-frame updates can go here
        if (this.isFirstPerson) {
            // Ensure camera orientation stays correct
            this.updateCameraPositionAndOrientation();
        }
    }
    
    /**
     * Toggle between first-person and other camera modes
     */
    toggleControls() {
        this.isFirstPerson = !this.isFirstPerson;
        
        if (this.isFirstPerson) {
            this.showCrosshair();
        } else {
            this.hideCrosshair();
            this.exitPointerLock();
        }
    }
    
    /**
     * Enable manual control without pointer lock
     * Used as a fallback and for mobile devices
     */
    enableManualControl() {
        console.log('Enabling manual camera control');
        this.manualControlActive = true;
        this.isLocked = true;
        
        // Show crosshair for first-person mode
        this.showCrosshair();
        
        // Add FPS active class to body
        document.body.classList.add('fps-active');
        
        // Dispatch events to notify other systems
        const event = new CustomEvent('lockchange', { detail: { locked: true } });
        document.dispatchEvent(event);
        
        const lockEvent = new CustomEvent('lock-state-changed', {
            detail: { locked: true }
        });
        document.dispatchEvent(lockEvent);
    }
    
    /**
     * Update camera rotation based on touch joystick input
     * @param {Object} joystickData - { x, y } from touch joystick
     */
    updateCameraFromJoystick(joystickData) {
        if (!joystickData || (joystickData.x === 0 && joystickData.y === 0)) {
            return;
        }
        
        // Apply joystick values to camera rotation
        // X controls left/right (heading)
        this.spherical.heading -= joystickData.x * 0.05;
        this.spherical.heading = (this.spherical.heading + Math.PI * 2) % (Math.PI * 2);
        
        // Y controls up/down (pitch)
        this.spherical.pitch += joystickData.y * 0.05;
        this.spherical.pitch = Math.max(-Math.PI/4, Math.min(Math.PI/4, this.spherical.pitch));
        
        // Apply the new orientation
        this.updateCameraPositionAndOrientation();
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerCamera;
} 