const { v4: uuidv4 } = require('uuid');
const { redisStore, mongoStore, cassandraStore, neo4jStore } = require('./db');

async function seedData() {
  const events = [
    {
      _id: 'evt-rock-bsb-2026',
      nome: 'Festival Pulse Brasília 2026',
      local: 'Arena BRB Mané Garrincha — Brasília/DF',
      data: '2026-12-12T20:00:00-03:00',
      categoria: 'Música / Festival',
      setores: [
        { codigo: 'pista', nome: 'Pista Comum', preco: 220.0, capacidade: 25000 },
        { codigo: 'pista-premium', nome: 'Pista Premium', preco: 480.0, capacidade: 10000 },
        { codigo: 'camarote', nome: 'Camarote Open Bar', preco: 890.0, capacidade: 5000 },
      ],
      metadados: {
        classificacao_etaria: '18 anos',
        lote_atual: '2º Lote',
        regras_acesso: ['Documento com foto', 'QR Code dinâmico'],
      },
    },
    {
      _id: 'evt-tech-summit-2026',
      nome: 'NoSQL & Big Data Summit',
      local: 'Centro de Convenções Ulysses Guimarães — Brasília/DF',
      data: '2026-12-19T09:00:00-03:00',
      categoria: 'Conferência / Tecnologia',
      setores: [
        { codigo: 'plateia', nome: 'Plateia Geral', preco: 150.0, capacidade: 3000 },
        { codigo: 'vip', nome: 'Passe VIP + Workshops', preco: 420.0, capacidade: 500 },
      ],
      metadados: {
        certificado_horas: 16,
        trilhas: ['Chave-Valor', 'Wide-Column', 'Documentos', 'Grafos'],
      },
    },
  ];

  for (const evt of events) {
    await mongoStore.upsertEvent(evt);
    for (const s of evt.setores) {
      await redisStore.setStock(evt._id, s.codigo, s.capacidade);
    }
  }

  const users = [
    { _id: 'usr-leo', nome: 'Leonardo Soares', email: 'leo@ceub.edu.br', cpf_mask: '***.111.222-**' },
    { _id: 'usr-victor', nome: 'Victor Zainote', email: 'victor@ceub.edu.br', cpf_mask: '***.333.444-**' },
    { _id: 'usr-ana', nome: 'Ana Clara', email: 'ana@email.com', cpf_mask: '***.555.666-**' },
    { _id: 'usr-cambista-1', nome: 'Conta Suspeita A', email: 'bot1@mail.com', cpf_mask: '***.777.888-**' },
    { _id: 'usr-cambista-2', nome: 'Conta Suspeita B', email: 'bot2@mail.com', cpf_mask: '***.999.000-**' },
  ];

  for (const u of users) {
    await mongoStore.upsertUser(u);
  }

  // Compra inicial legitima + cenario de fraude no grafo para demonstracao
  const now = new Date().toISOString();
  await cassandraStore.recordPurchase({
    evento_id: 'evt-rock-bsb-2026',
    comprado_em: now,
    compra_id: uuidv4(),
    usuario_id: 'usr-leo',
    setor: 'pista-premium',
    quantidade: 2,
    valor_total: 960.0,
    status: 'CONFIRMADA',
  });
  await neo4jStore.recordPurchaseGraph({
    userId: 'usr-leo',
    userName: 'Leonardo Soares',
    eventId: 'evt-rock-bsb-2026',
    eventName: 'Festival Pulse Brasília 2026',
    deviceId: 'dev-iphone-leo',
    cardHash: 'card-hash-1010',
    qty: 2,
  });

  // Simula 2 contas suspeitas usando o mesmo dispositivo e cartao (cambismo)
  await neo4jStore.recordPurchaseGraph({
    userId: 'usr-cambista-1',
    userName: 'Conta Suspeita A',
    eventId: 'evt-rock-bsb-2026',
    eventName: 'Festival Pulse Brasília 2026',
    deviceId: 'dev-bot-farm-99',
    cardHash: 'card-hash-9999',
    qty: 4,
  });
  await neo4jStore.recordPurchaseGraph({
    userId: 'usr-cambista-2',
    userName: 'Conta Suspeita B',
    eventId: 'evt-rock-bsb-2026',
    eventName: 'Festival Pulse Brasília 2026',
    deviceId: 'dev-bot-farm-99',
    cardHash: 'card-hash-9999',
    qty: 4,
  });

  await cassandraStore.recordAudit(
    'evt-rock-bsb-2026',
    'SEED_INICIAL',
    'Carga inicial de eventos, estoque no Redis e grafo antifraude no Neo4j',
    uuidv4()
  );
}

if (require.main === module) {
  const { initAllDatabases } = require('./db');
  initAllDatabases()
    .then(() => seedData())
    .then(() => {
      console.log('Seed concluido com sucesso!');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedData };
