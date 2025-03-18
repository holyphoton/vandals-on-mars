const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

server.on('connection', (socket) => {
  console.log('Player connected');
  socket.on('message', (message) => {
    console.log('Received:', message);
    server.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
  });
  socket.on('close', () => console.log('Player disconnected'));
});

console.log('Server running on port 8080');