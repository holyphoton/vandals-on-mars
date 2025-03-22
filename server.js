const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8090 });

// Store all billboards to send to new players
const billboards = [];

server.on('connection', (socket) => {
  console.log('Player connected');

  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message type:', data.type);

      // Handle different message types
      if (data.type === 'billboard_data') {
        // Store billboard data for future players
        const existingIndex = billboards.findIndex(b => b.id === data.id);
        if (existingIndex !== -1) {
          // Update existing billboard but preserve original text and owner
          const originalText = billboards[existingIndex].text;
          const originalOwner = billboards[existingIndex].owner;
          
          billboards[existingIndex] = {
            ...billboards[existingIndex],
            ...data,
            // Keep original text and owner
            text: originalText,
            owner: originalOwner
          };
        } else {
          // Add new billboard
          billboards.push(data);
        }
      } 
      else if (data.type === 'billboard_remove') {
        // Remove billboard from stored list
        const index = billboards.findIndex(b => b.id === data.id);
        if (index !== -1) {
          billboards.splice(index, 1);
          console.log(`Removed billboard ${data.id} from server storage`);
        }
      }
      else if (data.type === 'request_billboards') {
        // Send all stored billboards to the requesting client
        const response = {
          type: 'billboard_list',
          billboards: billboards
        };
        socket.send(JSON.stringify(response));
        console.log(`Sent ${billboards.length} billboards to requesting client`);
        return; // Don't broadcast this request to everyone
      }

      // Broadcast message to all clients (except request_billboards)
      server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  socket.on('close', () => console.log('Player disconnected'));
});

console.log('Server running on port 8090');