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
        
        // WebSocket connection for multiplayer
        this.socket = null;
        this.connectedToServer = false;
        this.billboards = []; // Global billboard data store
        
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
        
        // Create terrain with a fixed seed from config for consistent generation across all clients
        const terrainSeed = CONFIG.world.terrainSeed || 42424242; // Use config seed or default
        this.terrain = new Terrain(this.globe, this.scene, { seed: terrainSeed });
        
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
        
        console.log('Created terrain with fixed seed from config:', terrainSeed);
        
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
        if (!this.isInitialized) {
            console.error('Game not initialized');
            return;
        }
        
        if (this.gameStarted) {
            console.warn('Game already started');
            return;
        }
        
        console.log('Starting game');
        
        // Get username from input field
        if (this.usernameInput && this.usernameInput.value.trim() !== '') {
            this.username = this.usernameInput.value.trim();
            console.log(`Username set to: ${this.username}`);
        } else {
            console.log(`Using default username: ${this.username}`);
        }
        
        // Hide start screen
        this.hideStartScreen();
        
        // Show the game UI
        const gameUI = document.getElementById('game-ui');
        if (gameUI) {
            gameUI.style.display = 'block';
            console.log('Game UI displayed');
        } else {
            console.error('Game UI element not found');
        }
        
        // Ensure camera is in first-person mode
        if (this.playerCamera) {
            // Make sure first-person mode is enabled
            this.playerCamera.isFirstPerson = true;
            
            // If the toggleControls method exists, use it to ensure first-person mode
            if (typeof this.playerCamera.toggleControls === 'function') {
                if (!this.playerCamera.isFirstPerson) {
                    this.playerCamera.toggleControls();
                }
            }
            
            // Update camera position and orientation
            if (typeof this.playerCamera.updateCameraPositionAndOrientation === 'function') {
                this.playerCamera.updateCameraPositionAndOrientation();
            }
        }
        
        // Connect to the WebSocket server
        this.connectToServer();
        
        // Wait for a short time before requesting pointer lock to give the UI time to update
        setTimeout(() => {
            // Verify DOM elements
            this.verifyDomElements();
            
            // Ensure canvas is visible
            this.ensureCanvasIsVisible();
            
            // Start animation loop
            this.isAnimating = true;
            this.animate();
            
            // Set game started flag
            this.gameStarted = true;
            
            // Show game started message
            this.showGameStartedMessage();
            
            // Request pointer lock for camera
            this.playerCamera.requestPointerLock();
            
            console.log('Game started');
        }, 100);
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
     * Connect to the WebSocket server
     */
    connectToServer() {
        // Force direct connection to port 8090 with timestamp to prevent caching
        const wsUrl = `ws://${window.location.hostname}:8090?t=${Date.now()}`;
        console.log(`Connecting to WebSocket server at ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);
        
        // Connection opened
        this.socket.addEventListener('open', (event) => {
            console.log('Connected to the server');
            this.connectedToServer = true;
            
            // Send initial player data
            this.sendPlayerData();
            
            // Only request billboards if we're fully initialized and weapon manager exists
            // This ensures we can properly create the billboards when data arrives
            if (this.weaponManager) {
                console.log('Weapon manager initialized, requesting billboards from server');
                this.requestAllBillboards();
            } else {
                console.warn('Delaying billboard request: weapon manager not yet initialized');
                // Set a flag to request billboards once weapon manager is ready
                this.pendingBillboardRequest = true;
            }
        });
        
        // Listen for messages
        this.socket.addEventListener('message', (event) => {
            this.handleServerMessage(event.data);
        });
        
        // Connection closed
        this.socket.addEventListener('close', (event) => {
            console.log('Disconnected from the server');
            this.connectedToServer = false;
        });
        
        // Connection error
        this.socket.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
            this.showErrorMessage('Failed to connect to the server. Playing in offline mode.');
            this.connectedToServer = false;
        });
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
     * @param {string|Blob} message - Message data
     */
    handleServerMessage(message) {
        try {
            // Check if the message is a Blob (binary data)
            if (message instanceof Blob) {
                console.log('Received binary data from server, converting to text');
                
                // Convert Blob to text
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        // Parse the text data as JSON
                        const jsonData = JSON.parse(event.target.result);
                        this.processServerMessage(jsonData);
                    } catch (error) {
                        console.error('Failed to parse binary message as JSON:', error);
                    }
                };
                reader.readAsText(message);
                return;
            }
            
            // Handle string data
            const data = JSON.parse(message);
            this.processServerMessage(data);
        } catch (error) {
            console.error('Failed to parse message:', error, typeof message, message);
        }
    }
    
    /**
     * Process parsed server message data
     * @param {Object} data - Parsed message data
     */
    processServerMessage(data) {
        switch (data.type) {
            case 'billboard_data':
                this.processBillboardData(data);
                break;
                
            case 'billboard_list':
                this.processAllBillboards(data.billboards);
                break;
                
            case 'billboard_remove':
                this.processBillboardRemoval(data);
                break;
                
            case 'player_join':
                console.log(`Player joined: ${data.username}`);
                break;
                
            case 'admin_command':
                this.processAdminCommand(data);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
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
        
        console.log(`Received billboard data for: ${data.id}`);
        
        // Check if we already have this billboard
        const existingIndex = this.billboards.findIndex(b => b.id === data.id);
        
        if (existingIndex !== -1) {
            // Update existing billboard in our array
            this.billboards[existingIndex] = {
                ...this.billboards[existingIndex],
                ...data
            };
            console.log(`Updated billboard ${data.id} in data storage`);
            
            // Update visual if we have a weapon manager with billboard gun
            if (this.weaponManager && typeof this.weaponManager.updateBillboard === 'function') {
                console.log(`Updating visual billboard ${data.id}`);
                this.weaponManager.updateBillboard(data);
            } else {
                console.log('WeaponManager or updateBillboard function not available');
            }
        } else {
            // Add new billboard
            this.billboards.push(data);
            console.log(`Added new billboard ${data.id} to data storage`);
            
            // Create visual billboard
            if (this.weaponManager) {
                if (typeof this.weaponManager.createBillboardFromData === 'function') {
                    console.log(`Creating visual billboard for ${data.id}`);
                    this.weaponManager.createBillboardFromData(data);
                } else if (typeof this.weaponManager.billboardGun?.createBillboardFromData === 'function') {
                    console.log(`Creating visual billboard using billboardGun for ${data.id}`);
                    this.weaponManager.billboardGun.createBillboardFromData(data);
                } else if (typeof this.weaponManager.addBillboard === 'function') {
                    console.log(`Adding billboard using legacy method for ${data.id}`);
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
     * Process all billboards received from the server
     * @param {Array} billboards - Array of billboard data
     */
    processAllBillboards(billboards) {
        console.log(`Received ${billboards.length} billboards from server`);
        
        // Validate billboards array
        if (!Array.isArray(billboards)) {
            console.error('Invalid billboards data received:', billboards);
            return;
        }
        
        // Log each billboard for debugging
        billboards.forEach((billboard, index) => {
            console.log(`Billboard ${index + 1}/${billboards.length}: ID=${billboard.id}, Owner=${billboard.owner}, Text=${billboard.text}`);
        });
        
        // Clear existing billboards first
        this.billboards = [];
        
        // Add all billboards from the server
        billboards.forEach(data => {
            this.billboards.push(data);
            
            // Create visual representation
            if (this.weaponManager) {
                // Try different possible methods for creating billboards
                if (typeof this.weaponManager.createBillboardFromData === 'function') {
                    console.log(`Creating billboard ${data.id} using weaponManager.createBillboardFromData`);
                    this.weaponManager.createBillboardFromData(data);
                } else if (typeof this.weaponManager.createBillboard === 'function') {
                    console.log(`Creating billboard ${data.id} using weaponManager.createBillboard`);
                    this.weaponManager.createBillboard(data);
                } else if (typeof this.weaponManager.addBillboard === 'function') {
                    console.log(`Creating billboard ${data.id} using weaponManager.addBillboard`);
                    this.weaponManager.addBillboard(data);
                } else {
                    console.error('Billboard added to data store, but no creation method found in weaponManager');
                }
            } else {
                console.error('WeaponManager not available to create billboards');
            }
        });
        
        console.log(`Successfully processed ${this.billboards.length} billboards from server`);
    }
    
    /**
     * Process billboard removal from the server
     * @param {Object} data - Billboard removal data
     */
    processBillboardRemoval(data) {
        if (!data.id) {
            console.warn('Missing billboard ID in removal message');
            return;
        }
        
        console.log(`Received request to remove billboard: ${data.id}`);
        
        // Remove the billboard from our local array
        const existingIndex = this.billboards.findIndex(b => b.id === data.id);
        if (existingIndex !== -1) {
            // Remove from local data store
            this.billboards.splice(existingIndex, 1);
            console.log(`Removed billboard ${data.id} from data store`);
            
            // Remove visual representation if available
            if (this.weaponManager) {
                if (typeof this.weaponManager.removeBillboard === 'function') {
                    const removed = this.weaponManager.removeBillboard(data.id);
                    console.log(`Visual billboard removal ${removed ? 'successful' : 'failed'}`);
                } else {
                    console.log('WeaponManager does not have removeBillboard method');
                }
            }
        } else {
            console.log(`Billboard ${data.id} not found in data store`);
        }
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
        const position = billboardObj.position.clone();
        
        // Get quaternion rotation for more accurate sync
        let quaternion = { x: 0, y: 0, z: 0, w: 1 }; // Default identity quaternion
        if (billboardObj.mesh && billboardObj.mesh.quaternion) {
            quaternion = {
                x: billboardObj.mesh.quaternion.x,
                y: billboardObj.mesh.quaternion.y,
                z: billboardObj.mesh.quaternion.z,
                w: billboardObj.mesh.quaternion.w
            };
        }
        
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
}

// Create game instance when the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
}); 