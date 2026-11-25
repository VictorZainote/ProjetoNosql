# Tickets Pulse — Marco 2 (NoSQL Poliglota)

Plataforma distribuída de ingressos e filas virtuais para eventos de grande porte, integrando as **4 famílias NoSQL**:
- **Redis (Chave-Valor):** fila virtual (`Sorted Set`), reservas com TTL (`Hash + EXPIRE`) e estoque atômico (`DECRBY`).
- **MongoDB (Documentos):** catálogo de eventos semiestruturado, perfis de usuários e ingressos emitidos.
- **Cassandra (Wide-Column):** histórico de compras (`compras_por_evento`) e auditoria (`auditoria_eventos`) com modelagem *query-first*.
- **Neo4j (Grafos):** detecção de cambismo/fraude (dispositivos/cartões compartilhados) e rede de transferências.

## Como executar

### Opção 1: Modo completo com Docker (bancos reais)
```bash
docker compose up -d
npm install
npm start
```
Acesse: `http://localhost:3000`

### Opção 2: Modo demonstração local (sem Docker)
Caso a máquina de apresentação não tenha Docker instalado, a aplicação detecta automaticamente a indisponibilidade dos containers (`DB_MODE=auto`) e ativa o motor em memória equivalente para as 4 famílias, mantendo todos os fluxos e o Inspector de comandos funcionando:
```bash
npm install
npm start
```

### Executar testes E2E
```bash
npm test
```

## Documentação e Apresentação
- [Documentação Final (Marco 2)](docs/DOCUMENTACAO_MARCO2.md)
- [Roteiro da Apresentação (10–12 min)](docs/ROTEIRO_APRESENTACAO_MARCO2.md)
