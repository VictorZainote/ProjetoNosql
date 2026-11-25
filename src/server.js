const { initAllDatabases } = require('./db');
const { seedData } = require('./seed');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;

async function start() {
  const dbModes = await initAllDatabases();
  await seedData();

  const app = createApp(dbModes);
  app.listen(PORT, () => {
    console.log(`\n=== TICKETS PULSE (Marco 2) rodando em http://localhost:${PORT} ===`);
    console.log('Bancos NoSQL inicializados:', dbModes);
  });
}

start().catch((err) => {
  console.error('Erro ao iniciar Tickets Pulse:', err);
  process.exit(1);
});
