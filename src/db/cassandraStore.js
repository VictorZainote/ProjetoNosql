const cassandra = require('cassandra-driver');

class CassandraStore {
  constructor() {
    this.mode = 'memory';
    this.client = null;
    // Particionamento simulado por Partition Key (evento_id)
    this.partitions = new Map(); // evento_id -> array ordenado por comprado_em DESC
    this.auditLog = [];
    this.commandLog = [];
  }

  log(cmd) {
    this.commandLog.unshift({ ts: new Date().toISOString(), db: 'Cassandra (Wide-Column)', cmd });
    if (this.commandLog.length > 50) this.commandLog.pop();
  }

  async init(mode = 'auto') {
    if (mode === 'memory') return;
    try {
      const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS || '127.0.0.1').split(',');
      const localDataCenter = process.env.CASSANDRA_DATACENTER || 'datacenter1';
      const keyspace = process.env.CASSANDRA_KEYSPACE || 'tickets_pulse';

      const client = new cassandra.Client({
        contactPoints,
        localDataCenter,
        socketOptions: { connectTimeout: 1500 },
      });
      await client.connect();
      await client.execute(`
        CREATE KEYSPACE IF NOT EXISTS ${keyspace}
        WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
      `);
      await client.execute(`USE ${keyspace}`);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS compras_por_evento (
          evento_id text,
          comprado_em timestamp,
          compra_id uuid,
          usuario_id text,
          setor text,
          quantidade int,
          valor_total decimal,
          status text,
          PRIMARY KEY ((evento_id), comprado_em, compra_id)
        ) WITH CLUSTERING ORDER BY (comprado_em DESC)
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS auditoria_eventos (
          evento_id text,
          ocorrido_em timestamp,
          log_id uuid,
          tipo text,
          detalhe text,
          PRIMARY KEY ((evento_id), ocorrido_em, log_id)
        ) WITH CLUSTERING ORDER BY (ocorrido_em DESC)
      `);
      this.client = client;
      this.mode = 'live';
    } catch {
      this.mode = 'memory';
    }
  }

  async recordPurchase(purchase) {
    const cql = `INSERT INTO compras_por_evento (evento_id, comprado_em, compra_id, usuario_id, setor, quantidade, valor_total, status) VALUES ('${purchase.evento_id}', '${purchase.comprado_em}', ${purchase.compra_id}, '${purchase.usuario_id}', '${purchase.setor}', ${purchase.quantidade}, ${purchase.valor_total}, '${purchase.status}')`;
    this.log(cql);
    if (this.mode === 'live') {
      await this.client.execute(
        `INSERT INTO compras_por_evento (evento_id, comprado_em, compra_id, usuario_id, setor, quantidade, valor_total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchase.evento_id,
          new Date(purchase.comprado_em),
          cassandra.types.Uuid.fromString(purchase.compra_id),
          purchase.usuario_id,
          purchase.setor,
          purchase.quantidade,
          String(purchase.valor_total),
          purchase.status,
        ],
        { prepare: true }
      );
      return purchase;
    }
    if (!this.partitions.has(purchase.evento_id)) {
      this.partitions.set(purchase.evento_id, []);
    }
    const list = this.partitions.get(purchase.evento_id);
    list.unshift(purchase);
    list.sort((a, b) => new Date(b.comprado_em) - new Date(a.comprado_em));
    return purchase;
  }

  async getPurchasesByEvent(eventoId, limit = 50) {
    this.log(`SELECT * FROM compras_por_evento WHERE evento_id = '${eventoId}' LIMIT ${limit}`);
    if (this.mode === 'live') {
      const res = await this.client.execute(
        `SELECT evento_id, comprado_em, compra_id, usuario_id, setor, quantidade, valor_total, status FROM compras_por_evento WHERE evento_id = ? LIMIT ?`,
        [eventoId, limit],
        { prepare: true }
      );
      return res.rows.map((r) => ({
        ...r,
        compra_id: r.compra_id.toString(),
        valor_total: Number(r.valor_total),
      }));
    }
    return (this.partitions.get(eventoId) || []).slice(0, limit);
  }

  async recordAudit(eventoId, tipo, detalhe, logId) {
    const ts = new Date().toISOString();
    this.log(`INSERT INTO auditoria_eventos (evento_id, ocorrido_em, log_id, tipo, detalhe) VALUES ('${eventoId}', '${ts}', ${logId}, '${tipo}', '${detalhe}')`);
    if (this.mode === 'live') {
      await this.client.execute(
        `INSERT INTO auditoria_eventos (evento_id, ocorrido_em, log_id, tipo, detalhe) VALUES (?, ?, ?, ?, ?)`,
        [eventoId, new Date(ts), cassandra.types.Uuid.fromString(logId), tipo, detalhe],
        { prepare: true }
      );
      return;
    }
    this.auditLog.unshift({ evento_id: eventoId, ocorrido_em: ts, log_id: logId, tipo, detalhe });
    if (this.auditLog.length > 100) this.auditLog.pop();
  }

  async getAuditByEvent(eventoId, limit = 30) {
    if (this.mode === 'live') {
      const res = await this.client.execute(
        `SELECT evento_id, ocorrido_em, log_id, tipo, detalhe FROM auditoria_eventos WHERE evento_id = ? LIMIT ?`,
        [eventoId, limit],
        { prepare: true }
      );
      return res.rows;
    }
    return this.auditLog.filter((a) => a.evento_id === eventoId).slice(0, limit);
  }
}

module.exports = new CassandraStore();
