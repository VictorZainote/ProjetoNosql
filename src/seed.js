const { v4: uuidv4 } = require('uuid');
const { redisStore, mongoStore, cassandraStore, neo4jStore } = require('./db');

async function seedData({ prefillQueue = false } = {}) {
  const events = [
    {
      _id: 'evt-rock-bsb-2026',
      nome: 'Festival Pulse Brasília 2026',
      local: 'Arena BRB Mané Garrincha — Brasília/DF',
      data: '2026-12-12T20:00:00-03:00',
      categoria: 'Música / Festival',
      setores: [
        { codigo: 'pista', nome: 'Pista Comum', preco: 220.0, capacidade: 25000, estoque_inicial: 25000 },
        { codigo: 'pista-premium', nome: 'Pista Premium', preco: 480.0, capacidade: 10000, estoque_inicial: 4120 },
        { codigo: 'cadeira-inferior', nome: 'Cadeira Inferior', preco: 340.0, capacidade: 8000, estoque_inicial: 2310 },
        { codigo: 'camarote', nome: 'Camarote Open Bar', preco: 890.0, capacidade: 5000, estoque_inicial: 184 },
      ],
      metadados: {
        classificacao_etaria: '18 anos',
        lote_atual: '3º Lote Virada',
        regras_acesso: ['Documento oficial com foto', 'QR Code dinâmico anti-print', 'Biometria facial no Camarote'],
      },
    },
    {
      _id: 'evt-neon-sp-2026',
      nome: 'Neon Horizon World Tour 2026',
      local: 'Estádio Morumbi — São Paulo/SP',
      data: '2026-11-28T21:00:00-03:00',
      categoria: 'Show Internacional',
      setores: [
        { codigo: 'pista-premium', nome: 'Pista Premium', preco: 580.0, capacidade: 12000, estoque_inicial: 1420 },
        { codigo: 'pista', nome: 'Pista Comum', preco: 290.0, capacidade: 30000, estoque_inicial: 12840 },
        { codigo: 'arquibancada', nome: 'Arquibancada Superior', preco: 190.0, capacidade: 20000, estoque_inicial: 6410 },
        { codigo: 'camarote-vip', nome: 'Camarote VIP Lounge', preco: 1150.0, capacidade: 3000, estoque_inicial: 92 },
      ],
      metadados: {
        classificacao_etaria: '16 anos',
        lote_atual: 'Últimos Ingressos',
        turne: 'South America Leg',
      },
    },
    {
      _id: 'evt-tech-summit-2026',
      nome: 'NoSQL & Big Data Summit',
      local: 'Centro de Convenções Ulysses Guimarães — Brasília/DF',
      data: '2026-12-19T09:00:00-03:00',
      categoria: 'Conferência / Tecnologia',
      setores: [
        { codigo: 'plateia', nome: 'Plateia Geral', preco: 150.0, capacidade: 3000, estoque_inicial: 1840 },
        { codigo: 'vip', nome: 'Passe VIP + Workshops', preco: 420.0, capacidade: 500, estoque_inicial: 128 },
        { codigo: 'executive', nome: 'Executive Keynotes & Dinner', preco: 780.0, capacidade: 150, estoque_inicial: 34 },
      ],
      metadados: {
        certificado_horas: 16,
        lote_atual: '2º Lote Acadêmico',
        trilhas: ['Chave-Valor (Redis)', 'Wide-Column (Cassandra)', 'Documentos (MongoDB)', 'Grafos (Neo4j)'],
      },
    },
    {
      _id: 'evt-final-copa-2026',
      nome: 'Final Copa Continental 2026',
      local: 'Estádio do Maracanã — Rio de Janeiro/RJ',
      data: '2026-12-05T17:00:00-03:00',
      categoria: 'Esportes / Futebol',
      setores: [
        { codigo: 'norte', nome: 'Arquibancada Norte', preco: 260.0, capacidade: 20000, estoque_inicial: 3120 },
        { codigo: 'sul', nome: 'Arquibancada Sul', preco: 260.0, capacidade: 20000, estoque_inicial: 2890 },
        { codigo: 'cativa', nome: 'Cadeira Cativa Central', preco: 640.0, capacidade: 15000, estoque_inicial: 940 },
        { codigo: 'hospitality', nome: 'Maracanã Hospitality Club', preco: 1490.0, capacidade: 4000, estoque_inicial: 65 },
      ],
      metadados: {
        classificacao_etaria: 'Livre',
        lote_atual: 'Lote Único Torcedor',
        abertura_portoes: '13:00',
      },
    },
  ];

  for (const evt of events) {
    await mongoStore.upsertEvent(evt);
    for (const s of evt.setores) {
      const initialStock = s.estoque_inicial !== undefined ? s.estoque_inicial : s.capacidade;
      await redisStore.setStock(evt._id, s.codigo, initialStock);
    }
  }

  const users = [
    {
      _id: 'usr-victor',
      nome: 'Victor Zainote',
      email: 'victor.zainote@sempreceub.com',
      cpf_mask: '***.333.444-**',
      cidade: 'Brasília/DF',
      tier: 'Prime VIP',
      device_padrao: 'dev-macbook-victor',
      card_hash: 'card-hash-5555',
      perfil_risco: 'Verificado · Dispositivo e cartão exclusivos',
    },
    {
      _id: 'usr-leo',
      nome: 'Leonardo Soares Paes',
      email: 'leonardo.paes@sempreceub.com',
      cpf_mask: '***.111.222-**',
      cidade: 'Brasília/DF',
      tier: 'Prime VIP',
      device_padrao: 'dev-iphone16-leo',
      card_hash: 'card-hash-1010',
      perfil_risco: 'Verificado · Cliente recorrente desde 2024',
    },
    {
      _id: 'usr-ana',
      nome: 'Ana Clara Mendes',
      email: 'ana.mendes@gmail.com',
      cpf_mask: '***.555.666-**',
      cidade: 'São Paulo/SP',
      tier: 'Fã Clube',
      device_padrao: 'dev-galaxy-s24-ana',
      card_hash: 'card-hash-2020',
      perfil_risco: 'Verificado · Conta autenticada via 2FA',
    },
    {
      _id: 'usr-mariana',
      nome: 'Mariana Costa',
      email: 'mariana.costa@outlook.com',
      cpf_mask: '***.214.890-**',
      cidade: 'Brasília/DF',
      tier: 'Standard',
      device_padrao: 'dev-ipad-mariana',
      card_hash: 'card-hash-3041',
      perfil_risco: 'Verificado · Sem alertas no grafo',
    },
    {
      _id: 'usr-rafael',
      nome: 'Rafael Almeida',
      email: 'rafael.almeida@tech.io',
      cpf_mask: '***.482.910-**',
      cidade: 'Belo Horizonte/MG',
      tier: 'Prime VIP',
      device_padrao: 'dev-thinkpad-rafa',
      card_hash: 'card-hash-4092',
      perfil_risco: 'Verificado · Engenheiro de Dados',
    },
    {
      _id: 'usr-juliana',
      nome: 'Juliana Ferreira',
      email: 'ju.ferreira@uol.com.br',
      cpf_mask: '***.619.203-**',
      cidade: 'Rio de Janeiro/RJ',
      tier: 'Fã Clube',
      device_padrao: 'dev-iphone15-ju',
      card_hash: 'card-hash-6180',
      perfil_risco: 'Verificado · Histórico limpo',
    },
    {
      _id: 'usr-lucas',
      nome: 'Lucas Ribeiro',
      email: 'lucas.ribeiro@sempreceub.com',
      cpf_mask: '***.731.405-**',
      cidade: 'Brasília/DF',
      tier: 'Meia Estudante',
      device_padrao: 'dev-android-lucas',
      card_hash: 'card-hash-7314',
      perfil_risco: 'Verificado · Carteira estudantil validada',
    },
    {
      _id: 'usr-camila',
      nome: 'Camila Rocha',
      email: 'camila.rocha@gmail.com',
      cpf_mask: '***.845.112-**',
      cidade: 'Curitiba/PR',
      tier: 'Standard',
      device_padrao: 'dev-macair-camila',
      card_hash: 'card-hash-8451',
      perfil_risco: 'Verificado · Sem anomalias',
    },
    {
      _id: 'usr-bruno',
      nome: 'Bruno Carvalho',
      email: 'bruno.carvalho@corp.com.br',
      cpf_mask: '***.902.318-**',
      cidade: 'São Paulo/SP',
      tier: 'Corporativo',
      device_padrao: 'dev-dell-bruno',
      card_hash: 'card-hash-9023',
      perfil_risco: 'Verificado · Compra corporativa',
    },
    {
      _id: 'usr-fernanda',
      nome: 'Fernanda Lima',
      email: 'fernanda.lima@icloud.com',
      cpf_mask: '***.156.784-**',
      cidade: 'Goiânia/GO',
      tier: 'Fã Clube',
      device_padrao: 'dev-iphone14-fe',
      card_hash: 'card-hash-1567',
      perfil_risco: 'Verificado · Sem anomalias',
    },
    {
      _id: 'usr-thiago',
      nome: 'Thiago Martins',
      email: 'thiago.martins@dev.br',
      cpf_mask: '***.329.651-**',
      cidade: 'Recife/PE',
      tier: 'Standard',
      device_padrao: 'dev-linux-thiago',
      card_hash: 'card-hash-3296',
      perfil_risco: 'Verificado · Sem anomalias',
    },
    {
      _id: 'usr-beatriz',
      nome: 'Beatriz Gomes',
      email: 'bia.gomes@gmail.com',
      cpf_mask: '***.504.927-**',
      cidade: 'Brasília/DF',
      tier: 'Meia Estudante',
      device_padrao: 'dev-moto-bia',
      card_hash: 'card-hash-5049',
      perfil_risco: 'Verificado · Sem anomalias',
    },
    // Anel de Fraude 1: Bot Farm compartilhando device dev-bot-farm-99 e cartão card-hash-9999
    {
      _id: 'usr-cambista-1',
      nome: 'Conta Suspeita A (Bot #01)',
      email: 'scalper.node01@darkmail.org',
      cpf_mask: '***.777.888-**',
      cidade: 'Proxy/VPN',
      tier: 'Sob Monitoramento',
      device_padrao: 'dev-bot-farm-99',
      card_hash: 'card-hash-9999',
      perfil_risco: '⚠ ALTO RISCO: Compartilha device dev-bot-farm-99 e cartão card-hash-9999 com Bots #02 e #03',
    },
    {
      _id: 'usr-cambista-2',
      nome: 'Conta Suspeita B (Bot #02)',
      email: 'scalper.node02@darkmail.org',
      cpf_mask: '***.999.000-**',
      cidade: 'Proxy/VPN',
      tier: 'Sob Monitoramento',
      device_padrao: 'dev-bot-farm-99',
      card_hash: 'card-hash-9999',
      perfil_risco: '⚠ ALTO RISCO: Compartilha device dev-bot-farm-99 e cartão card-hash-9999 com Bots #01 e #03',
    },
    {
      _id: 'usr-cambista-3',
      nome: 'Conta Suspeita C (Bot #03)',
      email: 'scalper.node03@darkmail.org',
      cpf_mask: '***.888.111-**',
      cidade: 'Proxy/VPN',
      tier: 'Sob Monitoramento',
      device_padrao: 'dev-bot-farm-99',
      card_hash: 'card-hash-8888',
      perfil_risco: '⚠ ALTO RISCO: Opera no mesmo cluster de hardware dev-bot-farm-99',
    },
    // Anel de Fraude 2: Laranjas compartilhando o mesmo cartão clonado/corporativo card-corp-7777
    {
      _id: 'usr-laranja-1',
      nome: 'Marcos Oliveira (Suspeito Laranja)',
      email: 'marcos.revenda99@mail.com',
      cpf_mask: '***.444.222-**',
      cidade: 'São Paulo/SP',
      tier: 'Sob Monitoramento',
      device_padrao: 'dev-emulator-x1',
      card_hash: 'card-corp-7777',
      perfil_risco: '⚠ CRÍTICO: Compartilha cartão card-corp-7777 com Diego Silva (usr-laranja-2)',
    },
    {
      _id: 'usr-laranja-2',
      nome: 'Diego Silva (Suspeito Laranja)',
      email: 'diego.tickets77@mail.com',
      cpf_mask: '***.666.333-**',
      cidade: 'São Paulo/SP',
      tier: 'Sob Monitoramento',
      device_padrao: 'dev-emulator-x2',
      card_hash: 'card-corp-7777',
      perfil_risco: '⚠ CRÍTICO: Compartilha cartão card-corp-7777 com Marcos Oliveira (usr-laranja-1)',
    },
  ];

  for (const u of users) {
    await mongoStore.upsertUser(u);
  }

  // Histórico realista de compras (Cassandra + MongoDB Ingressos + Neo4j Grafo)
  const baseMs = Date.now() - 3600 * 1000;
  const initialPurchases = [
    {
      userId: 'usr-leo',
      userName: 'Leonardo Soares Paes',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'pista-premium',
      unitPrice: 480.0,
      qty: 2,
      deviceId: 'dev-iphone16-leo',
      cardHash: 'card-hash-1010',
      offsetSec: 120,
    },
    {
      userId: 'usr-mariana',
      userName: 'Mariana Costa',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'cadeira-inferior',
      unitPrice: 340.0,
      qty: 2,
      deviceId: 'dev-ipad-mariana',
      cardHash: 'card-hash-3041',
      offsetSec: 420,
    },
    {
      userId: 'usr-rafael',
      userName: 'Rafael Almeida',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'camarote',
      unitPrice: 890.0,
      qty: 2,
      deviceId: 'dev-thinkpad-rafa',
      cardHash: 'card-hash-4092',
      offsetSec: 780,
    },
    {
      userId: 'usr-juliana',
      userName: 'Juliana Ferreira',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'pista-premium',
      unitPrice: 480.0,
      qty: 1,
      deviceId: 'dev-iphone15-ju',
      cardHash: 'card-hash-6180',
      offsetSec: 1120,
    },
    {
      userId: 'usr-cambista-1',
      userName: 'Conta Suspeita A (Bot #01)',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'pista-premium',
      unitPrice: 480.0,
      qty: 4,
      deviceId: 'dev-bot-farm-99',
      cardHash: 'card-hash-9999',
      offsetSec: 1500,
    },
    {
      userId: 'usr-cambista-2',
      userName: 'Conta Suspeita B (Bot #02)',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'camarote',
      unitPrice: 890.0,
      qty: 4,
      deviceId: 'dev-bot-farm-99',
      cardHash: 'card-hash-9999',
      offsetSec: 1540,
    },
    {
      userId: 'usr-cambista-3',
      userName: 'Conta Suspeita C (Bot #03)',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'pista-premium',
      unitPrice: 480.0,
      qty: 3,
      deviceId: 'dev-bot-farm-99',
      cardHash: 'card-hash-8888',
      offsetSec: 1595,
    },
    {
      userId: 'usr-laranja-1',
      userName: 'Marcos Oliveira (Suspeito Laranja)',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'cadeira-inferior',
      unitPrice: 340.0,
      qty: 4,
      deviceId: 'dev-emulator-x1',
      cardHash: 'card-corp-7777',
      offsetSec: 2100,
    },
    {
      userId: 'usr-laranja-2',
      userName: 'Diego Silva (Suspeito Laranja)',
      eventId: 'evt-rock-bsb-2026',
      eventName: 'Festival Pulse Brasília 2026',
      setor: 'cadeira-inferior',
      unitPrice: 340.0,
      qty: 4,
      deviceId: 'dev-emulator-x2',
      cardHash: 'card-corp-7777',
      offsetSec: 2145,
    },
    {
      userId: 'usr-bruno',
      userName: 'Bruno Carvalho',
      eventId: 'evt-neon-sp-2026',
      eventName: 'Neon Horizon World Tour 2026',
      setor: 'camarote-vip',
      unitPrice: 1150.0,
      qty: 2,
      deviceId: 'dev-dell-bruno',
      cardHash: 'card-hash-9023',
      offsetSec: 2400,
    },
    {
      userId: 'usr-camila',
      userName: 'Camila Rocha',
      eventId: 'evt-tech-summit-2026',
      eventName: 'NoSQL & Big Data Summit',
      setor: 'vip',
      unitPrice: 420.0,
      qty: 1,
      deviceId: 'dev-macair-camila',
      cardHash: 'card-hash-8451',
      offsetSec: 2800,
    },
  ];

  const allSeededTickets = [];

  for (const item of initialPurchases) {
    const compraId = uuidv4();
    const ts = new Date(baseMs + item.offsetSec * 1000).toISOString();
    const total = Number((item.unitPrice * item.qty).toFixed(2));

    await cassandraStore.recordPurchase({
      evento_id: item.eventId,
      comprado_em: ts,
      compra_id: compraId,
      usuario_id: item.userId,
      setor: item.setor,
      quantidade: item.qty,
      valor_total: total,
      status: 'CONFIRMADA',
    });

    await neo4jStore.recordPurchaseGraph({
      userId: item.userId,
      userName: item.userName,
      eventId: item.eventId,
      eventName: item.eventName,
      deviceId: item.deviceId,
      cardHash: item.cardHash,
      qty: item.qty,
    });

    const batchTickets = [];
    for (let i = 0; i < Math.min(item.qty, 2); i++) {
      const tkt = {
        _id: `tkt-${compraId.slice(0, 8)}-${i + 1}`,
        compra_id: compraId,
        evento_id: item.eventId,
        evento_nome: item.eventName,
        setor: item.setor,
        valor: item.unitPrice,
        titular_id: item.userId,
        status: 'ativo',
        qr_code: `PULSE-${compraId.slice(0, 6).toUpperCase()}-${i + 1}`,
        emitido_em: ts,
        historico_transferencias: [],
      };
      batchTickets.push(tkt);
      allSeededTickets.push(tkt);
    }
    await mongoStore.insertTickets(batchTickets);
  }

  // Simula repasses (transferências P2P) de cambista para compradores finais no MongoDB + Neo4j
  const cambistaTickets = allSeededTickets.filter((t) => t.titular_id === 'usr-cambista-1');
  if (cambistaTickets.length >= 2) {
    await mongoStore.transferTicket(cambistaTickets[0]._id, 'usr-cambista-1', 'usr-lucas');
    await neo4jStore.recordTransferGraph({
      ticketId: cambistaTickets[0]._id,
      fromUserId: 'usr-cambista-1',
      toUserId: 'usr-lucas',
      eventId: 'evt-rock-bsb-2026',
    });

    await mongoStore.transferTicket(cambistaTickets[1]._id, 'usr-cambista-1', 'usr-fernanda');
    await neo4jStore.recordTransferGraph({
      ticketId: cambistaTickets[1]._id,
      fromUserId: 'usr-cambista-1',
      toUserId: 'usr-fernanda',
      eventId: 'evt-rock-bsb-2026',
    });
  }

  await cassandraStore.recordAudit(
    'evt-rock-bsb-2026',
    'SEED_CLUSTER',
    'Carga inicial poliglota: 17 usuários, 4 eventos, histórico Cassandra e anéis de fraude no Neo4j',
    uuidv4()
  );

  // Quando iniciado pelo servidor web (prefillQueue = true), pré-popula fila virtual e reservas ativas no Redis
  if (prefillQueue) {
    const queueUsers = [
      'usr-mariana',
      'usr-rafael',
      'usr-juliana',
      'usr-lucas',
      'usr-camila',
      'usr-bruno',
      'usr-fernanda',
      'usr-thiago',
      'usr-beatriz',
      'usr-cambista-3',
      'usr-laranja-1',
      'usr-ana',
    ];
    const qBase = Date.now() - 45000;
    for (let i = 0; i < queueUsers.length; i++) {
      await redisStore.enqueue('evt-rock-bsb-2026', queueUsers[i], qBase + i * 1800);
    }

    // Cria 2 reservas ativas reais no Redis com TTL rodando
    await redisStore.createReservation(
      'usr-mariana',
      { eventoId: 'evt-rock-bsb-2026', setor: 'pista-premium', qtd: 2, status: 'reservado' },
      540
    );
    await redisStore.createReservation(
      'usr-laranja-1',
      { eventoId: 'evt-rock-bsb-2026', setor: 'camarote', qtd: 4, status: 'reservado' },
      480
    );
  }
}

if (require.main === module) {
  const { initAllDatabases } = require('./db');
  initAllDatabases()
    .then(() => seedData({ prefillQueue: true }))
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
