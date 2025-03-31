// main.js - Main application entry point - 2025-03-18

/**
 * Game class for managing the entire game
 */
class Game {
    /**
     * Create a new game instance
     */
    constructor() {
        // Check if another Game instance is already active
        if (window.gameInstance) {
            console.warn('A Game instance already exists, returning existing instance');
            return window.gameInstance;
        }
        
        // Store this instance as the global game instance
        window.gameInstance = this;
        
        // Game state
        this.isInitialized = false;
        this.isPaused = false;
        this.isAnimating = false;
        this.gameStarted = false;
        this.isDebug = CONSTANTS.DEBUG_MODE;
        this.username = "Anonymous"; // Default username
        this.billboardText = null; // Custom billboard text will be set once username is confirmed
        
        // Make billboard text accessible globally for weapons
        window.billboardText = null;
        
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
        this.botManager = null; // Bot Manager for automated billboard spawning
        this.powerupManager = null; // Powerup Manager for spawning and handling powerups
        
        // WebSocket connection for multiplayer
        this.socket = null;
        this.connectedToServer = false;
        this.billboards = []; // Global billboard data store
        
        // Player persistence system
        this.persistence = null;
        
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
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.warn('Game is already initialized, skipping duplicate initialization');
            return;
        }
        
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
        
        // Connect to the server
        if (CONFIG.isMultiplayer) {
            try {
                // Connect to server and wait for connection to be established
                this.updateLoadingProgress(0.8, 'Connecting to server...');
                await this.connectToServer();
                this.updateLoadingProgress(0.85, 'Server connected');
                
                // Initialize player persistence after connecting to server
                // This needs to happen before showing the start screen
                this.updateLoadingProgress(0.9, 'Loading player data...');
                await this.initializePersistence();
                this.updateLoadingProgress(0.95, 'Player data loaded');
            } catch (error) {
                console.error('Error during server connection or persistence initialization:', error);
                // Continue without multiplayer features
                this.updateLoadingProgress(0.9, 'Continuing in offline mode...');
            }
        }
        
        // Hide loading screen and show start screen
        this.hideLoadingScreen();
        this.showStartScreen();
        
        // Set initialization flag
        this.isInitialized = true;
        
        console.log('Game initialized');
    }

    /**
     * Initialize the player persistence system
     */
    async initializePersistence() {
        // Create persistence manager
        this.persistence = new PlayerPersistence(this);
        
        // Make sure socket is connected before continuing
        if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            console.log('Waiting for socket connection before initializing persistence...');
            try {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject('Socket connection timeout');
                    }, 5000);
                    
                    const checkSocketReady = () => {
                        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                            clearTimeout(timeout);
                            console.log('Socket connection ready, proceeding with persistence initialization');
                            resolve();
                        } else {
                            setTimeout(checkSocketReady, 100);
                        }
                    };
                    
                    checkSocketReady();
                });
            } catch (error) {
                console.warn('Socket connection timed out while initializing persistence:', error);
                // Continue without socket - persistence will handle the retry logic
            }
        }
        
        // Initialize persistence (generate/load player ID)
        try {
            const playerId = await this.persistence.initialize();
            console.log('Player persistence initialized successfully, player ID:', playerId);
            
            // Log the player data that was loaded, if any
            if (this.username) {
                console.log('Player data loaded from persistence:', {
                    username: this.username,
                    billboardText: this.billboardText,
                    hasAmmoData: !!this.persistence.savedAmmoData,
                    hasPositionData: !!this.persistence.savedPosition
                });
            } else {
                console.log('No existing player data found, will create new data on game start');
            }
            
            return playerId;
        } catch (error) {
            console.warn('Failed to initialize player persistence:', error);
            return null;
        }
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
        
        // Create terrain with a fixed seed from config for consistent generation across all clients
        const terrainSeed = CONFIG.world.terrainSeed || 42424242; // Use config seed or default
        this.terrain = new Terrain(this.globe, this.scene, { 
            seed: terrainSeed,
            useServerTerrain: CONFIG.world.useServerTerrain !== undefined ? CONFIG.world.useServerTerrain : true 
        });
        
        // If we're in development mode or we're not using server terrain, generate terrain locally
        if (!CONFIG.world.useServerTerrain || !CONFIG.isMultiplayer) {
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
            
            console.log('Created local terrain with fixed seed from config:', terrainSeed);
        } else {
            console.log('Waiting for server terrain data...');
            // We'll wait for server to send terrain data before generating
        }
        
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
        
        // Create bot manager - don't initialize yet, will be done when game starts
        // BotManager will be initialized with a delay after game start to allow other systems to stabilize
        if (window.BotManager) {
            console.log('Setting up bot manager - will be fully initialized when game starts');
            this.botManager = new BotManager(this);
        } else {
            console.warn('BotManager class not found, bot billboards will not be available');
        }
        
        // Create powerup manager
        if (window.PowerupManager) {
            console.log('Setting up powerup manager');
            this.powerupManager = new PowerupManager(this, this.scene);
            
            // Add console command for spawning shooting ammo powerup (for testing)
            window.createShootingAmmoPowerup = (distance = 20) => {
                console.log(`Creating Shooting Ammo powerup ${distance} steps ahead of player...`);
                return this.powerupManager.createShootingAmmoPowerup(distance);
            };
            
            // Add console command for spawning billboard ammo powerup (for testing)
            window.createBillboardAmmoPowerup = (distance = 20) => {
                console.log(`Creating Billboard Ammo powerup ${distance} steps ahead of player...`);
                return this.powerupManager.createBillboardAmmoPowerup(distance);
            };
            
            console.log('PowerupManager initialized with console commands: createShootingAmmoPowerup() and createBillboardAmmoPowerup()');
        } else {
            console.warn('PowerupManager class not found, powerups will not be available');
        }
        
        this.updateLoadingProgress(0.9, 'Player ready');
    }
    
    /**
     * Make sure player spawn location is valid (not inside an obstacle)
     */
    validatePlayerSpawnLocation() {
        if (!this.playerCamera || !this.terrain) return;
        
        // Don't override position if persistence has already set one
        if (this.persistence && this.persistence.savedPosition) {
            console.log('Using saved position from persistence');
            return;
        }
        
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
            
            // If we have a username from persistence, prefill the input field
            if (this.persistence && this.persistence.isInitialized) {
                // Get username directly from the game instance, not from persistence.game
                if (this.username && this.username !== '' && this.username.indexOf('Anonymous_') !== 0) {
                    console.log('Prefilling username input with:', this.username);
                    if (this.usernameInput) {
                        this.usernameInput.value = this.username;
                    }
                }
            }
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
    async startGame() {
        if (this.gameStarted) {
            console.warn('Game already started, ignoring request');
            return;
        }
        
        console.log('Starting game...');
        
        // Verify DOM elements to prevent errors
        this.verifyDomElements();
        
        // Get username from input
        if (this.usernameInput && this.usernameInput.value.trim()) {
            this.username = this.usernameInput.value.trim();
        } else {
            this.username = "Anonymous";
        }
        
        console.log(`Starting game for user: ${this.username}`);
        
        // Set default billboard text based on username
        this.billboardText = `${this.username}'s Turf`;
        window.billboardText = this.billboardText;
        
        // Save billboard text in persistence if available
        if (this.persistence) {
            this.persistence.saveBillboardText(this.billboardText);
        }
        
        // Hide start screen
        this.hideStartScreen();
        
        // Ensure canvas is visible
        this.ensureCanvasIsVisible();
        
        // Lock pointer if not already locked
        if (this.playerCamera && !this.playerCamera.isLocked) {
            this.playerCamera.requestPointerLock();
        }
        
        // Start animations if not already running
        if (!this.isAnimating) {
            this.animate();
        }
        
        // Connect to server if needed and not already connected
        if (CONFIG.isMultiplayer && !this.connectedToServer) {
            try {
                await this.connectToServer();
            } catch (error) {
                console.error('Failed to connect to server:', error);
                this.showErrorMessage('Could not connect to server. Playing in offline mode.');
            }
        }
        
        // Set flag to indicate weaponManager is ready
        if (this.weaponManager) {
            console.log('WeaponManager is ready for use');
            this.weaponManager.isInitialized = true;
        }
        
        // Request existing billboards from server
        if (this.connectedToServer) {
            if (this.weaponManager) {
                this.requestAllBillboards();
            } else {
                // Set a flag to request billboards once weapon manager is initialized
                this.pendingBillboardRequest = true;
            }
        }
        
        // If we have persistence data, apply it
        if (this.persistence && this.persistence.isInitialized) {
            console.log('Applying persistence data (position, ammo, etc.)');
            
            // Validate position data before applying (wait for globe to be ready)
            this.validatePlayerSpawnLocation();
        }
        
        // Initialize bot manager with a longer delay
        // This ensures the weapon manager and billboards are fully loaded first
        setTimeout(() => {
            if (this.botManager) {
                console.log('Initializing bot billboard system...');
                
                // If the botManager has an initialize method, call it
                if (typeof this.botManager.initialize === 'function') {
                    this.botManager.initialize();
                }
                // Otherwise, if it has a spawnInitialBillboards method, call that
                else if (typeof this.botManager.spawnInitialBillboards === 'function') {
                    this.botManager.spawnInitialBillboards();
                }
                
                console.log('Bot billboard system initialized');
            } else {
                console.warn('BotManager not available, bot billboards will not be spawned');
            }
        }, 10000); // 10 second delay to ensure weapon manager is fully initialized
        
        // Set game started flag
        this.gameStarted = true;
        console.log('Game started successfully');
        
        // Show started message
        this.showGameStartedMessage();
    }
    
    /**
     * Verify that all necessary DOM elements are available
     */
    verifyDomElements() {
        console.log('Verifying DOM elements');
        
        // Check for UI elements
        const gameUI = document.getElementById('game-ui');
        if (gameUI) {
            gameUI.style.display = 'block';
            console.log('Game UI is displayed');
        } else {
            console.warn('Game UI element not found');
        }
        
        // Check for canvas element
        const canvas = document.querySelector('canvas');
        if (!canvas) {
            console.error('Canvas element not found');
        } else {
            console.log('Canvas element found and verified');
        }
    }
    
    /**
     * Ensure the Three.js canvas is visible
     */
    ensureCanvasIsVisible() {
        console.log('Ensuring canvas visibility');
        
        // Check for canvas element
        const canvas = this.renderer ? this.renderer.domElement : document.querySelector('canvas');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        // Make sure the canvas is visible
        canvas.style.display = 'block';
        
        // Ensure it has a high z-index but below UI
        canvas.style.zIndex = '1';
        
        // Put canvas at correct position
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        
        console.log('Canvas visibility ensured');
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
        // Skip update if game is paused
        if (this.isPaused) return;
        
        // Check for pending billboard request (if we connected before weapon manager was ready)
        if (this.pendingBillboardRequest && this.weaponManager && this.connectedToServer) {
            console.log('Weapon manager now initialized, sending delayed billboard request');
            this.requestAllBillboards();
            this.pendingBillboardRequest = false;
        }
        
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
        
        // Update bot manager
        if (this.botManager) {
            this.botManager.update(deltaTime);
        }
        
        // Update powerup manager
        if (this.powerupManager) {
            this.powerupManager.update(deltaTime);
        }
        
        // Send a position update to the server periodically
        if (this.connectedToServer && this.playerCamera) {
            this.syncPlayerPosition();
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
        
        // Also update the global window reference to ensure it's available
        window.billboardText = this.billboardText;
        
        // Save the billboard text to the server via persistence
        if (this.persistence) {
            this.persistence.saveBillboardText(this.billboardText);
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

    /**
     * Connect to the WebSocket server for multiplayer
     * @returns {Promise} - Resolves when connected to the server
     */
    connectToServer() {
        return new Promise((resolve, reject) => {
            if (this.connectedToServer) {
                console.log('Already connected to server, skipping connection');
                resolve(true);
                return;
            }
            
            const serverUrl = CONFIG.server.url || 'ws://localhost:8090';
            console.log('Connecting to server:', serverUrl);
            
            try {
                this.socket = new WebSocket(serverUrl);
                
                // Set a connection timeout
                const connectionTimeout = setTimeout(() => {
                    console.error('Connection to server timed out');
                    reject('Connection timeout');
                }, 5000);
                
                this.socket.onopen = () => {
                    console.log('Connected to server:', serverUrl);
                    this.connectedToServer = true;
                    
                    // Clear the timeout since we're connected
                    clearTimeout(connectionTimeout);
                    
                    // Send initial player data
                    this.sendPlayerData();
                    
                    // Request terrain data
                    this.requestTerrainData();
                    
                    // Request all existing billboards
                    this.requestAllBillboards();
                    
                    // Resolve the promise as we're now connected
                    resolve(true);
                };
                
                this.socket.onclose = (event) => {
                    console.log('Disconnected from server:', event.code, event.reason);
                    this.connectedToServer = false;
                    
                    // If not resolved yet, reject the promise
                    reject('Connection closed');
                };
                
                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    
                    // If not resolved yet, reject the promise
                    reject('WebSocket error');
                };
                
                this.socket.onmessage = this.handleServerMessage.bind(this);
                
            } catch (error) {
                console.error('Error connecting to server:', error);
                reject(error);
            }
        });
    }

    /**
     * Request terrain data from the server
     */
    requestTerrainData() {
        if (!this.connectedToServer) return;
        
        console.log('Requesting terrain data from server');
        
        const message = {
            type: 'request_terrain_data'
        };
        
        this.socket.send(JSON.stringify(message));
    }

    /**
     * Send player data to the server
     */
    sendPlayerData() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const playerData = {
            type: 'player_join',
            username: this.getUsername(),
            timestamp: Date.now()
        };
        
        this.socket.send(JSON.stringify(playerData));
    }
    
    /**
     * Request all billboards from the server
     */
    requestAllBillboards() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const request = {
            type: 'request_billboards'
        };
        
        this.socket.send(JSON.stringify(request));
    }
    
    /**
     * Handle messages from the server
     * @param {MessageEvent} event - Message event from WebSocket
     */
    handleServerMessage(event) {
        try {
            // Check if the data is a Blob (binary data)
            if (event.data instanceof Blob) {
                // Handle binary data by reading it as text first
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const jsonData = JSON.parse(reader.result);
                        this.processServerMessage(jsonData);
                    } catch (parseError) {
                        console.error('Error parsing blob data:', parseError);
                    }
                };
                reader.readAsText(event.data);
            } else {
                // Handle string data directly
                const data = JSON.parse(event.data);
                this.processServerMessage(data);
            }
        } catch (error) {
            console.error('Error handling server message:', error, event);
        }
    }
    
    /**
     * Process a server message
     * @param {Object} data - The parsed message data
     */
    processServerMessage(data) {
        switch (data.type) {
            case 'billboard_data':
                this.processBillboardData(data);
                break;
            case 'all_billboards':
                this.processAllBillboards(data.billboards);
                break;
            case 'billboard_removed':
                this.processBillboardRemoval(data);
                break;
            case 'admin_command':
                this.processAdminCommand(data);
                break;
            case 'terrain_data':
                this.processTerrainData(data);
                break;
            default:
                console.warn('Unknown message type:', data.type);
        }
    }
    
    /**
     * Process billboard data from the server
     * @param {Object} data - Billboard data
     */
    processBillboardData(data) {
        // Reject if missing required data
        if (!data.id || !data.position) {
            console.warn('Received invalid billboard data from server');
            return;
        }
        
        // console.log(`Received billboard data for: ${data.id}`);
        
        // Check if we already have this billboard
        const existingIndex = this.billboards.findIndex(b => b.id === data.id);
        
        if (existingIndex !== -1) {
            // Save the original text and owner
            const originalText = this.billboards[existingIndex].text;
            const originalOwner = this.billboards[existingIndex].owner;
            
            // Update existing billboard in our array but preserve text and owner
            this.billboards[existingIndex] = {
                ...this.billboards[existingIndex],
                ...data,
                // Restore original text and owner
                text: originalText,
                owner: originalOwner
            };
            // console.log(`Updated billboard ${data.id} in data storage (preserved original text and owner)`);
            
            // Update visual if we have a weapon manager with billboard gun
            if (this.weaponManager && typeof this.weaponManager.updateBillboard === 'function') {
                // console.log(`Updating visual billboard ${data.id}`);
                // Make sure we don't pass text updates to updateBillboard
                const updateData = {...data};
                // Remove text property to prevent accidental updates
                delete updateData.text;
                this.weaponManager.updateBillboard(updateData);
            } else {
                // console.log('WeaponManager or updateBillboard function not available');
            }
        } else {
            // Add new billboard
            this.billboards.push(data);
            // console.log(`Added new billboard ${data.id} to data storage`);
            
            // Create visual billboard
            if (this.weaponManager) {
                if (typeof this.weaponManager.createBillboardFromData === 'function') {
                    // console.log(`Creating visual billboard for ${data.id}`);
                    this.weaponManager.createBillboardFromData(data);
                } else if (typeof this.weaponManager.billboardGun?.createBillboardFromData === 'function') {
                    // console.log(`Creating visual billboard using billboardGun for ${data.id}`);
                    this.weaponManager.billboardGun.createBillboardFromData(data);
                } else if (typeof this.weaponManager.addBillboard === 'function') {
                    // console.log(`Adding billboard using legacy method for ${data.id}`);
                    this.weaponManager.addBillboard(data);
                } else {
                    console.log('Cannot create billboard: missing appropriate creation method');
                }
            } else {
                console.log('WeaponManager not available to create visual billboard');
            }
        }
    }
    
    /**
     * Process all billboards received from server
     * @param {Array} billboards - Array of billboard data from server
     */
    processAllBillboards(billboards) {
        console.log(`Received ${billboards ? billboards.length : 0} billboards from server`);
        
        // Validate billboards array
        if (!Array.isArray(billboards)) {
            console.error('Received invalid billboards data (not an array):', billboards);
            return;
        }
        
        // Clear existing billboards first to avoid duplicates
        if (this.weaponManager && typeof this.weaponManager.clearBillboards === 'function') {
            // console.log('Clearing existing billboards before adding new ones');
            this.weaponManager.clearBillboards();
        }
        
        let successCount = 0;
        
        // Process each billboard
        billboards.forEach(billboardData => {
            // Skip invalid billboard data
            if (!billboardData || !billboardData.id) {
                console.warn('Received invalid billboard data, skipping:', billboardData);
                return;
            }
            
            // console.log(`Processing billboard - ID: ${billboardData.id}, Text: "${billboardData.text || 'undefined'}", Owner: ${billboardData.owner || 'unknown'}`);
            
            // Validate position and rotation
            if (!billboardData.position) {
                console.warn(`Billboard ${billboardData.id} is missing position data, adding default`);
                billboardData.position = { x: 0, y: 0, z: 0 };
            }
            
            // Log quaternion data if available (important for proper orientation)
            if (billboardData.quaternion) {
                // console.log(`Billboard ${billboardData.id} has quaternion data: (${billboardData.quaternion.x.toFixed(3)}, ${billboardData.quaternion.y.toFixed(3)}, ${billboardData.quaternion.z.toFixed(3)}, ${billboardData.quaternion.w.toFixed(3)})`);
            } else if (!billboardData.rotation) {
                console.warn(`Billboard ${billboardData.id} has neither quaternion nor rotation data, adding default rotation`);
                billboardData.rotation = { x: 0, y: 0, z: 0 };
            }
            
            // Create billboard from data
            try {
                const billboard = this.weaponManager.createBillboardFromData(billboardData);
                if (billboard) successCount++;
            } catch (error) {
                console.error(`Error creating billboard ${billboardData.id}:`, error);
                // Try to log the full billboard data for debugging
                try {
                    console.error('Billboard data that caused error:', JSON.stringify(billboardData));
                } catch (e) {
                    console.error('Could not stringify billboard data:', billboardData);
                }
            }
        });
        
        console.log(`Successfully added ${successCount} of ${billboards.length} billboards from server`);
    }
    
    /**
     * Process a billboard removal message from the server
     * @param {Object} data - The removal message data
     */
    processBillboardRemoval(data) {
        console.log('Processing billboard removal:', data.id);
        
        // Check for weapon manager
        if (!this.weaponManager) {
            console.warn('Cannot process billboard removal - weapon manager not initialized');
            return;
        }
        
        // Remove the billboard in the game
        this.weaponManager.removeBillboard(data.id);
        
        // Notify bot manager if it's a bot billboard
        if (this.botManager && data.id && data.id.startsWith('bot_')) {
            this.botManager.onBillboardRemoved(data.id);
        }
        
        // Show debug message
        console.log(`Billboard ${data.id} removed from game`);
    }
    
    /**
     * Process admin command from the server
     * @param {Object} data - Admin command data
     */
    processAdminCommand(data) {
        switch (data.command) {
            case 'reveal_billboards':
                console.log('Admin command: Revealing all billboards');
                this.showAllBillboardsInfo();
                break;
                
            default:
                console.log('Unknown admin command:', data.command);
        }
    }
    
    /**
     * Show information about all billboards (admin command)
     */
    showAllBillboardsInfo() {
        console.log('--- ALL BILLBOARDS ---');
        this.billboards.forEach(billboard => {
            console.log(`ID: ${billboard.id}`);
            console.log(`  Owner: ${billboard.owner}`);
            console.log(`  Text: ${billboard.text}`);
            console.log(`  Size: ${billboard.width}x${billboard.height}`);
            console.log(`  Position: x=${billboard.position.x.toFixed(2)}, y=${billboard.position.y.toFixed(2)}, z=${billboard.position.z.toFixed(2)}`);
            console.log(`  Health: ${billboard.health}`);
        });
        console.log('---------------------');
        
        // Create and show an overlay with billboard information
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '10px';
        overlay.style.left = '10px';
        overlay.style.padding = '10px';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.color = 'white';
        overlay.style.zIndex = '1000';
        overlay.style.maxHeight = '80vh';
        overlay.style.overflowY = 'auto';
        overlay.style.maxWidth = '400px';
        overlay.style.borderRadius = '5px';
        
        let html = '<h3>All Billboards</h3>';
        html += `<p>Total: ${this.billboards.length}</p>`;
        
        this.billboards.forEach(billboard => {
            html += `<div style="margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom: 5px;">`;
            html += `<strong>ID:</strong> ${billboard.id}<br>`;
            html += `<strong>Owner:</strong> ${billboard.owner}<br>`;
            html += `<strong>Text:</strong> ${billboard.text}<br>`;
            html += `<strong>Size:</strong> ${billboard.width}x${billboard.height}<br>`;
            html += `<strong>Health:</strong> ${billboard.health}<br>`;
            html += `</div>`;
        });
        
        html += '<button id="close-billboard-info" style="padding: 5px 10px; margin-top: 10px;">Close</button>';
        
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
        
        // Add close button listener
        document.getElementById('close-billboard-info').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    }
    
    /**
     * Sync player position with the server (called periodically)
     */
    syncPlayerPosition() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        // Only sync every 500ms to reduce network traffic
        const now = Date.now();
        if (!this.lastPositionSync || now - this.lastPositionSync > 500) {
            this.lastPositionSync = now;
            
            const position = this.playerCamera.camera.position;
            const rotation = this.playerCamera.camera.rotation;
            
            const playerPosition = {
                type: 'player_position',
                username: this.getUsername(),
                position: {
                    x: position.x,
                    y: position.y,
                    z: position.z
                },
                rotation: {
                    x: rotation.x,
                    y: rotation.y,
                    z: rotation.z
                },
                timestamp: now
            };
            
            this.socket.send(JSON.stringify(playerPosition));
        }
    }
    
    /**
     * Get billboard data for sync
     * @param {Object} billboardObj - The billboard object to sync
     * @returns {Object} - Billboard data ready for sync
     */
    getBillboardDataForSync(billboardObj) {
        if (!billboardObj) {
            console.error('Cannot sync undefined billboard');
            return null;
        }
        
        const position = billboardObj.position ? billboardObj.position.clone() : new THREE.Vector3(0, 0, 0);
        
        // Get quaternion rotation for more accurate sync
        let quaternion = { x: 0, y: 0, z: 0, w: 1 }; // Default identity quaternion
        if (billboardObj.mesh && billboardObj.mesh.quaternion) {
            quaternion = {
                x: billboardObj.mesh.quaternion.x,
                y: billboardObj.mesh.quaternion.y,
                z: billboardObj.mesh.quaternion.z,
                w: billboardObj.mesh.quaternion.w
            };
            console.log(`Got quaternion data for sync from mesh for billboard ${billboardObj.id}: (${quaternion.x.toFixed(3)}, ${quaternion.y.toFixed(3)}, ${quaternion.z.toFixed(3)}, ${quaternion.w.toFixed(3)})`);
        } else if (billboardObj.quaternion) {
            // Fallback to stored quaternion if mesh is not available
            quaternion = {
                x: billboardObj.quaternion.x,
                y: billboardObj.quaternion.y, 
                z: billboardObj.quaternion.z,
                w: billboardObj.quaternion.w
            };
            console.log(`Using stored quaternion for billboard ${billboardObj.id}`);
        } else {
            console.warn(`No quaternion data available for billboard ${billboardObj.id}, using default`);
        }
        
        // Get player_id from the billboard object, or from persistence, or generate fallback
        let playerId = billboardObj.player_id;
        if (!playerId && this.persistence) {
            playerId = this.persistence.playerId;
        }
        if (!playerId) {
            playerId = localStorage.getItem('vandalsOnMarsPlayerId');
        }
        if (!playerId) {
            // Final fallback if player ID is still not available
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
        
        // Get billboard_category with fallback
        const billboardCategory = billboardObj.billboard_category || "player";
        
        return {
            type: 'billboard_data',
            id: billboardObj.id,
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            // Send quaternion instead of Euler angles for more accurate rotation
            quaternion: quaternion,
            width: billboardObj.width || 5,
            height: billboardObj.height || 5,
            health: billboardObj.health || 100,
            text: billboardObj.text || "Default Text",
            owner: billboardObj.owner || this.getUsername(),
            player_id: playerId,
            billboard_category: billboardCategory,
            timestamp: Date.now()
        };
    }
    
    /**
     * Sync billboard data with the server
     * @param {Object} billboardObj - The billboard to sync
     */
    syncBillboardData(billboardObj) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not available for billboard sync');
            return;
        }
        
        // Get serializable billboard data
        const billboardData = this.getBillboardDataForSync(billboardObj);
        
        // Store or update in local array
        const existingIndex = this.billboards.findIndex(b => b.id === billboardObj.id);
        if (existingIndex !== -1) {
            // Update existing entry
            this.billboards[existingIndex] = {
                ...this.billboards[existingIndex],
                ...billboardData
            };
            console.log(`Updated local billboard: ${billboardObj.id}`);
        } else {
            // Add new entry
            this.billboards.push(billboardData);
            console.log(`Added local billboard: ${billboardObj.id}`);
        }
        
        // Send to server
        console.log('Syncing billboard to server:', billboardData);
        this.socket.send(JSON.stringify(billboardData));
    }
    
    /**
     * Execute admin command
     * @param {string} command - Admin command
     */
    executeAdminCommand(command) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            // Handle locally in offline mode
            if (command === 'reveal_billboards') {
                this.showAllBillboardsInfo();
            }
            return;
        }
        
        const adminCommand = {
            type: 'admin_command',
            command: command,
            username: this.getUsername(),
            timestamp: Date.now()
        };
        
        this.socket.send(JSON.stringify(adminCommand));
    }

    /**
     * Process terrain data from server
     * @param {Object} data - The terrain data
     */
    processTerrainData(data) {
        console.log('Received terrain data from server');
        
        if (!data.terrainData) {
            console.error('Invalid terrain data received from server');
            return;
        }
        
        // Check if server has empty terrain data (first player needs to generate it)
        const emptyServerData = data.terrainData.craters.length === 0 &&
                               data.terrainData.rocks.length === 0;
        
        if (emptyServerData) {
            console.log('Server has empty terrain data - generating and sending terrain data as first player');
            
            // Generate terrain locally
            const result = this.terrain.generateAll({
                craterCount: 70,
                rockCount: 250,
                craterOptions: {
                    minSize: 1.5,
                    maxSize: 7,
                    depth: 0.5,
                    distribution: 'clustered'
                },
                rockOptions: {
                    minSize: 0.6,
                    maxSize: 3.0,
                    distribution: 'clustered'
                }
            });
            
            // Send generated terrain data to server for future clients
            this.sendTerrainData(result.terrainData);
        } else {
            // Use terrain data provided by server
            console.log('Using terrain data from server');
            
            // Set the terrain data in the terrain system
            this.terrain.setServerTerrainData(data.terrainData);
            
            // Generate terrain from the server data
            this.terrain.generateAll();
        }
        
        // Make sure player spawn is valid with the new terrain
        this.validatePlayerSpawnLocation();
        
        console.log('Server terrain data processed successfully');
    }

    /**
     * Send generated terrain data to the server
     * @param {Object} terrainData - The generated terrain data
     */
    sendTerrainData(terrainData) {
        if (!this.connectedToServer) return;
        
        console.log('Sending terrain data to server for future clients');
        
        const message = {
            type: 'terrain_data_update',
            terrainData: terrainData
        };
        
        this.socket.send(JSON.stringify(message));
    }
}

// Create game instance when the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
}); 