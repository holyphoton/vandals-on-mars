// main.js - Main application entry point - 2025-03-18

/**
 * Game class for managing the entire game
 */
class Game {
    /**
     * Create a new game instance
     */
    constructor() {
        // Game state
        this.isInitialized = false;
        this.isPaused = false;
        this.isAnimating = false;
        this.gameStarted = false;
        this.isDebug = CONSTANTS.DEBUG_MODE;
        this.username = "Anonymous"; // Default username
        this.billboardText = null; // Custom billboard text
        
        // Three.js objects
        this.renderer = null;
        this.scene = null;
        this.clock = null;
        
        // Game objects
        this.globe = null;
        this.environment = null;
        this.terrain = null;
        this.playerCamera = null;
        this.playerControls = null;
        this.playerMovement = null;
        this.weaponManager = null;
        
        // UI elements
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingBar = document.getElementById('loading-bar');
        this.loadingText = document.getElementById('loading-text');
        this.startScreen = document.getElementById('start-screen');
        this.startButton = document.getElementById('start-button');
        this.usernameInput = document.getElementById('username-input');
        
        // Popup elements
        this.billboardPopup = document.getElementById('billboard-popup');
        this.billboardTextInput = document.getElementById('billboard-text-input');
        this.confirmBillboardButton = document.getElementById('confirm-billboard');
        this.cancelBillboardButton = document.getElementById('cancel-billboard');
        
        // Debug log DOM elements
        console.log('DOM Elements:', {
            loadingScreen: !!this.loadingScreen,
            loadingBar: !!this.loadingBar,
            loadingText: !!this.loadingText,
            startScreen: !!this.startScreen,
            startButton: !!this.startButton,
            usernameInput: !!this.usernameInput
        });
        
        // Initialize the game
        this.initialize();
    }

    /**
     * Initialize the game
     */
    async initialize() {
        console.log('Initializing game');
        
        // Show loading screen
        this.showLoadingScreen();
        
        // Load configuration
        await this.loadConfiguration();
        
        // Create Three.js objects
        this.setupThreeJS();
        
        // Create game objects
        this.createGameObjects();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Hide loading screen and show start screen
        this.hideLoadingScreen();
        this.showStartScreen();
        
        // Set initialization flag
        this.isInitialized = true;
        
        console.log('Game initialized');
    }

    /**
     * Load game configuration
     */
    async loadConfiguration() {
        this.updateLoadingProgress(0.1, 'Loading configuration...');
        
        try {
            // Load configuration using the loadConfig function from config.js
            await loadConfig();
            console.log('Configuration loaded', CONFIG);
        } catch (error) {
            console.error('Failed to load configuration:', error);
            // Continue with default configuration
        }
        
        this.updateLoadingProgress(0.2, 'Configuration loaded');
    }

    /**
     * Set up Three.js
     */
    setupThreeJS() {
        this.updateLoadingProgress(0.3, 'Setting up 3D engine...');
        
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Make sure the renderer is added to the DOM
        const canvas = this.renderer.domElement;
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '1'; // Below UI elements
        document.body.appendChild(canvas);
        
        // Create clock for timing
        this.clock = new THREE.Clock();
        
        // Add window resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        
        this.updateLoadingProgress(0.4, '3D engine ready');
    }

    /**
     * Create game objects
     */
    createGameObjects() {
        this.updateLoadingProgress(0.5, 'Creating game world...');
        
        // Create Mars globe
        this.globe = new MarsGlobe(CONFIG.world.radius, this.scene);
        
        // Create environment (sky, sun, Earth)
        this.environment = new Environment(this.scene);
        
        // Create terrain
        this.terrain = new Terrain(this.globe, this.scene);
        
        // Configure terrain - increased rock count and more detailed craters
        this.terrain.generateAll({
            craterCount: 70, // More craters
            rockCount: 250, // More rocks
            craterOptions: {
                minSize: 1.5,
                maxSize: 7,
                depth: 0.5, // Deeper craters
                distribution: 'clustered' // Clustered distribution for more realism
            },
            rockOptions: {
                minSize: 0.6,
                maxSize: 3.0, // Slightly larger rocks
                distribution: 'clustered' // Clustered distribution for more realism
            }
        });
        
        this.updateLoadingProgress(0.7, 'World created');
        
        // Create player camera - with random spawn location
        this.playerCamera = new PlayerCamera(this.scene, this.globe);
        
        // Create player controls
        this.playerControls = new PlayerControls(this.playerCamera);
        
        // Create player movement
        this.playerMovement = new PlayerMovement(
            this.playerCamera,
            this.globe,
            this.playerControls
        );
        
        // Set terrain reference in player movement for collision detection
        this.playerMovement.setTerrain(this.terrain);
        
        // Check if the player's random spawn location is valid (not inside rocks/obstacles)
        this.validatePlayerSpawnLocation();
        
        // Create weapon manager
        this.weaponManager = new WeaponManager(
            this.playerCamera,
            this.scene,
            this.globe
        );
        
        // Set weapon manager reference in player controls
        this.playerControls.setWeaponManager(this.weaponManager);
        
        this.updateLoadingProgress(0.9, 'Player ready');
    }
    
    /**
     * Validate player spawn location to ensure they don't spawn inside obstacles
     */
    validatePlayerSpawnLocation() {
        if (!this.playerCamera || !this.terrain) return;
        
        // Get player's current position
        const playerPos = this.playerCamera.camera.position.clone();
        
        // Check for collisions with the terrain
        const collision = this.terrain.checkCollision(playerPos, 1.0); // 1.0 = safe distance
        
        if (collision) {
            console.log('Player spawned inside an obstacle. Adjusting position...');
            
            // Move the player up slightly to avoid being inside the object
            const sphericalCoords = this.playerCamera.spherical;
            sphericalCoords.radius += 1.5; // Move 1.5 units up
            
            // Update camera position
            this.playerCamera.updateCameraPositionAndOrientation();
            
            // Log the adjusted position
            console.log('Player position adjusted to avoid obstacles');
        } else {
            console.log('Player spawn location is valid');
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        console.log('Setting up event listeners');
        
        // Start button
        if (this.startButton) {
            console.log('Adding click listener to start button');
            
            // Remove any existing listeners first (in case it's called multiple times)
            this.startButton.removeEventListener('click', this.startGame.bind(this));
            
            // Try direct function reference first
            const startGameHandler = () => {
                console.log('Start button clicked!');
                this.startGame();
            };
            
            this.startButton.addEventListener('click', startGameHandler);
            
            // Also add direct inline function as backup
            this.startButton.onclick = () => {
                console.log('Start button clicked (via onclick)!');
                this.startGame();
            };
        } else {
            console.error('Start button not found, cannot add click handler');
        }
        
        // Add Enter key support for the username input field
        if (this.usernameInput) {
            this.usernameInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    console.log('Enter key pressed in username input!');
                    event.preventDefault();
                    this.startGame();
                }
            });
        }
        
        // Billboard popup buttons
        if (this.confirmBillboardButton) {
            this.confirmBillboardButton.addEventListener('click', () => {
                this.saveBillboardText();
            });
        }
        
        if (this.cancelBillboardButton) {
            this.cancelBillboardButton.addEventListener('click', () => {
                this.hideBillboardPopup();
            });
        }
        
        // Add keyboard listener for pausing
        document.addEventListener('keydown', (event) => {
            if (event.key === 'p' || event.key === 'P') {
                this.togglePause();
            }
            
            // Remove the S key functionality for starting the game
            // Only the Start Button should start the game
        });
        
        // Also listen for lockchange events from the camera
        document.addEventListener('lockchange', (event) => {
            console.log('Lock change event received:', event.detail.locked);
            
            // If lock was acquired, make sure start screen is hidden
            if (event.detail.locked) {
                this.hideStartScreen();
            }
        });
        
        this.updateLoadingProgress(1.0, 'Ready to play!');
    }

    /**
     * Show loading screen
     */
    showLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'flex';
        }
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
    }

    /**
     * Show start screen
     */
    showStartScreen() {
        if (this.startScreen) {
            this.startScreen.style.display = 'flex';
        }
    }

    /**
     * Hide start screen
     */
    hideStartScreen() {
        try {
            if (this.startScreen) {
                console.log('Hiding start screen');
                
                // Make sure it's actually hidden
                this.startScreen.style.display = 'none';
                this.startScreen.style.visibility = 'hidden';
                
                // Double check if it's hidden
                setTimeout(() => {
                    const computedStyle = window.getComputedStyle(this.startScreen);
                    console.log('Start screen hidden state:', {
                        display: computedStyle.display,
                        visibility: computedStyle.visibility,
                        opacity: computedStyle.opacity
                    });
                    
                    // Force hide again if not hidden
                    if (computedStyle.display !== 'none') {
                        console.warn('Start screen not properly hidden, forcing hide');
                        this.startScreen.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                    }
                }, 100);
            } else {
                console.error('Start screen element not found when trying to hide it');
            }
        } catch (error) {
            console.error('Error hiding start screen:', error);
        }
    }

    /**
     * Update loading progress
     * @param {number} progress - Progress value (0-1)
     * @param {string} message - Loading message
     */
    updateLoadingProgress(progress, message) {
        if (this.loadingBar) {
            this.loadingBar.style.width = `${progress * 100}%`;
        }
        
        if (this.loadingText) {
            this.loadingText.textContent = message;
        }
        
        console.log(`Loading progress: ${Math.floor(progress * 100)}% - ${message}`);
    }

    /**
     * Start the game
     */
    startGame() {
        console.log('Starting game');
        
        // Get username from input
        if (this.usernameInput && this.usernameInput.value.trim()) {
            this.username = this.usernameInput.value.trim();
        }
        
        // Set default billboard text
        this.billboardText = `${this.username}'s Turf`;
        console.log(`Starting game with username: ${this.username}, default billboard text: ${this.billboardText}`);
        
        // Hide start screen
        this.hideStartScreen();
        
        // Show the game UI
        const gameUI = document.getElementById('game-ui');
        if (gameUI) {
            gameUI.style.display = 'block';
        }
        
        // Request pointer lock with a short delay to ensure it works for key events
        setTimeout(() => {
            if (this.playerCamera && !this.playerCamera.isLocked) {
                console.log('Requesting pointer lock');
                this.playerCamera.requestPointerLock();
            }
        }, 100); // 100ms delay before requesting pointer lock
        
        // Start animation loop if not already running
        if (!this.isAnimating) {
            console.log('Starting animation loop');
            this.isAnimating = true;
            this.animate();
        }
        
        // Set game started flag
        this.gameStarted = true;
        console.log('Game started successfully');
        
        // Show gameplay message
        this.showGameStartedMessage();
    }
    
    /**
     * Verify all required DOM elements exist
     */
    verifyDomElements() {
        // Check all important DOM elements
        const elements = {
            'renderer.domElement': this.renderer ? !!this.renderer.domElement : false,
            'startScreen': !!this.startScreen,
            'scene': !!this.scene,
            'playerCamera': !!this.playerCamera,
            'playerControls': !!this.playerControls,
            'body': !!document.body
        };
        
        console.log('DOM element verification:', elements);
        
        // Check if there are any missing elements
        const missingElements = Object.entries(elements)
            .filter(([_, exists]) => !exists)
            .map(([name]) => name);
            
        if (missingElements.length > 0) {
            console.error('Missing required DOM elements:', missingElements);
        }
    }
    
    /**
     * Ensure the WebGL canvas is visible
     */
    ensureCanvasIsVisible() {
        if (this.renderer && this.renderer.domElement) {
            const canvas = this.renderer.domElement;
            
            // Make sure the canvas is in the DOM
            if (!document.body.contains(canvas)) {
                console.log('Canvas not in DOM, re-adding it');
                document.body.appendChild(canvas);
            }
            
            // Make sure it's visible
            canvas.style.display = 'block';
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.zIndex = '1'; // Below UI elements
            
            console.log('Canvas visibility ensured');
        } else {
            console.error('Cannot ensure canvas visibility - renderer not initialized');
        }
    }
    
    /**
     * Show a message that the game has started
     */
    showGameStartedMessage() {
        const message = document.createElement('div');
        message.textContent = `Game Started! Welcome, ${this.username}!`;
        message.style.position = 'fixed';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        message.style.color = '#ffffff';
        message.style.padding = '20px';
        message.style.borderRadius = '10px';
        message.style.fontSize = '24px';
        message.style.textAlign = 'center';
        message.style.zIndex = '1000';
        document.body.appendChild(message);
        
        // Add second line with B key hint
        const hintLine = document.createElement('div');
        hintLine.textContent = 'Press B to edit your billboard text';
        hintLine.style.fontSize = '16px';
        hintLine.style.marginTop = '10px';
        hintLine.style.color = '#cccccc';
        message.appendChild(hintLine);
        
        // Remove after 1.5 seconds (reduced from 3 seconds)
        setTimeout(() => {
            if (document.body.contains(message)) {
                document.body.removeChild(message);
            }
        }, 1500);
    }
    
    /**
     * Show an error message on screen
     */
    showErrorMessage(errorText) {
        const errorMessage = document.createElement('div');
        errorMessage.textContent = errorText;
        errorMessage.style.position = 'fixed';
        errorMessage.style.top = '50%';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translate(-50%, -50%)';
        errorMessage.style.background = 'rgba(255, 0, 0, 0.8)';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '20px';
        errorMessage.style.borderRadius = '10px';
        errorMessage.style.maxWidth = '80%';
        errorMessage.style.textAlign = 'center';
        errorMessage.style.zIndex = '10000';
        
        // Add a close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.display = 'block';
        closeButton.style.margin = '10px auto 0';
        errorMessage.appendChild(closeButton);
        
        closeButton.addEventListener('click', () => {
            if (errorMessage.parentNode) {
                errorMessage.parentNode.removeChild(errorMessage);
            }
        });
        
        document.body.appendChild(errorMessage);
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        console.log(this.isPaused ? 'Game paused' : 'Game resumed');
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Camera aspect ratio is handled in the PlayerCamera class
    }

    /**
     * Animation loop
     */
    animate() {
        try {
            // Set animation flag
            this.isAnimating = true;
            
            // Request next frame
            requestAnimationFrame(this.animate.bind(this));
            
            // Skip update if paused
            if (this.isPaused) return;
            
            // Calculate delta time
            let deltaTime = this.clock ? this.clock.getDelta() : 0.016; // fallback to 60fps
            
            // Cap delta time to reasonable values (prevents huge jumps after tab switch or initial load)
            // This is crucial for movement stability
            deltaTime = Math.min(deltaTime, 0.1); // Cap at 100ms (10fps)
            
            // Make sure we have all required objects
            if (!this.renderer || !this.scene || !this.playerCamera) {
                console.warn("Missing critical components for rendering");
                return;
            }
            
            // Update game objects
            this.update(deltaTime);
            
            // Render scene
            this.render();
        } catch (error) {
            console.error("Error in animation loop:", error);
            // Don't stop the animation loop on error, just skip this frame
        }
    }

    /**
     * Update game objects
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Skip if not initialized
        if (!this.isInitialized) return;
        
        // Update globe
        if (this.globe) {
            this.globe.update(deltaTime);
        }
        
        // Update environment
        if (this.environment) {
            this.environment.update(deltaTime);
        }
        
        // Update player controls
        if (this.playerControls) {
            this.playerControls.update(deltaTime);
        }
        
        // Update player movement
        if (this.playerMovement) {
            this.playerMovement.update(deltaTime);
        }
        
        // Update player camera
        if (this.playerCamera) {
            this.playerCamera.update(deltaTime);
        }
        
        // Update weapon manager
        if (this.weaponManager) {
            this.weaponManager.update(deltaTime);
        }
    }

    /**
     * Render the scene
     */
    render() {
        try {
            // Skip if renderer or scene or camera is missing
            if (!this.renderer || !this.scene || !this.playerCamera) {
                console.warn("Missing critical components for rendering");
                return;
            }

            // Make sure camera is defined and has a proper object
            const camera = this.playerCamera.camera;
            if (!camera) {
                console.warn("Camera not properly initialized");
                return;
            }
            
            // Render the scene
            this.renderer.render(this.scene, camera);
        } catch (error) {
            console.error("Error rendering scene:", error);
        }
    }

    /**
     * Show billboard text edit popup
     */
    showBillboardPopup() {
        if (!this.billboardPopup || !this.billboardTextInput) return;
        
        // Set current billboard text in input
        this.billboardTextInput.value = this.billboardText || `${this.username}'s Turf`;
        
        // Show popup
        this.billboardPopup.style.display = 'flex';
        
        // Add keyboard listener for Enter and Escape keys
        this.addPopupKeyboardListeners();
        
        // Focus after a small delay to prevent the 'B' key from being entered
        setTimeout(() => {
            this.billboardTextInput.focus();
            // Select all text to make it easy to replace
            this.billboardTextInput.select();
        }, 50);
        
        // Pause the game
        this.isPaused = true;
        
        // Unlock pointer
        if (this.playerCamera && this.playerCamera.isLocked) {
            document.exitPointerLock();
        }
    }
    
    /**
     * Hide billboard text edit popup
     */
    hideBillboardPopup() {
        if (!this.billboardPopup) return;
        
        // Hide popup
        this.billboardPopup.style.display = 'none';
        
        // Remove keyboard listeners
        this.removePopupKeyboardListeners();
        
        // Resume the game
        this.isPaused = false;
        
        // Re-lock pointer with a short delay to ensure it works for key events
        setTimeout(() => {
            if (this.playerCamera && !this.playerCamera.isLocked) {
                this.playerCamera.requestPointerLock();
            }
        }, 100); // 100ms delay before requesting pointer lock
    }
    
    /**
     * Add keyboard listeners for the popup
     */
    addPopupKeyboardListeners() {
        // Store the listener so we can remove it later
        this._popupKeyListener = (event) => {
            if (event.key === 'Enter') {
                this.saveBillboardText();
                event.preventDefault();
            } else if (event.key === 'Escape') {
                this.hideBillboardPopup();
                event.preventDefault();
            }
        };
        
        // Add the listener
        document.addEventListener('keydown', this._popupKeyListener);
    }
    
    /**
     * Remove keyboard listeners for the popup
     */
    removePopupKeyboardListeners() {
        if (this._popupKeyListener) {
            document.removeEventListener('keydown', this._popupKeyListener);
            this._popupKeyListener = null;
        }
    }
    
    /**
     * Save billboard text
     */
    saveBillboardText() {
        if (!this.billboardTextInput) return;
        
        // Get text from input
        const text = this.billboardTextInput.value.trim();
        
        // Set billboard text if not empty, otherwise use default
        if (text) {
            this.billboardText = text;
            console.log(`Billboard text updated: ${this.billboardText}`);
        } else {
            this.billboardText = `${this.username}'s Turf`;
            console.log(`Billboard text reset to default: ${this.billboardText}`);
        }
        
        // Hide popup
        this.hideBillboardPopup();
    }
    
    /**
     * Get the current billboard text
     * @returns {string} Current billboard text
     */
    getBillboardText() {
        return this.billboardText || `${this.username}'s Turf`;
    }
    
    /**
     * Get the username
     * @returns {string} Current username
     */
    getUsername() {
        return this.username;
    }
}

// Create game instance when the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
}); 