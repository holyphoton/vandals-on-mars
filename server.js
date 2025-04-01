const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

// Try to load .env.local file for local development if dotenv is available
try {
  const dotenv = require('dotenv');
  if (fs.existsSync('.env.local')) {
    console.log('Loading .env.local configuration');
    dotenv.config({ path: '.env.local' });
  }
} catch (error) {
  console.log('dotenv not available, skipping .env.local loading');
}

// Get port from environment variable or use default
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || PORT;

// Get data directory from environment variable or use current directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  console.log(`Creating data directory: ${DATA_DIR}`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Game configuration
const CONFIG = {
  world: {
    radius: 100,
    terrainSeed: 42424242, // Fixed seed for consistent terrain
  }
};

// Store all billboards to send to new players
const billboards = [];

// Store bot billboards separately
const botBillboards = [];

// Store player data for persistence
const playerData = {};

// Player data file path
const PLAYER_DATA_FILE = path.join(DATA_DIR, 'player-data.json');

// Billboard data file path
const BILLBOARD_DATA_FILE = path.join(DATA_DIR, 'billboard-data.json');

// Bot billboard data file path
const BOT_BILLBOARD_DATA_FILE = path.join(DATA_DIR, 'billboard-data-bots.json');

// Bot configuration file path
const BOT_CONFIG_FILE = path.join(__dirname, 'code', 'bot-config.json');

// Powerup related constants
const POWERUP_DATA_FILE = path.join(DATA_DIR, 'powerups-data.json');
const POWERUP_CONFIG_FILE = path.join(__dirname, 'code', 'powerups-config.json');

// Create terrain data file path
const TERRAIN_DATA_FILE = path.join(DATA_DIR, 'terrain-data.json');

// Bot configuration
let botConfig = {
  spawnInterval: 2000,
  maxBots: 20,
  spawnChance: 0.3,
  minDistance: 20,
  checkInterval: 3000
};

// Bot spawning control variables
let botSpawningTimer = null;
let botCheckTimer = null;
let isSpawningBots = false;

// Generate and store terrain data
let terrainData = null;

// Powerup related variables
let powerupConfig = {};
let powerups = []; // All powerups
let powerupsByType = {}; // Powerups organized by type
let isSpawningPowerups = false;
let powerupSpawningTimers = {}; // Timer IDs for each powerup type
let powerupCheckTimer = null;

// Create Express app
const app = express();

// Create HTTP server
const httpServer = http.createServer(app);

// Create WebSocket server using the HTTP server
const wsServer = new WebSocket.Server({ server: httpServer });

// Serve static files from code directory
app.use(express.static(path.join(__dirname, 'code')));

// Set up API routes
app.use(express.json());

// Serve bot-config.json
app.get('/bot-config.json', (req, res) => {
  try {
    const configFilePath = path.join(__dirname, 'code', 'bot-config.json');
    if (fs.existsSync(configFilePath)) {
      res.sendFile(configFilePath);
    } else {
      res.status(404).json({ success: false, error: 'Bot configuration not found' });
    }
  } catch (error) {
    console.error('Error serving bot config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve powerups-config.json
app.get('/powerups-config.json', (req, res) => {
  try {
    const configFilePath = path.join(__dirname, 'code', 'powerups-config.json');
    if (fs.existsSync(configFilePath)) {
      res.sendFile(configFilePath);
    } else {
      res.status(404).json({ success: false, error: 'Powerup configuration not found' });
    }
  } catch (error) {
    console.error('Error serving powerup config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve config.json
app.get('/config.json', (req, res) => {
  try {
    const configFilePath = path.join(__dirname, 'code', 'config.json');
    if (fs.existsSync(configFilePath)) {
      res.sendFile(configFilePath);
    } else {
      res.status(404).json({ success: false, error: 'Game configuration not found' });
    }
  } catch (error) {
    console.error('Error serving game config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save bot billboards API endpoint
app.post('/save-bot-billboards', express.json(), (req, res) => {
  try {
    if (req.body && Array.isArray(req.body)) {
      // Replace all bot billboards with the new list
      const newBotBillboards = req.body.filter(bb => bb && bb.id && bb.id.startsWith('bot_'));
      
      // Clear existing bot billboards and add new ones
      botBillboards.length = 0;
      botBillboards.push(...newBotBillboards);
      
      console.log(`Updated ${botBillboards.length} bot billboards from client`);
      
      // Save to file
      saveBotBillboardData();
      
      res.json({ success: true, count: botBillboards.length });
    } else {
      console.error('Invalid bot billboard data received');
      res.status(400).json({ success: false, error: 'Invalid data format' });
    }
  } catch (error) {
    console.error('Error handling bot billboard save:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Load saved player data from file
function loadPlayerData() {
  try {
    if (fs.existsSync(PLAYER_DATA_FILE)) {
      const data = fs.readFileSync(PLAYER_DATA_FILE, 'utf8');
      const parsedData = JSON.parse(data);
      
      // Copy to our in-memory storage
      Object.assign(playerData, parsedData);
      
      console.log(`Loaded player data for ${Object.keys(playerData).length} players`);
    } else {
      console.log('No player data file found, starting with empty player data');
      // Create directory if it doesn't exist
      const dir = path.dirname(PLAYER_DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Create empty file
      fs.writeFileSync(PLAYER_DATA_FILE, JSON.stringify({}), 'utf8');
    }
  } catch (error) {
    console.error('Error loading player data:', error);
  }
}

// Save player data to file
function savePlayerData() {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(PLAYER_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PLAYER_DATA_FILE, JSON.stringify(playerData, null, 2), 'utf8');
    console.log(`Saved player data for ${Object.keys(playerData).length} players`);
  } catch (error) {
    console.error('Error saving player data:', error);
  }
}

// Load billboard data from file
function loadBillboardData() {
  try {
    if (fs.existsSync(BILLBOARD_DATA_FILE)) {
      const data = fs.readFileSync(BILLBOARD_DATA_FILE, 'utf8');
      const loadedBillboards = JSON.parse(data);
      
      if (Array.isArray(loadedBillboards)) {
        // Clear existing billboards (not bot billboards)
        billboards.length = 0;
        
        // Filter out bot billboards
        const playerBillboards = loadedBillboards.filter(bb => !bb.id.startsWith('bot_'));
        billboards.push(...playerBillboards);
        
        console.log(`Loaded ${billboards.length} player billboards`);
      } else {
        console.log('Invalid billboard data format, starting with empty billboards');
      }
    } else {
      console.log('No billboard data file found, starting with empty billboards');
      // Create directory if it doesn't exist
      const dir = path.dirname(BILLBOARD_DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Create empty file
      fs.writeFileSync(BILLBOARD_DATA_FILE, JSON.stringify([]), 'utf8');
    }
  } catch (error) {
    console.error('Error loading billboard data:', error);
  }
}

// Save billboard data to file
function saveBillboardData() {
  try {
    // Filter out bot billboards when saving to billboard-data.json
    const playerBillboards = billboards.filter(bb => !bb.id.startsWith('bot_'));
    
    // Create directory if it doesn't exist
    const dir = path.dirname(BILLBOARD_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(BILLBOARD_DATA_FILE, JSON.stringify(playerBillboards, null, 2), 'utf8');
    console.log(`Saved ${playerBillboards.length} player billboards`);
  } catch (error) {
    console.error('Error saving billboard data:', error);
  }
}

// Load bot billboard data from file
function loadBotBillboardData() {
  try {
    if (fs.existsSync(BOT_BILLBOARD_DATA_FILE)) {
      const data = fs.readFileSync(BOT_BILLBOARD_DATA_FILE, 'utf8');
      const loadedBotBillboards = JSON.parse(data);
      
      if (Array.isArray(loadedBotBillboards)) {
        // Clear existing bot billboards
        botBillboards.length = 0;
        
        // Only add billboards with bot_ prefix to ensure data integrity
        const validBotBillboards = loadedBotBillboards.filter(bb => bb.id && bb.id.startsWith('bot_'));
        botBillboards.push(...validBotBillboards);
        
        console.log(`Loaded ${botBillboards.length} bot billboards`);
      } else {
        console.log('Invalid bot billboard data format, starting with empty bot billboards');
      }
    } else {
      console.log('No bot billboard data file found, starting with empty bot billboards');
      // Create directory if it doesn't exist
      const dir = path.dirname(BOT_BILLBOARD_DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Create empty file
      fs.writeFileSync(BOT_BILLBOARD_DATA_FILE, JSON.stringify([]), 'utf8');
    }
  } catch (error) {
    console.error('Error loading bot billboard data:', error);
  }
}

// Save bot billboard data to file
function saveBotBillboardData() {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(BOT_BILLBOARD_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(BOT_BILLBOARD_DATA_FILE, JSON.stringify(botBillboards, null, 2), 'utf8');
    console.log(`Saved ${botBillboards.length} bot billboards`);
  } catch (error) {
    console.error('Error saving bot billboard data:', error);
  }
}

// Try to load saved terrain data or generate new
function initializeTerrainData() {
  try {
    // Check if terrain data file already exists
    if (fs.existsSync(TERRAIN_DATA_FILE)) {
      console.log('Loading terrain data from file');
      const fileData = fs.readFileSync(TERRAIN_DATA_FILE, 'utf8');
      terrainData = JSON.parse(fileData);
      console.log(`Loaded terrain data: ${terrainData.craters.length} craters, ${terrainData.rocks.length} rocks, ${terrainData.towers.length || 0} towers`);
    } else {
      console.log('No terrain data file found, will generate terrain on first request');
      // Create directory if it doesn't exist
      const dir = path.dirname(TERRAIN_DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  } catch (error) {
    console.error('Error loading terrain data:', error);
    console.log('Will generate terrain on first request');
  }
}

// Load powerup configuration
function loadPowerupConfig() {
  try {
    if (fs.existsSync(POWERUP_CONFIG_FILE)) {
      const data = fs.readFileSync(POWERUP_CONFIG_FILE, 'utf8');
      const configData = JSON.parse(data);
      console.log('Loaded raw powerup configuration from file');
      
      // Initialize powerupConfig as an empty object
      powerupConfig = {};
      
      // Convert from the "types" array to a key-value structure
      if (configData.types && Array.isArray(configData.types)) {
        for (const typeConfig of configData.types) {
          if (typeConfig.type) {
            // Use the type field as the key
            powerupConfig[typeConfig.type] = { ...typeConfig };
            
            // Add the check interval from the parent object
            if (configData.checkInterval) {
              powerupConfig[typeConfig.type].checkInterval = configData.checkInterval;
            }
          }
        }
      }
      
      console.log('Processed powerup configuration:', JSON.stringify(powerupConfig, null, 2));
      
      // Initialize powerupsByType structure
      for (const type in powerupConfig) {
        if (!powerupsByType[type]) {
          powerupsByType[type] = [];
        }
      }
    } else {
      console.log('No powerup configuration file found, using defaults');
      powerupConfig = {
        shooting_ammo: {
          weight: 0.6,
          lifespan: 86400000,
          maxPowerups: 30,
          spawnInterval: 3000,
          spawnChance: 0.2,
          minDistance: 25
        },
        billboard_ammo: {
          weight: 0.4,
          lifespan: 86400000,
          maxPowerups: 20,
          spawnInterval: 6000,
          spawnChance: 0.15,
          minDistance: 30
        }
      };
      
      // Initialize powerupsByType structure
      for (const type in powerupConfig) {
        powerupsByType[type] = [];
      }
    }
  } catch (error) {
    console.error('Error loading powerup configuration:', error);
    // Use defaults
    powerupConfig = {
      shooting_ammo: {
        weight: 0.6,
        lifespan: 86400000,
        maxPowerups: 30,
        spawnInterval: 3000,
        spawnChance: 0.2,
        minDistance: 25
      },
      billboard_ammo: {
        weight: 0.4,
        lifespan: 86400000,
        maxPowerups: 20,
        spawnInterval: 6000,
        spawnChance: 0.15,
        minDistance: 30
      }
    };
    
    // Initialize powerupsByType structure
    for (const type in powerupConfig) {
      powerupsByType[type] = [];
    }
  }
}

// Load bot configuration
function loadBotConfig() {
  try {
    if (fs.existsSync(BOT_CONFIG_FILE)) {
      const data = fs.readFileSync(BOT_CONFIG_FILE, 'utf8');
      const loadedConfig = JSON.parse(data);
      // Update our config with loaded values
      Object.assign(botConfig, loadedConfig);
      console.log('Loaded bot configuration from file');
    } else {
      console.log('No bot configuration file found, using defaults');
    }
  } catch (error) {
    console.error('Error loading bot configuration:', error);
    // Continue with defaults
  }
}

// Load powerup data from file
function loadPowerupData() {
  try {
    if (fs.existsSync(POWERUP_DATA_FILE)) {
      const data = fs.readFileSync(POWERUP_DATA_FILE, 'utf8');
      const loadedPowerups = JSON.parse(data);
      
      if (Array.isArray(loadedPowerups)) {
        // Clear existing powerups
        powerups.length = 0;
        
        // Reset powerupsByType
        for (const type in powerupsByType) {
          powerupsByType[type] = [];
        }
        
        // Add current timestamp to each powerup, so we can track lifespan
        const now = Date.now();
        loadedPowerups.forEach(powerup => {
          if (!powerup.spawnTime) {
            powerup.spawnTime = now;
          }
          powerups.push(powerup);
          
          // Also add to by-type collection
          if (powerupsByType[powerup.type]) {
            powerupsByType[powerup.type].push(powerup);
          } else {
            // Initialize if this type doesn't exist yet
            powerupsByType[powerup.type] = [powerup];
          }
        });
        
        console.log(`Loaded ${powerups.length} powerups`);
      } else {
        console.log('Invalid powerup data format, starting with empty powerups');
      }
    } else {
      console.log('No powerup data file found, starting with empty powerups');
      // Create directory if it doesn't exist
      const dir = path.dirname(POWERUP_DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Create empty file
      fs.writeFileSync(POWERUP_DATA_FILE, JSON.stringify([]), 'utf8');
    }
  } catch (error) {
    console.error('Error loading powerup data:', error);
  }
}

// Save powerup data to file
function savePowerupData() {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(POWERUP_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(POWERUP_DATA_FILE, JSON.stringify(powerups, null, 2), 'utf8');
    console.log(`Saved ${powerups.length} powerups`);
  } catch (error) {
    console.error('Error saving powerup data:', error);
  }
}

// Generate a random position on the globe surface
function getRandomPositionOnGlobe() {
  // Use the world radius from CONFIG
  const radius = CONFIG.world.radius || 100;
  
  // Generate random spherical coordinates
  const theta = Math.random() * Math.PI * 2; // 0 to 2π
  const phi = Math.acos(2 * Math.random() - 1); // 0 to π
  
  // Convert to Cartesian coordinates
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  
  return { x, y, z };
}

// Calculate quaternion for proper billboard orientation
function calculateQuaternion(position) {
  // Normalized position vector (direction from center to position) - this is the "up" vector
  const length = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
  const up = {
    x: position.x / length,
    y: position.y / length,
    z: position.z / length
  };
  
  // Find a reference vector different from up
  // Use world up (0,1,0) as the reference unless up is too close to it
  let reference;
  const worldUpDot = Math.abs(up.y); // Dot product with (0,1,0)
  
  if (worldUpDot > 0.9) {
    // If up is too close to world up, use world right instead
    reference = { x: 1, y: 0, z: 0 };
  } else {
    reference = { x: 0, y: 1, z: 0 };
  }
  
  // Calculate right vector (cross product of up and reference)
  const right = {
    x: up.y * reference.z - up.z * reference.y,
    y: up.z * reference.x - up.x * reference.z,
    z: up.x * reference.y - up.y * reference.x
  };
  
  // Normalize right vector
  const rightLength = Math.sqrt(right.x * right.x + right.y * right.y + right.z * right.z);
  const rightNorm = {
    x: right.x / rightLength,
    y: right.y / rightLength,
    z: right.z / rightLength
  };
  
  // Calculate forward vector (cross product of right and up)
  const forward = {
    x: rightNorm.y * up.z - rightNorm.z * up.y,
    y: rightNorm.z * up.x - rightNorm.x * up.z,
    z: rightNorm.x * up.y - rightNorm.y * up.x
  };
  
  // Create a rotation matrix from these three orthogonal vectors
  // Matrix rows are rightNorm, up, forward (for a right-handed coordinate system)
  const rotMatrix = [
    rightNorm.x, up.x, forward.x, 0,
    rightNorm.y, up.y, forward.y, 0,
    rightNorm.z, up.z, forward.z, 0,
    0, 0, 0, 1
  ];
  
  // Convert rotation matrix to quaternion
  const m11 = rotMatrix[0], m12 = rotMatrix[1], m13 = rotMatrix[2];
  const m21 = rotMatrix[4], m22 = rotMatrix[5], m23 = rotMatrix[6];
  const m31 = rotMatrix[8], m32 = rotMatrix[9], m33 = rotMatrix[10];
  
  const trace = m11 + m22 + m33;
  let qx, qy, qz, qw;
  
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    qx = (m32 - m23) * s;
    qy = (m13 - m31) * s;
    qz = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
    qw = (m32 - m23) / s;
    qx = 0.25 * s;
    qy = (m12 + m21) / s;
    qz = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
    qw = (m13 - m31) / s;
    qx = (m12 + m21) / s;
    qy = 0.25 * s;
    qz = (m23 + m32) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
    qw = (m21 - m12) / s;
    qx = (m13 + m31) / s;
    qy = (m23 + m32) / s;
    qz = 0.25 * s;
  }
  
  return { x: qx, y: qy, z: qz, w: qw };
}

// Generate a unique ID for bot billboards
function generateBotId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `bot_${timestamp}_${random}`;
}

// Generate a unique ID for powerups
function generatePowerupId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `powerup_${timestamp}_${random}`;
}

// BOT BILLBOARD SYSTEM //

// Check if more bot billboards need to be spawned
function checkBotBillboards() {
  // Get the current count of bot billboards
  const currentBotCount = botBillboards.length;
  
  console.log(`Checking bot billboards: ${currentBotCount}/${botConfig.maxBots}`);
  
  // If we have more than the maximum, trim the excess billboards
  if (currentBotCount > botConfig.maxBots) {
    console.log(`Found ${currentBotCount} bot billboards, exceeding maximum of ${botConfig.maxBots}`);
    console.log(`Trimming excess bot billboards...`);
    
    // Sort billboards by timestamp (oldest first)
    botBillboards.sort((a, b) => a.timestamp - b.timestamp);
    
    // Keep only the newest up to maxBots
    const excess = botBillboards.splice(0, currentBotCount - botConfig.maxBots);
    console.log(`Removed ${excess.length} excess bot billboards`);
    
    // Update the main billboards array to remove excess bot billboards
    for (const billboard of excess) {
      const index = billboards.findIndex(b => b.id === billboard.id);
      if (index !== -1) {
        billboards.splice(index, 1);
      }
    }
    
    // Save the updated bot billboards
    saveBotBillboardData();
    
    // Stop any active spawning
    if (isSpawningBots) {
      stopSpawningBots();
    }
    
    return;
  }
  
  // If we need to spawn more billboards
  if (currentBotCount < botConfig.maxBots) {
    const botsToSpawn = botConfig.maxBots - currentBotCount;
    console.log(`Need to spawn ${botsToSpawn} more bot billboards`);
    
    // Start spawning bots if not already spawning
    if (!isSpawningBots) {
      startSpawningBots();
    }
  } else {
    console.log('Maximum bot count reached, no new spawns needed');
    
    // Stop any active spawning
    if (isSpawningBots) {
      stopSpawningBots();
    }
  }
}

// Start spawning bots at the specified interval
function startSpawningBots() {
  if (isSpawningBots) return;
  
  console.log(`Starting bot spawning with interval ${botConfig.spawnInterval}ms`);
  isSpawningBots = true;
  
  // Immediately spawn the first bot
  spawnBotBillboard();
  
  // Set up interval for subsequent spawns
  botSpawningTimer = setInterval(() => {
    // Check if we've reached max bots
    if (botBillboards.length >= botConfig.maxBots) {
      console.log('Maximum bot count reached during spawning, stopping');
      stopSpawningBots();
      return;
    }
    
    // Otherwise spawn another bot
    spawnBotBillboard();
  }, botConfig.spawnInterval);
}

// Stop the bot spawning process
function stopSpawningBots() {
  if (!isSpawningBots) return;
  
  console.log('Stopping bot spawning');
  
  if (botSpawningTimer) {
    clearInterval(botSpawningTimer);
    botSpawningTimer = null;
  }
  
  isSpawningBots = false;
}

// Spawn a single bot billboard
function spawnBotBillboard() {
  try {
    // Check if we've reached the maximum before attempting to spawn
    if (botBillboards.length >= botConfig.maxBots) {
      console.log(`Maximum bot count (${botConfig.maxBots}) reached, not spawning a new billboard`);
      
      // Stop the spawning process if it's still running
      if (isSpawningBots) {
        stopSpawningBots();
      }
      
      return null;
    }
    
    // Generate a random position
    const position = getRandomPositionOnGlobe();
    
    // Calculate quaternion for orientation
    const quaternion = calculateQuaternion(position);
    
    // Get random message
    const messages = botConfig.messages || [
      "Mars is mine!", 
      "Bot was here", 
      "Mars billboard"
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    // Get random color
    const colors = botConfig.colors || ["#FF5733", "#33FF57", "#3357FF"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Get random sender
    const senders = botConfig.botSenders || ["MarsBot", "RedRover"];
    const randomSender = senders[Math.floor(Math.random() * senders.length)];
    
    // Get billboard size
    const width = botConfig.billboardSize?.width || 5;
    const height = botConfig.billboardSize?.height || 5;
    
    // Create the billboard data
    const billboardData = {
      id: generateBotId(),
      type: 'billboard_data',
      position: position,
      quaternion: quaternion,
      width: width,
      height: height,
      health: botConfig.health || 100,
      text: randomMessage,
      color: randomColor,
      owner: randomSender,
      player_id: 'bot_system',
      billboard_category: 'bot',
      timestamp: Date.now()
    };
    
    // Add to bot billboards array
    botBillboards.push(billboardData);
    
    // Also add to main billboards array for client syncing
    billboards.push(billboardData);
    
    console.log(`Bot billboard spawned: "${randomMessage}" by ${randomSender} (${botBillboards.length}/${botConfig.maxBots})`);
    
    // Save bot billboards to file
    saveBotBillboardData();
    
    // Broadcast to all connected clients
    broadcastBillboardData(billboardData);
    
    return billboardData;
  } catch (error) {
    console.error('Error spawning bot billboard:', error);
    return null;
  }
}

// POWERUP SYSTEM //

// Start spawning powerups
function startPowerupSystem() {
  console.log('Starting powerup system');
  isSpawningPowerups = true;
  
  // Make sure powerupConfig has the right structure
  console.log('PowerupConfig:', JSON.stringify(powerupConfig, null, 2));
  
  // Valid powerup types
  const validTypes = ['shooting_ammo', 'billboard_ammo'];
  
  // Start spawning for each powerup type
  for (const type of validTypes) {
    if (powerupConfig[type] && powerupConfig[type].spawnInterval) {
      console.log(`Setting up spawning for powerup type: ${type}`);
      startSpawningPowerupOfType(type);
    } else {
      console.warn(`No configuration found for powerup type: ${type}`);
    }
  }
  
  // Set up periodic check for expired powerups
  powerupCheckTimer = setInterval(checkPowerups, 10000); // Check every 10 seconds
}

// Start spawning a specific type of powerup
function startSpawningPowerupOfType(type) {
  const typeConfig = powerupConfig[type];
  if (!typeConfig) {
    console.error(`Powerup type ${type} not found in configuration`);
    return;
  }
  
  // Clear any existing timer
  if (powerupSpawningTimers[type]) {
    clearInterval(powerupSpawningTimers[type]);
  }
  
  console.log(`Starting to spawn powerups of type ${type} every ${typeConfig.spawnInterval}ms`);
  
  // Immediately spawn first powerup
  const randomChance = Math.random();
  if (randomChance < (typeConfig.spawnChance || 0.2)) {
    spawnPowerupOfType(type);
  }
  
  // Set up interval for subsequent spawns
  powerupSpawningTimers[type] = setInterval(() => {
    // Check if we've reached max count for this type
    const currentCount = powerupsByType[type]?.length || 0;
    const maxCount = typeConfig.maxPowerups || 10;
    
    if (currentCount >= maxCount) {
      console.log(`Maximum ${type} powerup count (${maxCount}) reached, skipping spawn`);
      return;
    }
    
    // Apply spawn chance
    const randomChance = Math.random();
    if (randomChance < (typeConfig.spawnChance || 0.2)) {
      spawnPowerupOfType(type);
    }
  }, typeConfig.spawnInterval);
}

// Spawn a powerup of a specific type
function spawnPowerupOfType(type) {
  try {
    const typeConfig = powerupConfig[type];
    if (!typeConfig) {
      console.error(`Powerup type ${type} not found in configuration`);
      return null;
    }
    
    // Check if we've reached the maximum for this type
    const currentCount = powerupsByType[type]?.length || 0;
    const maxCount = typeConfig.maxPowerups || 10;
    
    if (currentCount >= maxCount) {
      console.log(`Maximum ${type} powerup count (${maxCount}) reached, not spawning`);
      return null;
    }
    
    // Generate a random position
    const basePosition = getRandomPositionOnGlobe();
    
    // Make powerups float 2 units above the surface
    const length = Math.sqrt(
      basePosition.x * basePosition.x + 
      basePosition.y * basePosition.y + 
      basePosition.z * basePosition.z
    );
    
    const normalVector = {
      x: basePosition.x / length,
      y: basePosition.y / length,
      z: basePosition.z / length
    };
    
    const floatHeight = 2.0;
    const position = {
      x: basePosition.x + normalVector.x * floatHeight,
      y: basePosition.y + normalVector.y * floatHeight,
      z: basePosition.z + normalVector.z * floatHeight
    };
    
    // Calculate quaternion for orientation
    const quaternion = calculateQuaternion(position);
    
    // Create the powerup data
    const powerupData = {
      id: generatePowerupId(),
      type: type,
      position: position,
      quaternion: quaternion,
      size: typeConfig.size || 1.5,
      color: typeConfig.color || "#FFFF00",
      lifespan: typeConfig.lifespan || 86400000, // 1 minute default
      spawnTime: Date.now(),
      isCollected: false
    };
    
    // Add to powerups array
    powerups.push(powerupData);
    
    // Add to type-specific collection
    if (!powerupsByType[type]) {
      powerupsByType[type] = [];
    }
    powerupsByType[type].push(powerupData);
    
    console.log(`Spawned ${type} powerup (${currentCount + 1}/${maxCount})`);
    
    // Save to file
    savePowerupData();
    
    // Broadcast to all clients
    broadcastPowerupData(powerupData);
    
    return powerupData;
  } catch (error) {
    console.error(`Error spawning ${type} powerup:`, error);
    return null;
  }
}

// Check powerups for expiration and count
function checkPowerups() {
  const now = Date.now();
  const expiredPowerups = [];
  
  // Check each powerup for expiration
  for (let i = powerups.length - 1; i >= 0; i--) {
    const powerup = powerups[i];
    
    // Skip if no lifespan or no spawn time
    if (!powerup.lifespan || !powerup.spawnTime) continue;
    
    // Check if expired
    if (now - powerup.spawnTime > powerup.lifespan) {
      expiredPowerups.push(powerup);
      powerups.splice(i, 1);
      
      // Also remove from type-specific collection
      if (powerupsByType[powerup.type]) {
        const typeIndex = powerupsByType[powerup.type].findIndex(p => p.id === powerup.id);
        if (typeIndex !== -1) {
          powerupsByType[powerup.type].splice(typeIndex, 1);
        }
      }
    }
  }
  
  // If any powerups expired, save and notify clients
  if (expiredPowerups.length > 0) {
    console.log(`Removed ${expiredPowerups.length} expired powerups`);
    savePowerupData();
    
    // Broadcast removals
    expiredPowerups.forEach(powerup => {
      broadcastPowerupRemoval(powerup.id);
    });
  }
  
  // Valid powerup types
  const validTypes = ['shooting_ammo', 'billboard_ammo'];
  
  // Check if we need to spawn more of each type
  for (const type of validTypes) {
    const typeConfig = powerupConfig[type];
    if (!typeConfig) continue;
    
    const currentCount = powerupsByType[type]?.length || 0;
    const maxCount = typeConfig.maxPowerups || 10;
    
    if (currentCount < maxCount && !powerupSpawningTimers[type]) {
      // Start spawning this type if not already spawning
      startSpawningPowerupOfType(type);
    }
  }
}

// Broadcast billboard data to all connected clients
function broadcastBillboardData(billboardData) {
  wsServer.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(billboardData));
    }
  });
}

// Broadcast powerup data to all connected clients
function broadcastPowerupData(powerupData) {
  wsServer.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(powerupData));
    }
  });
}

// Setup WebSocket connection handling
wsServer.on('connection', (socket) => {
  console.log('Player connected');

  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message type:', data.type);

      // Handle different message types
      if (data.type === 'billboard_data') {
        // Check if this is a bot billboard by the ID prefix
        const isBotBillboard = data.id && data.id.startsWith('bot_');
        
        // Store billboard data for future players
        const existingIndex = billboards.findIndex(b => b.id === data.id);
        if (existingIndex !== -1) {
          // Update existing billboard but preserve original text and owner if not a bot update
          if (!isBotBillboard) {
            const originalText = billboards[existingIndex].text;
            const originalOwner = billboards[existingIndex].owner;
            
            // Store the updated data but preserve text and owner
            billboards[existingIndex] = {
              ...billboards[existingIndex],
              ...data,
              // Keep original text and owner
              text: originalText,
              owner: originalOwner
            };
            
            console.log(`Updated player billboard ${data.id} in server storage (preserved text and owner)`);
          } else {
            // For bot billboards, update everything
            billboards[existingIndex] = {
              ...data
            };
            
            console.log(`Updated bot billboard ${data.id} in server storage`);
            
            // Also update in the bot billboards array
            const botIndex = botBillboards.findIndex(b => b.id === data.id);
            if (botIndex !== -1) {
              botBillboards[botIndex] = { ...data };
            }
          }
          
          // Log health update if it changed
          if (data.health !== undefined && billboards[existingIndex].health !== data.health) {
            console.log(`Billboard ${data.id} health updated to: ${data.health}`);
          }
          
          // Save billboard data when health changes
          if (data.health !== undefined) {
            // Save periodically to avoid too frequent writes
            if (Math.random() < 0.3) { // 30% chance to save on update
              // Only save to billboard-data.json if it's a player billboard
              if (!isBotBillboard) {
                saveBillboardData();
              }
              
              // If it's a bot billboard, only save bot data
              if (isBotBillboard) {
                saveBotBillboardData();
              }
            }
          }
        } else {
          // Add new billboard
          billboards.push(data);
          console.log(`Added new billboard ${data.id} to server storage`);
          
          // If it's a bot billboard, also add to bot billboards
          if (isBotBillboard) {
            botBillboards.push(data);
            console.log(`Added new bot billboard ${data.id} to bot storage`);
          }
          
          // Save billboard data when a new billboard is added - only for player billboards
          if (!isBotBillboard) {
            saveBillboardData();
          }
          
          // If it's a bot billboard, only save bot data
          if (isBotBillboard) {
            saveBotBillboardData();
          }
        }
        
        // Broadcast the billboard update to all other clients with consistent naming
        const broadcastData = {
          type: 'billboard_data',
          ...data
        };
        
        wsServer.clients.forEach(client => {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(broadcastData));
          }
        });
      } 
      else if (data.type === 'billboard_remove') {
        // Check if this is a bot billboard by the ID prefix
        const isBotBillboard = data.id && data.id.startsWith('bot_');
        
        // Remove billboard from stored list
        const index = billboards.findIndex(b => b.id === data.id);
        if (index !== -1) {
          billboards.splice(index, 1);
          console.log(`Removed billboard ${data.id} from server storage`);
          
          // If it's a bot billboard, also remove from bot billboards
          if (isBotBillboard) {
            const botIndex = botBillboards.findIndex(b => b.id === data.id);
            if (botIndex !== -1) {
              botBillboards.splice(botIndex, 1);
              console.log(`Removed bot billboard ${data.id} from bot storage`);
            }
          }
          
          // Save billboard data when a billboard is removed - only for player billboards
          if (!isBotBillboard) {
            saveBillboardData();
          }
          
          // If it's a bot billboard, only save bot data
          if (isBotBillboard) {
            saveBotBillboardData();
          }
          
          // Broadcast removal to all other clients with the expected "billboard_removed" type
          const removalData = {
            type: 'billboard_removed',  // Note: Changed from 'billboard_remove' to 'billboard_removed'
            id: data.id,
            timestamp: Date.now()
          };
          
          wsServer.clients.forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(removalData));
            }
          });
        }
      }
      // Handle player data persistence
      else if (data.type === 'player_save_data') {
        if (data.playerId) {
          // Store the player data
          playerData[data.playerId] = {
            username: data.username,
            billboardText: data.billboardText,
            position: data.position,
            shootingAmmo: data.shootingAmmo,
            billboardAmmo: data.billboardAmmo,
            lastUpdate: Date.now()
          };
          
          console.log(`Saved data for player ${data.playerId}`);
          
          // Save to file periodically (not on every update to avoid I/O overhead)
          // In this case, we'll save every 5th update
          if (Math.random() < 0.2) {
            savePlayerData();
          }
        }
      }
      else if (data.type === 'player_save_ammo') {
        if (data.playerId && playerData[data.playerId]) {
          // Update just the ammo values
          playerData[data.playerId].shootingAmmo = data.shootingAmmo;
          playerData[data.playerId].billboardAmmo = data.billboardAmmo;
          playerData[data.playerId].lastUpdate = Date.now();
          
          console.log(`Updated ammo for player ${data.playerId}`);
        }
      }
      else if (data.type === 'player_save_billboard_text') {
        if (data.playerId && playerData[data.playerId]) {
          // Update just the billboard text
          playerData[data.playerId].billboardText = data.billboardText;
          playerData[data.playerId].lastUpdate = Date.now();
          
          console.log(`Updated billboard text for player ${data.playerId}`);
          
          // Save to file when billboard text changes as it's less frequent
          savePlayerData();
        }
      }
      else if (data.type === 'player_load_data') {
        if (data.playerId) {
          // Look up player data
          const playerInfo = playerData[data.playerId];
          
          // Send response back to client
          const response = {
            type: 'player_data_response',
            playerId: data.playerId,
            found: !!playerInfo
          };
          
          // If player data exists, include it
          if (playerInfo) {
            response.username = playerInfo.username;
            response.billboardText = playerInfo.billboardText;
            response.position = playerInfo.position;
            response.shootingAmmo = playerInfo.shootingAmmo;
            response.billboardAmmo = playerInfo.billboardAmmo;
            
            console.log(`Sent data for player ${data.playerId}`);
          } else {
            console.log(`No data found for player ${data.playerId}`);
          }
          
          socket.send(JSON.stringify(response));
        }
      }
      else if (data.type === 'request_terrain_data') {
        // If we don't have terrain data yet, this would be generated by the first player
        // In a production environment, you'd want to pre-generate this during server startup
        if (!terrainData) {
          console.log('No terrain data exists yet - server would request generation from client');
          // In a real implementation, you would generate the terrain here
          // or already have it generated at server start
          
          // For demo purposes, create dummy data that will be populated by first client
          terrainData = {
            seed: CONFIG.world.terrainSeed,
            craters: [],
            rocks: [],
            towers: []
          };
        }
        
        // Send terrain data to the requesting client
        const response = {
          type: 'terrain_data',
          terrainData: terrainData
        };
        socket.send(JSON.stringify(response));
        console.log('Sent terrain data to requesting client');
      }
      else if (data.type === 'terrain_data_update') {
        // First client is providing generated terrain data to the server
        if (data.terrainData && (!terrainData || terrainData.craters.length === 0)) {
          console.log('Received terrain data from client - saving for future clients');
          terrainData = data.terrainData;
          
          // Save to file for persistence
          try {
            fs.writeFileSync(
              path.join(__dirname, 'terrain-data.json'), 
              JSON.stringify(terrainData, null, 2),
              'utf8'
            );
            console.log('Terrain data saved to file');
          } catch (error) {
            console.error('Error saving terrain data:', error);
          }
        }
      }
      else if (data.type === 'powerup_collected') {
        // Process powerup collection
        const powerupId = data.powerupId;
        const playerId = data.playerId;
        
        console.log(`[DEBUG SERVER] Player ${playerId} collected powerup ${powerupId}`);
        
        // Find the powerup in our array
        const powerupIndex = powerups.findIndex(p => p.id === powerupId);
        
        if (powerupIndex !== -1) {
          // Get the powerup data
          const powerup = powerups[powerupIndex];
          
          console.log(`[DEBUG SERVER] Found powerup ${powerupId} at index ${powerupIndex}, type: ${powerup.type}`);
          
          // Mark as collected
          powerup.isCollected = true;
          powerup.collectedBy = playerId;
          powerup.collectedAt = Date.now();
          
          // Remove from the main array
          powerups.splice(powerupIndex, 1);
          console.log(`[DEBUG SERVER] Removed powerup ${powerupId} from main powerups array`);
          
          // Also remove from type-specific array
          if (powerupsByType[powerup.type]) {
            const typeIndex = powerupsByType[powerup.type].findIndex(p => p.id === powerupId);
            if (typeIndex !== -1) {
              powerupsByType[powerup.type].splice(typeIndex, 1);
              console.log(`[DEBUG SERVER] Removed powerup ${powerupId} from ${powerup.type} type-specific array`);
            } else {
              console.warn(`[DEBUG SERVER] Powerup ${powerupId} not found in ${powerup.type} type-specific array`);
            }
          }
          
          console.log(`[DEBUG SERVER] Removed powerup ${powerupId} from server (collected by ${playerId})`);
          
          // Save updated powerup data
          console.log(`[DEBUG SERVER] Saving updated powerups-data.json (${powerups.length} powerups remaining)`);
          savePowerupData();
          
          // Broadcast removal to all clients
          console.log(`[DEBUG SERVER] Broadcasting removal of powerup ${powerupId} to all clients`);
          broadcastPowerupRemoval(powerupId);
        } else {
          console.warn(`[DEBUG SERVER] Powerup ${powerupId} not found for collection by ${playerId}`);
        }
      }
      // Handle request_billboards message
      else if (data.type === 'request_billboards') {
        // Ensure that bot billboards are included in the billboards array
        // First, check if we might be missing some bot billboards
        for (const botBillboard of botBillboards) {
          const found = billboards.some(b => b.id === botBillboard.id);
          if (!found) {
            console.log(`Adding missing bot billboard ${botBillboard.id} to main billboards array`);
            billboards.push(botBillboard);
          }
        }
        
        // Send all stored billboards to the requesting client
        const response = {
          type: 'all_billboards',
          billboards: billboards
        };
        socket.send(JSON.stringify(response));
        
        // Log details about what we're sending for debugging
        const botCount = billboards.filter(b => b.id && b.id.startsWith('bot_')).length;
        const playerCount = billboards.length - botCount;
        console.log(`Sent ${billboards.length} billboards to requesting client (${playerCount} player, ${botCount} bot)`);
      }
      // Handle request_powerups message
      else if (data.type === 'request_powerups') {
        // Send all stored powerups to the requesting client
        const response = {
          type: 'all_powerups',
          powerups: powerups
        };
        socket.send(JSON.stringify(response));
        
        console.log(`Sent ${powerups.length} powerups to requesting client`);
      }

      // Broadcast the general message to all other clients for other message types
      // But don't broadcast billboard data or removals that are already handled above
      if (data.type !== 'billboard_data' && data.type !== 'billboard_remove') {
        wsServer.clients.forEach(client => {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            // Ensure we're sending a string, not a raw message object
            if (typeof message === 'string') {
              client.send(message);
            } else {
              // If it's not a string (perhaps an object), stringify it
              try {
                client.send(JSON.stringify(message));
              } catch (error) {
                console.error('Error stringifying message for broadcast:', error);
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  socket.on('close', () => {
    console.log('Player disconnected');
  });
});

// Broadcast powerup data to all connected clients
function broadcastPowerupRemoval(powerupId) {
  console.log(`[DEBUG SERVER] Broadcasting powerup removal for ID: ${powerupId} to all clients`);
  
  const removalData = {
    type: 'powerup_removed',
    id: powerupId
  };
  
  let clientCount = 0;
  wsServer.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(removalData));
      clientCount++;
    }
  });
  
  console.log(`[DEBUG SERVER] Sent powerup_removed message to ${clientCount} connected clients`);
}

// Start the server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on same port`);
  
  // Load data
  loadPlayerData();
  loadBillboardData();
  loadBotBillboardData();
  loadBotConfig();
  loadPowerupConfig();
  loadPowerupData();
  initializeTerrainData();
  
  // Start bot billboard system
  console.log('Starting bot billboard system...');
  botCheckTimer = setInterval(checkBotBillboards, botConfig.checkInterval || 30000);
  checkBotBillboards(); // Initial check
  
  // Start powerup system
  console.log('Starting powerup system...');
  startPowerupSystem();
});