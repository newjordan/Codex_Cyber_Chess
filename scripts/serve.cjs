const { resolve } = require('node:path');
const { createGameServer } = require('../Cyber_Chess_0.9/resources/app/lib/static-server.cjs');

const root = resolve(__dirname, '../Cyber_Chess_0.9/resources/app/app');
const port = Number(process.env.PORT) || 4173;
const server = createGameServer(root);

server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`Cyber Chess is serving at http://127.0.0.1:${address.port}`);
});
