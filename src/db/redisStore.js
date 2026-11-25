const Redis = require('ioredis');

class RedisStore {
  constructor() {
    this.mode = 'memory';
    this.client = null;
    this.sortedSets = new Map(); // key -> Map(member -> score)
    this.hashes = new Map();     // key -> Map(field -> value)
    this.strings = new Map();    // key -> string/number
    this.ttls = new Map();       // key -> expiresAtMs
    this.commandLog = [];
  }

  log(cmd) {
    this.commandLog.unshift({ ts: new Date().toISOString(), db: 'Redis (Chave-Valor)', cmd });
    if (this.commandLog.length > 50) this.commandLog.pop();
  }

  async init(mode = 'auto') {
    if (mode === 'memory') return;
    try {
      const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        connectTimeout: 1500,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        lazyConnect: true,
      });
      await client.connect();
      await client.ping();
      this.client = client;
      this.mode = 'live';
    } catch {
      this.mode = 'memory';
    }
  }

  _purgeIfExpired(key) {
    const exp = this.ttls.get(key);
    if (exp && Date.now() > exp) {
      this.hashes.delete(key);
      this.strings.delete(key);
      this.ttls.delete(key);
      return true;
    }
    return false;
  }

  async setStock(eventId, sector, qty) {
    const key = `estoque:${eventId}:${sector}`;
    this.log(`SET ${key} ${qty}`);
    if (this.mode === 'live') return this.client.set(key, qty);
    this.strings.set(key, String(qty));
  }

  async getStock(eventId, sector) {
    const key = `estoque:${eventId}:${sector}`;
    if (this.mode === 'live') {
      const v = await this.client.get(key);
      return v === null ? 0 : Number(v);
    }
    const v = this.strings.get(key);
    return v === undefined ? 0 : Number(v);
  }

  async decrStockAtomic(eventId, sector, qty) {
    const key = `estoque:${eventId}:${sector}`;
    this.log(`DECRBY ${key} ${qty}`);
    if (this.mode === 'live') {
      const next = await this.client.decrby(key, qty);
      if (next < 0) {
        await this.client.incrby(key, qty);
        return { ok: false, remaining: next + qty };
      }
      return { ok: true, remaining: next };
    }
    const curr = Number(this.strings.get(key) ?? 0);
    if (curr < qty) return { ok: false, remaining: curr };
    const next = curr - qty;
    this.strings.set(key, String(next));
    return { ok: true, remaining: next };
  }

  async incrStock(eventId, sector, qty) {
    const key = `estoque:${eventId}:${sector}`;
    this.log(`INCRBY ${key} ${qty}`);
    if (this.mode === 'live') return this.client.incrby(key, qty);
    const curr = Number(this.strings.get(key) ?? 0);
    const next = curr + qty;
    this.strings.set(key, String(next));
    return next;
  }

  async enqueue(eventId, userId, score = Date.now()) {
    const key = `fila:${eventId}`;
    const member = `usuario:${userId}`;
    this.log(`ZADD ${key} ${score} ${member}`);
    if (this.mode === 'live') {
      await this.client.zadd(key, 'NX', score, member);
      const rank = await this.client.zrank(key, member);
      this.log(`ZRANK ${key} ${member} -> ${rank}`);
      return rank === null ? -1 : rank + 1;
    }
    if (!this.sortedSets.has(key)) this.sortedSets.set(key, new Map());
    const set = this.sortedSets.get(key);
    if (!set.has(member)) set.set(member, score);
    const sorted = [...set.entries()].sort((a, b) => a[1] - b[1]);
    const idx = sorted.findIndex(([m]) => m === member);
    this.log(`ZRANK ${key} ${member} -> ${idx}`);
    return idx + 1;
  }

  async getQueue(eventId) {
    const key = `fila:${eventId}`;
    if (this.mode === 'live') {
      const raw = await this.client.zrange(key, 0, -1, 'WITHSCORES');
      const items = [];
      for (let i = 0; i < raw.length; i += 2) {
        items.push({ position: i / 2 + 1, member: raw[i], score: Number(raw[i + 1]) });
      }
      return items;
    }
    const set = this.sortedSets.get(key);
    if (!set) return [];
    return [...set.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([member, score], idx) => ({ position: idx + 1, member, score }));
  }

  async removeFromQueue(eventId, userId) {
    const key = `fila:${eventId}`;
    const member = `usuario:${userId}`;
    this.log(`ZREM ${key} ${member}`);
    if (this.mode === 'live') return this.client.zrem(key, member);
    const set = this.sortedSets.get(key);
    if (set) set.delete(member);
  }

  async createReservation(userId, data, ttlSeconds = 600) {
    const key = `reserva:${userId}`;
    this.log(`HSET ${key} eventoId ${data.eventoId} setor ${data.setor} qtd ${data.qtd} status ${data.status}`);
    this.log(`EXPIRE ${key} ${ttlSeconds}`);
    if (this.mode === 'live') {
      await this.client.hset(key, data);
      await this.client.expire(key, ttlSeconds);
      return;
    }
    const map = new Map(Object.entries(data).map(([k, v]) => [k, String(v)]));
    this.hashes.set(key, map);
    this.ttls.set(key, Date.now() + ttlSeconds * 1000);
  }

  async getReservation(userId) {
    const key = `reserva:${userId}`;
    if (this.mode === 'live') {
      const obj = await this.client.hgetall(key);
      if (!obj || Object.keys(obj).length === 0) return null;
      const ttl = await this.client.ttl(key);
      return { ...obj, qtd: Number(obj.qtd), ttl };
    }
    if (this._purgeIfExpired(key)) return null;
    const map = this.hashes.get(key);
    if (!map) return null;
    const obj = Object.fromEntries(map.entries());
    const ttl = Math.max(0, Math.round((this.ttls.get(key) - Date.now()) / 1000));
    return { ...obj, qtd: Number(obj.qtd), ttl };
  }

  async deleteReservation(userId) {
    const key = `reserva:${userId}`;
    this.log(`DEL ${key}`);
    if (this.mode === 'live') return this.client.del(key);
    this.hashes.delete(key);
    this.ttls.delete(key);
  }

  async listActiveReservations() {
    if (this.mode === 'live') {
      const keys = await this.client.keys('reserva:*');
      const res = [];
      for (const k of keys) {
        const obj = await this.client.hgetall(k);
        const ttl = await this.client.ttl(k);
        res.push({ key: k, ...obj, qtd: Number(obj.qtd), ttl });
      }
      return res;
    }
    const res = [];
    for (const key of [...this.hashes.keys()]) {
      if (this._purgeIfExpired(key)) continue;
      const obj = Object.fromEntries(this.hashes.get(key).entries());
      const ttl = Math.max(0, Math.round((this.ttls.get(key) - Date.now()) / 1000));
      res.push({ key, ...obj, qtd: Number(obj.qtd), ttl });
    }
    return res;
  }
}

module.exports = new RedisStore();
