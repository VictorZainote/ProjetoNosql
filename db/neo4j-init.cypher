// Constraints e indices para o grafo antifraude e de transferencias do Tickets Pulse
CREATE CONSTRAINT usuario_id_unique IF NOT EXISTS FOR (u:Usuario) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT evento_id_unique IF NOT EXISTS FOR (e:Evento) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT dispositivo_id_unique IF NOT EXISTS FOR (d:Dispositivo) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT cartao_hash_unique IF NOT EXISTS FOR (c:Cartao) REQUIRE c.hash IS UNIQUE;

// Consulta exemplo de deteccao de cambismo (multiplas contas no mesmo dispositivo ou cartao)
// MATCH (u:Usuario)-[:USOU_DISPOSITIVO]->(d:Dispositivo)
// WITH d, collect(DISTINCT u.id) AS usuarios
// WHERE size(usuarios) > 1
// RETURN d.id AS dispositivo, usuarios;
