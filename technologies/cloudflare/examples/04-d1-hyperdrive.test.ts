import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { D1DatabaseWithSessions } from './lib/edge-models.ts';

describe('Module 07: D1 SQL, Replicas & Sessions API Consistency', () => {
  it('prevents stale reads by falling back to primary when replica lags behind bookmark', () => {
    const db = new D1DatabaseWithSessions();
    const edgeReplica = db.createReplica();

    // Write a new record to primary
    const { bookmark, record } = db.write('tenant_42', 'active_plan_enterprise');

    // Without bookmark, reading from lagging replica yields undefined
    const readWithoutBookmark = db.sessionRead(edgeReplica, 'tenant_42');
    assert.equal(readWithoutBookmark.source, 'replica');
    assert.equal(readWithoutBookmark.record, undefined);

    // With bookmark (Sessions API), client passes token from write response
    const readWithBookmark = db.sessionRead(edgeReplica, 'tenant_42', bookmark);
    assert.equal(readWithBookmark.source, 'primary'); // Routed to primary!
    assert.equal(readWithBookmark.record?.data, 'active_plan_enterprise');

    // When replica catches up and syncs to version
    edgeReplica.syncFromPrimary([record], record.version);

    // Reading with bookmark now safely executes on replica!
    const readAfterSync = db.sessionRead(edgeReplica, 'tenant_42', bookmark);
    assert.equal(readAfterSync.source, 'replica');
    assert.equal(readAfterSync.record?.data, 'active_plan_enterprise');
  });
});
