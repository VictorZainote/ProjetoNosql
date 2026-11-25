const redisStore = require('./redisStore');
const mongoStore = require('./mongoStore');
const cassandraStore = require('./cassandraStore');
const neo4jStore = require('./neo4jStore');

async function initAllDatabases() {
  const mode = process.env.DB_MODE || 'auto';
  await Promise.all([
    redisStore.init(mode),
    mongoStore.init(mode),
    cassandraStore.init(mode),
    neo4jStore.init(mode),
  ]);

  return {
    redis: redisStore.mode,
    mongodb: mongoStore.mode,
    cassandra: cassandraStore.mode,
    neo4j: neo4jStore.mode,
  };
}

function getUnifiedCommandLog() {
  const all = [
    ...redisStore.commandLog,
    ...mongoStore.commandLog,
    ...cassandraStore.commandLog,
    ...neo4jStore.commandLog,
  ];
  return all.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 40);
}

module.exports = {
  redisStore,
  mongoStore,
  cassandraStore,
  neo4jStore,
  initAllDatabases,
  getUnifiedCommandLog,
};
