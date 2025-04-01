#!/bin/bash

# Text colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Vandals on Mars Server Starter ===${NC}"

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
if [ ! -d "node_modules" ] || [ ! -d "node_modules/express" ] || [ ! -d "node_modules/ws" ] || [ ! -d "node_modules/dotenv" ]; then
    echo -e "${YELLOW}Installing or repairing dependencies...${NC}"
    npm install express ws dotenv
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
    echo -e "${GREEN}✓ WebSocket server stopped${NC}"
else
    echo -e "${GREEN}✓ No WebSocket server was running${NC}"
fi

# Kill HTTP server
if pgrep -f "http-server" > /dev/null; then
    pkill -f "http-server"
    echo -e "${GREEN}✓ HTTP server stopped${NC}"
else
    echo -e "${GREEN}✓ No HTTP server was running${NC}"
fi

# Add a small delay to ensure ports are freed
sleep 1

# Start WebSocket server
echo -e "${YELLOW}Starting Express/WebSocket server...${NC}"
node server.js &
SERVER_PID=$!

# Check if server started successfully
sleep 2
if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}✓ Server started successfully (PID: $SERVER_PID)${NC}"
else
    echo -e "${RED}✗ Server failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}=== Server started successfully ===${NC}"
echo -e "${YELLOW}Game is available at:${NC} http://localhost:${PORT}"
echo -e "${YELLOW}WebSocket server running on:${NC} ws://localhost:${PORT}"
echo -e "${YELLOW}Important:${NC} Make sure 'auto' is selected in config.json for WebSocket URL"
echo -e "${YELLOW}To stop the server, run:${NC} pkill -f \"node server.js\""
echo ""
echo -e "${YELLOW}Leave this terminal window open. Press Ctrl+C to stop the server.${NC}"

# Keep the script running to make it easier to stop servers with Ctrl+C
wait % 