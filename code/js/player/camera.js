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
        
        console.log('Player spawning at:', {
            phi: (this.spherical.phi * 180 / Math.PI).toFixed(2) + '°',
            theta: (this.spherical.theta * 180 / Math.PI).toFixed(2) + '°',
            heading: (this.spherical.heading * 180 / Math.PI).toFixed(2) + '°'
        });
        
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
        
        // Set initial position and orientation
        this.updateCameraPositionAndOrientation();
        
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
            
            // Log rotation for debugging
            console.log('Camera rotation - Heading:', 
                        (this.spherical.heading * 180 / Math.PI).toFixed(1) + '°', 
                        'Pitch:', (this.spherical.pitch * 180 / Math.PI).toFixed(1) + '°');
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
            
            // Add FPS active class to body to style cursor
            document.body.classList.add('fps-active');
            
            // Dispatch a custom event for listeners
            const lockEvent = new CustomEvent('lock-state-changed', {
                detail: { locked: true }
            });
            document.dispatchEvent(lockEvent);
        } else {
            // Pointer is unlocked, disable controls
            console.log('Pointer lock deactivated');
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
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerCamera;
} 