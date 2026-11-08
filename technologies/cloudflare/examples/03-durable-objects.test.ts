import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DurableObjectActor } from './lib/edge-models.ts';

describe('Module 06: Durable Objects Actor Model, SQLite Transactions & Gates', () => {
  it('guarantees atomic transactional commits and rollback on SQLite failure', async () => {
    const actor = new DurableObjectActor('do_room_alpha');

    // Seed initial balance
    await actor.sqlTransaction(async (tx) => {
      tx.put('balance:alice', '100');
      tx.put('balance:bob', '50');
    });

    assert.equal(actor.getStorage('balance:alice'), '100');
    assert.equal(actor.getStorage('balance:bob'), '50');

    // Attempt a transfer that throws mid-transaction
    await assert.rejects(
      async () => {
        await actor.sqlTransaction(async (tx) => {
          tx.put('balance:alice', '70');
          throw new Error('Simulated network/DB constraint failure');
        });
      },
      { message: 'Simulated network/DB constraint failure' },
    );

    // Verify rollback: Alice balance remains 100, not 70!
    assert.equal(actor.getStorage('balance:alice'), '100');
    assert.equal(actor.getStorage('balance:bob'), '50');
  });

  it('manages scheduled alarms lifecycle deterministically', async () => {
    const actor = new DurableObjectActor('do_alarm_test');
    assert.equal(actor.getAlarm(), null);

    const scheduledTime = Date.now() + 10_000;
    actor.setAlarm(scheduledTime);
    assert.equal(actor.getAlarm(), scheduledTime);

    // Alarm should not fire before scheduled time
    let fired = false;
    const ranEarly = await actor.runScheduledAlarm(scheduledTime - 1000, async () => {
      fired = true;
    });
    assert.equal(ranEarly, false);
    assert.equal(fired, false);

    // Alarm fires when current time >= scheduled time
    const ranOnTime = await actor.runScheduledAlarm(scheduledTime + 50, async () => {
      fired = true;
    });
    assert.equal(ranOnTime, true);
    assert.equal(fired, true);
    assert.equal(actor.getAlarm(), null); // Cleared after firing
  });

  it('demonstrates input gate opening and interleaving during external async I/O', async () => {
    const actor = new DurableObjectActor('do_gate_test');

    // Concurrently invoke opA (which does external fetch/await) and opB
    const opA = actor.executeWithGates('opA', async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const opB = actor.executeWithGates('opB');

    await Promise.all([opA, opB]);

    const logs = actor.getCallLog();
    // Verify opB started while opA was active (active=2) because opA awaited external I/O!
    assert(logs.some((l) => l.includes('start:opB:active=2')));
  });
});
