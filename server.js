const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

// Get port from environment variable or use default
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8090;

// Get data directory from environment variable or use current directory
const DATA_DIR = process.env.DATA_DIR || __dirname;

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
      powerupConfig = JSON.parse(data);
      console.log('Loaded powerup configuration from file');
      
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
          lifespan: 60000,
          maxPowerups: 30,
          spawnInterval: 3000,
          spawnChance: 0.2,
          minDistance: 25
        },
        billboard_ammo: {
          weight: 0.4,
          lifespan: 60000,
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
        lifespan: 60000,
        maxPowerups: 30,
        spawnInterval: 3000,
        spawnChance: 0.2,
        minDistance: 25
      },
      billboard_ammo: {
        weight: 0.4,
        lifespan: 60000,
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
        
        server.clients.forEach(client => {
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
          
          server.clients.forEach(client => {
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
        server.clients.forEach(client => {
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
  // ... bot billboard code ...
  
  // Start powerup system
  // ... powerup code ...
});