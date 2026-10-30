# Distributed Systems Cheatsheet

A high-density operational reference covering fundamental theorems, formal bounds, protocol state machines, quorum formulas, consensus invariants, and production failure modes.

---

## 1. System Models & Impossibility Theorems

### Timing & Failure Models
| Model | Message Delay Bound ($\Delta$) | Processor Drift ($\rho$) | Failure Detection | Consensus Solvability |
|---|---|---|---|---|
| **Synchronous** | Known constant $\Delta$ | Known bound $\rho$ | Perfect ($P$) | Solvable ($f < N/2$ CFT, $f < N/3$ BFT) |
| **Partially Synchronous** | Unknown or holds after GST | Bounded after GST | Eventually Strong ($\diamondsuit P$) | Solvable (Raft, Paxos, PBFT) |
| **Asynchronous** | Finite but unbounded | Unbounded / No clocks | Impossible without errors | **Impossible** deterministically if $f \ge 1$ (FLP) |

### Fundamental Bounds
- **FLP Impossibility (1985)**: In an asynchronous message-passing system, no deterministic algorithm can guarantee consensus termination in the presence of even $f = 1$ unannounced crash fault.
- **CAP Theorem (Gilbert-Lynch 2002)**: On a read/write register, Consistency (Linearizability) and Availability cannot both be guaranteed under a network partition:
  $$\text{Partition} \implies \text{Must choose } C \ (\text{CP, reject minority writes}) \lor A \ (\text{AP, accept divergent writes})$$
- **PACELC Theorem (Abadi 2012)**: If **P**artition $\to$ **A**vailability $\lor$ **C**onsistency; **E**lse $\to$ **L**atency $\lor$ **C**onsistency.
- **Byzantine Resilience Bound**: Tolerating $f$ Byzantine traitors in an unauthenticated network requires:
  $$N \ge 3f + 1 \quad (\text{or honest nodes } > 2f)$$

---

## 2. RPC, Jitter & Failure Detectors

### Retry Backoff & Jitter Formulas
- **Full Jitter (AWS Brooker)**:
  $$t_{\text{sleep}} = \text{random}(0, \min(M, b \cdot 2^i))$$
- **Decorrelated Jitter**:
  $$t_{\text{sleep}} = \min(M, \text{random}(b, \text{prev\_sleep} \cdot 3))$$
- **Retry Budget Standard**:
  $$\text{Retries allowed} \le \text{Total requests} \times 0.10 \quad (\text{Max 10\% outbound retries})$$

### $\Phi$-Accrual Failure Detector Math
$$\Phi = -\log_{10}(P_{\text{later}}(t - t_{\text{last}}))$$
- When $z = \frac{(t - t_{\text{last}}) - \mu}{\sigma} \le 0 \implies \Phi = 0$ (on time).
- For $z > 0$: $P_{\text{later}} \approx \frac{1}{\sqrt{2\pi}} \int_z^\infty e^{-u^2/2} du$.
- **Action Thresholds**:
  - $\Phi \ge 3$: Low suspicion ($P \le 10^{-3}$) $\to$ Stop assigning new work.
  - $\Phi \ge 8$: High suspicion ($P \le 10^{-8}$) $\to$ Re-replicate partitions.
  - $\Phi \ge 12$: Certain failure ($P \le 10^{-12}$) $\to$ Trigger leader failover.

---

## 3. Clocks, Logical Time & Fencing

### Lamport Logical Clock
- **Local event**: $L = L + 1$.
- **Send message**: Send $L$ with message.
- **Receive message**: $L = \max(L_{\text{local}}, L_{\text{msg}}) + 1$.
- **Property**: $a \to b \implies L(a) < L(b)$. Contrapositive: $L(a) < L(b) \implies b \not\to a$.

### Vector Clocks
- Process $i$ maintains vector $V[1 \dots N]$:
  - Local event on $i$: $V_i[i] = V_i[i] + 1$.
  - Receive message with $V_{\text{msg}}$: $V_i[k] = \max(V_i[k], V_{\text{msg}}[k]) \ \forall k$; then $V_i[i] = V_i[i] + 1$.
- **Causal Comparison**:
  - $V_a \le V_b \iff \forall k, V_a[k] \le V_b[k]$.
  - $a \to b \iff V_a \le V_b \land V_a \neq V_b$.
  - $a \parallel b \iff \neg(V_a \le V_b) \land \neg(V_b \le V_a)$ (**Concurrent / Conflict**).

### Google Spanner TrueTime
- Returns $[t_{\text{earliest}}, t_{\text{latest}}]$ with uncertainty $\epsilon \approx 1\text{--}7\text{ms}$.
- **Commit Wait Invariant**: Coordinator assigns commit timestamp $s = t_{\text{latest}}$ and waits until:
  $$t_{\text{earliest}} > s \quad (\text{Wait duration } \ge 2\epsilon)$$
- Guarantees: $T_1 \text{ completed before } T_2 \text{ begins} \implies s_1 < s_2$.

### Fencing Token Invariant
$$\text{Storage checks: Reject write if } \text{token} \le \text{max\_token\_observed}$$
- Prevents STW garbage collection pauses and hypervisor preemptions from corrupting files.

---

## 4. Consistency Models Cheat Sheet

### Hierarchy of Consistency Models (Strict to Weak)
1. **Strict Serializability (External Consistency)**: Serializability + Linearizability (Spanner, CockroachDB).
2. **Linearizability**: Single object, real-time precedence ($res(a) <_{real} inv(b) \implies a <_S b$). Composable (P-compositional).
3. **Sequential Consistency**: Operations follow local program order and some legal serial interleaving; NOT real-time constrained; NOT composable.
4. **Causal Consistency with Convergence (SEC)**: Operations causally related ($a \to b$) ordered identically; concurrent operations merge deterministically (CRDTs).
5. **Session Guarantees**:
   - **Read-Your-Writes (RYW)**: Client reads its own writes.
   - **Monotonic Reads (MR)**: Repeated reads never observe earlier states.
   - **Monotonic Writes (MW)**: Client writes serialized in submission order.
   - **Writes-Follow-Reads (WFR)**: Writes made after reading version $v$ serialized after $v$.
6. **Eventual Consistency**: Replicas converge if writes cease ($t \to \infty$).

---

## 5. Replication & Quorums

### Quorum Math
- Standard majority quorums:
  $$R + W > N \quad \text{and} \quad W > N / 2$$
- **Flexible Paxos Condition (Howard et al. 2016)**:
  $$Q_1 \cap Q_2 \neq \emptyset \quad (\text{Phase 1 quorum intersects Phase 2 quorum})$$
  - Example ($N=6$): $Q_1 = 5$ (Election), $Q_2 = 2$ (Steady-state write). $5 + 2 = 7 > 6 \implies$ Safe!

### Chain Replication Rules
- **Write**: Client $\to$ Head $\to$ Node 2 $\to \dots \to$ Tail $\to$ Client ACK.
- **Read**: Client $\to$ Tail $\to$ Client (Strictly Linearizable in 1 hop).
- **Failure**: Tail failure $\to$ penultimate becomes Tail; Head failure $\to$ successor becomes Head; Middle failure $\to$ upstream links to downstream.

### ABD Protocol (Linearizable Register over Quorums)
- **Read Phase 1**: Query quorum $R$, pick $(v, ts)$ with highest timestamp.
- **Read Phase 2 (Write-Back / Read-Repair)**: Write $(v, ts)$ to write quorum $W$ before returning $v$. Eliminates New-Then-Old anomaly.

---

## 6. Consensus: Paxos, Raft & ZAB

### Single-Decree Paxos Protocol
```
Proposer                                  Acceptors
   |-------- Phase 1a: Prepare(n) --------->|   n > minProposal
   |<------- Phase 1b: Promise(n, max_v) ---|   Promise not to accept < n
   |                                        |
   |-- Phase 2a: Accept(n, adopted_val) --->|   If n >= minProposal:
   |<------- Phase 2b: Accepted ------------|     accepted_v = val, minProposal = n
```
- If any Phase 1b promise contains an accepted value, Proposer **must** propose the value with the highest accepted proposal number.

### Raft Consensus Invariants
1. **Election Safety**: At most one leader can be elected per term.
2. **Leader Append-Only**: A leader never overwrites or truncates its own log entries.
3. **Log Matching Invariant**: If two logs contain an entry with the same index and term:
   - They store the identical command.
   - Their logs are identical in all preceding entries ($0 \dots \text{index}$).
4. **Leader Completeness**: If a log entry is committed in a given term, that entry is present in the logs of the leaders for all higher terms.
5. **State Machine Safety**: If a server applies an entry at index $i$ to its state machine, no other server will apply a different entry at index $i$.

### Raft Figure 8 Commit Rule
$$\mathbf{A\ leader\ NEVER\ commits\ an\ entry\ from\ a\ previous\ term\ by\ counting\ replicas!}$$
- An entry is committed ONLY when an entry from the leader's **current term** is stored on a majority.

### Persistent vs Volatile Raft State
- **Persistent (`fsync` before RPC response)**: `currentTerm`, `votedFor`, `log[]`.
- **Volatile (reconstructed)**: `commitIndex`, `lastApplied`, `nextIndex[]`, `matchIndex[]`.

---

## 7. Distributed Transactions & Coordination

### Two-Phase Commit (2PC) State Matrix
```
Coordinator                               Participants
   |-------- Phase 1: Prepare ------------->|   Acquire local locks, write PREPARE log
   |<------- Vote YES / NO -----------------|   Vote YES -> Enters PREPARED (BLOCKED)
   |                                        |
   |-- Phase 2: Global COMMIT / ABORT ----->|   Apply mutation, write COMMIT log, release locks
   |<------- Acknowledged ------------------|
```
- **Blocking Coordinator Flaw**: If coordinator crashes while participants are in `PREPARED`, participants cannot commit or abort unilaterally; locks are held indefinitely.

### Sagas vs 2PC
| Feature | Two-Phase Commit (2PC) | Saga Pattern |
|---|---|---|
| **ACID Property** | Full ACID (Strict Serializability) | ACD (No Isolation: intermediate states exposed) |
| **Lock Duration** | Full transaction duration across all nodes | Local transaction duration per step |
| **Rollback Mechanism** | Abort drops uncommitted locks | Explicit semantic compensating transactions |
| **Scalability** | Low (fragile to network latency & partitions) | High (asynchronous, decoupled microservices) |

### ZooKeeper Fair Lock Recipe (No Thundering Herd)
1. Client creates ephemeral sequential znode: `/lock/guid-lock-0000000042`.
2. Client lists children under `/lock`.
3. If client's node has lowest sequence number $\to$ **Lock acquired!**
4. Else $\to$ Set watch ONLY on the node with the **immediately preceding sequence number** (`guid-lock-0000000041`).
5. Upon watch trigger $\to$ Go to step 2 ($O(1)$ wakeups per release).

---

## 8. Distributed Logs & Kafka

### Durability Configuration
- **Leader acknowledgment**: `acks=all` (waits for all current ISR nodes).
- **Minimum in-sync replicas**: `min.insync.replicas=2` (rejects write if $\text{ISR} < 2$).
- **Replication factor**: $\text{RF} \ge 3$.
- **High Watermark Rule**: Consumers can read up to $HW = \min_{r \in \text{ISR}}(\text{LEO}_r)$.

### Partition Resizing Trap
$$\text{Partition} = \text{hash}(key) \pmod N$$
- Changing $N$ breaks ordering for $\sim \frac{N_{\text{new}} - N_{\text{old}}}{N_{\text{new}}}$ of keys.
- **Rule**: Never increase partition counts on topics requiring strict per-key ordering without re-keying into a new topic.

---

## 9. Conflict-Free Replicated Data Types (CRDTs)

### Join-Semilattice Properties for Merge ($\sqcup$)
1. **Commutative**: $A \sqcup B = B \sqcup A$ (Packet arrival order irrelevant).
2. **Associative**: $(A \sqcup B) \sqcup C = A \sqcup (B \sqcup C)$ (Batching irrelevant).
3. **Idempotent**: $A \sqcup A = A$ (Duplicate network deliveries have zero side effects).

### Core CRDT Implementations
- **G-Counter (Grow-Only)**: $V[1 \dots N]$; merge: $V_{\text{res}}[i] = \max(V_A[i], V_B[i])$; value: $\sum V[i]$.
- **PN-Counter**: Two G-Counters $(P, N)$; value: $\sum P[i] - \sum N[i]$.
- **OR-Set (Observed-Removed Set, Add-Wins)**: Elements stored as $(e, \text{tag})$; `add(e)` generates new UUID tag; `remove(e)` deletes observed tags; merge takes set union of surviving $(e, \text{tag})$ pairs.

---

## 10. Top 10 Production Distributed Systems Gotchas

1. **LWW Silent Overwrite**: Resolving concurrent database writes via physical system clocks causes silent data loss under ordinary NTP drift.
2. **Missing Fencing Tokens**: Relying on distributed lock leases without storage-side monotonic fencing tokens causes split-brain data corruption during GC pauses.
3. **Naive Quorums ($R+W>N$)**: Quorum intersection without read-repair permits the New-Then-Old non-linearizable read anomaly.
4. **Retry Amplification Storms**: Retrying without jitter and retry budgets pushes overloaded databases into persistent metastable failures.
5. **Raft Pre-Vote Omission**: A rejoining partitioned follower increments its term and disrupts an active healthy leader unless Pre-Vote is enabled.
6. **2PC Coordinator Crash**: Coordinator failure in 2PC leaves participants blocked holding locks indefinitely.
7. **Kafka `min.insync.replicas=1`**: Setting `acks=all` with `min.insync.replicas=1` allows silent data loss if the lone leader crashes.
8. **Partition Count Alteration**: Resizing topic partitions silently scrambles key-to-partition hashing, breaking sequential processing order.
9. **CRDT Tombstone Bloat**: Collaborative editing sequence CRDTs leak memory indefinitely without causal stability garbage collection.
10. **Single-Server Raft Config Change**: Transitioning configurations directly without Joint Consensus ($C_{\text{old,new}}$) allows two disjoint majorities to elect two leaders concurrently.
