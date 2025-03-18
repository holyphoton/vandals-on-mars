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
        
        // Start position (in spherical coordinates)
        this.position = {
            radius: this.globe ? this.globe.radius + 2 : 20,
            phi: Math.PI / 2,
            theta: 0
        };
        
        // Initialize camera
        this.initialize();
    }
    
    /**
     * Initialize camera and controls
     */
    initialize() {
        console.log('Initializing player camera');
        
        // Create perspective camera
        this.camera = new THREE.PerspectiveCamera(
            this.fov,
            window.innerWidth / window.innerHeight,
            this.near,
            this.far
        );
        
        // Set proper rotation order for FPS camera
        this.camera.rotation.order = 'YXZ';
        
        // Set initial position
        this.updateCameraPosition();
        
        // Check if pointer lock is supported
        this.checkPointerLockSupport();
        
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
        
        // Window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    /**
     * Handle mouse movement for camera rotation
     */
    onMouseMove(event) {
        if (this.isLocked || this.manualControlActive) {
            // Get mouse movement deltas
            const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            
            // Apply rotation directly to the camera (standard FPS controls)
            this.camera.rotation.y -= movementX * this.mouseSensitivity;
            this.camera.rotation.x -= movementY * this.mouseSensitivity;
            
            // Clamp vertical rotation to prevent flipping
            this.camera.rotation.x = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.camera.rotation.x));
            
            // Log rotation for debugging
            console.log('Camera rotation:', 
                        (this.camera.rotation.y * 180 / Math.PI).toFixed(1) + '°', 
                        (this.camera.rotation.x * 180 / Math.PI).toFixed(1) + '°');
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
            console.log('Pointer lock activated');
            this.isLocked = true;
            this.showCrosshair();
        } else {
            // Pointer is unlocked, disable controls
            console.log('Pointer lock deactivated');
            this.isLocked = false;
            this.hideCrosshair();
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
     * Update camera position in the world
     */
    updateCameraPosition() {
        if (this.globe) {
            // Convert spherical to cartesian coordinates
            const x = this.position.radius * Math.sin(this.position.phi) * Math.cos(this.position.theta);
            const y = this.position.radius * Math.cos(this.position.phi);
            const z = this.position.radius * Math.sin(this.position.phi) * Math.sin(this.position.theta);
            
            // Set camera position
            this.camera.position.set(x, y, z);
        } else {
            // Default position if no globe
            this.camera.position.y = this.playerHeight;
        }
    }
    
    /**
     * Request pointer lock to enable first-person controls
     * @returns {Promise} A promise that resolves when pointer lock is acquired
     */
    requestPointerLock() {
        // Return a Promise that resolves when pointer lock is acquired
        return new Promise((resolve, reject) => {
            // Get the element to request pointer lock on (usually the document body)
            const element = document.body;
            
            if (!element) {
                reject(new Error('No valid element to lock pointer on'));
                return;
            }
            
            if (this.isLocked) {
                resolve('Pointer is already locked');
                return;
            }
            
            // Create a temporary event listener to detect when pointer lock is acquired
            const pointerLockChangeHandler = () => {
                if (this.isLocked) {
                    document.removeEventListener('pointerlockchange', pointerLockChangeHandler);
                    document.removeEventListener('mozpointerlockchange', pointerLockChangeHandler);
                    document.removeEventListener('webkitpointerlockchange', pointerLockChangeHandler);
                    resolve('Pointer lock acquired');
                }
            };
            
            // Listen for the pointer lock change event
            document.addEventListener('pointerlockchange', pointerLockChangeHandler);
            document.addEventListener('mozpointerlockchange', pointerLockChangeHandler);
            document.addEventListener('webkitpointerlockchange', pointerLockChangeHandler);
            
            // Create a temporary event listener for pointer lock errors
            const pointerLockErrorHandler = (error) => {
                document.removeEventListener('pointerlockerror', pointerLockErrorHandler);
                document.removeEventListener('mozpointerlockerror', pointerLockErrorHandler);
                document.removeEventListener('webkitpointerlockerror', pointerLockErrorHandler);
                this.showNotification('First-person mode not fully supported', 3000);
                reject(new Error('Pointer lock failed: ' + (error || 'Unknown error')));
            };
            
            // Listen for pointer lock errors
            document.addEventListener('pointerlockerror', pointerLockErrorHandler);
            document.addEventListener('mozpointerlockerror', pointerLockErrorHandler);
            document.addEventListener('webkitpointerlockerror', pointerLockErrorHandler);
            
            // Use the appropriate method based on browser support
            try {
                if (element.requestPointerLock) {
                    element.requestPointerLock();
                } else if (element.mozRequestPointerLock) {
                    element.mozRequestPointerLock();
                } else if (element.webkitRequestPointerLock) {
                    element.webkitRequestPointerLock();
                } else {
                    console.error('Pointer lock not supported');
                    this.showNotification('Your browser does not support pointer lock', 3000);
                    reject(new Error('Pointer lock not supported by this browser'));
                }
                
                // Set a timeout in case the pointer lock change events don't fire
                setTimeout(() => {
                    if (!this.isLocked) {
                        document.removeEventListener('pointerlockchange', pointerLockChangeHandler);
                        document.removeEventListener('mozpointerlockchange', pointerLockChangeHandler);
                        document.removeEventListener('webkitpointerlockchange', pointerLockChangeHandler);
                        reject(new Error('Pointer lock timed out'));
                    }
                }, 2000);
            } catch (error) {
                pointerLockErrorHandler(error);
            }
        });
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
        const crosshair = document.createElement('div');
        crosshair.id = 'crosshair';
        crosshair.style.position = 'absolute';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.transform = 'translate(-50%, -50%)';
        crosshair.style.width = '20px';
        crosshair.style.height = '20px';
        crosshair.style.border = '2px solid white';
        crosshair.style.borderRadius = '50%';
        crosshair.style.opacity = '0.7';
        crosshair.style.display = 'none'; // Hidden by default
        
        document.body.appendChild(crosshair);
        this.crosshair = crosshair;
    }
    
    /**
     * Show the crosshair
     */
    showCrosshair() {
        if (this.crosshair) {
            this.crosshair.style.display = 'block';
        }
    }
    
    /**
     * Hide the crosshair
     */
    hideCrosshair() {
        if (this.crosshair) {
            this.crosshair.style.display = 'none';
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
     * Move the camera in first-person mode
     * @param {number} forwardBackward - Forward/backward movement (-1 to 1)
     * @param {number} leftRight - Left/right movement (-1 to 1)
     * @param {number} speed - Movement speed
     */
    move(forwardBackward, leftRight, speed) {
        if (!this.isFirstPerson) return;
        
        const actualSpeed = speed || 0.1;
        
        // Get camera's forward direction (excluding y component for level movement)
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        forward.y = 0;
        forward.normalize();
        
        // Get camera's right direction
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        right.y = 0;
        right.normalize();
        
        // Apply movement
        if (forwardBackward !== 0) {
            this.camera.position.addScaledVector(forward, forwardBackward * actualSpeed);
        }
        
        if (leftRight !== 0) {
            this.camera.position.addScaledVector(right, leftRight * actualSpeed);
        }
    }
    
    /**
     * Update the camera each frame
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Update the camera position
        if (this.isFirstPerson) {
            // First-person updates are handled by move() method
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
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerCamera;
} 