# Roteiro de Apresentação Final — Marco 2 (10 a 12 minutos)

**Projeto:** Tickets Pulse — Plataforma Distribuída de Ingressos e Filas Virtuais  
**Apresentadores:** Leonardo Soares Paes e Victor Zainote  

---

## Estrutura de Tempo (11 minutos alvo)

| Bloco | Tempo | Responsável | Conteúdo |
| :--- | :---: | :---: | :--- |
| **1. O Problema & Evolução** | 2 min | Leonardo | Revisão rápida do problema (100k usuários, 15k req/s, gargalo de locks no SQL) e evolução do Marco 1 (2 famílias) para o Marco 2 (4 famílias). |
| **2. Arquitetura Poliglota** | 3 min | Victor | Por que cada família NoSQL foi escolhida: Redis (Chave-Valor), MongoDB (Documentos), Cassandra (Wide-Column) e Neo4j (Grafos) + CAP, BASE e Sharding. |
| **3. Demonstração ao Vivo** | 4 min | Ambos | Execução no painel web (`http://localhost:3000`) mostrando os 4 bancos reagindo em tempo real + Inspector de comandos. |
| **4. Lições Aprendidas** | 2 min | Ambos | Trade-offs reais de consistência eventual, TTL sem devolução automática no Redis e modelagem *query-first*. |

---

## Roteiro da Demonstração ao Vivo (4 minutos)

1. **Status dos Bancos (Topo da tela):** mostrar os 4 badges (**REDIS**, **MONGODB**, **CASSANDRA**, **NEO4J**).
2. **Catálogo & Fila Virtual (Redis + MongoDB):**
   - Selecionar o evento *Festival Pulse Brasília 2026* (documento semiestruturado no MongoDB).
   - Clicar em **"Simular Pico (+15)"** e depois **"Entrar na Fila (ZADD)"** — mostrar no Inspector o `ZADD` e `ZRANK`.
3. **Reserva com TTL e Estorno (Redis):**
   - Selecionar setor e quantidade e clicar em **"1. Reservar (DECRBY + TTL)"** — mostrar o estoque diminuindo atomicamente e a chave `reserva:<usuario>` com contagem de TTL.
   - Opcional: clicar em **"Expirar"** em uma reserva para demonstrar o worker devolvendo o ingresso ao estoque (`INCRBY`).
4. **Checkout Poliglota (Todos os 4 bancos):**
   - Fazer uma nova reserva e clicar em **"2. Confirmar Checkout"**.
   - Apontar no painel:
     - **Cassandra:** compra aparece imediatamente em *Histórico de Compras* (`compras_por_evento`).
     - **MongoDB:** ingressos emitidos aparecem na lista de transferências.
     - **Neo4j:** novo nó/aresta no grafo.
5. **Antifraude & Transferência (Neo4j + MongoDB):**
   - Mostrar o alerta de **Dispositivo/Cartão compartilhado** já detectado entre `usr-cambista-1` e `usr-cambista-2`.
   - Transferir um ingresso de um usuário para outro e mostrar a atualização no MongoDB e a nova aresta `TRANSFERIU_PARA` no Neo4j.

---

## Lições Aprendidas (Slide Final)
- **Não existe bala de prata:** cada modelo NoSQL resolve um padrão de acesso específico; forçar grafos no relacional ou fila de alta concorrência em disco degrada o sistema.
- **TTL do Redis exige orquestração:** `EXPIRE` apaga a chave, mas a devolução do estoque precisa de lógica da aplicação/worker.
- **Modelagem Query-First muda o raciocínio:** no Cassandra, primeiro definimos a consulta (`WHERE evento_id = ? ORDER BY comprado_em DESC`) e só depois a tabela.
