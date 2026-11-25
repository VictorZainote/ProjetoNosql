const { MongoClient } = require('mongodb');

class MongoStore {
  constructor() {
    this.mode = 'memory';
    this.client = null;
    this.db = null;
    this.collections = {
      eventos: [],
      usuarios: [],
      ingressos: [],
    };
    this.commandLog = [];
  }

  log(cmd) {
    this.commandLog.unshift({ ts: new Date().toISOString(), db: 'MongoDB (Documentos)', cmd });
    if (this.commandLog.length > 50) this.commandLog.pop();
  }

  async init(mode = 'auto') {
    if (mode === 'memory') return;
    try {
      const client = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017', {
        serverSelectionTimeoutMS: 1500,
      });
      await client.connect();
      this.db = client.db(process.env.MONGO_DB || 'tickets_pulse');
      await this.db.command({ ping: 1 });
      this.client = client;
      this.mode = 'live';
    } catch {
      this.mode = 'memory';
    }
  }

  async upsertEvent(eventDoc) {
    this.log(`db.eventos.updateOne({ _id: "${eventDoc._id}" }, { $set: ... }, { upsert: true })`);
    if (this.mode === 'live') {
      await this.db.collection('eventos').updateOne(
        { _id: eventDoc._id },
        { $set: eventDoc },
        { upsert: true }
      );
      return eventDoc;
    }
    const idx = this.collections.eventos.findIndex((e) => e._id === eventDoc._id);
    if (idx >= 0) this.collections.eventos[idx] = eventDoc;
    else this.collections.eventos.push(eventDoc);
    return eventDoc;
  }

  async listEvents() {
    if (this.mode === 'live') {
      return this.db.collection('eventos').find({}).toArray();
    }
    return this.collections.eventos;
  }

  async getEvent(eventId) {
    if (this.mode === 'live') {
      return this.db.collection('eventos').findOne({ _id: eventId });
    }
    return this.collections.eventos.find((e) => e._id === eventId) || null;
  }

  async upsertUser(userDoc) {
    this.log(`db.usuarios.updateOne({ _id: "${userDoc._id}" }, { $set: ... }, { upsert: true })`);
    if (this.mode === 'live') {
      await this.db.collection('usuarios').updateOne(
        { _id: userDoc._id },
        { $set: userDoc },
        { upsert: true }
      );
      return userDoc;
    }
    const idx = this.collections.usuarios.findIndex((u) => u._id === userDoc._id);
    if (idx >= 0) this.collections.usuarios[idx] = userDoc;
    else this.collections.usuarios.push(userDoc);
    return userDoc;
  }

  async listUsers() {
    if (this.mode === 'live') {
      return this.db.collection('usuarios').find({}).toArray();
    }
    return this.collections.usuarios;
  }

  async insertTickets(tickets) {
    this.log(`db.ingressos.insertMany([${tickets.length} docs])`);
    if (this.mode === 'live') {
      if (tickets.length > 0) await this.db.collection('ingressos').insertMany(tickets);
      return tickets;
    }
    this.collections.ingressos.push(...tickets);
    return tickets;
  }

  async transferTicket(ticketId, fromUserId, toUserId) {
    this.log(`db.ingressos.updateOne({ _id: "${ticketId}", titular_id: "${fromUserId}" }, { $set: { titular_id: "${toUserId}" }, $push: { historico_transferencias: ... } })`);
    if (this.mode === 'live') {
      const res = await this.db.collection('ingressos').findOneAndUpdate(
        { _id: ticketId, titular_id: fromUserId },
        {
          $set: { titular_id: toUserId, status: 'transferido' },
          $push: {
            historico_transferencias: {
              de: fromUserId,
              para: toUserId,
              em: new Date().toISOString(),
            },
          },
        },
        { returnDocument: 'after' }
      );
      return res;
    }
    const ticket = this.collections.ingressos.find((t) => t._id === ticketId && t.titular_id === fromUserId);
    if (!ticket) return null;
    ticket.titular_id = toUserId;
    ticket.status = 'transferido';
    ticket.historico_transferencias = ticket.historico_transferencias || [];
    ticket.historico_transferencias.push({ de: fromUserId, para: toUserId, em: new Date().toISOString() });
    return ticket;
  }

  async listTickets(filter = {}) {
    if (this.mode === 'live') {
      return this.db.collection('ingressos').find(filter).toArray();
    }
    return this.collections.ingressos.filter((t) =>
      Object.entries(filter).every(([k, v]) => t[k] === v)
    );
  }
}

module.exports = new MongoStore();
