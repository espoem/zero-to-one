import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AuroraStorageCluster } from './lib/aws-models.ts';

describe('Aurora 6-Way Quorum Storage Engine', () => {
  test('Write Quorum: Succeeds on 4/6 ACKs, fails when < 4 nodes are online', () => {
    const cluster = new AuroraStorageCluster();

    // Normal operation: all 6 nodes online
    const write1 = cluster.writeRedoLog({
      lsn: 101,
      transactionId: 'tx-001',
      data: "INSERT INTO users VALUES (1, 'Alice');",
    });

    assert.equal(write1.success, true);
    assert.equal(write1.acks, 6);
    assert.equal(write1.failedNodes.length, 0);

    // Take 2 nodes offline (e.g. AZ1 offline: node 0 and node 1)
    // 4 nodes remain online -> write quorum 4/6 MUST succeed
    cluster.setNodeStatus(0, false);
    cluster.setNodeStatus(1, false);

    const write2 = cluster.writeRedoLog({
      lsn: 102,
      transactionId: 'tx-002',
      data: 'UPDATE users SET balance = 500 WHERE id = 1;',
    });

    assert.equal(write2.success, true);
    assert.equal(write2.acks, 4);
    assert.deepEqual(write2.failedNodes, [0, 1]);

    // Take 1 more node offline (node 2 in AZ2) -> only 3 nodes remain online
    // Write quorum 4/6 FAILS
    cluster.setNodeStatus(2, false);

    const write3 = cluster.writeRedoLog({
      lsn: 103,
      transactionId: 'tx-003',
      data: 'UPDATE users SET balance = 600 WHERE id = 1;',
    });

    assert.equal(write3.success, false);
    assert.equal(write3.acks, 3);
    assert.equal(write3.failedNodes.length, 3);
  });

  test('Read Quorum: 3/6 nodes reconstitute valid state from highest LSN', () => {
    const cluster = new AuroraStorageCluster();

    // Node 0, 1, 2, 3 receive write at LSN 201
    // Node 4 and 5 were offline during write
    cluster.setNodeStatus(4, false);
    cluster.setNodeStatus(5, false);

    const writeRes = cluster.writeRedoLog({
      lsn: 201,
      transactionId: 'tx-201',
      data: 'COMMIT ORDER #999',
    });
    assert.equal(writeRes.success, true);
    assert.equal(writeRes.acks, 4);

    // Now bring back nodes 4 and 5 (which have stale LSN < 201)
    // Take nodes 0, 1, 2 offline (simulating AZ1 outage + 1 transient node)
    // Remaining online nodes are: 3 (has LSN 201), 4 (stale), 5 (stale)
    cluster.setNodeStatus(0, false);
    cluster.setNodeStatus(1, false);
    cluster.setNodeStatus(2, false);
    cluster.setNodeStatus(4, true);
    cluster.setNodeStatus(5, true);

    // Read with 3 responding nodes (nodes 3, 4, 5) satisfies 3/6 read quorum
    const readRes = cluster.readRecord(201);
    assert.equal(readRes.success, true);
    assert.equal(readRes.data, 'COMMIT ORDER #999');
    assert.equal(readRes.reconstructedFromLsn, 201);
  });

  test('Peer Gossip Repair: Recovers missing LSN segments on lagging nodes', () => {
    const cluster = new AuroraStorageCluster();

    // Write LSN 301 and 302 while node 5 is offline
    cluster.setNodeStatus(5, false);

    cluster.writeRedoLog({ lsn: 301, transactionId: 'tx-301', data: 'PAGE_INIT' });
    cluster.writeRedoLog({ lsn: 302, transactionId: 'tx-302', data: 'PAGE_UPDATE' });

    // Verify node 5 is missing these records
    const node5 = cluster.getNode(5);
    assert.ok(node5);
    assert.equal(node5.records.has(301), false);
    assert.equal(node5.records.has(302), false);

    // Bring node 5 back online
    cluster.setNodeStatus(5, true);

    // Run background peer gossip protocol
    const repairResult = cluster.peerGossipRepair();
    assert.equal(repairResult.repairedNodes, 1);
    assert.deepEqual(repairResult.details[0]?.recoveredLsns, [301, 302]);

    // Verify node 5 is now fully synchronized
    assert.equal(node5.records.has(301), true);
    assert.equal(node5.records.has(302), true);
    assert.equal(node5.maxLsn, 302);
  });
});
