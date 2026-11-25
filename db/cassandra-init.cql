CREATE KEYSPACE IF NOT EXISTS tickets_pulse
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3};

USE tickets_pulse;

-- Modelagem Query-First: consultar compras recentes de um evento
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
) WITH CLUSTERING ORDER BY (comprado_em DESC);

-- Modelagem Query-First: logs de auditoria por evento em ordem cronologica inversa
CREATE TABLE IF NOT EXISTS auditoria_eventos (
  evento_id text,
  ocorrido_em timestamp,
  log_id uuid,
  tipo text,
  detalhe text,
  PRIMARY KEY ((evento_id), ocorrido_em, log_id)
) WITH CLUSTERING ORDER BY (ocorrido_em DESC);
