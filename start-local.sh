#!/bin/bash

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create data directory if it doesn't exist
mkdir -p data

# Start the server in development mode
echo "Starting server in development mode..."
npm run dev 