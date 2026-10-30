# Distributed Systems Question Bank & Mock Examination

This bank contains 75 rigorous questions covering distributed systems theory, protocol mechanics, invariant proofs, failure modes, and principal/staff-level architecture, aligned with **MIT 6.5840**, **Cambridge CST Part II**, and **Senior/Staff Distributed Systems Engineering Loops**.

---

## Part 1: Domain Question Banks (Questions 1–75)

### Domain 1: System Models, Impossibility & CAP

#### Q-DIST-001 · System Models · difficulty 1 · single
Which of the following describes the fundamental distinction between an asynchronous network model and a partially synchronous network model?
- A) In an asynchronous model, message delivery is never guaranteed; in a partially synchronous model, all messages arrive instantly.
- B) In an asynchronous model, there are no upper bounds on message transmission delay or processor speed; in a partially synchronous model, bounds exist but are unknown or hold only after some Global Stabilization Time (GST).
- C) In an asynchronous model, crash faults can be detected with absolute certainty; in a partially synchronous model, failure detection is impossible.
- D) In an asynchronous model, physical clocks are perfectly synchronized via GPS; in a partially synchronous model, clocks drift arbitrarily.
<details><summary>Answer</summary>

**B.** In the asynchronous model (FLP), message transmission delays and processing execution times are finite but completely unbounded. In the partially synchronous model (Dwork, Lynch, Stockmeyer 1988), bounds exist but are either unknown or only hold eventually after a Global Stabilization Time (GST).
- Why not A: In the standard asynchronous model, messages sent across non-faulty links are eventually delivered (they are not dropped indefinitely), but no time bound can be placed on arrival.
- Why not C: In an asynchronous network, an arbitrary delay is indistinguishable from a node crash, making perfect failure detection impossible.
- Why not D: Physical clocks cannot be synchronized in an asynchronous model.
- Ref: [modules/01-system-models-and-impossibility.md](../modules/01-system-models-and-impossibility.md#timing-models), Dwork, Lynch, Stockmeyer (1988)
</details>

#### Q-DIST-002 · Impossibility Proofs · difficulty 2 · scenario
In the classic Two Generals Problem, General A sends a message $m_1$ ("Attack at dawn") across an unreliable channel that drops an unknown fraction of messages. General B receives $m_1$ and responds with ACK $a_1$. Why can the two generals never reach common knowledge of an attack agreement across a purely lossy channel in bounded time?
- A) Because the Byzantine Generals theorem requires at least 4 generals to tolerate 1 traitor.
- B) Because any finite sequence of messages ending with message $m_k$ leaves the sender of $m_k$ uncertain whether $m_k$ was delivered, requiring an infinite chain of acknowledgments.
- C) Because network switches drop TCP SYN packets when the queue is saturated.
- D) Because physical clocks drift at rate $\rho$, invalidating the attack timestamp.
<details><summary>Answer</summary>

**B.** By mathematical induction on the protocol length: Suppose there exists a minimum-length successful protocol of $k$ messages that guarantees common agreement. The last message $m_k$ could be dropped by the adversary. Since the protocol was guaranteed to succeed, the sender of $m_k$ must attack regardless of whether $m_k$ arrived. But if $m_k$ was unnecessary, a protocol of length $k-1$ would suffice. By induction, no messages are required, which is a contradiction since initial states are undecided. Common knowledge cannot be achieved across an unreliable link.
- Why not A: Two Generals concerns message omission, not Byzantine arbitrary behavior.
- Why not C: The problem is a foundational mathematical result, independent of transport protocols like TCP.
- Why not D: Time drift is irrelevant to the message-loss impossibility proof.
- Ref: [modules/01-system-models-and-impossibility.md](../modules/01-system-models-and-impossibility.md#the-two-generals-problem), Gray (1978)
</details>

#### Q-DIST-003 · Impossibility Proofs · difficulty 3 · single
What is the precise statement and consequence of the Fischer-Lynch-Paterson (FLP) impossibility result (1985)?
- A) In an asynchronous distributed system, consensus can be solved deterministically if at most $f < n/2$ nodes crash.
- B) In an asynchronous distributed system with message passing, no deterministic consensus protocol can guarantee liveness (termination) in the presence of even a single unannounced crash fault.
- C) In a synchronous distributed system, Byzantine agreement requires $3f + 1$ rounds of communication.
- D) Distributed databases cannot guarantee both serializability and durability under network partitions.
<details><summary>Answer</summary>

**B.** FLP proves that in an asynchronous network model where nodes communicate via message buffers and may experience fail-stop crashes, no deterministic algorithm can guarantee Agreement, Validity, and Termination simultaneously if even one crash fault is possible ($f \ge 1$). Starting from an initial bivalent configuration, an adversary can perpetually delay messages to maintain bivalence indefinitely.
- Why not A: FLP proves impossibility for even $f = 1$; majority quorums cannot circumvent FLP in pure asynchronous models without timeouts, randomization, or partial synchrony.
- Why not C: FLP applies to crash faults in asynchronous systems, not synchronous Byzantine rounds.
- Why not D: This confuses FLP with CAP/PACELC.
- Ref: [modules/01-system-models-and-impossibility.md](../modules/01-system-models-and-impossibility.md#flp-impossibility-result), Fischer, Lynch, Paterson (1985)
</details>

#### Q-DIST-004 · CAP & PACELC · difficulty 1 · single
In Daniel Abadi's PACELC theorem, what does the acronym stand for?
- A) If Partition: choose Availability or Consistency; Else: choose Latency or Consistency.
- B) If Partial: choose Asynchrony or Consensus; Else: choose Linearizability or Concurrency.
- C) If Partition: choose Atomicity or Durability; Else: choose Logging or Caching.
- D) If Primary: choose Active or Passive; Else: choose Leader or Candidate.
<details><summary>Answer</summary>

**A.** PACELC expands the CAP theorem by observing that partitions are rare: If there is a **P**artition, how does your system trade off **A**vailability versus **C**onsistency? **E**lse (during normal failure-free operation), how does your system trade off **L**atency versus **C**onsistency?
- Why not B, C, D: These are fictitious expansions.
- Ref: [modules/01-system-models-and-impossibility.md](../modules/01-system-models-and-impossibility.md#pacelc-beyond-binary-cap), Abadi (2012)
</details>

#### Q-DIST-005 · Formal Properties · difficulty 2 · single
In Lamport's classification of distributed system properties, which of the following is a **Safety** property, and which is a **Liveness** property?
- A) Safety: "Every client request eventually receives a response"; Liveness: "No two nodes hold the distributed lock simultaneously".
- B) Safety: "No two nodes hold the distributed lock simultaneously"; Liveness: "Every client request eventually receives a response".
- C) Safety: "The system terminates in under 100 milliseconds"; Liveness: "The system never runs out of disk space".
- D) Safety: "Messages are delivered in FIFO order"; Liveness: "Messages are encrypted with AES-256".
<details><summary>Answer</summary>

**B.** A Safety property asserts that "nothing bad happens" (a violation can be recognized in a finite execution trace and cannot be undone). A Liveness property asserts that "something good eventually happens" (no finite trace can violate it, because the good thing could always happen in the future). Mutual exclusion is Safety; eventual response is Liveness.
- Why not A: The classifications are inverted.
- Why not C: Termination in under 100ms is a timed safety property, not pure liveness.
- Why not D: Encryption is a safety invariant.
- Ref: [modules/01-system-models-and-impossibility.md](../modules/01-system-models-and-impossibility.md#safety-vs-liveness), Alpern & Schneider (1985)
</details>

---

### Domain 2: Networks, RPC & Failure Detection

#### Q-DIST-006 · RPC Semantics · difficulty 2 · scenario
A payments service experiences a network timeout while calling a third-party billing gateway. The network packet containing the payment request actually reached the gateway and was processed, but the TCP connection was reset before the HTTP response reached the caller. If the caller blindly retries the HTTP request without an idempotency key, what happens?
- A) The billing gateway automatically detects the duplicate via TCP SYN sequence numbers and ignores it.
- B) The customer is charged twice because standard HTTP POST requests are non-idempotent without application-level deduplication.
- C) The database automatically issues a compensating transaction via the two-phase commit coordinator.
- D) The client library throws an unrecoverable `ECONNRESET` and cancels the original charge.
<details><summary>Answer</summary>

**B.** At-least-once delivery without deduplication causes duplicate executions of non-idempotent operations. TCP sequence numbers operate only within the scope of a single transport-layer connection; once a connection is severed, subsequent connections have new sequence numbers. The gateway has no way to recognize the retry as identical without an application-layer idempotency key.
- Why not A: TCP state is ephemeral and connection-scoped; it does not deduplicate across distinct connections.
- Why not C: 2PC requires an explicit coordinator protocol; standard HTTP POSTs do not participate in 2PC.
- Why not D: Throwing an error in the client does not alter the fact that the remote server already executed the charge.
- Ref: [modules/02-networks-rpc-and-failure-detection.md](../modules/02-networks-rpc-and-failure-detection.md#at-most-once-rpc-mechanics), Birrell & Nelson (1984)
</details>

#### Q-DIST-007 · Jitter & Retries · difficulty 2 · single
In a large distributed microservice mesh experiencing downstream database overload, why is Full Jitter or Decorrelated Jitter strictly preferred over standard Exponential Backoff without jitter?
- A) Standard exponential backoff causes retrying clients to synchronize their retry waves into periodic, destructive traffic spikes (thundering herds).
- B) Exponential backoff increases CPU utilization by a factor of $2^k$.
- C) Jitter guarantees that message payload sizes decrease with each retry attempt.
- D) Standard exponential backoff violates TCP congestion control RFC 5681.
<details><summary>Answer</summary>

**A.** Without jitter, clients that fail simultaneously due to a downstream outage will calculate identical backoff intervals ($b \cdot 2^i$). Their subsequent retries arrive at the downstream service simultaneously, creating severe periodic spikes ("thundering herds") that prevent the downstream service from recovering. Full Jitter ($t = \text{random}(0, \min(M, b \cdot 2^i))$) spreads the load uniformly over time.
- Why not B: Calculating backoff sleep delays takes negligible CPU cycles.
- Why not C: Jitter modifies the timing delay, not the payload size.
- Why not D: Application-layer retry logic operates above the transport layer.
- Ref: [modules/02-networks-rpc-and-failure-detection.md](../modules/02-networks-rpc-and-failure-detection.md#retry-strategies-and-jitter), Brooker (AWS Architecture Blog 2015)
</details>

#### Q-DIST-008 · Metastable Failures · difficulty 3 · scenario
A downstream cache cluster restarts after a power failure. During the reboot, all upstream application servers experience cache misses and forward their read traffic directly to the primary database. The database CPU hits 100%, causing queries to time out. Upstream services retry their timed-out queries with exponential backoff. Even after the cache cluster finishes booting and is fully operational, the system remains stuck at 100% database CPU and high error rates. What is this phenomenon called, and how can it be permanently broken?
- A) Byzantine Fault; broken by replacing the database nodes with Proof-of-Work validators.
- B) Metastable Failure driven by a sustaining feedback loop; broken by load-shedding, dropping retries, and rate-limiting cache-warming traffic.
- C) Distributed Deadlock; broken by running Tarjan's strongly connected components algorithm on the wait-for graph.
- D) Split-Brain; broken by electing an odd number of Raft voters.
<details><summary>Answer</summary>

**B.** A metastable failure occurs when a temporary trigger (cache restart) pushes a system into an alternate, sustained degraded state where feedback loops (retry amplification, cache invalidation, work queues) generate more load than the system can process, even after the initial trigger is removed. It can only be cleared by reducing load below system capacity: shedding load at the gateway, enforcing strict retry budgets (e.g., max 10% retries), and warming caches under rate limits.
- Why not A: Nodes are not malicious or compromised; they are simply overloaded.
- Why not C: The database is thrashing under CPU saturation, not blocked in a cyclic lock dependency.
- Why not D: There is no partitioning of consensus leaders.
- Ref: [modules/02-networks-rpc-and-failure-detection.md](../modules/02-networks-rpc-and-failure-detection.md#metastable-failures-and-retry-storms), Bronson et al. (OSDI 2022)
</details>

#### Q-DIST-009 · Failure Detection · difficulty 2 · single
How does the $\Phi$-Accrual Failure Detector (Hayashibara et al.) differ from a traditional binary heartbeat failure detector?
- A) It uses Byzantine quorum consensus to cast votes on node death.
- B) Instead of returning a binary flag (Alive/Dead), it outputs a continuous suspicion metric $\Phi = -\log_{10}(P_{\text{later}})$, allowing applications to trigger progressive actions (e.g., pause reads at $\Phi=3$, re-replicate at $\Phi=8$, elect new leader at $\Phi=12$).
- C) It guarantees zero false positives in purely asynchronous networks.
- D) It requires hardware GPS clocks to compute packet flight time.
<details><summary>Answer</summary>

**B.** The $\Phi$-accrual failure detector decouples monitoring from policy. By estimating the distribution of heartbeat arrival intervals, it computes the probability $P_{\text{later}}$ that a heartbeat will arrive more than $t - t_{\text{last}}$ after the previous one. The output $\Phi = -\log_{10}(P_{\text{later}})$ represents the scale of suspicion. High-priority, irreversible operations (like promoting a replica) can wait for high $\Phi$, while lightweight precautions (like sending an alert or stopping task assignment) trigger at lower $\Phi$.
- Why not A: It is a local statistical detector, not a consensus protocol.
- Why not C: FLP proves that in asynchronous networks, false positives cannot be eliminated if crash faults are to be detected in finite time.
- Why not D: It measures local time intervals between received heartbeats; no physical clock synchronization is needed.
- Ref: [modules/02-networks-rpc-and-failure-detection.md](../modules/02-networks-rpc-and-failure-detection.md#phi-accrual-failure-detectors), Hayashibara et al. (SRDS 2004)
</details>

#### Q-DIST-010 · Gossip Protocols · difficulty 2 · single
In the SWIM (Structured Weakly-Consistent Infection-Style Process Group Membership) gossip protocol, how does indirect probing resolve the false suspicion caused by localized network packet loss?
- A) If target node $j$ does not respond to a direct `ping` from node $i$, node $i$ requests $k$ random peer nodes to send indirect `ping-req(j)` messages to $j$.
- B) Node $i$ immediately broadcasts a `Dead` message to all $N$ nodes in the cluster.
- C) Node $i$ asks the central ZooKeeper ensemble to check if node $j$'s ephemeral znode exists.
- D) Node $i$ uses ICMP ping sweeps across the entire subnet.
<details><summary>Answer</summary>

**A.** In SWIM, direct probing can fail due to localized edge congestion between node $i$ and node $j$, even when node $j$ is healthy. Before declaring $j$ suspect, node $i$ selects $k$ random peers and sends them `ping-req(j)`. If any of the $k$ peers successfully pings $j$ and forwards the ACK back to $i$, node $j$ is marked alive. This achieves $O(1)$ message overhead per node per period while sharply reducing false positive failure detections.
- Why not B: Declaring dead immediately without indirect probing causes severe false positives on transient packet drops.
- Why not C: SWIM is decentralized and peer-to-peer; it does not use ZooKeeper.
- Why not D: ICMP does not check process-level health and does not scale in distributed groups.
- Ref: [modules/02-networks-rpc-and-failure-detection.md](../modules/02-networks-rpc-and-failure-detection.md#swim-gossip-protocol), Das, Gupta, Motivala (DSN 2002)
</details>

---

### Domain 3: Logical Time, Physical Clocks & Ordering

#### Q-DIST-011 · Physical Clocks · difficulty 1 · scenario
Two distinct database nodes, Node 1 and Node 2, synchronize their physical time using standard NTP across the public Internet. Node 1's clock is running 25ms fast relative to UTC, while Node 2's clock is running 30ms slow. Client A writes `x = 1` to Node 1 at physical UTC time $t=1000$. Client B reads `x = 1` from Node 1, and subsequently writes `x = 2` to Node 2 at physical UTC time $t=1010$. Both nodes resolve conflicts using Last-Write-Wins (LWW) based on their local physical timestamps. What is the value of $x$ according to LWW?
- A) `x = 2`, because Client B's write occurred causally after Client A's write in real time.
- B) `x = 1`, because Node 1 assigned timestamp $1000 + 25 = 1025\text{ms}$, while Node 2 assigned timestamp $1010 - 30 = 980\text{ms}$, silently overwriting Client B's newer write.
- C) The database throws a `SerializabilityException` because of the clock discrepancy.
- D) `x = null`, because NTP resets the database journal.
<details><summary>Answer</summary>

**B.** This is the catastrophic silent data loss flaw of physical Last-Write-Wins (LWW). Even though Client B's write happened 10ms after Client A's write in real physical time, Node 1's skewed clock assigned timestamp 1025ms, while Node 2's slow clock assigned timestamp 980ms. When replicas reconcile, Node 1's timestamp $1025 > 980$ wins, permanently discarding the causally later write $x = 2$.
- Why not A: LWW compares timestamps, not physical UTC reality.
- Why not C: Standard LWW storage systems (like Apache Cassandra) do not detect clock anomalies or throw exceptions.
- Why not D: NTP does not reset database journals.
- Ref: [modules/03-time-clocks-and-ordering.md](../modules/03-time-clocks-and-ordering.md#physical-clocks-and-skew), Kleppmann (DDIA 2e Chapter 8)
</details>

#### Q-DIST-012 · Logical Clocks · difficulty 2 · single
Given Lamport timestamps $L(a)$ and $L(b)$ for two events $a$ and $b$, what can be definitively concluded if $L(a) < L(b)$?
- A) Event $a$ definitely caused event $b$ ($a \to b$).
- B) Event $a$ occurred strictly before event $b$ in physical real time.
- C) It is impossible that $b$ caused $a$ ($b \not\to a$); however, $a$ and $b$ may either be causally related ($a \to b$) or concurrent ($a \parallel b$).
- D) Events $a$ and $b$ were executed on the same physical server.
<details><summary>Answer</summary>

**C.** Lamport clocks satisfy the Clock Consistency Condition: $a \to b \implies L(a) < L(b)$. However, the converse does NOT hold: $L(a) < L(b)$ does not imply $a \to b$. Two completely independent, concurrent events can have arbitrary Lamport timestamps. The only certainty is the contrapositive: if $L(a) < L(b)$, then $b$ could not have caused $a$ ($b \not\to a$).
- Why not A: Lamport clocks cannot distinguish causal dependency from concurrency.
- Why not B: Lamport logical time is completely decoupled from physical real time.
- Why not D: Events can occur on distinct nodes in the cluster.
- Ref: [modules/03-time-clocks-and-ordering.md](../modules/03-time-clocks-and-ordering.md#lamport-timestamps), Lamport (CACM 1978)
</details>

#### Q-DIST-013 · Vector Clocks · difficulty 2 · scenario
In a 3-node cluster ($A, B, C$), event $x$ has vector timestamp $V(x) = [A: 2, B: 1, C: 0]$ and event $y$ has vector timestamp $V(y) = [A: 1, B: 2, C: 0]$. What is the causal relationship between $x$ and $y$?
- A) $x$ causally preceded $y$ ($x \to y$).
- B) $y$ causally preceded $x$ ($y \to x$).
- C) $x$ and $y$ are concurrent ($x \parallel y$), indicating a conflict.
- D) $x$ and $y$ are identical events.
<details><summary>Answer</summary>

**C.** In vector clocks, $V_1 \le V_2$ if and only if $\forall k, V_1[k] \le V_2[k]$. Here, for node $A$, $V(x)[A] = 2 > V(y)[A] = 1$, but for node $B$, $V(x)[B] = 1 < V(y)[B] = 2$. Because neither vector is component-wise less than or equal to the other, the events are concurrent ($x \parallel y$). They were generated without knowledge of each other and represent a conflict.
- Why not A: $V(x)[B] < V(y)[B]$ contradicts $x \to y$.
- Why not B: $V(x)[A] > V(y)[A]$ contradicts $y \to x$.
- Why not D: The vectors have different values.
- Ref: [modules/03-time-clocks-and-ordering.md](../modules/03-time-clocks-and-ordering.md#vector-clocks), Mattern (1988), Fidge (1988)
</details>

#### Q-DIST-014 · Google Spanner TrueTime · difficulty 3 · single
In Google Spanner, the TrueTime API returns a time interval $[t_{\text{earliest}}, t_{\text{latest}}]$ such that the absolute UTC physical time $t_{\text{absolute}}$ is guaranteed to fall within the interval, with maximum error bound $\epsilon \approx 1\text{--}7\text{ms}$. How does Spanner guarantee external consistency (linearizability across transactions) using TrueTime?
- A) By waiting for a Paxos majority on every read operation without timestamps.
- B) By assigning commit timestamp $s = t_{\text{latest}}$ and having the leader delay the transaction response until $t_{\text{earliest}} > s$ (Commit Wait of $2\epsilon$).
- C) By relying on NTP servers without hardware atomic clocks.
- D) By utilizing Lamport clocks to order cross-datacenter mutations.
<details><summary>Answer</summary>

**B.** To guarantee that transaction $T_2$ receives a commit timestamp $s_2$ strictly greater than $T_1$'s commit timestamp $s_1$ if $T_2$ starts after $T_1$ commits in real time ($t_{1,\text{commit}} < t_{2,\text{start}} \implies s_1 < s_2$), Spanner uses **Commit Wait**. The coordinator picks commit timestamp $s = \text{now}().\text{latest}$. It holds the commit response until $\text{now}().\text{earliest} > s$. This wait duration is at least $2\epsilon$, ensuring that the absolute physical time has passed $s$ before any client can observe the committed data.
- Why not A: Spanner uses timestamps to serve read-only transactions without acquiring locks or running Paxos rounds.
- Why not C: Spanner requires GPS receivers and atomic rubidium clocks in each datacenter to enforce a strict $\epsilon$ bound.
- Why not D: Logical Lamport clocks cannot enforce real-time external consistency across disconnected clients.
- Ref: [modules/03-time-clocks-and-ordering.md](../modules/03-time-clocks-and-ordering.md#google-spanner-truetime), Corbett et al. (OSDI 2012)
</details>

#### Q-DIST-015 · Fencing Tokens · difficulty 2 · scenario
Client 1 acquires a distributed lock with a 10-second TTL from a coordination service to update a critical file on network storage. Immediately after acquiring the lock, Client 1 experiences a 15-second Stop-The-World (STW) garbage collection pause. During this pause, the lock expires and Client 2 acquires the lock, writes data to storage, and releases it. Client 1 resumes execution from its GC pause and proceeds to execute its write. How do fencing tokens prevent Client 1 from corrupting Client 2's write?
- A) The storage system measures physical time and rejects Client 1's write if more than 10 seconds elapsed.
- B) The coordination service assigns a monotonically increasing token (e.g., token 34 to Client 1, token 35 to Client 2); the storage layer tracks the highest observed token and rejects any write with a token $\le$ current maximum.
- C) Client 1 sends an ICMP ping to Client 2 before writing.
- D) The operating system cancels Client 1's disk write system call upon thread resumption.
<details><summary>Answer</summary>

**B.** A client can never know whether its own lease has expired, because thread pauses, GC, and hypervisor preemptions can suspend execution indefinitely between checking the lock and writing to storage. Fencing tokens make the storage layer the enforcement boundary. The lock service issues a monotonic sequence number with each grant (Client 1 gets 34, Client 2 gets 35). Storage records the latest token (35). When Client 1 awakens and submits write with token 34, storage rejects it ($34 < 35$).
- Why not A: Storage nodes cannot rely on physical clocks due to skew and drift.
- Why not C: Client 1 is unaware that its lock expired, so it has no reason to contact Client 2.
- Why not D: Operating systems do not introspect application-level distributed lock semantics.
- Ref: [modules/03-time-clocks-and-ordering.md](../modules/03-time-clocks-and-ordering.md#gc-pauses-and-fencing-tokens), Kleppmann (2016)
</details>

#### Q-DIST-016 · Hybrid Logical Clocks · difficulty 2 · single
What is the primary motivation for Hybrid Logical Clocks (HLC, Kulkarni et al.) compared to pure physical clocks or pure Lamport logical clocks?
- A) HLC replaces network hardware with atomic quantum links.
- B) HLC provides the causality-tracking properties of Lamport clocks while maintaining values bounded within maximum physical clock drift $\epsilon$ of physical time ($|l.l - \text{pt}| \le \epsilon$).
- C) HLC eliminates the need for vector clocks in multi-master database replication.
- D) HLC allows consensus to terminate in 0 network round-trips.
<details><summary>Answer</summary>

**B.** Pure Lamport clocks capture causality ($a \to b \implies L(a) < L(b)$) but can drift arbitrarily far from physical wall-clock time. Pure physical clocks track wall time but violate causality under skew. HLC combines a physical component $l$ and a logical counter $c$ into a tuple $(l, c)$. It guarantees that timestamps strictly reflect causality while guaranteeing that $l$ never drifts further than the maximum NTP offset $\epsilon$ from local physical time.
- Why not A: HLC is an algorithmic software clock protocol.
- Why not C: HLC establishes a total order; vector clocks are still required to detect concurrent multi-writer conflicts.
- Why not D: Zero-RTT consensus violates fundamental FLP/Paxos bounds.
- Ref: [modules/03-time-clocks-and-ordering.md](../modules/03-time-clocks-and-ordering.md#hybrid-logical-clocks-hlc), Kulkarni et al. (2014)
</details>

---

### Domain 4: Consistency Models & Linearizability

#### Q-DIST-017 · Linearizability Definition · difficulty 2 · single
According to the formal definition of Linearizability by Maurice Herlihy and Jeannette Wing (1990), what two conditions must every concurrent execution history satisfy?
- A) 1. Every write must be acknowledged by 100% of nodes; 2. All reads must return identical byte counts.
- B) 1. Operations must appear to take effect at a discrete linearization point instantaneously between their invocation and response events; 2. The sequential order must respect the real-time precedence order of non-overlapping operations.
- C) 1. Database transactions must execute in two-phase locking order; 2. Foreign key constraints must never be violated.
- D) 1. All nodes must share a single physical CPU clock; 2. Network links must be lossless.
<details><summary>Answer</summary>

**B.** Linearizability is a composable, non-blocking recency guarantee for single objects. A concurrent history is linearizable if it can be extended by appending responses or discarding incomplete operations to yield a sequential history $S$ such that: (1) $S$ is equivalent to a legal sequential execution (satisfies the data type's sequential spec), and (2) for any two operations $op_1$ and $op_2$, if $op_1$ completes before $op_2$ begins in real time ($res(op_1) <_{real} inv(op_2)$), then $op_1$ precedes $op_2$ in $S$.
- Why not A: Quorum systems can be linearizable without 100% node acknowledgments.
- Why not C: This describes database serializability, not linearizability of concurrent objects.
- Why not D: Linearizability is designed specifically for asynchronous, distributed systems without shared clocks.
- Ref: [modules/04-consistency-models-and-linearizability.md](../modules/04-consistency-models-and-linearizability.md#formal-definition-herlihy-wing-1990), Herlihy & Wing (ACM TOPLAS 1990)
</details>

#### Q-DIST-018 · Serializability vs Linearizability · difficulty 2 · single
What is the precise difference between **Serializability** (from database transactions) and **Linearizability** (from distributed systems)?
- A) Serializability applies to arbitrary multi-operation transactions and requires execution equivalence to SOME sequential order, without real-time constraints; Linearizability applies to individual operations on single objects and requires operations to take effect instantaneously within their real-time invocation-response interval.
- B) Serializability is stronger than Linearizability; all serializable systems are automatically linearizable.
- C) Serializability is a liveness property; Linearizability is a safety property.
- D) Serializability requires Raft consensus; Linearizability requires two-phase commit.
<details><summary>Answer</summary>

**A.** Serializability guarantees that the concurrent execution of multi-operation, multi-object transactions is equivalent to some serial order. Crucially, it imposes no real-time ordering: transaction $T_2$ executed hours after $T_1$ can legally be serialized *before* $T_1$. Linearizability is a real-time recency guarantee on single operations/objects. The combination of both is **Strict Serializability** (or External Consistency).
- Why not B: Serializability does not enforce real-time precedence; an execution can be serializable without being linearizable.
- Why not C: Both are safety properties.
- Why not D: The definitions are mathematical specifications, independent of implementation protocols.
- Ref: [modules/04-consistency-models-and-linearizability.md](../modules/04-consistency-models-and-linearizability.md#serializability-vs-linearizability), Kleppmann (DDIA 2e Chapter 7 & 9)
</details>

#### Q-DIST-019 · Linearizability Checking · difficulty 3 · scenario
Consider the following execution trace on a single register initially set to `0`:
- Client A invokes `write(1)` at $t=10$, completes at $t=30$.
- Client B invokes `read()` at $t=35$, completes at $t=40$ returning `0`.
Is this history linearizable, and why?
- A) Yes, because Client B's read is concurrent with Client A's write.
- B) No, because `write(1)` completed at $t=30$, strictly before `read()` began at $t=35$ ($res(w) <_{real} inv(r)$), forcing `write(1)` to precede `read()` in any legal sequential history, which must therefore return `1`.
- C) Yes, because eventual consistency allows reads to return stale values indefinitely.
- D) No, because Client A and Client B did not obtain a shared mutex.
<details><summary>Answer</summary>

**B.** In Herlihy-Wing linearizability, real-time precedence is absolute. Because $res(write(1)) = 30 < inv(read()) = 35$, the write operation strictly completed before the read began. Therefore, the linearization point of the write must precede the linearization point of the read. A legal sequential register execution must return the most recently written value (`1`). Returning `0` violates the sequential specification.
- Why not A: The operations are strictly non-overlapping in time ($30 < 35$); they are not concurrent.
- Why not C: Eventual consistency is a weaker model; the question asks whether the trace is *linearizable*.
- Why not D: Linearizability is non-blocking and does not mandate mutexes.
- Ref: [modules/04-consistency-models-and-linearizability.md](../modules/04-consistency-models-and-linearizability.md#linearizability-verification-wgl-algorithm), Wing & Gong (1993)
</details>

#### Q-DIST-020 · Linearizability Verification · difficulty 3 · single
In the Wing-Gong (WGL) linearizability checking algorithm, what computational complexity class does verifying whether a general concurrent history of $n$ operations is linearizable belong to?
- A) $O(n \log n)$ via topological sort.
- B) $O(1)$ by hashing operation timestamps.
- C) NP-complete in the general case (Gibbons & Korach 1997).
- D) Undecidable (equivalent to the Halting Problem).
<details><summary>Answer</summary>

**C.** Gibbons and Korach (1997) proved that testing whether an arbitrary concurrent execution history is linearizable is NP-complete. The Wing-Gong (WGL) algorithm searches the exponential state space of valid linearization points via branch-and-bound backtracking, memoizing explored search paths. (For read/write registers specifically, polynomial algorithms exist under restricted access patterns, but general object linearizability checking is NP-complete).
- Why not A: A single topological sort cannot evaluate all valid overlapping interleavings.
- Why not B: Timestamps do not resolve overlapping concurrent windows.
- Why not D: Finite traces have a finite permutation space, making the problem decidable.
- Ref: [modules/04-consistency-models-and-linearizability.md](../modules/04-consistency-models-and-linearizability.md#linearizability-verification-wgl-algorithm), Gibbons & Korach (IEEE TPDS 1997)
</details>

#### Q-DIST-021 · Session Guarantees · difficulty 2 · single
A user updates their profile picture on a social network. Upon refreshing the page, the user is routed to a different read replica that has not yet received the replication stream, and observes their old profile picture. Which client session guarantee was violated?
- A) Monotonic Writes
- B) Writes-Follow-Reads
- C) Read-Your-Writes (RYW)
- D) Linearizable Multi-Register Atomic Snapshot
<details><summary>Answer</summary>

**C.** **Read-Your-Writes (RYW)** guarantees that if a process performs a write $w$, any subsequent read $r$ by that same process will observe the effects of $w$ (or a later write). Routing the user to a lagging replica that omits their own write directly violates RYW.
- Why not A: Monotonic Writes guarantees that a process's writes are serialized in the order they were submitted.
- Why not B: Writes-Follow-Reads guarantees that if a process reads version $v$ and writes $w$, $w$ is serialized after $v$.
- Why not D: Profile picture update involves a single user record, not multi-register atomic snapshots.
- Ref: [modules/04-consistency-models-and-linearizability.md](../modules/04-consistency-models-and-linearizability.md#session-guarantees), Terry et al. (Bayou, 1994)
</details>

#### Q-DIST-022 · Composability · difficulty 2 · single
What is the **Locality (P-Compositionality)** property of Linearizability, and how does it contrast with Sequential Consistency?
- A) A system is linearizable if and only if each individual object in the system is linearizable; in contrast, Sequential Consistency is NOT composable (combining two independently sequentially consistent objects does not guarantee sequential consistency of the system).
- B) Linearizability only works on local physical disks, while Sequential Consistency works over networks.
- C) Linearizability requires all objects to be partitioned across $P$ nodes.
- D) Sequential consistency is composable, whereas linearizability requires global locks.
<details><summary>Answer</summary>

**A.** Herlihy & Wing proved that Linearizability is **local (P-composable)**: if every object in a concurrent system is individually linearizable, the execution of the entire system is linearizable. This allows modular, independent verification of distributed components. In contrast, Sequential Consistency is not composable: two objects can each satisfy sequential consistency individually, but their joint execution can violate sequential consistency.
- Why not B: Locality in this context refers to mathematical decomposition, not disk hardware.
- Why not C: "P-compositionality" refers to property composition, not node partitioning.
- Why not D: It is sequential consistency that fails to compose, not linearizability.
- Ref: [modules/04-consistency-models-and-linearizability.md](../modules/04-consistency-models-and-linearizability.md#formal-definition-herlihy-wing-1990), Herlihy & Wing (1990)
</details>

---

### Domain 5: Replication Protocols & Quorums

#### Q-DIST-023 · Replication Models · difficulty 1 · single
In asynchronous primary-backup replication, what risk is fundamentally accepted in exchange for minimal client write latency?
- A) Client writes must execute two-phase commit with all backups before returning.
- B) If the primary crashes before replicating acknowledged writes to backups, a promoted backup will suffer silent data loss (failover loss).
- C) The primary node's CPU usage increases by $O(N^2)$.
- D) Backups reject read queries permanently.
<details><summary>Answer</summary>

**B.** In asynchronous replication, the primary writes to local storage and immediately sends a success acknowledgment to the client before the write reaches the backups. If the primary crashes before changes are transmitted across the network, those committed transactions exist only on the dead primary's disk, leading to permanent data loss upon backup failover (Recovery Point Objective $\text{RPO} > 0$).
- Why not A: Asynchronous replication explicitly returns *before* backups acknowledge.
- Why not C: Primary CPU overhead is $O(N)$ for streaming to $N$ replicas.
- Why not D: Backups can serve read traffic (subject to replication lag).
- Ref: [modules/05-replication-protocols-and-quorums.md](../modules/05-replication-protocols-and-quorums.md#primary-backup-replication), Kleppmann (DDIA 2e Chapter 5)
</details>

#### Q-DIST-024 · Chain Replication · difficulty 2 · scenario
In standard Chain Replication (Schneider, van Renesse 2004), client writes are sent to the **Head** node and forwarded down the chain to the **Tail** node. Where are read requests sent to guarantee linearizable reads without coordination?
- A) To any randomly selected node in the chain.
- B) Exclusively to the **Tail** node.
- C) Exclusively to the **Head** node.
- D) To a majority quorum of chain nodes.
<details><summary>Answer</summary>

**B.** In Chain Replication, a write is only committed and acknowledged to the client once it reaches the **Tail** node. Because the Tail only receives writes that have successfully traversed every preceding node in the chain, the Tail's local state is always a strictly linearizable sequence of all committed writes. Serving reads exclusively from the Tail guarantees linearizability without any distributed lock or quorum coordination.
- Why not A: Intermediate nodes or the head contain uncommitted writes that may still fail or be rolled back, causing dirty/unlinearizable reads.
- Why not C: The head sees writes before they are committed; reading from the head would expose uncommitted state.
- Why not D: Chain replication does not use majority quorums; its strength is $O(1)$ single-node reads at the tail.
- Ref: [modules/05-replication-protocols-and-quorums.md](../modules/05-replication-protocols-and-quorums.md#chain-replication), van Renesse & Schneider (OSDI 2004)
</details>

#### Q-DIST-025 · CRAQ · difficulty 2 · single
How does Chain Replication with Apportioned Queries (CRAQ, Terrace & Freedman 2009) increase read throughput without sacrificing linearizability?
- A) By routing reads to intermediate nodes, which serve them immediately if the node has no pending writes for that object, and query the Tail for the committed version identifier only when an object is in a `dirty` (pending write) state.
- B) By running Paxos across intermediate chain nodes for every read.
- C) By dropping replication to intermediate nodes when load exceeds 80%.
- D) By disabling writes during peak read hours.
<details><summary>Answer</summary>

**A.** In standard Chain Replication, the Tail is a read bottleneck. CRAQ allows intermediate nodes to store multiple versions tagged as `clean` or `dirty`. When an intermediate node receives a read for an object whose latest version is `clean`, it returns it immediately. If the latest version is `dirty` (an in-flight write has arrived from upstream but has not yet been acknowledged by the Tail), the node queries the Tail for the latest *committed version number* and returns that version.
- Why not B: CRAQ avoids running Paxos; it uses the chain structure.
- Why not C: Chain nodes cannot drop replication without breaking chain integrity.
- Why not D: Production systems must support concurrent reads and writes.
- Ref: [modules/05-replication-protocols-and-quorums.md](../modules/05-replication-protocols-and-quorums.md#craq-chain-replication-with-apportioned-queries), Terrace & Freedman (USENIX ATC 2009)
</details>

#### Q-DIST-026 · Quorum Anomalies · difficulty 3 · scenario
In a leaderless Dynamo-style cluster of $N=5$ replicas configured with write quorum $W=3$ and read quorum $R=3$, the quorum condition $R + W > N$ ($3 + 3 = 6 > 5$) holds. Client A writes `v1` to nodes $\{N_1, N_2, N_3\}$. Next, Client B writes `v2` to nodes $\{N_3, N_4, N_5\}$. Node $N_3$ is slow and drops Client B's message, but Client B's write succeeds on $\{N_4, N_5\}$ and $N_3$ receives it later.
Now, Client C reads from $\{N_1, N_2, N_3\}$ and observes `v2` (from $N_3$). Immediately afterward, Client D reads from $\{N_1, N_2, N_4\}$. What value does Client D observe, and what anomaly does this demonstrate?
- A) Client D observes `v2`; the system is fully linearizable.
- B) Client D observes only $\{N_1: v1, N_2: v1, N_4: v2\}$, and without read-repair or write-backs, another reader reading from $\{N_1, N_2, N_5\}$ could observe `v1`, demonstrating the **New-Then-Old** non-linearizable read anomaly.
- C) Client D's read times out because $R+W > N$ requires locks.
- D) Client D triggers an immediate database crash.
<details><summary>Answer</summary>

**B.** The overlap condition $R + W > N$ guarantees only that a read quorum intersects a write quorum by at least one node; it does NOT guarantee linearizability! Because different read quorums can query different subsets of nodes, Client C can read from $\{N_3, N_4, N_5\}$ and see new value `v2`, while Client D reading non-overlapping nodes $\{N_1, N_2, N_3\}$ (if $N_3$ hasn't updated) or $\{N_1, N_2, N_4\}$ can see stale value `v1`. Observing a newer value followed in real time by an older value is the classic "New-Then-Old" anomaly.
- Why not A: Quorum intersection alone does not enforce linearizability.
- Why not C: Dynamo-style quorums do not acquire locks.
- Why not D: Quorum queries are standard operations that do not crash the engine.
- Ref: [modules/05-replication-protocols-and-quorums.md](../modules/05-replication-protocols-and-quorums.md#quorum-systems-and-the-r-w-n-illusion), Kleppmann (DDIA 2e Chapter 5)
</details>

#### Q-DIST-027 · ABD Protocol · difficulty 2 · single
How does the Attiya-Bar-Noy-Dolev (ABD, 1995) protocol eliminate the "New-Then-Old" anomaly to provide a linearizable read/write register over an asynchronous quorum system?
- A) By requiring physical GPS clocks on all nodes.
- B) By enforcing a two-phase read protocol: the reader queries a quorum to find the highest timestamped value, and before returning to the caller, writes that highest value back to a write quorum (**Read-Repair**).
- C) By electing a single centralized leader for all read operations.
- D) By disabling concurrent client connections.
<details><summary>Answer</summary>

**B.** In the ABD algorithm, reads are executed in two phases: (1) Query phase: fetch $(v, ts)$ from a read quorum $R$ and select the value with the highest timestamp; (2) Write-back phase (Read-Repair): write that highest $(v, ts)$ to a write quorum $W$ before completing the read. This ensures that once any reader observes a new value, that value is guaranteed to be present on at least a write quorum, preventing any subsequent reader from observing an older value.
- Why not A: ABD operates in a purely asynchronous model without clocks.
- Why not C: ABD is leaderless and decentralized.
- Why not D: ABD is designed specifically for concurrent clients.
- Ref: [modules/05-replication-protocols-and-quorums.md](../modules/05-replication-protocols-and-quorums.md#the-abd-algorithm), Attiya, Bar-Noy, Dolev (JACM 1995)
</details>

#### Q-DIST-028 · Consensus Reads · difficulty 2 · single
In a consensus-based replicated state machine (such as Raft or Multi-Paxos), why can a leader NOT simply serve read requests by reading its own local memory without network communication?
- A) Because local memory is corrupted on every disk write.
- B) Because the leader might have been partitioned off and deposed by a newly elected leader (network split / partitioned leader), causing it to serve stale, unlinearizable data.
- C) Because state machine transitions require AES decryption keys stored on followers.
- D) Because the operating system blocks thread reads during consensus replication.
<details><summary>Answer</summary>

**B.** If a leader is partitioned from the majority, the majority will elect a new leader and commit new writes. The deposed leader, unaware that it has been superseded, would serve stale reads from its memory, violating linearizability. To safely serve reads, the leader must either: (1) execute a consensus round, (2) run **ReadIndex** (exchange heartbeats with a majority to verify it is still the legitimate leader before serving read at current commit index), or (3) use bounded **Leader Leases**.
- Why not A: Memory is not corrupted by disk writes.
- Why not C: Consensus algorithms do not require follower decryption keys to read local state.
- Why not D: Operating systems do not introspect consensus roles.
- Ref: [modules/05-replication-protocols-and-quorums.md](../modules/05-replication-protocols-and-quorums.md#linearizable-reads-in-consensus-systems), Ongaro (Stanford PhD Thesis 2014)
</details>

---

### Domain 6: Consensus Foundations, Paxos & ZAB

#### Q-DIST-029 · Consensus Properties · difficulty 1 · single
Which of the following defines the four fundamental formal correctness properties of the Distributed Consensus problem?
- A) Compression, Serialization, Authentication, Encryption
- B) Agreement (all non-faulty nodes decide the same value), Validity (decided value was proposed by some node), Integrity (each node decides at most once), Termination (all non-faulty nodes eventually decide)
- C) Atomicity, Consistency, Isolation, Durability
- D) Linearizability, Sequentiality, Causal Consistency, Eventual Consistency
<details><summary>Answer</summary>

**B.** The consensus problem requires nodes to agree on a single value satisfying: (1) **Agreement**: no two non-faulty nodes decide different values; (2) **Validity**: if a node decides $v$, then $v$ must have been proposed by some node; (3) **Integrity**: no node decides more than once; (4) **Termination**: every non-faulty node eventually decides some value.
- Why not A: These are data transformation concepts.
- Why not C: These are database ACID transaction properties.
- Why not D: These are memory consistency models.
- Ref: [modules/06-consensus-foundations-and-paxos.md](../modules/06-consensus-foundations-and-paxos.md#consensus-problem-definition), Lynch (Distributed Algorithms 1996)
</details>

#### Q-DIST-030 · Single-Decree Paxos · difficulty 2 · scenario
In Single-Decree Paxos, Proposer 1 sends `Prepare(n=100)` to Acceptors $\{A_1, A_2, A_3\}$. Acceptor $A_1$ responds with `Promise(100, accepted_n=null, accepted_v=null)`. Acceptor $A_2$ responds with `Promise(100, accepted_n=80, accepted_v="foo")`. Acceptor $A_3$ responds with `Promise(100, accepted_n=90, accepted_v="bar")`.
What value must Proposer 1 send in its Phase 2a `Accept(n=100, v)` message?
- A) Proposer 1 may propose its own initial value `"baz"`.
- B) Proposer 1 must propose `"foo"`, because it had the lowest proposal number.
- C) Proposer 1 must propose `"bar"`, because `"bar"` was associated with the highest proposal number ($90 > 80$) among the promises received.
- D) Proposer 1 must abort and increment its proposal number to 200.
<details><summary>Answer</summary>

**C.** In Paxos Phase 2a, if any acceptor in the promise quorum has already accepted a value in a previous proposal, the proposer **must** set its proposed value to the value associated with the *highest proposal number* returned in the Phase 1b promises. Here, $A_3$ reported `accepted_n=90` with value `"bar"`, which is higher than $A_2$'s `accepted_n=80`. Proposer 1 is mathematically bound to adopt `"bar"` to prevent overwriting an already committed decision.
- Why not A: Proposers can only pick their own arbitrary value if ALL acceptors in the promise quorum returned `null`.
- Why not B: The protocol mandates choosing the value with the *highest* accepted proposal number, not the lowest.
- Why not D: The proposer received promises from a majority ($\{A_1, A_2, A_3\}$), so it does not abort.
- Ref: [modules/06-consensus-foundations-and-paxos.md](../modules/06-consensus-foundations-and-paxos.md#single-decree-paxos-mechanics), Lamport (The Part-Time Parliament 1998)
</details>

#### Q-DIST-031 · Paxos Livelock · difficulty 2 · single
What causes the "Dueling Proposers" livelock condition in Single-Decree Paxos, and how is it resolved in production implementations?
- A) Acceptors run out of disk space; resolved by log compaction.
- B) Two proposers continuously alternate sending Phase 1a `Prepare` messages with higher proposal numbers, preempting each other's Phase 2a `Accept` messages before consensus can be reached; resolved by randomized backoff or electing a distinguished stable leader.
- C) A proposer crashes; resolved by running two-phase commit.
- D) Network links reorder TCP packets; resolved by switching to UDP.
<details><summary>Answer</summary>

**B.** In basic Paxos, if Proposer $P_1$ sends `Prepare(1)` and receives promises, but before it can send `Accept(1)`, Proposer $P_2$ sends `Prepare(2)`, acceptors promise not to accept proposals $< 2$. $P_1$'s `Accept(1)` is rejected. $P_1$ immediately sends `Prepare(3)`, preempting $P_2$'s `Accept(2)`. This infinite cycle violates termination (an manifestation of FLP). It is solved by having proposers use randomized backoff delays or by electing a single stable leader (Multi-Paxos / Raft).
- Why not A: Livelock is a protocol message interleaving issue, not disk capacity.
- Why not C: 2PC does not resolve consensus livelock.
- Why not D: UDP would exacerbate packet drops.
- Ref: [modules/06-consensus-foundations-and-paxos.md](../modules/06-consensus-foundations-and-paxos.md#dueling-proposers-and-livelock), Lamport (Paxos Made Simple 2001)
</details>

#### Q-DIST-032 · Flexible Paxos · difficulty 3 · single
What breakthrough theoretical observation was proven by Heidi Howard et al. in **Flexible Paxos** (2016)?
- A) Paxos does not require majority quorums for both phases; it only requires that Phase 1 (leader election / prepare) quorum $Q_1$ and Phase 2 (replication / commit) quorum $Q_2$ intersect by at least one node ($Q_1 \cap Q_2 \neq \emptyset$).
- B) Paxos can achieve consensus with zero acceptors.
- C) Byzantine consensus can be solved with $2f + 1$ nodes.
- D) Linearizability does not require monotonic proposal numbers.
<details><summary>Answer</summary>

**A.** For decades it was assumed that Paxos requires all quorums to be simple majorities ($\lceil (N+1)/2 \rceil$). Flexible Paxos proved that quorums within Phase 1 do not need to intersect each other, nor do quorums within Phase 2 need to intersect each other. The *only* mathematical invariant required for safety is that **any Phase 1 quorum $Q_1$ intersects any Phase 2 quorum $Q_2$ by at least one node** ($Q_1 \cap Q_2 \neq \emptyset$). In an $N=6$ cluster, Phase 2 can use a small quorum of 2 nodes, provided Phase 1 uses 5 nodes, dramatically improving steady-state commit latency.
- Why not B: Consensus cannot be achieved with 0 nodes.
- Why not C: Byzantine agreement requires $3f + 1$ nodes.
- Why not D: Monotonic proposal numbers are essential to order rounds.
- Ref: [modules/06-consensus-foundations-and-paxos.md](../modules/06-consensus-foundations-and-paxos.md#flexible-paxos), Howard, Malkhi, Spiegelman (2016)
</details>

#### Q-DIST-033 · ZooKeeper Atomic Broadcast · difficulty 2 · single
In the ZooKeeper Atomic Broadcast (ZAB) protocol, what are the two components of the 64-bit transaction identifier $zxid$?
- A) 32-bit IP address + 32-bit port number
- B) 32-bit epoch number (incremented each time a new leader is elected) + 32-bit monotonic counter (reset to zero at the start of each epoch)
- C) 32-bit UNIX timestamp + 32-bit CRC32 checksum
- D) 32-bit process ID + 32-bit thread ID
<details><summary>Answer</summary>

**B.** A $zxid$ consists of an epoch $e$ (the high-order 32 bits) and a counter $c$ (the low-order 32 bits). Each time a leader election completes and synchronization succeeds, the new leader increments the epoch and resets the counter to 0. Comparing two $zxid$s is a simple 64-bit integer comparison: a transaction from a higher epoch always supersedes a transaction from an older epoch, matching the leader term structure.
- Why not A, C, D: These fields do not enforce epoch-based total ordering.
- Ref: [modules/06-consensus-foundations-and-paxos.md](../modules/06-consensus-foundations-and-paxos.md#zookeeper-atomic-broadcast-zab), Junqueira et al. (DSN 2011)
</details>

#### Q-DIST-034 · Multi-Paxos · difficulty 2 · single
In Multi-Paxos, what optimization allows steady-state client writes to commit in a single network round-trip (1 RTT)?
- A) Skipping Phase 2 entirely.
- B) Amortizing Phase 1 across multiple log entries: once a leader successfully executes Phase 1 for all subsequent log positions, it only executes Phase 2 (`Accept` $\to$ `Accepted`) for subsequent client proposals.
- C) Having followers write directly to the client's local disk.
- D) Running NTP clock synchronization instead of sending network messages.
<details><summary>Answer</summary>

**B.** Single-decree Paxos requires 2 full round-trips per entry (Phase 1 Prepare/Promise + Phase 2 Accept/Accepted). Multi-Paxos observes that once a stable leader receives promises for all uncommitted log instances up to $\infty$, it does not need to re-run Phase 1 for every subsequent log entry. The leader executes only Phase 2 (propose value $\to$ majority accepted), achieving consensus in 1 RTT during steady-state operation.
- Why not A: Phase 2 is the commit/replication phase; skipping it would mean nothing is replicated or stored.
- Why not C: Distributed followers cannot write to client disks.
- Why not D: NTP cannot replace message passing in consensus protocols.
- Ref: [modules/06-consensus-foundations-and-paxos.md](../modules/06-consensus-foundations-and-paxos.md#multi-paxos-and-the-steady-state), Lamport (2001)
</details>

---

### Domain 7: Raft Consensus Deep Dive

#### Q-DIST-035 · Raft State Machine · difficulty 1 · single
What are the three possible roles that a node can occupy in a Raft consensus cluster?
- A) Master, Minion, Observer
- B) Leader, Follower, Candidate
- C) Coordinator, Participant, Arbiter
- D) Proposer, Acceptor, Learner
<details><summary>Answer</summary>

**B.** In Raft, a node is in one of three states at any given time: **Leader** (handles all client requests and manages log replication), **Follower** (passive; responds to incoming RPCs from leaders and candidates), or **Candidate** (transitions to this state upon election timeout to campaign for leadership).
- Why not A: Master/minion is legacy terminology, not Raft.
- Why not C: These are Two-Phase Commit terms.
- Why not D: These are Paxos roles.
- Ref: [modules/07-raft-consensus-deep-dive.md](../modules/07-raft-consensus-deep-dive.md#raft-state-machine-overview), Ongaro & Ousterhout (USENIX ATC 2014)
</details>

#### Q-DIST-036 · Raft Leader Election · difficulty 2 · scenario
In a 5-node Raft cluster, Candidate $C_1$ sends a `RequestVote(term=4, candidateId=1, lastLogIndex=8, lastLogTerm=3)` to Node $N_2$. Node $N_2$'s current log has `lastLogIndex=9, lastLogTerm=3`. Node $N_2$'s current term is 3. Does Node $N_2$ grant its vote to Candidate $C_1$, and why?
- A) Yes, because $C_1$'s term (4) is greater than $N_2$'s current term (3).
- B) No, because Raft's election safety rule requires the candidate's log to be at least as up-to-date as the receiver's log; since both have `lastLogTerm=3`, the node with the longer log ($N_2$ with index 9 vs $C_1$ with index 8) is strictly more up-to-date.
- C) Yes, because candidates always win votes if they ask first.
- D) No, because node $N_2$ must wait for a GPS timestamp sync.
<details><summary>Answer</summary>

**B.** In Raft Section 5.4.1 (Election Restriction), a voter denies its vote if its own log is more up-to-date than the candidate's log. Up-to-dateness is determined by: (1) compare `lastLogTerm`: higher term is more up-to-date; (2) if terms are identical, the longer log (`lastLogIndex`) is more up-to-date. Here, both have `lastLogTerm=3`, but $N_2$'s `lastLogIndex` ($9$) is greater than $C_1$'s ($8$). Therefore, $N_2$ denies its vote to protect its uncommitted entry.
- Why not A: A higher term alone is not sufficient; the candidate's log must also satisfy the up-to-dateness check.
- Why not C: Votes are evaluated strictly against Raft invariants.
- Why not D: Raft requires no physical clock synchronization.
- Ref: [modules/07-raft-consensus-deep-dive.md](../modules/07-raft-consensus-deep-dive.md#leader-election-and-voting-restriction), Ongaro & Ousterhout (2014)
</details>

#### Q-DIST-037 · Raft Figure 8 Trap · difficulty 3 · scenario
In Raft, Leader $L$ in Term 4 replicates an entry from a prior term (Term 2) to a majority of nodes. Why does Raft's commit rule **strictly forbid** the leader from committing the Term 2 entry by counting replicas directly, requiring instead that the leader commit an entry from its *current term* (Term 4) by counting replicas?
- A) Because entries from earlier terms use outdated encryption keys.
- B) Because an entry from a prior term, even if stored on a majority of nodes, could still be overwritten by a future leader if the current leader crashes before committing an entry from its own term (the classic Raft Figure 8 scenario).
- C) Because followers drop entries with older terms during TCP handshakes.
- D) Because Raft term numbers are limited to 8 bits.
<details><summary>Answer</summary>

**B.** This is the subtle correctness rule illustrated in Figure 8 of the Raft paper. If a leader were allowed to commit an old entry simply because it is on a majority, an alternate candidate with a higher term and an older log could be elected under certain interleavings and overwrite that supposedly committed entry. Raft guarantees safety by mandating that **a leader never commits an entry from a previous term by counting replicas; only entries from the leader's current term may be committed by counting replicas**. Once a current-term entry is committed, all prior entries are committed indirectly by the Log Matching Property.
- Why not A, C, D: These are nonsensical distractors.
- Ref: [modules/07-raft-consensus-deep-dive.md](../modules/07-raft-consensus-deep-dive.md#the-figure-8-commit-rule), Ongaro & Ousterhout (2014)
</details>

#### Q-DIST-038 · Raft Durability Invariants · difficulty 2 · single
Which three state variables **must** be synchronously flushed to non-volatile disk (`fsync`) before a Raft node can respond to an RPC?
- A) `matchIndex[]`, `nextIndex[]`, `lastApplied`
- B) `currentTerm`, `votedFor`, `log[]`
- C) `commitIndex`, `leaderId`, `heartbeatTimeout`
- D) Client socket descriptors, DNS cache, memory heap
<details><summary>Answer</summary>

**B.** According to Raft Figure 2: `currentTerm`, `votedFor`, and `log[]` are the **persistent state** on all servers. If a node crashes and restarts without preserving `votedFor`, it could vote for a second candidate in the same term, causing two leaders to be elected simultaneously. If `currentTerm` or `log[]` are lost, log matching invariants and committed entry durability are violated. All other state (`commitIndex`, `lastApplied`, `nextIndex[]`, `matchIndex[]`) is volatile and safely reconstructed upon restart.
- Why not A, C: Volatile state variables that are recalculated upon restart.
- Why not D: Ephemeral operating system resources.
- Ref: [modules/07-raft-consensus-deep-dive.md](../modules/07-raft-consensus-deep-dive.md#raft-state-machine-overview), Ongaro & Ousterhout (2014)
</details>

#### Q-DIST-039 · Raft Pre-Vote Extension · difficulty 2 · single
What problem does the **Pre-Vote** extension solve in production Raft systems?
- A) It prevents a partitioned, disconnected follower from incrementing its term indefinitely and subsequently disrupting an active, healthy cluster when it reconnects.
- B) It allows nodes to skip leader election entirely.
- C) It eliminates disk writes by running entirely in RAM.
- D) It enables Byzantine fault tolerance.
<details><summary>Answer</summary>

**A.** If a follower is partitioned from the cluster, its election timer will repeatedly fire, causing it to increment its term ($term = 5 \to 6 \to 7 \dots$) and campaign fruitlessly. When the partition heals, the follower's higher term forces the healthy, active leader to step down immediately, causing unnecessary cluster disruption. With Pre-Vote, a candidate first conducts an informal pre-election round without incrementing its term. If a majority responds that they would vote for it, only then does it increment its term and start a real election.
- Why not B: Real elections are still conducted if pre-vote succeeds.
- Why not C: Pre-vote has nothing to do with disk persistence.
- Why not D: Raft remains a Crash-Fault-Tolerant (CFT) system.
- Ref: [modules/07-raft-consensus-deep-dive.md](../modules/07-raft-consensus-deep-dive.md#pre-vote-and-check-quorum), Ongaro (Stanford Thesis 2014)
</details>

#### Q-DIST-040 · Check Quorum · difficulty 2 · single
How does the **Check-Quorum** mechanism protect a Raft leader that has been partitioned off from its followers?
- A) It causes the leader to send a SIGKILL signal to all followers.
- B) The leader checks if it has received heartbeats or acknowledgments from a majority of nodes within an election timeout window; if not, the leader proactively steps down to follower status.
- C) It triggers a hardware reboot of the network switch.
- D) It allows the partitioned leader to continue serving writes in AP mode.
<details><summary>Answer</summary>

**B.** In asymmetric network partitions, a leader might still be able to receive client requests while being unable to reach a majority of followers. Without Check-Quorum, the leader would linger indefinitely, attempting and failing to replicate writes. With Check-Quorum, if a leader fails to receive responses from a majority within one election timeout, it steps down to follower status voluntarily, mitigating stale read windows and allowing clients to failover promptly.
- Why not A: A partitioned leader cannot send signals across a severed network.
- Why not C: Check-quorum is an algorithmic software safeguard.
- Why not D: Raft is strictly a CP protocol; it never serves uncommitted writes in AP mode.
- Ref: [modules/07-raft-consensus-deep-dive.md](../modules/07-raft-consensus-deep-dive.md#pre-vote-and-check-quorum), Ongaro (2014)
</details>

---

### Domain 8: Distributed Coordination & Locks

#### Q-DIST-041 · Redlock Critique · difficulty 3 · single
In Martin Kleppmann's formal critique of the Redis Redlock algorithm (2016), what fundamental theoretical flaw was identified regarding its use of physical time?
- A) Redlock requires too many Redis instances ($2N+1$).
- B) Redlock relies on physical system clock synchrony and bounded execution times to guarantee mutual exclusion; if a process experiences a GC pause or clock jump after acquiring the lock, its lock can expire while the process continues to believe it owns the lock, corrupting shared resources without storage fencing.
- C) Redis cannot write keys with TTLs.
- D) Redlock violates the Byzantine Generals bound.
<details><summary>Answer</summary>

**B.** Kleppmann demonstrated that in asynchronous systems with unpredictable delays (garbage collection STW pauses, VM suspension, network delays), time-based leases cannot guarantee mutual exclusion unless the underlying storage resource enforces monotonic **fencing tokens**. A client can check the clock, see the lock is valid, experience a 10-second GC pause during which the lock expires, and then blindly write to storage, stomping on a newer client.
- Why not A: The cluster sizing was not the theoretical flaw.
- Why not C: Redis natively supports key expiration.
- Why not D: Redlock assumes a crash-fault model, not Byzantine.
- Ref: [modules/08-distributed-coordination-and-locks.md](../modules/08-distributed-coordination-and-locks.md#martin-kleppmanns-redlock-critique), Kleppmann (2016)
</details>

#### Q-DIST-042 · Thundering Herd in Locks · difficulty 2 · single
In Apache ZooKeeper, how does the Standard Distributed Lock Recipe avoid the "Thundering Herd" problem when thousands of clients compete for a single lock?
- A) All clients watch the parent lock node `/lock`; when it is deleted, all clients awaken simultaneously.
- B) Each client creates an ephemeral sequential znode (`/lock/lock-00000001`), and a client that does not hold the lock watches ONLY the immediately preceding sequential znode (`lock-(i-1)`), ensuring only one client awakens when a lock is released.
- C) Clients query ZooKeeper using exponential backoff every 10 milliseconds.
- D) ZooKeeper runs a round-robin DNS server.
<details><summary>Answer</summary>

**B.** If $M$ clients all set a watch on `/lock`, deleting `/lock` wakes up all $M$ clients simultaneously, causing an $O(M)$ flood of network traffic and ZooKeeper load (the Thundering Herd). By creating sequential nodes (`/lock/node-i`) and having each client watch only `node-(i-1)`, releasing a lock wakes up exactly ONE waiting client ($O(1)$ wakeups), ensuring fair FIFO queuing and stable performance under high contention.
- Why not A: Setting a watch on the root lock node is the exact anti-pattern that causes the thundering herd.
- Why not C: Polling with backoff does not guarantee FIFO order and wastes bandwidth.
- Why not D: DNS has no awareness of lock ownership.
- Ref: [modules/08-distributed-coordination-and-locks.md](../modules/08-distributed-coordination-and-locks.md#zookeeper-curator-lock-recipe), Hunt et al. (USENIX ATC 2010)
</details>

#### Q-DIST-043 · Ephemeral Nodes · difficulty 1 · single
What is an **Ephemeral Node** in Apache ZooKeeper or etcd lease mechanism, and when is it automatically removed?
- A) A node that is deleted every 24 hours at midnight UTC.
- B) A node tied to the lifecycle of the client's session/lease; if the client crashes or its heartbeat session expires, the coordination server automatically deletes the node.
- C) A node stored exclusively in L1 CPU cache.
- D) A node that cannot be read by other clients.
<details><summary>Answer</summary>

**B.** Ephemeral nodes exist only as long as the client session that created them is active. If the client disconnects or fails to send heartbeats within the negotiated session timeout, the server considers the client dead and automatically removes the ephemeral node, releasing any distributed locks or service registrations held by that client.
- Why not A: Deletion is driven by session expiration, not calendar time.
- Why not C: Ephemeral znodes are replicated across the consensus ensemble.
- Why not D: Ephemeral nodes are visible to all clients with read permissions.
- Ref: [modules/08-distributed-coordination-and-locks.md](../modules/08-distributed-coordination-and-locks.md#zookeeper-primitives), Hunt et al. (2010)
</details>

#### Q-DIST-044 · etcd Revisions · difficulty 2 · single
In `etcd` v3, how do 64-bit cluster **Revisions** enable lock-free atomic Compare-And-Swap (CAS) transactions?
- A) Every mutation in the entire cluster increments a global 64-bit revision counter; client transactions can evaluate preconditions (e.g. `mod_revision(key) == expected`) and execute mutations atomically in a single Raft round.
- B) Revisions are physical timestamps generated by NTP.
- C) Revisions require acquiring a cluster-wide write lock on all keys.
- D) Revisions encrypt client payloads.
<details><summary>Answer</summary>

**B is false, A is true.** In etcd v3, the data store maintains a single global 64-bit `revision` counter that monotonically increments with every commit. Every key-value version records its `create_revision` and `mod_revision`. This allows lightweight Software Transactional Memory (STM) transactions: `Txn().If(Compare(mod_revision(k), "=", rev)).Then(OpPut(k, v)).Else(...)` executed atomically without blocking readers.
- Why not B: Revisions are logical sequence numbers, not physical timestamps.
- Why not C: etcd uses Multi-Version Concurrency Control (MVCC), avoiding table locks.
- Why not D: Revisions are metadata, not encryption routines.
- Ref: [modules/08-distributed-coordination-and-locks.md](../modules/08-distributed-coordination-and-locks.md#etcd-concurrency-primitives), etcd Documentation
</details>

#### Q-DIST-045 · Distributed Barriers · difficulty 2 · scenario
In a distributed batch processing framework, 10 worker nodes must process intermediate data and synchronize before proceeding to the next processing phase. How is a **Double Barrier** implemented using a distributed coordination service?
- A) Workers write their output to an NFS share and check file sizes.
- B) Workers create child nodes under `/barrier/enter` and block until 10 children exist; when processing completes, they create child nodes under `/barrier/leave` and block until all 10 nodes are registered before exiting.
- C) Workers execute a Two-Phase Commit transaction on an SQL database.
- D) Workers send UDP broadcasts on port 8080.
<details><summary>Answer</summary>

**B.** A double barrier enables distributed processes to synchronize both at the beginning and at the conclusion of a distributed computation. In ZooKeeper/etcd, entering processes create a child znode under `/barrier/enter` and set a watch on the count reaching $N$. When all $N$ arrive, all proceed to compute. When computation finishes, each node registers under `/barrier/leave`, proceeding only when all $N$ have finished, preventing fast workers from starting subsequent phases while slow workers are still executing.
- Why not A: NFS file polling lacks transactional event notifications and watch mechanics.
- Why not C: 2PC is for atomic transaction commit, not multi-phase synchronization.
- Why not D: UDP is unreliable and prone to silent packet loss.
- Ref: [modules/08-distributed-coordination-and-locks.md](../modules/08-distributed-coordination-and-locks.md#distributed-barriers), ZooKeeper Recipes Documentation
</details>

---

### Domain 9: Distributed Transactions & Atomic Commit

#### Q-DIST-046 · Two-Phase Commit Blocking · difficulty 2 · scenario
In a Two-Phase Commit (2PC) protocol with 1 Coordinator and 3 Participants, all participants vote `YES` in Phase 1 (Prepare) and transition to the `PREPARED` state, holding local row locks. The Coordinator writes `COMMIT` to its write-ahead log, but crashes before sending the `Commit` message to any participant. What state are the participants left in?
- A) They immediately commit the transaction after a 5-second timeout.
- B) They immediately abort the transaction and release locks.
- C) They are **blocked indefinitely**, holding their row locks, because they cannot unilaterally decide to commit or abort without learning the coordinator's decision.
- D) They elect a new leader using Raft to abort the transaction.
<details><summary>Answer</summary>

**C.** This is the classic **blocking coordinator vulnerability** of 2PC. Once a participant votes `YES` in Phase 1, it abdicates autonomy: it cannot abort (the coordinator might have decided to commit), and it cannot commit (the coordinator or another participant might have voted to abort). Until the coordinator recovers or an operator intervenes, participants remain blocked, holding locks and paralyzing concurrent transactions.
- Why not A: If another participant had voted NO and the coordinator aborted, committing would cause inconsistency.
- Why not B: The coordinator already logged COMMIT; aborting would cause a split transaction.
- Why not C is correct.
- Why not D: Standard 2PC participants do not have an embedded Raft protocol to supersede coordinators.
- Ref: [modules/09-distributed-transactions-and-atomic-commit.md](../modules/09-distributed-transactions-and-atomic-commit.md#two-phase-commit-2pc-and-blocking), Gray (1978), Bernstein et al. (1987)
</details>

#### Q-DIST-047 · Three-Phase Commit · difficulty 3 · single
Why is the Three-Phase Commit (3PC, Skeen 1981) protocol rarely deployed in real-world distributed database systems across networks?
- A) Because 3PC requires 100 network round trips.
- B) Because 3PC is non-blocking ONLY under the assumption of a crash-stop failure model with a synchronous network; in the presence of network partitions, 3PC can split-brain and decide both commit and abort on opposite sides of a partition.
- C) Because 3PC requires hardware quantum entanglement.
- D) Because 3PC was proven mathematically incorrect in 1982.
<details><summary>Answer</summary>

**B.** Skeen's 3PC adds a `PreCommit` phase to remove the uncertainty window when nodes are prepared. However, Skeen's non-blocking proof strictly assumes a synchronous network where message delays are strictly bounded and network partitions never occur. Under real-world network partitions, 3PC sub-clusters can time out and make conflicting decisions (one partition commits while another aborts), violating safety. Real-world systems use Paxos/Raft-replicated coordinators instead.
- Why not A: 3PC requires 3 round trips, not 100.
- Why not C: Fictitious requirement.
- Why not D: 3PC is mathematically correct under its stated (synchronous, crash-stop) assumptions.
- Ref: [modules/09-distributed-transactions-and-atomic-commit.md](../modules/09-distributed-transactions-and-atomic-commit.md#three-phase-commit-3pc-and-partitions), Skeen (1981)
</details>

#### Q-DIST-048 · Google Percolator · difficulty 3 · scenario
In Google's Percolator transaction protocol (Peng & Dabek 2016), how are distributed transactions committed atomically across Bigtable without a centralized transaction manager?
- A) By designating one cell in the write set as the **Primary Lock**; committing the transaction consists of atomically removing the primary lock and writing its commit record; all secondary locks determine their commit status by referencing the primary lock.
- B) By running 2PC across all Bigtable tablet servers with an in-memory coordinator.
- C) By acquiring exclusive OS file locks on Bigtable SSTables.
- D) By disabling snapshot isolation.
<details><summary>Answer</summary>

**A.** Percolator provides distributed ACID transactions over Bigtable using snapshot isolation. In Phase 1 (Prewrite), locks are written to all modified cells, with one designated as the `Primary`. If prewrite succeeds on all keys, Phase 2 commits the transaction by executing a single atomic mutation on the **Primary Lock**: replacing the lock with a commit timestamp in Bigtable's `write` column. Once the primary commits, the transaction is officially committed. Secondary locks are resolved asynchronously by reading the primary lock's state.
- Why not B: Percolator avoids a centralized coordinator service; the client coordinates using Bigtable cells.
- Why not C: Bigtable SSTables are immutable on GFS/Colossus; file locking is impossible.
- Why not D: Percolator is explicitly designed to implement Snapshot Isolation.
- Ref: [modules/09-distributed-transactions-and-atomic-commit.md](../modules/09-distributed-transactions-and-atomic-commit.md#google-percolator-protocol), Peng & Dabek (OSDI 2010)
</details>

#### Q-DIST-049 · Sagas vs 2PC · difficulty 2 · single
What is the fundamental architectural difference between an ACID 2PC transaction and a **Saga** (Garcia-Molina & Salem 1987) in a microservices architecture?
- A) Sagas acquire locks across all databases for the full duration of the business workflow.
- B) Sagas break a long-lived transaction into a sequence of local transactions, committing each step immediately in its local database; if a step fails, the saga executes compensating transactions to semantically reverse previously committed steps, sacrificing Isolation for Availability.
- C) Sagas guarantee strict serializability without compensating actions.
- D) Sagas only run on relational databases.
<details><summary>Answer</summary>

**B.** 2PC holds locks across all participating databases until the final commit, devastating throughput and availability in microservices. A Saga executes each step as an independent, locally committed transaction. If step 4 fails, the orchestrator triggers compensating transactions for steps 3, 2, and 1. Because intermediate states are visible to concurrent transactions, Sagas sacrifice the **I** (Isolation) in ACID in exchange for high availability and decoupled services.
- Why not A: Holding locks across microservices is 2PC, not Sagas.
- Why not C: Sagas inherently expose unisolated intermediate states.
- Why not D: Sagas are database-agnostic and widely used with polyglot persistence.
- Ref: [modules/09-distributed-transactions-and-atomic-commit.md](../modules/09-distributed-transactions-and-atomic-commit.md#sagas-orchestration-and-choreography), Garcia-Molina & Salem (1987)
</details>

#### Q-DIST-050 · Transactional Outbox · difficulty 2 · single
What failure mode does the **Transactional Outbox** pattern solve when a service must both update a database and publish an event to an Apache Kafka message broker?
- A) Kafka brokers dropping messages due to partition rebalancing.
- B) Dual-Write inconsistency: the risk that the database write commits but the network call to publish to Kafka fails (or vice versa), leaving the database and event bus permanently out of sync.
- C) Database buffer pool exhaustion during bulk inserts.
- D) SSL certificate expiration between microservices.
<details><summary>Answer</summary>

**B.** A classic distributed systems pitfall is attempting a "dual-write" to two independent systems (e.g., `db.save(user)` followed by `kafka.send(userCreatedEvent)`). If the app crashes between the two, or Kafka is unreachable, one succeeds while the other fails. The Transactional Outbox pattern writes the event into an `outbox` table within the **same local database transaction** as the business mutation. A separate Change Data Capture (CDC) process (like Debezium) tails the database transaction log and guarantees at-least-once delivery to Kafka.
- Why not A: The problem exists regardless of Kafka's rebalancing mechanics.
- Why not C: Outbox tables do not resolve buffer pool memory exhaustion.
- Why not D: Unrelated to transport encryption.
- Ref: [modules/09-distributed-transactions-and-atomic-commit.md](../modules/09-distributed-transactions-and-atomic-commit.md#transactional-outbox-and-listen-to-yourself), Richardson (Microservices Patterns 2018)
</details>

#### Q-DIST-051 · Spanner Distributed Transactions · difficulty 3 · single
In Google Spanner, how are cross-shard distributed transactions executed while guaranteeing strict serializability?
- A) By using TrueTime timestamps with Two-Phase Locking (2PL) for read/write transactions, running Two-Phase Commit (2PC) across the Paxos groups that host the participating shards.
- B) By routing all writes globally through a single primary leader in Iowa.
- C) By relying on eventually consistent Dynamo quorums.
- D) By disabling cross-shard transactions entirely.
<details><summary>Answer</summary>

**A.** Spanner combines Paxos and 2PC: each shard (split) is a Paxos group, ensuring high availability and fault tolerance. For cross-shard transactions, Spanner runs a Two-Phase Commit protocol where the coordinator and participants are *Paxos groups* rather than individual nodes. Locks are acquired via 2PL, and TrueTime assigns globally monotonic commit timestamps, guaranteeing external consistency (strict serializability) globally.
- Why not B: Spanner is globally distributed and decentralized; routing all writes through a single leader would defeat its scaling and availability goals.
- Why not C: Spanner provides strict serializability, not eventual consistency.
- Why not D: Cross-shard transactions are a flagship capability of Spanner.
- Ref: [modules/09-distributed-transactions-and-atomic-commit.md](../modules/09-distributed-transactions-and-atomic-commit.md#spanner-paxos-2pc-and-calvin), Corbett et al. (2012)
</details>

---

### Domain 10: Messaging, Distributed Logs & Partitioning

#### Q-DIST-052 · Kafka High Watermark · difficulty 2 · single
In an Apache Kafka partition, what is the distinction between the **Log End Offset (LEO)** and the **High Watermark (HW)**?
- A) LEO is the offset of the next record written to the leader's local disk; HW is the offset up to which records have been replicated to all In-Sync Replicas (ISR) and are safe for consumers to read.
- B) LEO is consumer offset; HW is producer sequence number.
- C) HW tracks tombstone deletion markers; LEO tracks active keys.
- D) LEO is an encryption key; HW is an authentication signature.
<details><summary>Answer</summary>

**A.** The Log End Offset (LEO) is the offset of the highest message written to the local log on a replica. The High Watermark (HW) is the minimum LEO across all replicas in the In-Sync Replicas (ISR) set. Kafka consumers are only allowed to read messages up to the High Watermark, ensuring that consumers never observe uncommitted, speculative writes that could be lost or truncated if the leader crashes.
- Why not B: Consumer offsets are stored in `__consumer_offsets`; producer sequence numbers are in the produce request.
- Why not C: HW and LEO track physical partition offsets, not compaction tombstones.
- Why not D: These are log indexing offsets, not cryptographic tokens.
- Ref: [modules/10-messaging-logs-and-delivery-semantics.md](../modules/10-messaging-logs-and-delivery-semantics.md#the-distributed-commit-log), Kreps (I Heart Logs 2014)
</details>

#### Q-DIST-053 · Kafka Durability Configuration · difficulty 2 · scenario
A financial audit topic in Kafka requires zero message loss upon single broker failure. The topic is configured with replication factor 3. The producer sets `acks=all`. However, the broker configuration has `min.insync.replicas=1`. Why does this configuration fail to protect against message loss?
- A) Because `acks=all` only waits for acknowledgment from followers, not the leader.
- B) If 2 of the 3 brokers fail or lag behind and fall out of the ISR, the ISR shrinks to size 1 (the leader alone); because `min.insync.replicas=1`, the leader continues to acknowledge writes with `acks=all` alone; if that lone leader crashes before replicas catch up, those writes are lost.
- C) Because Kafka requires SSL to guarantee message durability.
- D) Because `min.insync.replicas` must always equal the partition count.
<details><summary>Answer</summary>

**B.** `acks=all` means the leader waits for acknowledgments from **all current members of the ISR**, NOT from all replicas in the replication factor! If two brokers drop out of the ISR, the ISR size becomes 1. If `min.insync.replicas=1`, the lone leader accepts and acknowledges writes alone. A subsequent crash of that leader causes permanent data loss. To guarantee true resilience against a node crash, `min.insync.replicas` must be set to $\ge 2$.
- Why not A: `acks=all` waits for the leader AND all in-sync followers.
- Why not C: SSL encrypts transit data; it has no effect on log persistence.
- Why not D: `min.insync.replicas` is an ISR threshold, independent of partition count.
- Ref: [modules/10-messaging-logs-and-delivery-semantics.md](../modules/10-messaging-logs-and-delivery-semantics.md#durability-invariants-and-the-isr), Kleppmann (DDIA 2e Chapter 11)
</details>

#### Q-DIST-054 · Producer Idempotence · difficulty 2 · single
How does Apache Kafka's Idempotent Producer eliminate duplicate records upon network retry?
- A) By hashing the message payload and storing a Bloom filter in RAM.
- B) The broker assigns a 64-bit Producer ID (PID) to the producer; each batch includes the PID and a monotonically increasing Sequence Number (`seqNum`); the broker stores the highest `seqNum` per partition and discards any batch where $\text{seqNum} \le \text{lastSeqNum}$.
- C) By running Two-Phase Commit with the consumer group coordinator.
- D) By enforcing single-threaded producer execution.
<details><summary>Answer</summary>

**B.** Kafka Idempotent Producer assigns each producer a unique PID via an `InitProducerId` RPC. For each topic partition, the producer tags every batch with a monotonic sequence number starting at 0. The broker tracks the latest sequence number for each PID. If a network retry arrives with a sequence number already committed to the partition log, the broker returns success to the client but discards the duplicate record, guaranteeing exactly-once semantics per partition per producer session.
- Why not A: Kafka uses sequence numbers, not probabilistic Bloom filters.
- Why not C: 2PC is used in transactional multi-partition writes, not simple idempotent produce.
- Why not D: Multiple threads and concurrent batches can be executed.
- Ref: [modules/10-messaging-logs-and-delivery-semantics.md](../modules/10-messaging-logs-and-delivery-semantics.md#exactly-once-semantics-eos), KIP-98 (2017)
</details>

#### Q-DIST-055 · Partition Resizing Trap · difficulty 3 · scenario
An e-commerce system partitions order events by `order_id` across 10 Kafka partitions using the standard hash partitioner: $\text{partition} = \text{murmur2}(\text{order\_id}) \pmod{10}$. Due to traffic growth, an engineer increases the partition count from 10 to 20. What critical distributed systems invariant is immediately broken for subsequent orders?
- A) Existing consumer groups will crash with OutOfMemory exceptions.
- B) Total ordering per `order_id` is broken: subsequent events for existing order IDs will hash to different partitions ($\pmod{20} \neq \pmod{10}$), causing consumer services to process updates out of order relative to initial creation events.
- C) Kafka brokers delete all messages in the existing 10 partitions.
- D) The cluster loses consensus and requires a ZK/KRaft wipe.
<details><summary>Answer</summary>

**B.** Kafka guarantees message ordering strictly *within a single partition*, not across partitions! When the partition count changes from 10 to 20, the modulo arithmetic $\text{murmur2}(k) \pmod N$ changes for approximately 50% of keys. If `OrderCreated` was sent to partition 4, subsequent `OrderPaid` or `OrderShipped` events for that same `order_id` may hash to partition 14. Consumers processing partition 14 may consume `OrderPaid` before another consumer on partition 4 consumes `OrderCreated`, causing severe causal ordering violations.
- Why not A: Consumer groups automatically adapt to new partitions without crashing.
- Why not C: Existing partitions and historical data remain intact.
- Why not D: Partition expansion is a standard administrative operation that does not corrupt metadata.
- Ref: [modules/10-messaging-logs-and-delivery-semantics.md](../modules/10-messaging-logs-and-delivery-semantics.md#partitioning-and-the-resizing-trap), Kafka Documentation
</details>

#### Q-DIST-056 · Cooperative Rebalancing · difficulty 2 · single
What was the primary performance defect of Kafka's legacy Eager Consumer Rebalance Protocol, and how did KIP-848 / KIP-429 Cooperative Rebalancing resolve it?
- A) Eager rebalancing required restarting the broker JVM.
- B) Eager rebalancing forced all consumers in the group to revoke all assigned partitions and stop consuming (a "Stop-The-World" pause for the entire consumer group), whereas Cooperative Rebalancing revokes only the specific partitions that must be reassigned, allowing unaffected consumers to continue processing without interruption.
- C) Cooperative rebalancing converts Kafka to RabbitMQ queues.
- D) Eager rebalancing dropped 10% of unacknowledged messages.
<details><summary>Answer</summary>

**B.** In the legacy eager rebalance protocol, when a single consumer joined or left the group, every consumer in the group had to revoke all their partition assignments, flush state, and rejoin. This caused severe "stop-the-world" consumption freezes that could last minutes in large groups with heavy state. Cooperative Sticky Rebalancing uses a two-phase protocol: consumers continue processing unaffected partitions while only the subset of partitions migrating to new owners are revoked and reassigned.
- Why not A: Rebalancing operates purely within consumer clients and group coordinators, not JVM restarts.
- Why not C: Rebalancing protocol changes do not alter Kafka's storage architecture.
- Why not D: Kafka does not drop committed messages during rebalance.
- Ref: [modules/10-messaging-logs-and-delivery-semantics.md](../modules/10-messaging-logs-and-delivery-semantics.md#consumer-groups-and-rebalancing), KIP-429 / KIP-848
</details>

#### Q-DIST-057 · Kafka 4.2 Share Groups · difficulty 2 · single
What new consumption paradigm was introduced in Kafka 4.2 via KIP-932 (Share Groups)?
- A) It removes partitions entirely from Kafka topics.
- B) It introduces queuing semantics over Kafka topics: multiple consumers in a share group can cooperatively consume and individually acknowledge records from the same partition, enabling point-to-point work queue patterns without 1:1 consumer-to-partition limits.
- C) It replaces KRaft metadata with SQLite.
- D) It enables peer-to-peer file sharing via BitTorrent.
<details><summary>Answer</summary>

**B.** Historically, Kafka's concurrency within a topic was strictly bounded by its partition count: a partition could only be consumed by at most one consumer in a consumer group. KIP-932 introduces **Share Groups**, bringing traditional message-queue (JMS / SQS / RabbitMQ) semantics to Kafka. Multiple consumer threads can consume concurrently from the *same* partition, acknowledging records individually, decoupling worker concurrency from partition sizing.
- Why not A: Partitions remain the underlying storage and ordering engine.
- Why not C: KRaft remains the metadata consensus protocol.
- Why not D: BitTorrent is unrelated to Kafka streaming.
- Ref: [modules/10-messaging-logs-and-delivery-semantics.md](../modules/10-messaging-logs-and-delivery-semantics.md#kafka-share-groups-kip-932), KIP-932 (Kafka 4.2)
</details>

---

### Domain 11: CRDTs & Strong Eventual Consistency

#### Q-DIST-058 · CRDT Mathematical Foundations · difficulty 2 · single
What three algebraic properties must the merge operator ($\sqcup$) of a state-based Conflict-Free Replicated Data Type (CvRDT) satisfy to form a join-semilattice?
- A) Reflexivity, Transitivity, Anti-symmetry
- B) Commutativity ($x \sqcup y = y \sqcup x$), Associativity ($(x \sqcup y) \sqcup z = x \sqcup (y \sqcup z)$), and Idempotence ($x \sqcup x = x$)
- C) Linearity, Homogeneity, Orthogonality
- D) Invertibility, Distributivity, Completeness
<details><summary>Answer</summary>

**B.** A state-based CRDT (CvRDT) relies on a mathematical join-semilattice equipped with a partial order $\le$ and a least upper bound operator $\sqcup$ (merge). Commutativity ensures that network arrival order does not matter; Associativity ensures that message batching or grouping does not alter the result; Idempotence ensures that duplicate message deliveries (retries) have no effect. Together, these guarantee Strong Eventual Consistency (SEC) without distributed locking.
- Why not A: These are properties of a partial order relation, not the binary merge operator itself.
- Why not C, D: These are properties from linear algebra or ring theory.
- Ref: [modules/11-conflict-free-replicated-data-types-crdts.md](../modules/11-conflict-free-replicated-data-types-crdts.md#algebraic-foundations-join-semilattices), Shapiro et al. (INRIA 2011)
</details>

#### Q-DIST-059 · PN-Counter Mechanics · difficulty 1 · single
How does a PN-Counter (Positive-Negative Counter) achieve correct increments and decrements in a state-based CRDT without losing concurrent updates?
- A) By subtracting incoming values using floating-point arithmetic.
- B) By maintaining two separate internal G-Counters (Grow-Only Counters): $P$ for increments and $N$ for decrements; the effective value is $V = \sum P - \sum N$, and merge computes component-wise maximums on both counters ($\max(P_1, P_2)$ and $\max(N_1, N_2)$).
- C) By running Paxos on every decrement operation.
- D) By locking the counter record during decrements.
<details><summary>Answer</summary>

**B.** Decrements violate the monotonicity requirement of a join-semilattice. A PN-Counter circumvents this by using two monotonic G-Counters: vector $P$ tracks all positive increments per node, while vector $N$ tracks all negative decrements (represented as positive quantities). Merging two PN-counters takes the component-wise maximum of $P$ and the component-wise maximum of $N$. The user-visible counter value is $\sum P[i] - \sum N[i]$, guaranteeing monotonic growth of internal states and deterministic convergence.
- Why not A: Direct subtraction on non-monotonic state breaks idempotence and associativity.
- Why not C, D: CRDTs are explicitly designed to operate lock-free without consensus protocols.
- Ref: [modules/11-conflict-free-replicated-data-types-crdts.md](../modules/11-conflict-free-replicated-data-types-crdts.md#pn-counter-mechanics), Shapiro et al. (2011)
</details>

#### Q-DIST-060 · OR-Set Add-Wins · difficulty 2 · scenario
In an Observed-Removed Set (OR-Set) CRDT with Add-Wins semantics, Replica A and Replica B both initially contain element $e$. Client 1 concurrently calls `remove(e)` on Replica A, while Client 2 calls `add(e)` on Replica B. When Replica A and Replica B merge their states, what is the resulting state of element $e$?
- A) Element $e$ is absent, because deletions take precedence over additions.
- B) Element $e$ is present in the set, because the addition generated a fresh unique tag that was not observed by the concurrent removal operation.
- C) The merge throws a `ConcurrentModificationException`.
- D) Element $e$ is duplicated as $e$ and $e'$.
<details><summary>Answer</summary>

**B.** In an Add-Wins OR-Set, each addition creates a tuple $(e, \text{tag})$ with a globally unique identifier (e.g. UUID). A `remove(e)` operation removes only the specific tags for $e$ that are *currently visible* on that replica. When Client 2 concurrently executes `add(e)` on Replica B, it generates a fresh tag $tag_{\text{new}}$. When the replicas merge, Client 1's removal deleted only the old tags; the new tag $tag_{\text{new}}$ survives, and element $e$ remains present in the set.
- Why not A: In an Add-Wins set, concurrent adds win over removes; Remove-Wins is an alternative policy, but Add-Wins is the industry default.
- Why not C: CRDT merges are deterministic mathematical joins that never throw conflict exceptions.
- Why not D: Sets enforce distinct elements; element $e$ is either present or absent.
- Ref: [modules/11-conflict-free-replicated-data-types-crdts.md](../modules/11-conflict-free-replicated-data-types-crdts.md#or-set-add-wins), Shapiro et al. (2011)
</details>

#### Q-DIST-061 · CRDT Sequence Tombstones · difficulty 2 · single
In collaborative text editing sequence CRDTs (such as RGA or Yjs), what problem arises from character deletion, and how is it mitigated in production?
- A) Deletions delete the entire document; mitigated by periodic full backups.
- B) Deletions leave "tombstones" (metadata markers preserving identity and causal relationships) in memory, causing metadata to grow unbounded over time; mitigated by causal stability garbage collection (GC) or run-length encoding.
- C) Deletions require running Raft leader elections.
- D) Deleted characters reappear whenever the browser window is resized.
<details><summary>Answer</summary>

**B.** In sequence CRDTs, inserting characters requires anchoring to preceding character IDs. If a character were physically deleted from memory, a concurrent insert referencing that character could not find its insertion anchor, breaking convergence. Therefore, deleted characters must remain as **tombstones**. In long-lived documents, tombstones cause severe memory bloat. Production frameworks (like Yjs and Automerge) use Run-Length Encoding (RLE) to compress adjacent tombstones and perform causal stability GC when all peers have acknowledged past state.
- Why not A: Deletions target individual characters, not full documents.
- Why not C: Collaborative editing CRDTs are decentralized and peer-to-peer.
- Why not D: Window resizing is a UI event unrelated to CRDT causal trees.
- Ref: [modules/11-conflict-free-replicated-data-types-crdts.md](../modules/11-conflict-free-replicated-data-types-crdts.md#sequence-crdts-and-collaborative-text), Roh et al. (RGA 2011), Kleppmann (Automerge)
</details>

#### Q-DIST-062 · Local-First Software · difficulty 1 · single
Which of the following is one of the seven foundational ideals of **Local-First Software** formulated by Martin Kleppmann et al. (2019)?
- A) All client operations must execute two-phase commit over the network before updating local UI.
- B) The user's device is primary; local data is stored on local disk and immediately available offline; cloud servers act as secondary replication relays rather than central gatekeepers of truth.
- C) Local data is encrypted with keys held exclusively by cloud vendors.
- D) Web applications must not use WebSockets.
<details><summary>Answer</summary>

**B.** The Local-First manifesto articulates 7 ideals: (1) No spinners: your work at your fingertips; (2) Multi-device sync; (3) Network is optional (offline-first); (4) Collaboration; (5) The long now (data outlives software vendors); (6) Security and privacy by default; (7) User retains ultimate ownership. Data resides primarily on user devices, and CRDTs synchronize peer-to-peer or via generic relays.
- Why not A: Local-first requires immediate local execution without network waits.
- Why not C: Local-first prioritizes user ownership and end-to-end encryption.
- Why not D: Local-first systems frequently use WebSockets and WebRTC for synchronization.
- Ref: [modules/11-conflict-free-replicated-data-types-crdts.md](../modules/11-conflict-free-replicated-data-types-crdts.md#local-first-software), Kleppmann, Wiggins, van Hardenberg, McGranaghan (Onward! 2019)
</details>

---

### Domain 12: Verification, DST & Fault Injection

#### Q-DIST-063 · Deterministic Simulation Testing · difficulty 3 · scenario
FoundationDB and TigerBeetle test their distributed storage engines using **Deterministic Simulation Testing (DST)** (also known as TigerBeetle's VOPR). How does DST allow a single developer machine to discover race conditions that would take months to manifest in production?
- A) By compiling C++ directly to FPGA hardware.
- B) By running the entire distributed cluster within a single OS process, replacing asynchronous network I/O, disk writes, thread scheduling, and physical clocks with a deterministic pseudo-random simulated discrete-event loop seeded by an integer; any bug found is 100% reproducible byte-for-byte by re-running that exact seed.
- C) By running machine learning models on AWS CloudWatch logs.
- D) By disabling all assertions and error handling during testing.
<details><summary>Answer</summary>

**B.** In DST, real I/O (sockets, disks, timers) is replaced by deterministic mocks controlled by a discrete-event simulator. Time is virtualized. Randomized network partitions, packet reordering, packet drops, bitflips, disk latency, and process crashes are driven entirely by a single pseudo-random number generator seed. Because execution is 100% single-threaded and deterministic, complex concurrency bugs can be discovered in seconds and reproduced perfectly every time by simply executing the test with the identical seed.
- Why not A: DST runs on standard CPU architectures in software.
- Why not C: DST tests protocol code directly via simulation, not log pattern mining.
- Why not D: DST relies heavily on invariant assertions running continuously.
- Ref: [modules/12-verification-testing-and-fault-injection.md](../modules/12-verification-testing-and-fault-injection.md#deterministic-simulation-testing-dst), Zhou et al. (FoundationDB, SIGMOD 2021)
</details>

#### Q-DIST-064 · Jepsen Testing · difficulty 2 · single
In Kyle Kingsbury's **Jepsen** distributed systems testing framework, what is the role of the **Nemesis** component?
- A) To generate client read/write workloads.
- B) To parse database configuration files for security vulnerabilities.
- C) To systematically inject real-world faults into the running cluster (e.g., partitioning nodes via `iptables`, pausing JVMs with `SIGSTOP`/`SIGCONT`, skewing clocks with `faketime`, and killing processes).
- D) To verify whether the resulting execution history is linearizable.
<details><summary>Answer</summary>

**C.** In Jepsen, three components cooperate: (1) **Generator/Client** submits concurrent operations to the cluster; (2) **Nemesis** introduces chaos and faults (network partitions, network delay, process crashes, thread pauses, clock jumps); (3) **Checker** (such as Knossos or Elle) analyzes the recorded operation history to verify if invariants (linearizability, serializability, monotonic reads) were violated during the faults.
- Why not A: That is the role of the Generator/Client.
- Why not B: Jepsen tests runtime behavior, not static configuration parsing.
- Why not D: That is the role of the Checker/Analyzer.
- Ref: [modules/12-verification-testing-and-fault-injection.md](../modules/12-verification-testing-and-fault-injection.md#jepsen-testing-framework), Kingsbury (aphyr.com)
</details>

#### Q-DIST-065 · TLA+ Formal Verification · difficulty 3 · single
How does Leslie Lamport's **TLA+** (Temporal Logic of Actions) and its model checker **TLC** help distributed systems engineers prevent production design bugs?
- A) It automatically generates optimized Rust code from UML diagrams.
- B) It models systems mathematically as state transitions ($Init \land \Box[Next]_{vars}$); TLC exhaustively explores the complete state space of reachable configurations to prove that safety invariants and liveness properties hold across all possible message interleavings.
- C) It monitors live production CPU and memory utilization.
- D) It replaces unit tests by running automated fuzz tests on HTTP endpoints.
<details><summary>Answer</summary>

**B.** TLA+ is a formal specification language based on first-order logic and set theory. An algorithm is specified by its initial state predicate ($Init$) and next-state relation ($Next$). The TLC model checker evaluates every possible reachable state across all concurrent interleavings. If TLC encounters any state that violates a declared invariant (e.g., two leaders elected in the same term, or divergent committed entries), it halts and prints the exact step-by-step trace leading to the failure.
- Why not A: TLA+ is a specification language, not a compiler.
- Why not C: TLA+ is a design verification tool, not an APM monitoring tool.
- Why not D: TLC tests abstract state machines exhaustively, not HTTP endpoints.
- Ref: [modules/12-verification-testing-and-fault-injection.md](../modules/12-verification-testing-and-fault-injection.md#formal-methods-tla), Newcombe et al. (AWS, CACM 2015)
</details>

#### Q-DIST-066 · State Space Explosion · difficulty 2 · single
When using a formal model checker like TLC, what is the **State Space Explosion** problem, and how is it practically managed?
- A) The model checker runs out of CPU cores; managed by adding more physical servers.
- B) The number of reachable states grows exponentially with the number of nodes, messages in flight, and values considered ($O(V^N)$); managed by testing bounded model instances (e.g., 3 nodes, 2 client values) and utilizing state symmetry sets.
- C) Disk sectors become fragmented; managed by defragmentation.
- D) The specification exceeds 1,000 lines of code; managed by minification.
<details><summary>Answer</summary>

**B.** State space explosion is the fundamental challenge of exhaustive model checking: adding a single node or buffer slot can multiply the reachable states by orders of magnitude, exhausting memory. Engineers manage this using **symmetry reduction** (recognizing that permutations of node IDs are structurally identical) and **small scope hypotheses** (Jackson 2002): virtually all subtle distributed concurrency bugs can be triggered with 3 nodes, 2 terms, and 1 concurrent failure.
- Why not A: Exponential growth rapidly outstrips any physical hardware scaling.
- Why not C: Memory and algorithmic bounds are the limiting factor, not disk fragmentation.
- Why not D: Specification text size does not dictate state graph dimensions.
- Ref: [modules/12-verification-testing-and-fault-injection.md](../modules/12-verification-testing-and-fault-injection.md#formal-methods-tla), Lamport (Specifying Systems 2002)
</details>

#### Q-DIST-067 · Chaos Engineering · difficulty 1 · single
What is the core principle of **Chaos Engineering** (pioneered by Netflix with Chaos Monkey)?
- A) Randomly deleting production database tables to see if the backup team is awake.
- B) Formulating an empirical hypothesis about system steady-state, introducing realistic turbulence/failures in production or staging environments, and measuring whether the system sustains its steady-state behavior within a bounded blast radius.
- C) Disabling firewall rules to test network throughput.
- D) Replacing all microservices with a monolithic architecture.
<details><summary>Answer</summary>

**B.** Principles of Chaos Engineering (Basiri et al., Netflix 2016): (1) Define steady-state as measurable business output (e.g., stream starts per second); (2) Hypothesize that steady-state will continue in both control and experiment groups; (3) Introduce variables that reflect real-world events (server crashes, datacenter disconnects, network latency); (4) Minimize blast radius; (5) Run experiments in production to build confidence in systemic resilience.
- Why not A: Chaos engineering requires deliberate hypotheses and controlled blast radii, not reckless sabotage.
- Why not C, D: Unrelated to the definition of chaos engineering.
- Ref: [modules/12-verification-testing-and-fault-injection.md](../modules/12-verification-testing-and-fault-injection.md#chaos-engineering-in-production), Basiri et al. (IEEE Software 2016)
</details>

---

### Domain 13: Byzantine Fault Tolerance & Open Systems

#### Q-DIST-068 · Byzantine Fault Model · difficulty 1 · single
What characterizes a **Byzantine Fault** (Lamport, Shostak, Pease 1982) compared to a Crash-Stop or Crash-Recovery fault?
- A) A node stops executing and never resumes.
- B) A node may exhibit arbitrary, unpredictable, or actively malicious behavior—including sending conflicting messages to different peers, forging identities, modifying state incorrectly, or colluding with other faulty nodes.
- C) A node pauses execution due to Java garbage collection.
- D) A network switch drops UDP packets during high congestion.
<details><summary>Answer</summary>

**B.** The Byzantine fault model is the most adversarial failure model in distributed systems. Unlike benign crash-stop or crash-recovery models where nodes execute the algorithm correctly until they stop, a Byzantine node can behave arbitrarily: lie about its state, send message $m_1$ to node $A$ while sending contradicting message $m_2$ to node $B$ ("equivocation"), drop messages selectively, or attempt to corrupt consensus.
- Why not A: This describes a Crash-Stop fault.
- Why not C: This is a crash-recovery / transient timing fault.
- Why not D: This is a network omission fault.
- Ref: [modules/13-byzantine-fault-tolerance-and-open-systems.md](../modules/13-byzantine-fault-tolerance-and-open-systems.md#the-byzantine-fault-model), Lamport, Shostak, Pease (ACM TOPLAS 1982)
</details>

#### Q-DIST-069 · Byzantine Mathematical Bound · difficulty 3 · scenario
Prove why a system of $N$ nodes can tolerate at most $f$ Byzantine faulty nodes only if $N \ge 3f + 1$ (e.g. why $N = 3$ fails to tolerate $f = 1$ traitor).
- A) Because network cables have only 3 physical wires.
- B) In a 3-node system with Commander $C$ and Lieutenants $L_1, L_2$: if $C$ is a traitor and sends "Attack" to $L_1$ and "Retreat" to $L_2$, Lieutenant $L_1$ receives "Retreat" from $L_2$ (who claims $C$ said Retreat). $L_1$ cannot distinguish whether Commander $C$ is a traitor who sent conflicting orders, or Lieutenant $L_2$ is a traitor lying about what $C$ said. Therefore, $L_1$ cannot decide safely. Tolerating $f$ traitors requires a non-faulty majority of remaining nodes ($N - f > 2f \implies N \ge 3f + 1$).
- C) Because RSA signatures require at least 4 prime numbers.
- D) Because the FLP theorem only holds when $N$ is a multiple of 4.
<details><summary>Answer</summary>

**B.** Lamport, Shostak, and Pease proved that for oral (unauthenticated) messages, no solution exists for $N \le 3f$. In any quorum or decision group, if $f$ nodes crash or lie, the remaining $N - f$ nodes must be able to make progress. Furthermore, within those $N - f$ nodes, up to $f$ could be faulty nodes feeding misinformation. To ensure that the honest nodes outnumber the faulty nodes in the active set, we must have $(N - f) - f > f$, which simplifies directly to $N - 2f > f \implies N \ge 3f + 1$.
- Why not A, C, D: These are nonsensical distractors.
- Ref: [modules/13-byzantine-fault-tolerance-and-open-systems.md](../modules/13-byzantine-fault-tolerance-and-open-systems.md#the-3f-1-mathematical-bound), Lamport, Shostak, Pease (1982)
</details>

#### Q-DIST-070 · Practical Byzantine Fault Tolerance · difficulty 2 · single
In Castro and Liskov's **Practical Byzantine Fault Tolerance (PBFT)** algorithm (1999), what are the three phases of consensus executed in a view?
- A) Request, Reply, Acknowledge
- B) Pre-Prepare, Prepare, Commit
- C) Syn, Syn-Ack, Ack
- D) Lock, Validate, Release
<details><summary>Answer</summary>

**B.** PBFT executes a three-phase agreement protocol: (1) **Pre-Prepare**: Primary assigns a sequence number $n$ to client request $m$ and broadcasts `<<PRE-PREPARE, v, n, d>, m>` to all replicas; (2) **Prepare**: Replicas verify validity and broadcast `<PREPARE, v, n, d, i>` to each other; nodes wait for $2f$ matching prepares to ensure that honest nodes agree on the sequence number within view $v$ (**Prepared** certificate); (3) **Commit**: Replicas broadcast `<COMMIT, v, n, d, i>` and wait for $2f+1$ commits to ensure total order across view changes (**Committed** certificate) before executing the request.
- Why not A: These are client interaction steps, not the internal consensus phases.
- Why not C: These are TCP transport connection phases.
- Why not D: These are optimistic concurrency control phases.
- Ref: [modules/13-byzantine-fault-tolerance-and-open-systems.md](../modules/13-byzantine-fault-tolerance-and-open-systems.md#practical-byzantine-fault-tolerance-pbft), Castro & Liskov (OSDI 1999)
</details>

#### Q-DIST-071 · Nakamoto Consensus · difficulty 2 · single
How does Bitcoin's Nakamoto Consensus (2008) solve Byzantine consensus in an open, permissionless system where anyone can join and Sybil attacks would trivialise classical quorum voting?
- A) By utilizing centralized KYC identity verification.
- B) By tying voting weight to computational work (Proof-of-Work hash collisions: $H(B) < Target$) and resolving conflicting histories using the Longest-Chain Rule (heaviest cumulative difficulty), making identity count irrelevant.
- C) By running Paxos across millions of mining nodes.
- D) By enforcing synchronous atomic clocks across all nodes.
<details><summary>Answer</summary>

**B.** In permissionless networks, an adversary can spin up 1,000,000 virtual nodes at zero cost (a **Sybil attack**), making IP-based or node-count quorums ($3f + 1$) impossible. Satoshi Nakamoto resolved this by replacing "one node, one vote" with "one CPU (hashrate), one vote". Miners must find a cryptographic nonce such that the block hash is below a target difficulty. Fork conflicts are resolved objectively by the **Longest-Chain Rule** (specifically, the chain with the most accumulated Proof-of-Work difficulty).
- Why not A: Bitcoin is permissionless and pseudonymous without KYC.
- Why not C: Classical Paxos has $O(N^2)$ message complexity and cannot scale to permissionless networks.
- Why not D: Nakamoto consensus relies on Proof-of-Work difficulty, not synchronized clocks.
- Ref: [modules/13-byzantine-fault-tolerance-and-open-systems.md](../modules/13-byzantine-fault-tolerance-and-open-systems.md#nakamoto-consensus-and-open-systems), Nakamoto (2008)
</details>

---

### Domain 14: Real-World Systems, Sharding & Capstone Architecture

#### Q-DIST-072 · Google File System · difficulty 2 · single
In the Google File System (GFS, Ghemawat et al. 2003), why did the architects choose a massive 64 MB chunk size, and what trade-off did they accept?
- A) To reduce master memory overhead (since the master stores chunk metadata in RAM) and reduce client-master network round-trips; accepting the trade-off of wasted space for small files and hotspotting on popular small files.
- B) Because Linux ext3 could only address 64 MB files.
- C) To make disk seeks faster than RAM reads.
- D) To prevent network encryption overhead.
<details><summary>Answer</summary>

**A.** GFS designed its master to maintain all file system metadata (namespace, chunk mappings, locations) entirely in physical RAM for sub-millisecond lookups. A 64 MB chunk requires only 64 bytes of master metadata. A large chunk size minimizes metadata footprint (hundreds of terabytes managed with a few gigabytes of master RAM) and allows clients to perform sequential reads/writes on single chunks without repeatedly querying the master. The trade-off is internal fragmentation for small files and potential hot-spotting if a single small file is accessed by thousands of clients.
- Why not B: Linux ext3 supported multi-gigabyte files.
- Why not C: Disk seeks are orders of magnitude slower than RAM.
- Why not D: Chunk size has no connection to network encryption.
- Ref: [modules/14-distributed-systems-in-practice-and-capstone.md](../modules/14-distributed-systems-in-practice-and-capstone.md#google-file-system-gfs), Ghemawat et al. (SOSP 2003)
</details>

#### Q-DIST-073 · AWS Aurora Architecture · difficulty 3 · single
What was the foundational architectural insight behind Amazon Aurora (Verbitski et al. SIGMOD 2017) regarding the relationship between the database engine and the storage layer?
- A) "The database is the memory; the disk is for backups."
- B) "The Log is the Database": database compute nodes write ONLY redo log records over the network to a 6-way replicated storage fleet across 3 Availability Zones, eliminating dirty page writes, double-write buffers, and cross-AZ write amplification.
- C) Replacing MySQL with MongoDB.
- D) Running SQLite on local EC2 NVMe drives without replication.
<details><summary>Answer</summary>

**B.** Traditional distributed databases replicate entire modified 16 KB data pages, leading to massive write amplification (dirty pages, double-write buffer, binlogs). Aurora observed that data pages are merely an in-memory optimization of the underlying redo log stream. In Aurora, the compute node never writes data pages to storage; it streams *only* tiny redo log records to a specialized 6-way replicated storage service ($V=6, W=4, R=3$) across 3 AZs. Storage nodes independently generate and maintain data pages in the background by applying the log records.
- Why not A: In Aurora, storage is persistent and durable, not merely a backup.
- Why not C: Aurora provides MySQL and PostgreSQL compatibility.
- Why not D: Aurora's defining feature is shared distributed storage across AZs.
- Ref: [modules/14-distributed-systems-in-practice-and-capstone.md](../modules/14-distributed-systems-in-practice-and-capstone.md#aws-aurora-the-log-is-the-database), Verbitski et al. (SIGMOD 2017)
</details>

#### Q-DIST-074 · Dynamo Architecture · difficulty 2 · single
In Amazon's original Dynamo system (DeCandia et al. SOSP 2007), what mechanisms were combined to guarantee "Always-Writable" shopping cart availability during network partitions?
- A) Raft consensus with synchronous leader election.
- B) Consistent Hashing for sharding, Sloppy Quorums with Hinted Handoff for write availability during partitions, and Vector Clocks with client-side reconciliation for resolving concurrent divergent writes.
- C) Two-phase locking across MySQL clusters.
- D) Centralized ZooKeeper coordination.
<details><summary>Answer</summary>

**B.** Dynamo prioritized write availability above all else: a customer must never be prevented from adding an item to their shopping cart. To achieve this, Dynamo used: (1) Consistent Hashing to distribute keys across a node ring; (2) **Sloppy Quorums** and **Hinted Handoff**: if designated nodes are unreachable, writes are accepted by healthy alternate nodes and handed back later; (3) **Vector Clocks**: concurrent writes during partitions produce divergent branches, which are passed to the client application for domain-specific reconciliation (e.g. merging shopping carts).
- Why not A: Synchronous consensus rejects writes on minority partitions, violating always-writable availability.
- Why not C: 2PL blocks on partition boundaries.
- Why not D: Dynamo is decentralized and peer-to-peer without central coordination.
- Ref: [modules/14-distributed-systems-in-practice-and-capstone.md](../modules/14-distributed-systems-in-practice-and-capstone.md#amazon-dynamo), DeCandia et al. (SOSP 2007)
</details>

#### Q-DIST-075 · Multi-Raft Sharding & Handoff · difficulty 3 · scenario
In a sharded distributed database running **Multi-Raft** (such as CockroachDB or TiKV), Range 42 (keys `[m, p)`) must be migrated from Replica Group $\{N_1, N_2, N_3\}$ to Replica Group $\{N_4, N_5, N_6\}$ to rebalance load. How does the system transfer ownership of the range while strictly preserving linearizability and preventing split-brain writes?
- A) By having the client write to both replica groups simultaneously for 5 minutes.
- B) By executing the migration as a consensus-managed configuration change: Node $N_4, N_5, N_6$ are first added as non-voting learners to Range 42's Raft group, caught up via snapshot, promoted to voting members, and then $N_1, N_2, N_3$ are removed via a Raft joint consensus configuration change command.
- C) By restarting all 6 nodes simultaneously.
- D) By changing the DNS record for Range 42.
<details><summary>Answer</summary>

**B.** In Multi-Raft systems, ranges are migrated dynamically without external locks by treating migration as a **Raft membership change** within the range's own consensus group. The new nodes ($N_4, N_5, N_6$) join the existing Raft group of Range 42 as learners to stream log data and snapshots. Once caught up, the group executes a Joint Consensus reconfiguration ($C_{\text{old}} \to C_{\text{old,new}} \to C_{\text{new}}$). Because the Raft group itself transitions smoothly from $\{N_1..N_3\}$ to $\{N_4..N_6\}$, leadership and commit rules remain continuous and unbroken, guaranteeing linearizability throughout the handoff.
- Why not A: Dual-writing by clients causes split-brain conflicts and lacks transaction isolation.
- Why not C: Restarting nodes causes severe downtime and does not automate state migration.
- Why not D: DNS operates at network layer and has zero awareness of key ranges or Raft logs.
- Ref: [modules/14-distributed-systems-in-practice-and-capstone.md](../modules/14-distributed-systems-in-practice-and-capstone.md#sharded-multi-raft-architecture), Ongaro (2014), TiKV / CockroachDB Architecture Docs
</details>

---

## Part 2: Timed 90-Minute Mock Examination

### Overview & Instructions
- **Format**: 4 multi-part in-depth scenarios reflecting a Principal/Staff Distributed Systems Engineering Loop or MIT 6.5840 / Cambridge CST Final Examination.
- **Allowed Time**: 90 Minutes.
- **Passing Score**: 80 / 100 points (Staff / Principal level: 90+ points).

---

### Scenario 1: Multi-Region Active-Active Storage Design (25 Points)

You are the Principal Systems Architect designing a globally distributed, multi-region metadata repository for an AI agent platform. The system operates across 3 geographic regions: `us-east`, `eu-west`, and `ap-northeast`. 

#### Requirements:
1. **P99 Read Latency**: $< 5\text{ms}$ within the local region for 95% of reads.
2. **Write Invariant**: System state must be strictly linearizable for workspace tenancy configurations and security credentials.
3. **Partition Resilience**: The system must remain available for reads and writes even if one entire geographic region suffers a total submarine fiber blackout.

#### Questions:
1. **Protocol Selection & Invariant Proof (10 Points)**:
   - Which consensus and replication architecture satisfies these constraints: Multi-Paxos/Raft with regional followers, Spanner-style TrueTime Paxos, or Dynamo-style CRDTs? Prove why your selection satisfies the write invariant and partition resilience, while explaining why the other two options fail.
2. **Local Read Semantics (8 Points)**:
   - How can local region nodes serve reads in $< 5\text{ms}$ without routing every read across transatlantic fiber links to the current consensus leader, while still guaranteeing linearizability? Contrast **ReadIndex**, **Lease Reads**, and **Bounded Stale Reads**.
3. **Fencing and Zombie Mitigation (7 Points)**:
   - If an asymmetric partition isolates the leader in `us-east` such that it can still receive client traffic but cannot communicate with `eu-west` or `ap-northeast`, describe the exact sequence of events that prevents the isolated leader from accepting uncommitted writes or serving stale data.

<details><summary>Scoring Rubric & Model Answer</summary>

#### Model Answer:

**1. Protocol Selection & Invariant Proof (10 Points)**:
- **Selection**: Multi-Paxos or Raft with a 5-node or 3-region quorum configuration (e.g. 2 nodes in `us-east`, 2 nodes in `eu-west`, 1 node in `ap-northeast` with witness, or Spanner-style Multi-Paxos groups).
- **Proof of Safety**: In a 3-region deployment with 1 voting member per region (or $2+2+1$ distribution), any majority quorum requires $\lceil (3+1)/2 \rceil = 2$ regions. If any single region experiences a total blackout, the remaining 2 regions constitute a strict majority ($2/3 > 1/2$), allowing the leader election and log replication to proceed without violation of Agreement or Validity.
- **Why Dynamo CRDT fails**: CRDTs offer Strong Eventual Consistency, not Linearizability. Concurrent writes produce divergent semilattice states resolved asynchronously. Security credentials and tenancy isolation require immediate mutual exclusion and real-time linearizability.
- **Why Single-Region Primary fails**: A single primary in `us-east` would violate partition resilience if `us-east` blacks out, and would incur $150\text{ms}+$ RTT latency for European and Asian writes and reads.

**2. Local Read Semantics (8 Points)**:
- To achieve $< 5\text{ms}$ local reads without cross-region WAN round-trips:
  - **Lease Reads**: The consensus leader obtains a timed lease from followers. During the lease validity period, followers guarantee they will not elect a new leader. If the local node is the leader, it serves reads locally in $O(1)$ memory lookup. However, for cross-region followers, a bare follower read would be stale.
  - **ReadIndex with Follower Reads**: The local follower queries the remote leader for the current `ReadIndex` (1 WAN RTT, $\approx 70\text{ms}$), which violates the $< 5\text{ms}$ requirement.
  - **Resolution**: To strictly achieve $< 5\text{ms}$ reads locally while maintaining linearizability, metadata must be partitioned into shard ranges where each region acts as the Raft leader for its locally owned workspaces using **Leader Leases with synchronized hardware clocks / TrueTime**, or the requirement must explicitly classify read operations: linearizable writes + local lease reads for tenant-local data, and bounded staleness ($t \le 100\text{ms}$) for non-critical reads.

**3. Fencing and Zombie Mitigation (7 Points)**:
- The isolated leader in `us-east` attempts to replicate incoming client writes.
- Because it can reach neither `eu-west` nor `ap-northeast`, it cannot collect a majority quorum of `AppendEntries` acknowledgments ($1/3 < 2/3$).
- The leader never commits the entry, never advances its `commitIndex`, and never returns a success response to the client.
- Concurrently, the nodes in `eu-west` and `ap-northeast` experience election timeouts, conduct a Pre-Vote, increment their term, and elect a new leader in `eu-west`.
- Under **Check-Quorum**, the isolated `us-east` leader notices that an election timeout has elapsed without heartbeats from a majority; it voluntarily abdicates to Follower state, closing client write channels.
- Any write attempted on storage is guarded by monotonic fencing tokens derived from the Raft term, ensuring any delayed packet is rejected by storage.

**Scoring Guide**:
- 9-10 pts: Rigorous proof of quorum bounds, correct failure analysis of CRDT and single-master.
- 7-8 pts: Accurate explanation of Lease Reads vs ReadIndex and latency trade-offs.
- 6-7 pts: Exhaustive failure sequence covering Check-Quorum, majority unreachability, and fencing tokens.
</details>

---

### Scenario 2: Diagnosing & Mitigating a Metastable Retry Storm (25 Points)

A critical authentication and authorization service handles 50,000 requests/sec. Following a brief 200ms network blip on the backend Redis session cache, the system collapses:
- Database CPU spikes to 100%.
- Client P99 latency jumps from 12ms to 15,000ms.
- Downstream HTTP 504 Gateway Timeouts surge to 60%.
- Upstream microservices retry every failed request 3 times with a 200ms fixed timeout.
- Even after the Redis cache is confirmed healthy and reachable, the database CPU remains pegged at 100% and the system does not recover after 30 minutes.

#### Questions:
1. **Feedback Loop Identification (8 Points)**:
   - Identify the two distinct sustaining feedback loops that maintain this metastable failure state even after the trigger (the network blip) has resolved.
2. **Work Amplification Calculation (7 Points)**:
   - If initial request arrival rate is $R = 50{,}000\text{ req/s}$, client timeout is 200ms, and clients retry up to 3 times on timeout, calculate the potential maximum amplified request volume hitting the saturated database. Explain why exponential backoff *alone* is insufficient to halt the storm.
3. **Comprehensive Remediation Architecture (10 Points)**:
   - Propose an architectural remedy incorporating: (a) Circuit breakers, (b) Jittered backoff, (c) Retry budgets, (d) Adaptive load shedding / concurrency limits (e.g. CoDel or Little's Law queues), and (e) Cache-stampede defenses (XFetch / Probabilistic early expiration).

<details><summary>Scoring Rubric & Model Answer</summary>

#### Model Answer:

**1. Feedback Loop Identification (8 Points)**:
- **Loop 1: Retry Amplification & Work Multiplier**: When database response time exceeds the client timeout ($200\text{ms}$), upstream clients abandon the connection and issue a retry. However, the database continues processing the original abandoned query to completion. The database is now executing work for requests whose callers have already given up, while receiving up to $3\times$ additional retried requests, exponentially increasing queue depth.
- **Loop 2: Cache Depletion & Negative Cache Invalidation**: The initial blip prevented session tokens from being fetched or refreshed in Redis. Requests bypassed cache and hit the database. Under 100% CPU, database queries timeout before the application can write the retrieved sessions back into Redis. Thus, the cache hit rate drops to zero, permanently converting a cache-buffered architecture into a raw database thundering herd.

**2. Work Amplification Calculation (7 Points)**:
- Saturated request volume: $R_{\text{total}} = R \times (1 + \text{retries}) = 50{,}000 \times (1 + 3) = 200{,}000\text{ req/s}$.
- The database, which was provisioned for cache-miss traffic of $5{,}000\text{ req/s}$, is subjected to a $40\times$ overload ($200{,}000\text{ req/s}$).
- **Why Exponential Backoff Alone Fails**: Exponential backoff delays retries, but if the aggregate steady-state arrival rate exceeds processing capacity ($R_{\text{arrival}} > C_{\text{database}}$), the queues grow monotonically. Furthermore, if clients retry without jitter, retries cluster into synchronized thundering herds that repeatedly hit the database at interval harmonics.

**3. Comprehensive Remediation Architecture (10 Points)**:
- **(a) Adaptive Concurrency Limits & Load Shedding**: Enforce Little's Law ($L = \lambda W$) at the service boundary. Set a max concurrency limit (e.g., using Vegas or AIMD algorithm). When average latency rises, throttle concurrent in-flight database requests immediately, returning fast HTTP 429 / 503 errors at the gateway without touching the database.
- **(b) Retry Budgets**: Client libraries must enforce a strict retry budget: retries may consume at most 10% of total outbound requests. Once retry tokens are exhausted, requests fail fast.
- **(c) Full / Decorrelated Jitter**: Backoff intervals must be randomized: $t = \text{random}(0, \min(M, b \cdot 2^i))$ to permanently desynchronize client retries.
- **(d) Deadline Propagation**: Attach a deadline timestamp header (e.g., `X-Request-Deadline: <epoch_ms>`). If a database query worker pulls a request from its queue whose deadline has already elapsed, it immediately drops the request without executing SQL.
- **(e) Cache Stampede Defense (XFetch)**: Use the probabilistic early recomputation algorithm:
  $$\Delta - \beta \cdot \ln(\text{random}(0, 1)) \times \text{compute\_time} \ge \text{TTL}$$
  Background workers refresh cache keys *before* they expire, eliminating stampedes. In addition, lock single-flight mutexes (like Go's `singleflight`) per key to ensure only one database query executes for a missed session key.

**Scoring Guide**:
- 7-8 pts: Clear identification of abandoned work waste and cache invalidation collapse.
- 6-7 pts: Accurate mathematical formulation of arrival rates and limitation of backoff.
- 9-10 pts: Complete system design addressing deadline propagation, concurrency limits, retry budgets, and XFetch.
</details>

---

### Scenario 3: Formal Linearizability Verification (25 Points)

Below is a concurrent execution trace of four operations on a single distributed register $X$ (initially $X = 0$). Operations are logged with their physical invocation and response times in milliseconds:

| Op ID | Client | Operation | Invocation Time ($t_{\text{inv}}$) | Response Time ($t_{\text{res}}$) | Result |
|---|---|---|---|---|---|
| $O_1$ | Client 1 | `write(1)` | 100 | 180 | `OK` |
| $O_2$ | Client 2 | `read()` | 120 | 160 | `0` |
| $O_3$ | Client 3 | `write(2)` | 170 | 240 | `OK` |
| $O_4$ | Client 4 | `read()` | 190 | 220 | `1` |
| $O_5$ | Client 5 | `read()` | 230 | 260 | `1` |

#### Questions:
1. **Real-Time Precedence Constraints (8 Points)**:
   - Identify all pairs of operations $(A, B)$ that have a strict real-time precedence order ($A <_{real} B$, meaning $res(A) < inv(B)$).
2. **Linearizability Proof or Refutation (10 Points)**:
   - Is this concurrent history linearizable according to Herlihy-Wing linearizability?
   - If linearizable: provide the exact valid sequential order and assign valid linearization points ($LP$) in milliseconds for all 5 operations.
   - If not linearizable: identify the minimal sub-history that violates linearizability and prove why no legal sequential execution exists.
3. **Algorithmic Complexity (7 Points)**:
   - Describe how the Wing-Gong (WGL) algorithm would explore this execution trace. What is the worst-case time complexity of WGL, and what pruning condition prevents exhaustive search when a valid prefix is found?

<details><summary>Scoring Rubric & Model Answer</summary>

#### Model Answer:

**1. Real-Time Precedence Constraints (8 Points)**:
An operation $A$ strictly precedes $B$ ($A <_{real} B$) iff $t_{\text{res}}(A) < t_{\text{inv}}(B)$:
- $res(O_2) = 160 < inv(O_3) = 170 \implies \mathbf{O_2 <_{real} O_3}$
- $res(O_2) = 160 < inv(O_4) = 190 \implies \mathbf{O_2 <_{real} O_4}$
- $res(O_2) = 160 < inv(O_5) = 230 \implies \mathbf{O_2 <_{real} O_5}$
- $res(O_1) = 180 < inv(O_4) = 190 \implies \mathbf{O_1 <_{real} O_4}$
- $res(O_1) = 180 < inv(O_5) = 230 \implies \mathbf{O_1 <_{real} O_5}$
- Note: $O_3$ ($res=240$) does NOT precede $O_5$ ($inv=230$) because $240 > 230$ (they overlap in time!).
- Note: $O_4$ ($res=220$) precedes $O_5$ ($inv=230$) $\implies \mathbf{O_4 <_{real} O_5}$.

**2. Linearizability Proof or Refutation (10 Points)**:
- **Verdict**: The history is **LINEARIZABLE**.
- **Proof via Valid Sequential Ordering**:
  Let the sequential ordering be:
  $$S = [O_2, O_1, O_4, O_5, O_3]$$
- **Verification of Sequential Legality**:
  1. Initial state: $X = 0$.
  2. $O_2$ (`read() -> 0`) executes: valid ($X$ is 0).
  3. $O_1$ (`write(1) -> OK`) executes: state becomes $X = 1$.
  4. $O_4$ (`read() -> 1`) executes: valid ($X$ is 1).
  5. $O_5$ (`read() -> 1`) executes: valid ($X$ is 1).
  6. $O_3$ (`write(2) -> OK`) executes: state becomes $X = 2$.
- **Verification of Real-Time Consistency**:
  - $O_2$ linearized at $LP = 130\text{ms}$ ($120 \le 130 \le 160$).
  - $O_1$ linearized at $LP = 175\text{ms}$ ($100 \le 175 \le 180$).
  - $O_4$ linearized at $LP = 200\text{ms}$ ($190 \le 200 \le 220$).
  - $O_5$ linearized at $LP = 232\text{ms}$ ($230 \le 232 \le 260$).
  - $O_3$ linearized at $LP = 235\text{ms}$ ($170 \le 235 \le 240$).
  - Notice: Because $O_3$ overlaps with $O_5$ ($[170, 240]$ overlaps $[230, 260]$), $O_3$'s linearization point can be placed *after* $O_5$'s linearization point ($LP(O_5) = 232 < LP(O_3) = 235 \le 240$).
  - All real-time precedence constraints ($O_2 < O_3, O_2 < O_4, O_2 < O_5, O_1 < O_4, O_1 < O_5, O_4 < O_5$) are strictly satisfied.

**3. Algorithmic Complexity (7 Points)**:
- **WGL Exploration**: Wing-Gong maintains a set of concurrent events and recursively searches for a linearized operation from the set of currently "eligible" operations (operations whose invocation has occurred and whose predecessors have finished). It matches operations against the sequential register specification.
- **Pruning**: WGL memoizes pairs of $(\text{history\_prefix\_set}, \text{register\_state})$. If a search branch reaches a state that has already been explored with the same consumed operation set, it prunes the branch immediately.
- **Complexity**: In the worst-case, testing linearizability is **NP-complete** ($O(2^N)$ branch exploration).

**Scoring Guide**:
- 7-8 pts: Flawless extraction of all strict precedence pairs.
- 9-10 pts: Correct linearizable verdict with precise, valid linearization timestamps within $[inv, res]$ intervals.
- 6-7 pts: Accurate description of Wing-Gong search graph, memoization, and NP-complete complexity.
</details>

---

### Scenario 4: Dynamic Multi-Raft Rebalancing & Network Partition (25 Points)

A sharded distributed database (30 nodes, 1,000 Multi-Raft ranges) is balancing range shards across nodes. Range 100 has current Raft replica group $G_1 = \{N_1, N_2, N_3\}$ with leader $N_1$. The shard controller decides to rebalance Range 100 by migrating replica $N_3$ to node $N_4$, changing the group to $G_2 = \{N_1, N_2, N_4\}$.

During the rebalance:
1. $N_4$ is added to the Raft configuration.
2. A network partition splits the datacenter into two components:
   - Component Left: $\{N_1, N_4\}$
   - Component Right: $\{N_2, N_3\}$

#### Questions:
1. **Single-Server Membership Change Vulnerability (8 Points)**:
   - Why is transitioning from $\{N_1, N_2, N_3\}$ directly to $\{N_1, N_2, N_4\}$ unsafe if nodes switch their configurations at different times without Joint Consensus? Describe the exact split-brain scenario.
2. **Ongaro Joint Consensus State Machine (9 Points)**:
   - Detail how Raft's **Joint Consensus** ($C_{\text{old,new}}$) guarantees that no two leaders can be elected during the network partition described above. Show the quorum calculations for both components.
3. **Snapshot Streaming and Linearizability (8 Points)**:
   - Node $N_4$ has no prior data for Range 100. How does $N_4$ catch up on millions of keys without stopping client writes on Leader $N_1$, and how does Raft guarantee that log entries applied after the snapshot was generated are not duplicated or lost?

<details><summary>Scoring Rubric & Model Answer</summary>

#### Model Answer:

**1. Single-Server Membership Change Vulnerability (8 Points)**:
- In a naive single-server transition where nodes switch immediately upon receiving the configuration change:
  - If $N_1$ commits the config change and switches to $C_{\text{new}} = \{N_1, N_2, N_4\}$, its majority quorum is any 2 nodes from $\{N_1, N_2, N_4\}$.
  - If $N_3$ has not yet received or processed the message, it remains on $C_{\text{old}} = \{N_1, N_2, N_3\}$, where a majority quorum is any 2 nodes from $\{N_1, N_2, N_3\}$.
  - If $N_1$ is partitioned off with $N_4$, $N_1$ and $N_4$ form a valid majority in $C_{\text{new}}$ ($2/3$) and elect $N_1$.
  - Concurrently, $N_2$ and $N_3$ form a valid majority in $C_{\text{old}}$ ($2/3$) and elect $N_2$.
  - Result: **Two leaders are elected in the same term for the same range**, committing conflicting writes and destroying data consistency (Split-Brain).

**2. Ongaro Joint Consensus State Machine (9 Points)**:
- **Joint Consensus Protocol**: The leader first proposes and commits a joint configuration entry $C_{\text{old,new}} = \{N_1, N_2, N_3\} \ \& \ \{N_1, N_2, N_4\}$.
- In $C_{\text{old,new}}$, any consensus decision (elections, commits) **requires independent majorities from BOTH configurations simultaneously**:
  - A majority of $C_{\text{old}}$ ($\ge 2$ nodes of $\{N_1, N_2, N_3\}$), **AND**
  - A majority of $C_{\text{new}}$ ($\ge 2$ nodes of $\{N_1, N_2, N_4\}$).
- **Partition Analysis**:
  - Component Left has $\{N_1, N_4\}$:
    - $C_{\text{new}}$ check: $N_1, N_4 \in \{N_1, N_2, N_4\} \implies 2/3$ (Majority met!).
    - $C_{\text{old}}$ check: only $N_1 \in \{N_1, N_2, N_3\} \implies 1/3$ (**Majority FAILED!**).
    - Result: Component Left **cannot** elect a leader or commit any entry.
  - Component Right has $\{N_2, N_3\}$:
    - $C_{\text{old}}$ check: $N_2, N_3 \in \{N_1, N_2, N_3\} \implies 2/3$ (Majority met!).
    - $C_{\text{new}}$ check: only $N_2 \in \{N_1, N_2, N_4\} \implies 1/3$ (**Majority FAILED!**).
    - Result: Component Right **cannot** elect a leader or commit any entry.
- **Conclusion**: Split-brain is mathematically impossible. The system safely pauses Range 100 writes until the partition heals, preserving safety.

**3. Snapshot Streaming and Linearizability (8 Points)**:
- **Non-Voting Learner Phase**: Leader $N_1$ adds $N_4$ as a non-voting `Learner` before initiating the membership change. $N_4$ receives log entries and snapshots but does not count toward quorums.
- **Snapshot Transfer**:
  - $N_1$ takes a point-in-time storage snapshot at index $K$ and streams it to $N_4$ via chunks of `InstallSnapshot` RPCs.
  - While the snapshot streams over several minutes, $N_1$ continues accepting and committing client writes in its local Raft log ($K+1, K+2, \dots$).
- **Log Replay & Catch-Up**:
  - Once $N_4$ writes the snapshot to disk, its state machine is at index $K$.
  - $N_1$ immediately begins sending `AppendEntries` starting from index $K+1$.
  - Raft's log matching invariant ensures that entries $K+1 \dots$ are applied in exact order to $N_4$'s state machine.
- Only when $N_4$'s replication lag drops below a small threshold does $N_1$ initiate the Joint Consensus configuration change, eliminating any availability hiccup.

**Scoring Guide**:
- 7-8 pts: Lucid explanation of disjoint quorum overlap failure in naive single-server transitions.
- 8-9 pts: Mathematical proof of dual-majority requirement in Joint Consensus preventing split-brain.
- 7-8 pts: Thorough description of Learner role, InstallSnapshot streaming, and log replay catch-up.
</details>
