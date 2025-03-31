const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8090 });
const fs = require('fs');
const path = require('path');

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
const PLAYER_DATA_FILE = path.join(__dirname, 'player-data.json');

// Billboard data file path
const BILLBOARD_DATA_FILE = path.join(__dirname, 'billboard-data.json');

// Bot billboard data file path
const BOT_BILLBOARD_DATA_FILE = path.join(__dirname, 'billboard-data-bots.json');

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
    }
  } catch (error) {
    console.error('Error loading player data:', error);
  }
}

// Save player data to file
function savePlayerData() {
  try {
    fs.writeFileSync(
      PLAYER_DATA_FILE,
      JSON.stringify(playerData, null, 2),
      'utf8'
    );
    console.log('Player data saved to file');
  } catch (error) {
    console.error('Error saving player data:', error);
  }
}

// Load saved billboard data from file
function loadBillboardData() {
  try {
    if (fs.existsSync(BILLBOARD_DATA_FILE)) {
      const data = fs.readFileSync(BILLBOARD_DATA_FILE, 'utf8');
      const parsedData = JSON.parse(data);
      
      // Clear existing billboards and load from file
      billboards.length = 0;
      
      // Copy all billboards from file
      parsedData.forEach(billboard => {
        // Only add non-bot billboards to the billboards array
        if (!billboard.id || !billboard.id.startsWith('bot_')) {
          billboards.push(billboard);
        }
      });
      
      console.log(`Loaded ${billboards.length} player billboards from file`);
    } else {
      console.log('No billboard data file found, starting with empty billboards');
    }
  } catch (error) {
    console.error('Error loading billboard data:', error);
  }
}

// Save billboard data to file
function saveBillboardData() {
  try {
    // Filter out any bot billboards before saving to billboard-data.json
    const playerBillboards = billboards.filter(billboard => 
      !billboard.id || !billboard.id.startsWith('bot_')
    );
    
    fs.writeFileSync(
      BILLBOARD_DATA_FILE,
      JSON.stringify(playerBillboards, null, 2),
      'utf8'
    );
    console.log('Player billboard data saved to file');
  } catch (error) {
    console.error('Error saving billboard data:', error);
  }
}

// Load saved bot billboard data from file
function loadBotBillboardData() {
  try {
    if (fs.existsSync(BOT_BILLBOARD_DATA_FILE)) {
      const data = fs.readFileSync(BOT_BILLBOARD_DATA_FILE, 'utf8');
      const parsedData = JSON.parse(data);
      
      // Clear existing bot billboards and load from file
      botBillboards.length = 0;
      
      // Copy all bot billboards from file
      parsedData.forEach(billboard => {
        botBillboards.push(billboard);
      });
      
      console.log(`Loaded ${botBillboards.length} bot billboards from file`);
    } else {
      console.log('No bot billboard data file found, starting with empty bot billboards');
    }
  } catch (error) {
    console.error('Error loading bot billboard data:', error);
  }
}

// Save bot billboard data to file
function saveBotBillboardData() {
  try {
    fs.writeFileSync(
      BOT_BILLBOARD_DATA_FILE,
      JSON.stringify(botBillboards, null, 2),
      'utf8'
    );
    console.log('Bot billboard data saved to file');
  } catch (error) {
    console.error('Error saving bot billboard data:', error);
  }
}

// Try to load saved terrain data or generate new
function initializeTerrainData() {
  const terrainFilePath = path.join(__dirname, 'terrain-data.json');
  
  try {
    // Check if terrain data file already exists
    if (fs.existsSync(terrainFilePath)) {
      console.log('Loading terrain data from file');
      const fileData = fs.readFileSync(terrainFilePath, 'utf8');
      terrainData = JSON.parse(fileData);
      console.log(`Loaded terrain data: ${terrainData.craters.length} craters, ${terrainData.rocks.length} rocks, ${terrainData.towers.length || 0} towers`);
    } else {
      console.log('No terrain data file found, will generate terrain on first request');
    }
  } catch (error) {
    console.error('Error loading terrain data:', error);
    console.log('Will generate terrain on first request');
  }
}

// Load bot configuration from the bot-config.json file
async function loadBotConfig() {
  try {
    const configFilePath = path.join(__dirname, 'code', 'bot-config.json');
    if (fs.existsSync(configFilePath)) {
      const data = fs.readFileSync(configFilePath, 'utf8');
      const parsedConfig = JSON.parse(data);
      
      // Update the bot configuration
      botConfig = {
        spawnInterval: parsedConfig.spawnInterval || 2000,
        maxBots: parsedConfig.maxBots || 20,
        spawnChance: parsedConfig.spawnChance || 0.3,
        minDistance: parsedConfig.minDistance || 20,
        checkInterval: parsedConfig.checkInterval || 3000,
        messages: parsedConfig.messages || [],
        botSenders: parsedConfig.botSenders || [],
        colors: parsedConfig.colors || ["#FF5733", "#33FF57", "#3357FF"],
        billboardSize: parsedConfig.billboardSize || { width: 5, height: 5 },
        health: parsedConfig.health || 100
      };
      
      console.log('Bot configuration loaded successfully:');
      console.log(`- Maximum bots: ${botConfig.maxBots}`);
      console.log(`- Check interval: ${botConfig.checkInterval}ms`);
      console.log(`- Spawn interval: ${botConfig.spawnInterval}ms`);
      
      return botConfig;
    } else {
      console.warn('Bot configuration file not found, using defaults');
      return botConfig;
    }
  } catch (error) {
    console.error('Error loading bot configuration:', error);
    return botConfig;
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
  
  // Use a similar approach to what's done in the client-side placeBillboard method
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
  // This is similar to THREE.Matrix4().makeBasis() on the client
  // Matrix rows are rightNorm, up, forward (for a right-handed coordinate system)
  const rotMatrix = [
    rightNorm.x, up.x, forward.x, 0,
    rightNorm.y, up.y, forward.y, 0,
    rightNorm.z, up.z, forward.z, 0,
    0, 0, 0, 1
  ];
  
  // Convert rotation matrix to quaternion using the same algorithm as THREE.js
  // Algorithm from http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/
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
  
  return {
    x: qx,
    y: qy,
    z: qz,
    w: qw
  };
}

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

// Generate a unique ID for bot billboards
function generateBotId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `bot_${timestamp}_${random}`;
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

// Broadcast billboard data to all connected clients
function broadcastBillboardData(billboardData) {
  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(billboardData));
    }
  });
}

// Initialize terrain data and player data at server startup
initializeTerrainData();
loadPlayerData();
loadBillboardData(); // Load billboard data on startup
loadBotBillboardData(); // Load bot billboard data on startup

// Load bot configuration and start bot management
(async function initializeBotSystem() {
  await loadBotConfig();
  
  // Set up periodic checking for bot billboards
  botCheckTimer = setInterval(checkBotBillboards, botConfig.checkInterval);
  
  // Perform initial check
  checkBotBillboards();
})();

// Log server startup
console.log('WebSocket server running on port 8090');
console.log(`Terrain seed: ${CONFIG.world.terrainSeed}`);

// Create a simple HTTP server for handling bot billboard saving
const http = require('http');
const url = require('url');

const httpServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight CORS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Handle save-bot-billboards endpoint
  if (parsedUrl.pathname === '/save-bot-billboards' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        // Update bot billboards
        botBillboards.length = 0;
        data.forEach(billboard => {
          botBillboards.push(billboard);
        });
        
        // Save to bot billboard file
        saveBotBillboardData();
        
        // Add bot billboards to the main billboards array for sync
        // but don't save them to billboard-data.json
        data.forEach(botBillboard => {
          const existingIndex = billboards.findIndex(b => b.id === botBillboard.id);
          if (existingIndex !== -1) {
            billboards[existingIndex] = botBillboard;
          } else {
            billboards.push(botBillboard);
          }
        });
        
        // No need to save the main billboard data as we don't want bots there
        // saveBillboardData();  <-- This line is removed
        
        // Send success response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: botBillboards.length }));
      } catch (error) {
        console.error('Error saving bot billboards:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  }
  // Serve bot-config.json
  else if (parsedUrl.pathname === '/bot-config.json' && req.method === 'GET') {
    try {
      const configFilePath = path.join(__dirname, 'code', 'bot-config.json');
      if (fs.existsSync(configFilePath)) {
        const data = fs.readFileSync(configFilePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Bot configuration not found' }));
      }
    } catch (error) {
      console.error('Error serving bot config:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }
  else {
    // Handle 404 for other endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
  }
});

// Start HTTP server for bot billboard handling on port 8091
httpServer.listen(8091, () => {
  console.log('HTTP server for bot billboard management running on port 8091');
});

// WebSocket server
server.on('connection', (socket) => {
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
      else if (data.type === 'request_billboards') {
        // Send all stored billboards to the requesting client
        const response = {
          type: 'all_billboards',
          billboards: billboards
        };
        socket.send(JSON.stringify(response));
        console.log(`Sent ${billboards.length} billboards to requesting client`);
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