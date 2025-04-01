#!/bin/bash

# Text colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Vandals on Mars Development Server Starter ===${NC}"

# Create data directory if it doesn't exist
echo -e "${YELLOW}Checking data directory...${NC}"
if [ ! -d "data" ]; then
    mkdir -p data
    echo -e "${GREEN}✓ Created data directory${NC}"
else
    echo -e "${GREEN}✓ Data directory already exists${NC}"
fi

# Install dependencies if needed
echo -e "${YELLOW}Checking dependencies...${NC}"
if [ ! -d "node_modules" ] || [ ! -d "node_modules/express" ] || [ ! -d "node_modules/ws" ] || [ ! -d "node_modules/dotenv" ] || [ ! -d "node_modules/nodemon" ]; then
    echo -e "${YELLOW}Installing or repairing dependencies...${NC}"
    npm install express ws dotenv
    npm install --save-dev nodemon
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Set environment variables for local development
export PORT=3000
export DATA_DIR="./data"
echo -e "${GREEN}✓ Environment configured: PORT=$PORT, DATA_DIR=$DATA_DIR${NC}"

# Kill any existing server processes
echo -e "${YELLOW}Stopping any existing server processes...${NC}"

# Kill WebSocket server
if pgrep -f "node server.js" > /dev/null; then
    pkill -f "node server.js"
    echo -e "${GREEN}✓ Server stopped${NC}"
elif pgrep -f "nodemon server.js" > /dev/null; then
    pkill -f "nodemon server.js"
    echo -e "${GREEN}✓ Development server stopped${NC}"
else
    echo -e "${GREEN}✓ No server was running${NC}"
fi

# Add a small delay to ensure ports are freed
sleep 1

# Start server with nodemon for automatic reloading
echo -e "${YELLOW}Starting development server with auto-reload...${NC}"
echo -e "${YELLOW}Any changes to server files will automatically restart the server${NC}"

npx nodemon server.js

echo -e "${GREEN}=== Server stopped ===${NC}" 