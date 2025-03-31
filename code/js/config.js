// config.js - Configuration loader and game constants - 2025-03-18

// Default configuration values
const DEFAULT_CONFIG = {
    world: {
        radius: 100,
        dayNightCycle: 600,
        maxBillboards: 500,
        terrainSeed: 42424242, // Fixed seed for deterministic terrain generation
        useServerTerrain: true // Use server-provided terrain data for consistency
    },
    player: {
        runSpeed: 5,
        startAmmo: 200,
        ammoCap: 500,
        ammoRegen: 10,
        ammoPerDamage: 20,
        billboardSlots: 1,
        shootRange: 50,
        gun: {
            startingAmmoShooting: 200,
            maxAmmoShooting: 500,
            startingAmmoBillboard: 3,
            maxAmmoBillboard: 5
        }
    },
    billboard: {
        startSize: 5,
        maxSize: 50,
        growthPerDamage: 0.5,
        decayRate: 0.1,
        decayInterval: 86400
    },
    powerUps: {
        spawnCycle: 300,
        spawnCount: [5, 10]
    },
    economy: {
        mcPerDamage: 5,
        mcDailyBonus: 100
    },
    persistence: {
        autoSaveDelay: 15 // Auto-save player data every 15 seconds
    },
    server: {
        url: 'ws://localhost:8090',
        reconnectInterval: 5000
    },
    isMultiplayer: true // Whether to connect to multiplayer server
};

// Game configuration object
const CONFIG = { ...DEFAULT_CONFIG };

// Load configuration from JSON file
async function loadConfig() {
    try {
        console.log('Attempting to load configuration from local config.json...');
        // Use a simple relative path to the config in the code directory
        const response = await fetch('./config.json');
        
        if (!response.ok) {
            console.error(`Failed to load config: HTTP ${response.status} ${response.statusText}`);
            throw new Error(`Failed to load config: ${response.statusText}`);
        }
        
        console.log('Config file response received, parsing JSON...');
        const loadedConfig = await response.json();
        
        console.log('Raw loaded config:', loadedConfig);
        
        // Dynamically replace the server URL with current hostname
        if (loadedConfig.server && loadedConfig.server.url) {
            // Extract the port from the original URL
            const originalUrl = loadedConfig.server.url;
            let port = "8090"; // Default port
            
            // Extract port if specified in the original URL
            const portMatch = originalUrl.match(/:(\d+)$/);
            if (portMatch && portMatch[1]) {
                port = portMatch[1];
            }
            
            // Construct new URL with current hostname
            const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
            loadedConfig.server.url = `${protocol}${window.location.hostname}:${port}`;
            console.log(`Dynamically set server URL to: ${loadedConfig.server.url}`);
        }
        
        // Check if billboard config with damagePerShot exists
        if (loadedConfig.billboard && loadedConfig.billboard.damagePerShot !== undefined) {
            console.log(`Found damagePerShot in config: ${loadedConfig.billboard.damagePerShot}`);
        } else {
            console.warn('damagePerShot not found in config');
        }
        
        // Merge loaded config with defaults
        console.log('Merging loaded config with defaults...');
        mergeConfig(CONFIG, loadedConfig);
        
        // Verify damagePerShot was properly merged
        if (CONFIG.billboard && CONFIG.billboard.damagePerShot !== undefined) {
            console.log(`Final CONFIG.billboard.damagePerShot after merge: ${CONFIG.billboard.damagePerShot}`);
        } else {
            console.warn('damagePerShot missing in final CONFIG after merge');
        }
        
        console.log('Final configuration after merge:', CONFIG);
        return CONFIG;
    } catch (error) {
        console.warn('Error loading configuration, using defaults:', error);
        return CONFIG;
    }
}

// Helper function to process config response
async function processConfigResponse(response, source) {
    console.log(`${source} config file response received, parsing JSON...`);
    const loadedConfig = await response.json();
    
    console.log(`Raw loaded config from ${source}:`, loadedConfig);
    
    // Check if billboard config with damagePerShot exists
    if (loadedConfig.billboard && loadedConfig.billboard.damagePerShot !== undefined) {
        console.log(`Found damagePerShot in ${source} config: ${loadedConfig.billboard.damagePerShot}`);
    } else {
        console.warn(`damagePerShot not found in ${source} config`);
    }
    
    // Merge loaded config with defaults
    console.log('Merging loaded config with defaults...');
    mergeConfig(CONFIG, loadedConfig);
    
    // Verify damagePerShot was properly merged
    if (CONFIG.billboard && CONFIG.billboard.damagePerShot !== undefined) {
        console.log(`Final CONFIG.billboard.damagePerShot after merge: ${CONFIG.billboard.damagePerShot}`);
    } else {
        console.warn('damagePerShot missing in final CONFIG after merge');
    }
    
    console.log('Final configuration after merge:', CONFIG);
    return CONFIG;
}

// Helper function to merge configuration objects
function mergeConfig(target, source) {
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                // If the property is an object, recursively merge
                if (!target[key]) {
                    target[key] = {};
                }
                mergeConfig(target[key], source[key]);
            } else {
                // Otherwise, overwrite the property
                target[key] = source[key];
            }
        }
    }
}

// Game constants
const CONSTANTS = {
    // Physics
    GRAVITY: 9.8,
    FRICTION: 0.1,
    
    // Colors
    MARS_COLOR: 0xc1440e,
    SKY_COLOR: 0x000005,
    SUN_COLOR: 0xffff80,
    EARTH_COLOR: 0x1a7cba,
    
    // UI
    UI_UPDATE_INTERVAL: 500, // ms
    
    // Debug
    DEBUG_MODE: false
};

// Function to manually reload config (accessible from console)
async function reloadConfig() {
    console.log('Manually reloading configuration...');
    
    try {
        // Force a cache-busting fetch of the config
        const cacheBuster = `?bust=${Date.now()}`;
        const response = await fetch(`./config.json${cacheBuster}`);
        
        if (!response.ok) {
            console.error(`Failed to reload config: HTTP ${response.status} ${response.statusText}`);
            throw new Error(`Failed to reload config: ${response.statusText}`);
        }
        
        const loadedConfig = await response.json();
        console.log('Raw reloaded config:', loadedConfig);
        
        // Dynamically replace the server URL with current hostname
        if (loadedConfig.server && loadedConfig.server.url) {
            // Extract the port from the original URL
            const originalUrl = loadedConfig.server.url;
            let port = "8090"; // Default port
            
            // Extract port if specified in the original URL
            const portMatch = originalUrl.match(/:(\d+)$/);
            if (portMatch && portMatch[1]) {
                port = portMatch[1];
            }
            
            // Construct new URL with current hostname
            const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
            loadedConfig.server.url = `${protocol}${window.location.hostname}:${port}`;
            console.log(`Dynamically set server URL to: ${loadedConfig.server.url}`);
        }
        
        // Create a fresh CONFIG object based on defaults
        const freshConfig = { ...DEFAULT_CONFIG };
        
        // Merge the loaded config into the fresh CONFIG
        mergeConfig(freshConfig, loadedConfig);
        
        // Replace the global CONFIG with the fresh one
        Object.keys(CONFIG).forEach(key => delete CONFIG[key]);
        Object.assign(CONFIG, freshConfig);
        
        console.log('Configuration successfully reloaded:', CONFIG);
        
        // Specifically check damagePerShot
        if (CONFIG.billboard && CONFIG.billboard.damagePerShot !== undefined) {
            console.log(`Reloaded CONFIG.billboard.damagePerShot: ${CONFIG.billboard.damagePerShot}`);
        } else {
            console.warn('damagePerShot still missing in reloaded CONFIG');
        }
        
        return CONFIG;
    } catch (error) {
        console.error('Error reloading configuration:', error);
        return CONFIG;
    }
}

// Make CONFIG, CONSTANTS, and config functions available globally
window.CONFIG = CONFIG;
window.CONSTANTS = CONSTANTS;
window.loadConfig = loadConfig;
window.reloadConfig = reloadConfig; // Make reloadConfig globally accessible

// Export configuration as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, CONSTANTS, loadConfig, reloadConfig };
} 