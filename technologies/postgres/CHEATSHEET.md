# PostgreSQL 18 Fast-Lookup Cheatsheet

A concise, high-density reference sheet for PostgreSQL 18 covering command-line client operations, schema definition syntax, advanced SQL querying, JSONB manipulations, MVCC tuning, execution plan analysis, and high-availability administration.

---

## 1. Client CLI (`psql`) Commands

| Command | Description | Example |
| :--- | :--- | :--- |
| `\l` | List all databases | `\l` or `\l+` (detailed with size) |
| `\c <db> [user]` | Connect to a database / user | `\c training_db app_user` |
| `\dt[+] [pattern]` | List tables in current database | `\dt+ public.*` |
| `\d <table_name>` | Describe table schema, types & constraints | `\d users` |
| `\di[+]` | List indexes | `\di+ idx_users_email` |
| `\df[+]` | List functions and stored procedures | `\df+ calculate_total` |
| `\x [auto]` | Toggle expanded tabular/vertical output | `\x on` |
| `\timing` | Toggle query execution timer | `\timing on` |
| `\dn` | List schemas in current database | `\dn` |
| `\du` | List database roles and permissions | `\du` |
| `\copy` | Fast client-side bulk data import/export | `\copy orders FROM 'orders.csv' WITH (FORMAT csv, HEADER);` |
| `\ef [func]` | Edit function code in system `$EDITOR` | `\ef get_customer_summary` |
| `\q` | Quit `psql` console | `\q` |

---

## 2. PostgreSQL 18 Data Definition Language (DDL)

### Tables, Identity & PostgreSQL 18 `uuidv7()`
```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    account_number VARCHAR(32) NOT NULL UNIQUE,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
    is_active BOOLEAN NOT NULL DEFAULT true,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

### PostgreSQL 18 Virtual vs Stored Generated Columns
```sql
CREATE TABLE line_items (
    item_id UUID PRIMARY KEY DEFAULT uuidv7(),
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    tax_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.21,
    -- Virtual: zero disk consumption, dynamically computed on SELECT (PostgreSQL 18 default)
    net_total NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) VIRTUAL,
    -- Stored: computed at INSERT/UPDATE and materialized to disk
    gross_total NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity * (1 + tax_rate)) STORED
);
```

### PostgreSQL 18 Temporal Constraints (`WITHOUT OVERLAPS`)
```sql
CREATE TABLE room_bookings (
    booking_id UUID DEFAULT uuidv7(),
    room_number VARCHAR(16) NOT NULL,
    valid_during TSTZRANGE NOT NULL,
    -- Prevents double-booking overlaps for the same room
    CONSTRAINT pk_room_booking PRIMARY KEY (room_number, valid_during WITHOUT OVERLAPS)
);
```

---

## 3. Advanced DML & Modern SQL Constructs

### PostgreSQL 18 `RETURNING OLD / NEW`
```sql
-- Atomically capture previous state and new state in an update
UPDATE subscriptions
SET status = 'active', renewed_at = now()
WHERE id = '018b3d88-7522-7901-b65a-8b1e42a98f12'
RETURNING 
    OLD.status AS previous_status, 
    NEW.status AS current_status,
    NEW.renewed_at;
```

### Atomic Upsert (`INSERT ... ON CONFLICT`)
```sql
INSERT INTO user_preferences (user_id, theme, notifications_enabled)
VALUES ('018b3d88-7522-7901-b65a-8b1e42a98f12', 'dark', true)
ON CONFLICT (user_id) 
DO UPDATE SET
    theme = EXCLUDED.theme,
    notifications_enabled = EXCLUDED.notifications_enabled,
    updated_at = clock_timestamp();
```

### Chained & Data-Modifying CTEs
```sql
WITH archived_orders AS (
    DELETE FROM active_orders
    WHERE completed_at < now() - INTERVAL '30 days'
    RETURNING order_id, customer_id, total_amount, completed_at
)
INSERT INTO order_history (order_id, customer_id, total_amount, completed_at)
SELECT order_id, customer_id, total_amount, completed_at 
FROM archived_orders;
```

### Hierarchical Recursive CTE
```sql
WITH RECURSIVE org_chart AS (
    -- Anchor Member
    SELECT employee_id, manager_id, full_name, 1 AS depth
    FROM employees
    WHERE manager_id IS NULL
    UNION ALL
    -- Recursive Member
    SELECT e.employee_id, e.manager_id, e.full_name, o.depth + 1
    FROM employees e
    INNER JOIN org_chart o ON e.manager_id = o.employee_id
)
SELECT depth, employee_id, full_name 
FROM org_chart 
ORDER BY depth, full_name;
```

---

## 4. Window Functions Reference

```sql
SELECT 
    department_id,
    employee_name,
    salary,
    -- Ranking
    ROW_NUMBER() OVER w AS row_num,
    RANK() OVER w AS rank_num,
    DENSE_RANK() OVER w AS dense_rank_num,
    -- Offsets
    LAG(salary, 1, 0) OVER w AS prev_salary,
    LEAD(salary, 1, 0) OVER w AS next_salary,
    -- Running Total (Window Frame)
    SUM(salary) OVER (
        PARTITION BY department_id 
        ORDER BY salary DESC 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_dept_total,
    -- Moving Average (Sliding Frame)
    AVG(salary) OVER (
        PARTITION BY department_id 
        ORDER BY salary DESC 
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS moving_avg
FROM employee_salaries
WINDOW w AS (PARTITION BY department_id ORDER BY salary DESC);
```

---

## 5. JSONB Query & Indexing Operators

| Operator | Return Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `->` | `jsonb` | Extract JSON element by key or array index | `data->'address'` |
| `->>` | `text` | Extract JSON element as string | `data->>'city'` |
| `#>` | `jsonb` | Extract nested object by path array | `data#>'{user, address, zip}'` |
| `#>>` | `text` | Extract nested object as string by path array | `data#>>'{user, address, zip}'` |
| `@>` | `boolean` | Left JSONB contains right JSONB | `'{"a":1, "b":2}'::jsonb @> '{"a":1}'` |
| `<@` | `boolean` | Left JSONB is contained by right JSONB | `'{"a":1}'::jsonb <@ '{"a":1, "b":2}'` |
| `?` | `boolean` | String key exists in JSONB | `data ? 'email'` |
| `?\|` | `boolean` | Any specified string key exists | `data ?\| array['mobile', 'email']` |
| `?&` | `boolean` | All specified string keys exist | `data ?& array['first', 'last']` |
| `\|\|` | `jsonb` | Concatenate / merge two JSONB objects | `data \|\| '{"status": "verified"}'` |
| `-` | `jsonb` | Delete key or array index from JSONB | `data - 'temporary_token'` |

### JSONB GIN Indexing
```sql
-- Standard GIN: supports @>, ?, ?|, ?& operators
CREATE INDEX idx_users_meta ON users USING GIN (metadata);

-- Path Ops GIN: smaller and faster, specialized for containment (@>)
CREATE INDEX idx_users_meta_path ON users USING GIN (metadata jsonb_path_ops);
```

---

## 6. Query Optimization, EXPLAIN & Indexing

### Reading Execution Plans
```sql
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, COSTS, TIMING, SUMMARY)
SELECT u.id, u.email, count(o.id)
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= '2026-01-01'
GROUP BY u.id, u.email;
```

### PostgreSQL 18 B-Tree Skip Scan Indexing
```sql
-- Composite index where tenant_id has low cardinality (e.g. 10 tenants, 1,000,000 logs)
CREATE INDEX idx_audit_tenant_created ON audit_logs (tenant_id, created_at);

-- In PostgreSQL 18, Skip Scan automatically leverages this index even when tenant_id is omitted!
SELECT * FROM audit_logs 
WHERE created_at >= '2026-10-01' 
ORDER BY created_at DESC LIMIT 50;
```

### Advanced Indexes
```sql
-- Covering Index (facilitates Index-Only Scans)
CREATE INDEX idx_orders_user_covering 
ON orders (user_id) 
INCLUDE (total_amount, order_status);

-- Partial Index
CREATE INDEX idx_unprocessed_events 
ON domain_events (created_at) 
WHERE processed = false;

-- Functional / Expression Index
CREATE INDEX idx_users_lower_email 
ON users (lower(email));
```

---

## 7. Concurrency, Locks & Queues

```sql
-- Non-blocking transactional task queue consumer
BEGIN;
SELECT id, payload, attempts
FROM task_queue
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT 1;

-- Process work in application code...

UPDATE task_queue 
SET status = 'completed', completed_at = clock_timestamp()
WHERE id = :task_id;
COMMIT;
```

---

## 8. Vector Search (`pgvector`)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
    doc_id UUID PRIMARY KEY DEFAULT uuidv7(),
    content TEXT NOT NULL,
    embedding vector(1536) -- OpenAI / Ada / modern LLM embedding dimension
);

-- Fast Approximate Nearest Neighbor (ANN) HNSW Index
CREATE INDEX idx_doc_embeddings_hnsw 
ON document_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Cosine Distance Similarity Query (<=>)
SELECT doc_id, content, (1 - (embedding <=> :query_vector)) AS similarity
FROM document_embeddings
ORDER BY embedding <=> :query_vector
LIMIT 5;
```

---

## 9. Declarative Partitioning

```sql
-- Partitioned parent table
CREATE TABLE measurement_events (
    event_id UUID DEFAULT uuidv7(),
    device_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    reading_val DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (device_id, recorded_at, event_id)
) PARTITION BY RANGE (recorded_at);

-- Monthly partition tables
CREATE TABLE measurement_events_2026_10 PARTITION OF measurement_events
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE measurement_events_2026_11 PARTITION OF measurement_events
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

-- Query with partition pruning (plan scans only target partition)
EXPLAIN (COSTS OFF)
SELECT * FROM measurement_events
WHERE recorded_at >= '2026-10-15' AND recorded_at < '2026-10-20';
```

---

## 10. Autovacuum, Bloat & Freezing Diagnostics

```sql
-- Identify tables with high dead tuple ratio (bloat risk)
SELECT 
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_tuple_pct DESC;

-- Check distance to transaction ID wraparound
SELECT 
    datname,
    age(datfrozenxid) AS age_datfrozenxid,
    ROUND(100.0 * age(datfrozenxid) / 2147483648, 2) AS wraparound_pct
FROM pg_database
ORDER BY age_datfrozenxid DESC;

-- Non-blocking index rebuild
REINDEX TABLE CONCURRENTLY accounts;
```

---

## 11. Connection Pooling & PgBouncer Essentials

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
app_db = host=127.0.0.1 port=5432 dbname=app_db

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
default_pool_size = 32
max_client_conn = 5000
reserve_pool_size = 8
server_idle_timeout = 60
```

```sql
-- PgBouncer admin console checks (psql -p 6432 -U pgbouncer pgbouncer)
SHOW POOLS;
SHOW CLIENTS;
SHOW SERVERS;
```

---

## 12. Backup, Recovery & Point-In-Time Recovery (PITR)

```bash
# Physical cluster base backup with streaming WAL
pg_basebackup -h primary.db.internal -U replicator -D /var/lib/postgresql/data -Fp -Xs -P -R

# Logical database schema and data backup (custom format, parallel jobs)
pg_dump -h localhost -U postgres -Fc -j 4 -f app_db_backup.dump app_db

# Restore logical backup into target database
pg_restore -h localhost -U postgres -d app_db_restored -j 4 app_db_backup.dump
```

```ini
# PostgreSQL recovery configuration (postgresql.conf / recovery.signal)
restore_command = 'cp /mnt/wal_archive/%f %p'
recovery_target_time = '2026-10-30 14:00:00+00'
recovery_target_action = 'promote'
```

---

## 13. High Availability & Replication Monitoring

```sql
-- Primary: monitor active streaming replication standbys and lag
SELECT 
    client_addr,
    application_name,
    state,
    sync_state,
    pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS send_lag_bytes,
    pg_wal_lsn_diff(sent_lsn, write_lsn) AS write_lag_bytes,
    pg_wal_lsn_diff(write_lsn, flush_lsn) AS flush_lag_bytes,
    pg_wal_lsn_diff(flush_lsn, replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;

-- Primary: inspect replication slots (ensure active = true to avoid WAL retention bloat)
SELECT 
    slot_name,
    plugin,
    slot_type,
    active,
    wal_status,
    safe_wal_size
FROM pg_replication_slots;

-- Standby: verify recovery status and replay LSN
SELECT 
    pg_is_in_recovery() AS in_recovery,
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS last_xact_time;
```
