const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  redisStore,
  mongoStore,
  cassandraStore,
  neo4jStore,
  getUnifiedCommandLog,
} = require('./db');

function createApp(dbModes = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Status dos 4 bancos NoSQL
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      databases: {
        redis: { family: 'Chave-Valor', mode: redisStore.mode || dbModes.redis },
        mongodb: { family: 'Documentos', mode: mongoStore.mode || dbModes.mongodb },
        cassandra: { family: 'Wide-Column', mode: cassandraStore.mode || dbModes.cassandra },
        neo4j: { family: 'Grafos', mode: neo4jStore.mode || dbModes.neo4j },
      },
    });
  });

  // 1. Catalogo de eventos (MongoDB) + Estoque em tempo real (Redis)
  app.get('/api/events', async (req, res) => {
    const events = await mongoStore.listEvents();
    const enriched = await Promise.all(
      events.map(async (evt) => {
        const setores = await Promise.all(
          evt.setores.map(async (s) => ({
            ...s,
            disponivel: await redisStore.getStock(evt._id, s.codigo),
          }))
        );
        return { ...evt, setores };
      })
    );
    res.json(enriched);
  });

  app.get('/api/users', async (req, res) => {
    const users = await mongoStore.listUsers();
    res.json(users);
  });

  app.post('/api/users', async (req, res) => {
    const { nome, email, cidade = 'Brasília/DF', tier = 'Verificado', device_padrao, card_hash } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do usuario e obrigatorio' });
    const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 14);
    const id = `usr-${slug || 'novo'}-${Math.floor(100 + Math.random() * 900)}`;
    const userDoc = {
      _id: id,
      nome,
      email: email || `${slug}@ticketspulse.io`,
      cpf_mask: `***.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-**`,
      cidade,
      tier,
      device_padrao: device_padrao || `dev-web-${slug}`,
      card_hash: card_hash || `card-hash-${Math.floor(1000 + Math.random() * 8999)}`,
      perfil_risco: 'Novo usuário cadastrado via MongoDB',
    };
    await mongoStore.upsertUser(userDoc);
    res.status(201).json(userDoc);
  });

  // 2. Fila virtual (Redis Sorted Set: ZADD / ZRANK)
  app.post('/api/queue/enter', async (req, res) => {
    const { eventoId, usuarioId } = req.body;
    if (!eventoId || !usuarioId) {
      return res.status(400).json({ error: 'eventoId e usuarioId sao obrigatorios' });
    }
    const position = await redisStore.enqueue(eventoId, usuarioId);
    res.json({ eventoId, usuarioId, position });
  });

  app.post('/api/queue/burst', async (req, res) => {
    const { eventoId, count = 20 } = req.body;
    if (!eventoId) return res.status(400).json({ error: 'eventoId obrigatorio' });
    const baseTs = Date.now();
    for (let i = 1; i <= count; i++) {
      const uid = `usr-fan-${Math.floor(Math.random() * 9000 + 1000)}`;
      await redisStore.enqueue(eventoId, uid, baseTs + i);
    }
    const queue = await redisStore.getQueue(eventoId);
    res.json({ added: count, totalInQueue: queue.length, preview: queue.slice(0, 15) });
  });

  app.get('/api/queue/:eventoId', async (req, res) => {
    const queue = await redisStore.getQueue(req.params.eventoId);
    res.json(queue);
  });

  // 3. Reserva temporaria com TTL + DECRBY atomico (Redis Hash + EXPIRE)
  app.post('/api/reservations', async (req, res) => {
    const { eventoId, usuarioId, setor, qtd = 1, ttlSeconds = 600 } = req.body;
    if (!eventoId || !usuarioId || !setor) {
      return res.status(400).json({ error: 'eventoId, usuarioId e setor sao obrigatorios' });
    }

    const existing = await redisStore.getReservation(usuarioId);
    if (existing) {
      return res.status(409).json({ error: 'Usuario ja possui uma reserva ativa', reservation: existing });
    }

    const stockRes = await redisStore.decrStockAtomic(eventoId, setor, Number(qtd));
    if (!stockRes.ok) {
      return res.status(409).json({ error: 'Estoque insuficiente no setor', remaining: stockRes.remaining });
    }

    await redisStore.createReservation(
      usuarioId,
      { eventoId, setor, qtd: Number(qtd), status: 'reservado' },
      Number(ttlSeconds)
    );
    await redisStore.removeFromQueue(eventoId, usuarioId);
    await cassandraStore.recordAudit(
      eventoId,
      'RESERVA_CRIADA',
      `Usuario ${usuarioId} reservou ${qtd}x ${setor} (TTL ${ttlSeconds}s)`,
      uuidv4()
    );

    const reservation = await redisStore.getReservation(usuarioId);
    res.status(201).json({ reservation, remainingStock: stockRes.remaining });
  });

  app.get('/api/reservations', async (req, res) => {
    const list = await redisStore.listActiveReservations();
    res.json(list);
  });

  // Simula expiracao de reserva (worker devolvendo ingresso ao estoque)
  app.post('/api/reservations/:usuarioId/expire', async (req, res) => {
    const { usuarioId } = req.params;
    const reservation = await redisStore.getReservation(usuarioId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva nao encontrada ou ja expirou' });
    }
    await redisStore.deleteReservation(usuarioId);
    const remaining = await redisStore.incrStock(reservation.eventoId, reservation.setor, reservation.qtd);
    await cassandraStore.recordAudit(
      reservation.eventoId,
      'RESERVA_EXPIRADA',
      `TTL expirado para ${usuarioId}; ${reservation.qtd} ingresso(s) devolvidos ao setor ${reservation.setor}`,
      uuidv4()
    );
    res.json({ expired: true, devolvido: reservation.qtd, remainingStock: remaining });
  });

  // 4. Checkout Poliglota: Redis -> Cassandra + MongoDB + Neo4j
  app.post('/api/checkout', async (req, res) => {
    const { usuarioId, deviceId = 'dev-web-default', cardHash = 'card-hash-default' } = req.body;
    if (!usuarioId) return res.status(400).json({ error: 'usuarioId obrigatorio' });

    const reservation = await redisStore.getReservation(usuarioId);
    if (!reservation) {
      return res.status(404).json({ error: 'Nenhuma reserva ativa encontrada para checkout (TTL expirado ou nao reservado)' });
    }

    const eventDoc = await mongoStore.getEvent(reservation.eventoId);
    if (!eventDoc) return res.status(404).json({ error: 'Evento nao encontrado no MongoDB' });

    const sectorDoc = eventDoc.setores.find((s) => s.codigo === reservation.setor);
    const unitPrice = sectorDoc ? sectorDoc.preco : 200;
    const total = Number((unitPrice * reservation.qtd).toFixed(2));
    const purchaseId = uuidv4();
    const now = new Date().toISOString();

    // (a) Cassandra: grava historico duravel query-first
    const purchase = await cassandraStore.recordPurchase({
      evento_id: reservation.eventoId,
      comprado_em: now,
      compra_id: purchaseId,
      usuario_id: usuarioId,
      setor: reservation.setor,
      quantidade: reservation.qtd,
      valor_total: total,
      status: 'CONFIRMADA',
    });

    // (b) MongoDB: emite documentos de ingressos semiestruturados
    const tickets = [];
    for (let i = 0; i < reservation.qtd; i++) {
      tickets.push({
        _id: `tkt-${uuidv4().slice(0, 8)}`,
        compra_id: purchaseId,
        evento_id: reservation.eventoId,
        evento_nome: eventDoc.nome,
        setor: reservation.setor,
        valor: unitPrice,
        titular_id: usuarioId,
        status: 'ativo',
        qr_code: `PULSE-${purchaseId.slice(0, 6)}-${i + 1}`,
        emitido_em: now,
        historico_transferencias: [],
      });
    }
    await mongoStore.insertTickets(tickets);

    // (c) Neo4j: registra relacoes de compra, dispositivo e cartao
    await neo4jStore.recordPurchaseGraph({
      userId: usuarioId,
      userName: usuarioId,
      eventId: reservation.eventoId,
      eventName: eventDoc.nome,
      deviceId,
      cardHash,
      qty: reservation.qtd,
    });

    // (d) Redis: remove reserva temporaria
    await redisStore.deleteReservation(usuarioId);
    await cassandraStore.recordAudit(
      reservation.eventoId,
      'COMPRA_CONFIRMADA',
      `Compra ${purchaseId} por ${usuarioId} (${reservation.qtd}x ${reservation.setor}) - R$ ${total}`,
      uuidv4()
    );

    res.status(201).json({ purchase, tickets });
  });

  // 5. Consultas Cassandra (Wide-Column)
  app.get('/api/history/:eventoId', async (req, res) => {
    const purchases = await cassandraStore.getPurchasesByEvent(req.params.eventoId);
    const audit = await cassandraStore.getAuditByEvent(req.params.eventoId);
    res.json({ purchases, audit });
  });

  // 6. Ingressos (MongoDB) + Transferencia (MongoDB + Neo4j)
  app.get('/api/tickets', async (req, res) => {
    const filter = {};
    if (req.query.usuarioId) filter.titular_id = req.query.usuarioId;
    if (req.query.eventoId) filter.evento_id = req.query.eventoId;
    const tickets = await mongoStore.listTickets(filter);
    res.json(tickets);
  });

  app.post('/api/tickets/transfer', async (req, res) => {
    const { ticketId, fromUserId, toUserId } = req.body;
    if (!ticketId || !fromUserId || !toUserId) {
      return res.status(400).json({ error: 'ticketId, fromUserId e toUserId sao obrigatorios' });
    }
    const updated = await mongoStore.transferTicket(ticketId, fromUserId, toUserId);
    if (!updated) {
      return res.status(404).json({ error: 'Ingresso nao encontrado para o titular informado' });
    }
    await neo4jStore.recordTransferGraph({
      ticketId,
      fromUserId,
      toUserId,
      eventId: updated.evento_id,
    });
    await cassandraStore.recordAudit(
      updated.evento_id,
      'INGRESSO_TRANSFERIDO',
      `Ingresso ${ticketId} transferido de ${fromUserId} para ${toUserId}`,
      uuidv4()
    );
    res.json(updated);
  });

  // 7. Antifraude e Grafo (Neo4j)
  app.get('/api/graph/fraud', async (req, res) => {
    const alerts = await neo4jStore.detectFraudRings(req.query.eventoId);
    const snapshot = await neo4jStore.getGraphSnapshot(req.query.eventoId);
    res.json({ alerts, snapshot });
  });

  // 8. Inspector unificado de comandos NoSQL
  app.get('/api/logs', (req, res) => {
    res.json(getUnifiedCommandLog());
  });

  return app;
}

module.exports = { createApp };
