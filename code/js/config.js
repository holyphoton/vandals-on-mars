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
        const response = await fetch('/config.json');
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.statusText}`);
        }
        
        const loadedConfig = await response.json();
        
        // Merge loaded config with defaults
        mergeConfig(CONFIG, loadedConfig);
        
        console.log('Configuration loaded successfully:', CONFIG);
        return CONFIG;
    } catch (error) {
        console.warn('Error loading configuration, using defaults:', error);
        return CONFIG;
    }
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

// Make CONFIG and CONSTANTS available globally
window.CONFIG = CONFIG;
window.CONSTANTS = CONSTANTS;
window.loadConfig = loadConfig;

// Export configuration as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, CONSTANTS, loadConfig };
} 