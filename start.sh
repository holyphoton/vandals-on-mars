#!/bin/bash

# Text colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Vandals on Mars Server Starter ===${NC}"

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
echo -e "${YELLOW}Starting WebSocket server...${NC}"
node server.js &
WEBSOCKET_PID=$!

# Check if WebSocket server started successfully
sleep 2
if ps -p $WEBSOCKET_PID > /dev/null; then
    echo -e "${GREEN}✓ WebSocket server started successfully (PID: $WEBSOCKET_PID)${NC}"
else
    echo -e "${RED}✗ WebSocket server failed to start${NC}"
    exit 1
fi

# Start HTTP server with no cache
echo -e "${YELLOW}Starting HTTP server...${NC}"
npx http-server code -c-1 -p 8081 &
HTTP_PID=$!

# Check if HTTP server started successfully
sleep 2
if ps -p $HTTP_PID > /dev/null; then
    echo -e "${GREEN}✓ HTTP server started successfully (PID: $HTTP_PID)${NC}"
else
    echo -e "${RED}✗ HTTP server failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}=== All servers started successfully ===${NC}"
echo -e "${YELLOW}Game is available at:${NC} http://localhost:8081"
echo -e "${YELLOW}WebSocket server running on port:${NC} 8090"
echo -e "${YELLOW}To stop all servers, run:${NC} pkill -f \"node server.js\" && pkill -f \"http-server\""
echo ""
echo -e "${YELLOW}Leave this terminal window open. Press Ctrl+C to stop all servers.${NC}"

# Keep the script running to make it easier to stop servers with Ctrl+C
wait 