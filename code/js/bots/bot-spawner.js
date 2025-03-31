/**
 * Creates a billboard with bot data
 * @param {Object} botData - The bot data for the billboard
 */
createBotBillboard(botData) {
    if (!this.weaponManager || !this.weaponManager.billboardGun) {
        console.error("No weapon manager or billboard gun available");
        return;
    }
    
    console.log(`Creating bot billboard at position: ${JSON.stringify(botData.position)}`);
    
    // Get configuration values
    const startSize = CONFIG.billboard?.startSize || 5;
    const startHealth = CONFIG.billboard?.startHealth || 100;
    
    // Create billboard data
    const billboardData = {
        id: botData.id,
        type: 'billboard_data',
        position: botData.position,
        quaternion: botData.quaternion,
        width: botData.width || this.config.billboardSize?.width || startSize,
        height: botData.height || this.config.billboardSize?.height || startSize,
        health: botData.health || this.config.health || startHealth,
        text: botData.text,
        owner: 'Bot',
        player_id: 'bot_system',
        billboard_category: 'bot',
        timestamp: Date.now()
    };
    
    // Create the billboard using the billboard gun's method
    const billboard = this.weaponManager.billboardGun.createBillboardFromData(billboardData);
    
    // Add to spawned bot billboards
    if (billboard) {
        this.spawnedBillboards.push(billboard);
        console.log(`Bot billboard ${billboardData.id} created successfully`);
        return billboard;
    } else {
        console.error(`Failed to create bot billboard ${billboardData.id}`);
        return null;
    }
}

/**
 * Spawns a single bot billboard at a random position
 */
spawnBotBillboard() {
    // Check if maximum bot count is reached
    if (this.spawnedBillboards.length >= this.config.maxBots) {
        console.log(`Max bot count (${this.config.maxBots}) reached, not spawning`);
        return false;
    }
    
    // Generate a random position on the globe
    const position = this.getRandomGlobePosition();
    if (!position) {
        console.error("Failed to generate random position for bot billboard");
        return false;
    }
    
    // Get a random message from config
    const message = this.getRandomBotMessage();
    
    // Generate a random color from config
    const color = this.getRandomBotColor();
    
    // Generate a unique ID for the bot billboard
    const id = this.generateBotBillboardId();
    
    // Create a quaternion for the billboard
    const quaternion = this.calculateBillboardQuaternion(position);
    
    // Get the billboard size from config, or use default if not specified
    const width = this.config.billboardSize?.width || 4;
    const height = this.config.billboardSize?.height || 3;
    const health = this.config.health || 100;
    
    // Create the bot data
    const botData = {
        id,
        position,
        quaternion,
        text: message,
        color,
        width,
        height,
        health
    };
    
    // Create the billboard
    const billboard = this.createBotBillboard(botData);
    if (billboard) {
        console.log(`Bot billboard spawned at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        
        // Sync with all clients
        this.syncBotBillboards();
        
        return true;
    }
    
    return false;
} 