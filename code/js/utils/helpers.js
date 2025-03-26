// helpers.js - General utility functions - 2025-03-18

/**
 * General helper functions for the game
 */
const Helpers = {
    /**
     * Generate a random UUID
     * @returns {string} - UUID
     */
    generateUUID: function() {
        // Generate 5 random digits for xxxxx
        const randomNumbers = Math.floor(10000 + Math.random() * 90000);
        
        // Generate 5 random alphabet characters for yyyyy
        const alphabet = 'abcdefghijklmnopqrstuvwxyz';
        let randomAlphabets = '';
        for (let i = 0; i < 5; i++) {
            randomAlphabets += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        
        return `billboard_${randomNumbers}_${randomAlphabets}`;
    },

    /**
     * Generate a random color
     * @param {number} minBrightness - Minimum brightness (0-1)
     * @returns {number} - Color in hex format
     */
    randomColor: function(minBrightness = 0.5) {
        // Generate bright, vivid colors
        let r, g, b;
        do {
            r = Math.floor(Math.random() * 256);
            g = Math.floor(Math.random() * 256);
            b = Math.floor(Math.random() * 256);
            // Calculate brightness using relative luminance formula
            const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            // Continue until we get a color brighter than minBrightness
        } while (brightness < minBrightness);
        
        return (r << 16) + (g << 8) + b;
    },

    /**
     * Load a texture from a URL
     * @param {string} url - URL of the texture
     * @param {function} callback - Callback function(texture)
     */
    loadTexture: function(url, callback) {
        // Check if URL is for an SVG and modify it to point to the SVG version
        if (url.endsWith('.jpg') || url.endsWith('.png')) {
            // Try to load the SVG version instead
            const svgUrl = url.substring(0, url.lastIndexOf('.')) + '.svg';
            console.log(`Converting texture request from ${url} to SVG: ${svgUrl}`);
            url = svgUrl;
        }
        
        // Create a texture loader
        const loader = new THREE.TextureLoader();
        
        // Load the texture
        loader.load(
            url, 
            // Success callback
            function(texture) {
                console.log(`Texture loaded: ${url}`);
                callback(texture);
            },
            // Progress callback (not used)
            undefined,
            // Error callback
            function(error) {
                console.error('Error loading texture:', error);
                
                // Create a procedural texture as fallback
                const fallbackTexture = this.createFallbackTexture(url);
                console.warn(`Failed to load texture ${url}, using procedural fallback`);
                callback(fallbackTexture);
            }.bind(this)
        );
    },

    /**
     * Create a fallback procedural texture based on the URL
     * @param {string} url - URL that was attempted to load
     * @returns {THREE.Texture} - Procedural texture
     */
    createFallbackTexture: function(url) {
        // Create a canvas for the texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Determine texture type from URL
        if (url.includes('mars')) {
            // Mars texture (reddish)
            ctx.fillStyle = '#c1440e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add some crater-like circles
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const radius = 5 + Math.random() * 15;
                
                // Create gradient for crater
                const gradient = ctx.createRadialGradient(
                    x, y, 0,
                    x, y, radius
                );
                gradient.addColorStop(0, 'rgba(100, 70, 60, 1)');
                gradient.addColorStop(0.7, 'rgba(150, 70, 50, 0.8)');
                gradient.addColorStop(1, 'rgba(193, 68, 14, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (url.includes('earth')) {
            // Earth texture (blue/green)
            ctx.fillStyle = '#1a7cba';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add some continent-like blobs
            for (let i = 0; i < 7; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                
                // Random blob
                ctx.fillStyle = '#4a801c';
                ctx.beginPath();
                ctx.arc(x, y, 20 + Math.random() * 40, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (url.includes('sky')) {
            // Sky/space texture (dark with stars)
            ctx.fillStyle = '#000005';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add stars
            for (let i = 0; i < 200; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 2;
                const brightness = 0.5 + Math.random() * 0.5;
                
                ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Generic checkerboard pattern for any other texture
            const squareSize = 32;
            for (let x = 0; x < canvas.width; x += squareSize) {
                for (let y = 0; y < canvas.height; y += squareSize) {
                    const isEven = ((x / squareSize) + (y / squareSize)) % 2 === 0;
                    ctx.fillStyle = isEven ? '#ffffff' : '#888888';
                    ctx.fillRect(x, y, squareSize, squareSize);
                }
            }
        }
        
        // Create a texture from the canvas
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    },

    /**
     * Get current timestamp in seconds
     * @returns {number} - Current timestamp in seconds
     */
    timestamp: function() {
        return Math.floor(Date.now() / 1000);
    },

    /**
     * Format time in seconds to MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} - Formatted time
     */
    formatTime: function(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    },

    /**
     * Check if user is on a mobile device
     * @returns {boolean} - True if user is on mobile
     */
    isMobile: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    },

    /**
     * Set up NippleJS joysticks for mobile controls
     * @param {string} leftId - ID of left joystick container
     * @param {string} rightId - ID of right joystick container
     * @returns {Object} - {left, right} joystick instances
     */
    setupJoysticks: function(leftId, rightId) {
        // Only set up if window.nipplejs exists
        if (!window.nipplejs) {
            console.warn('NippleJS not loaded');
            return { left: null, right: null };
        }

        // Options for joysticks
        const options = {
            zone: document.getElementById(leftId),
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white',
            size: 100
        };

        // Create left joystick for movement
        const leftJoystick = nipplejs.create({
            ...options,
            zone: document.getElementById(leftId)
        });

        // Create right joystick for camera
        const rightJoystick = nipplejs.create({
            ...options,
            zone: document.getElementById(rightId)
        });

        return { left: leftJoystick, right: rightJoystick };
    },

    /**
     * Preload an array of assets (images, textures, etc.)
     * @param {Array} assets - Array of asset URLs to preload
     * @param {Function} progressCallback - Callback for progress updates
     * @param {Function} completedCallback - Callback when all assets are loaded
     */
    preloadAssets: function(assets, progressCallback, completedCallback) {
        let loaded = 0;
        const total = assets.length;
        
        const updateProgress = () => {
            loaded++;
            const progress = loaded / total;
            if (progressCallback) progressCallback(progress);
            
            if (loaded === total && completedCallback) {
                completedCallback();
            }
        };
        
        assets.forEach(asset => {
            if (asset.endsWith('.jpg') || asset.endsWith('.png')) {
                const img = new Image();
                img.onload = updateProgress;
                img.onerror = updateProgress; // Count errors as loaded to prevent hanging
                img.src = asset;
            } else {
                // For other asset types, just simulate loading
                setTimeout(updateProgress, 50);
            }
        });
    },

    /**
     * Show an error message to the user
     * @param {string} message - Error message
     */
    showError: function(message) {
        console.error(message);
        alert(message);
    },

    /**
     * Debounce a function to limit how often it can be called
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce: function(func, delay) {
        let timeout;
        return function() {
            const args = arguments;
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    },

    /**
     * Show notification for admin commands
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    showNotification: function(message, duration = 3000) {
        // Check if notification container exists
        let container = document.getElementById('notification-container');
        
        if (!container) {
            // Create container if it doesn't exist
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.position = 'absolute';
            container.style.top = '10px';
            container.style.right = '10px';
            container.style.zIndex = '1000';
            document.body.appendChild(container);
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '10px';
        notification.style.marginBottom = '5px';
        notification.style.borderRadius = '5px';
        notification.style.transition = 'opacity 0.3s ease-in-out';
        notification.style.opacity = '0';
        notification.textContent = message;
        
        // Add to container
        container.appendChild(notification);
        
        // Fade in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                container.removeChild(notification);
                
                // Remove container if empty
                if (container.children.length === 0) {
                    document.body.removeChild(container);
                }
            }, 300);
        }, duration);
    },

    /**
     * Format number with commas
     * @param {number} x - The number to format
     * @returns {string} The formatted number
     */
    numberWithCommas: function(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    /**
     * Execute admin commands
     * @param {string} command - The command to execute
     */
    executeAdminCommand: function(command) {
        if (!window.game) {
            console.error('Game instance not available');
            return;
        }
        
        if (typeof window.game.executeAdminCommand === 'function') {
            window.game.executeAdminCommand(command);
        } else {
            console.error('Admin command execution not available');
        }
    }
};

/**
 * Seeded random number generator based on the xorshift algorithm
 * This ensures that the same seed will produce the same sequence of random numbers
 * for all players, allowing for consistent world generation
 */
Helpers.SeededRandom = class {
    /**
     * Create a new seeded random number generator
     * @param {number} seed - The seed to use for random number generation
     */
    constructor(seed) {
        // Use seed or default to 1
        this.seed = seed || 1;
        // Initialize state with the seed
        this._state = this.seed;
    }

    /**
     * Get the next random number between 0 and 1
     * @returns {number} - Random number between 0 and 1
     */
    next() {
        // XORShift algorithm - simple but effective for non-cryptographic purposes
        let x = this._state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        this._state = x;
        
        // Convert to a number between 0 and 1 (inclusive of 0, exclusive of 1)
        return (x >>> 0) / 4294967296;
    }
    
    /**
     * Get a random number between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} - Random number between min and max
     */
    nextRange(min, max) {
        return min + this.next() * (max - min);
    }
    
    /**
     * Get a random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} - Random integer between min and max
     */
    nextInt(min, max) {
        return Math.floor(this.nextRange(min, max + 1));
    }
};

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Helpers;
} 