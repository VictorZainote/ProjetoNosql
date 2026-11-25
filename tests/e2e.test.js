const assert = require('assert');
const http = require('http');
const { initAllDatabases } = require('../src/db');
const { seedData } = require('../src/seed');
const { createApp } = require('../src/app');

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  process.env.DB_MODE = 'memory';
  const modes = await initAllDatabases();
  await seedData();
  const app = createApp(modes);
  const server = app.listen(0);

  try {
    // 1. Health check das 4 familias
    const health = await request(server, 'GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.ok(health.body.databases.redis);
    assert.ok(health.body.databases.mongodb);
    assert.ok(health.body.databases.cassandra);
    assert.ok(health.body.databases.neo4j);

    // 2. Fila virtual (Redis Sorted Set)
    const qRes = await request(server, 'POST', '/api/queue/enter', {
      eventoId: 'evt-rock-bsb-2026',
      usuarioId: 'usr-victor',
    });
    assert.strictEqual(qRes.status, 200);
    assert.strictEqual(qRes.body.position, 1);

    // 3. Reserva atomica (Redis DECRBY + HSET + EXPIRE)
    const rRes = await request(server, 'POST', '/api/reservations', {
      eventoId: 'evt-rock-bsb-2026',
      usuarioId: 'usr-victor',
      setor: 'pista',
      qtd: 2,
    });
    assert.strictEqual(rRes.status, 201);
    assert.strictEqual(rRes.body.remainingStock, 24998);

    // 4. Checkout poliglota (Cassandra + MongoDB + Neo4j)
    const cRes = await request(server, 'POST', '/api/checkout', {
      usuarioId: 'usr-victor',
      deviceId: 'dev-bot-farm-99',
      cardHash: 'card-hash-5555',
    });
    assert.strictEqual(cRes.status, 201);
    assert.strictEqual(cRes.body.tickets.length, 2);
    assert.strictEqual(cRes.body.purchase.valor_total, 440);

    // 5. Historico no Cassandra
    const hRes = await request(server, 'GET', '/api/history/evt-rock-bsb-2026');
    assert.strictEqual(hRes.status, 200);
    assert.ok(hRes.body.purchases.some((p) => p.usuario_id === 'usr-victor'));

    // 6. Transferencia de ingresso (MongoDB + Neo4j)
    const ticketId = cRes.body.tickets[0]._id;
    const tRes = await request(server, 'POST', '/api/tickets/transfer', {
      ticketId,
      fromUserId: 'usr-victor',
      toUserId: 'usr-ana',
    });
    assert.strictEqual(tRes.status, 200);
    assert.strictEqual(tRes.body.titular_id, 'usr-ana');

    // 7. Antifraude no Neo4j (detecta usr-victor no mesmo device dos bots)
    const gRes = await request(server, 'GET', '/api/graph/fraud?eventoId=evt-rock-bsb-2026');
    assert.strictEqual(gRes.status, 200);
    assert.ok(gRes.body.alerts.length >= 2);

    console.log('Todos os 7 testes E2E passaram com sucesso!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
