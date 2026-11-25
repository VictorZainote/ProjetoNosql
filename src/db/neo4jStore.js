const neo4j = require('neo4j-driver');

class Neo4jStore {
  constructor() {
    this.mode = 'memory';
    this.driver = null;
    // Grafo em memoria: nodes & edges
    this.purchases = []; // { userId, userName, eventId, deviceId, cardHash, qty, ts }
    this.transfers = []; // { ticketId, fromUserId, toUserId, eventId, ts }
    this.commandLog = [];
  }

  log(cmd) {
    this.commandLog.unshift({ ts: new Date().toISOString(), db: 'Neo4j (Grafos)', cmd });
    if (this.commandLog.length > 50) this.commandLog.pop();
  }

  async init(mode = 'auto') {
    if (mode === 'memory') return;
    try {
      const driver = neo4j.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'ticketspulse123'
        ),
        { connectionTimeout: 1500 }
      );
      await driver.verifyConnectivity();
      this.driver = driver;
      this.mode = 'live';
    } catch {
      this.mode = 'memory';
    }
  }

  async recordPurchaseGraph({ userId, userName, eventId, eventName, deviceId, cardHash, qty }) {
    const cypher = `MERGE (u:Usuario {id: '${userId}'}) SET u.nome = '${userName}' MERGE (e:Evento {id: '${eventId}'}) MERGE (d:Dispositivo {id: '${deviceId}'}) MERGE (c:Cartao {hash: '${cardHash}'}) MERGE (u)-[:USOU_DISPOSITIVO]->(d) MERGE (u)-[:PAGOU_COM]->(c) CREATE (u)-[:COMPROU {qtd: ${qty}}]->(e)`;
    this.log(cypher);
    if (this.mode === 'live') {
      const session = this.driver.session();
      try {
        await session.run(
          `
          MERGE (u:Usuario {id: $userId}) SET u.nome = $userName
          MERGE (e:Evento {id: $eventId}) SET e.nome = $eventName
          MERGE (d:Dispositivo {id: $deviceId})
          MERGE (c:Cartao {hash: $cardHash})
          MERGE (u)-[:USOU_DISPOSITIVO]->(d)
          MERGE (u)-[:PAGOU_COM]->(c)
          CREATE (u)-[:COMPROU {qtd: $qty, em: datetime()}]->(e)
          `,
          { userId, userName, eventId, eventName, deviceId, cardHash, qty }
        );
      } finally {
        await session.close();
      }
      return;
    }
    this.purchases.push({
      userId,
      userName,
      eventId,
      eventName,
      deviceId,
      cardHash,
      qty,
      ts: new Date().toISOString(),
    });
  }

  async recordTransferGraph({ ticketId, fromUserId, toUserId, eventId }) {
    const cypher = `MATCH (a:Usuario {id: '${fromUserId}'}) MERGE (b:Usuario {id: '${toUserId}'}) CREATE (a)-[:TRANSFERIU_PARA {ticketId: '${ticketId}', eventoId: '${eventId}'}]->(b)`;
    this.log(cypher);
    if (this.mode === 'live') {
      const session = this.driver.session();
      try {
        await session.run(
          `
          MERGE (a:Usuario {id: $fromUserId})
          MERGE (b:Usuario {id: $toUserId})
          CREATE (a)-[:TRANSFERIU_PARA {ticketId: $ticketId, eventoId: $eventId, em: datetime()}]->(b)
          `,
          { ticketId, fromUserId, toUserId, eventId }
        );
      } finally {
        await session.close();
      }
      return;
    }
    this.transfers.push({ ticketId, fromUserId, toUserId, eventId, ts: new Date().toISOString() });
  }

  async detectFraudRings(eventId) {
    const cypher = `MATCH (u1:Usuario)-[:USOU_DISPOSITIVO|PAGOU_COM]->(recurso)<-[:USOU_DISPOSITIVO|PAGOU_COM]-(u2:Usuario) WHERE u1.id < u2.id RETURN recurso, collect(DISTINCT u1.id) + collect(DISTINCT u2.id) AS suspeitos`;
    this.log(cypher);
    if (this.mode === 'live') {
      const session = this.driver.session();
      try {
        const res = await session.run(`
          MATCH (u:Usuario)-[:USOU_DISPOSITIVO]->(d:Dispositivo)
          WITH d, collect(DISTINCT u.id) AS usuarios
          WHERE size(usuarios) > 1
          RETURN 'Dispositivo' AS tipo, d.id AS recurso, usuarios
          UNION
          MATCH (u:Usuario)-[:PAGOU_COM]->(c:Cartao)
          WITH c, collect(DISTINCT u.id) AS usuarios
          WHERE size(usuarios) > 1
          RETURN 'Cartao' AS tipo, c.hash AS recurso, usuarios
        `);
        return res.records.map((r) => ({
          tipo: r.get('tipo'),
          recurso: r.get('recurso'),
          usuarios: r.get('usuarios'),
          risco: 'ALTO (Possivel cambismo/multi-conta)',
        }));
      } finally {
        await session.close();
      }
    }

    // Analise em grafo em memoria: agrupa usuarios por Dispositivo e por Cartao
    const byDevice = new Map();
    const byCard = new Map();
    const filtered = eventId ? this.purchases.filter((p) => p.eventId === eventId) : this.purchases;

    for (const p of filtered) {
      if (!byDevice.has(p.deviceId)) byDevice.set(p.deviceId, new Set());
      byDevice.get(p.deviceId).add(p.userId);
      if (!byCard.has(p.cardHash)) byCard.set(p.cardHash, new Set());
      byCard.get(p.cardHash).add(p.userId);
    }

    const alerts = [];
    for (const [deviceId, users] of byDevice.entries()) {
      if (users.size > 1) {
        alerts.push({
          tipo: 'Dispositivo compartilhado',
          recurso: deviceId,
          usuarios: [...users],
          risco: 'ALTO (Multiplas contas no mesmo device)',
        });
      }
    }
    for (const [cardHash, users] of byCard.entries()) {
      if (users.size > 1) {
        alerts.push({
          tipo: 'Cartao compartilhado',
          recurso: cardHash,
          usuarios: [...users],
          risco: 'CRITICO (Mesmo cartao em contas distintas)',
        });
      }
    }

    // Detecta revenda/repasses repetidos
    const transferCounts = new Map();
    for (const t of this.transfers) {
      if (eventId && t.eventId !== eventId) continue;
      transferCounts.set(t.fromUserId, (transferCounts.get(t.fromUserId) || 0) + 1);
    }
    for (const [userId, count] of transferCounts.entries()) {
      if (count >= 2) {
        alerts.push({
          tipo: 'Repasse em cadeia',
          recurso: userId,
          usuarios: [userId],
          risco: `MEDIO (${count} transferencias realizadas)`,
        });
      }
    }

    return alerts;
  }

  async getGraphSnapshot(eventId) {
    const filteredPurchases = eventId ? this.purchases.filter((p) => p.eventId === eventId) : this.purchases;
    const filteredTransfers = eventId ? this.transfers.filter((t) => t.eventId === eventId) : this.transfers;

    const nodes = new Map();
    const edges = [];

    for (const p of filteredPurchases) {
      nodes.set(`u:${p.userId}`, { id: `u:${p.userId}`, label: p.userId, group: 'Usuario' });
      nodes.set(`d:${p.deviceId}`, { id: `d:${p.deviceId}`, label: p.deviceId, group: 'Dispositivo' });
      nodes.set(`c:${p.cardHash}`, { id: `c:${p.cardHash}`, label: p.cardHash, group: 'Cartao' });
      nodes.set(`e:${p.eventId}`, { id: `e:${p.eventId}`, label: p.eventId, group: 'Evento' });

      edges.push({ from: `u:${p.userId}`, to: `d:${p.deviceId}`, label: 'USOU_DISPOSITIVO' });
      edges.push({ from: `u:${p.userId}`, to: `c:${p.cardHash}`, label: 'PAGOU_COM' });
      edges.push({ from: `u:${p.userId}`, to: `e:${p.eventId}`, label: `COMPROU (${p.qty})` });
    }
    for (const t of filteredTransfers) {
      nodes.set(`u:${t.fromUserId}`, { id: `u:${t.fromUserId}`, label: t.fromUserId, group: 'Usuario' });
      nodes.set(`u:${t.toUserId}`, { id: `u:${t.toUserId}`, label: t.toUserId, group: 'Usuario' });
      edges.push({ from: `u:${t.fromUserId}`, to: `u:${t.toUserId}`, label: 'TRANSFERIU_PARA' });
    }

    return { nodes: [...nodes.values()], edges };
  }
}

module.exports = new Neo4jStore();
