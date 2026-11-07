// Module 11: SQLite in WebAssembly, file portability between builds, and WAL shipping (the Litestream idea).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import Database from 'better-sqlite3';
import { open, scalar, tempDir } from './helpers.ts';

const tmp = tempDir();
after(() => tmp.cleanup());
const sqlite3 = await sqlite3InitModule();

describe('the official WebAssembly build', () => {
  test('@sqlite.org/sqlite-wasm 3.54.1-build1 bundles exactly 3.54.1, the newest engine in this track', () => {
    const db = new sqlite3.oo1.DB(':memory:', 'c');
    assert.equal(db.selectValue('SELECT sqlite_version()'), '3.54.1');
    assert.equal(db.selectValue("SELECT date('2026-02-10', 'end of month')"), '2026-02-28');
    db.close();
  });

  test('its build differs: single-threaded, no loadable extensions, 8 KiB default pages, bytecode() vtab', () => {
    const db = new sqlite3.oo1.DB(':memory:', 'c');
    const opts = db.selectValues('PRAGMA compile_options') as string[];
    for (const o of [
      'THREADSAFE=0',
      'OMIT_LOAD_EXTENSION',
      'DEFAULT_PAGE_SIZE=8192',
      'ENABLE_BYTECODE_VTAB',
      'ENABLE_SESSION',
    ]) {
      assert.ok(opts.includes(o), o);
    }
    assert.equal(db.selectValue("SELECT opcode FROM bytecode('SELECT 1') WHERE addr = 0"), 'Init');
    db.close();
  });

  test('negative: the OPFS VFS is not available outside a browser worker', () => {
    assert.equal(sqlite3.capi.sqlite3_vfs_find('opfs'), 0);
  });

  test('the file format is portable: a WASM-built image opens in better-sqlite3', () => {
    const db = new sqlite3.oo1.DB(':memory:', 'c');
    db.exec(
      "CREATE TABLE note(id INTEGER PRIMARY KEY, body TEXT) STRICT; INSERT INTO note(body) VALUES ('from the browser')",
    );
    const image = sqlite3.capi.sqlite3_js_db_export(db);
    db.close();
    const path = tmp.file('from-wasm.db');
    writeFileSync(path, image);
    const native = open(path);
    assert.equal(scalar(native, 'SELECT body FROM note'), 'from the browser');
    assert.equal(scalar(native, 'PRAGMA page_size'), 8192, 'the page size travels with the file');
    assert.equal(new Database(path).pragma('integrity_check', { simple: true }), 'ok');
  });
});

describe('WAL shipping: a snapshot plus later WAL content reproduces the primary', () => {
  test('a replica built from a checkpointed snapshot and a copied -wal file sees later commits', () => {
    const primaryPath = tmp.file('primary.db');
    const primary = open(primaryPath);
    primary.pragma('journal_mode = WAL');
    primary.pragma('wal_autocheckpoint = 0'); // the shipper, not SQLite, decides when to checkpoint
    primary.exec(
      "CREATE TABLE ev(id INTEGER PRIMARY KEY, msg TEXT); INSERT INTO ev(msg) VALUES ('before snapshot')",
    );
    // 1. Snapshot: checkpoint everything into the main file, then copy it while the WAL is empty.
    primary.pragma('wal_checkpoint(TRUNCATE)');
    const replicaPath = tmp.file('replica.db');
    copyFileSync(primaryPath, replicaPath);
    // 2. New commits land only in the primary's WAL.
    primary.exec("INSERT INTO ev(msg) VALUES ('after snapshot 1'), ('after snapshot 2')");
    // 3. Ship the WAL (Litestream ships it continuously, in segments, to object storage).
    copyFileSync(`${primaryPath}-wal`, `${replicaPath}-wal`);
    const replica = open(replicaPath);
    assert.deepEqual(replica.prepare('SELECT msg FROM ev ORDER BY id').pluck().all(), [
      'before snapshot',
      'after snapshot 1',
      'after snapshot 2',
    ]);
    assert.equal(replica.pragma('integrity_check', { simple: true }), 'ok');
  });

  test('negative: a torn WAL copy is cut at the last valid commit frame, not corrupted', () => {
    const primaryPath = tmp.file('p2.db');
    const primary = open(primaryPath);
    primary.pragma('journal_mode = WAL');
    primary.pragma('wal_autocheckpoint = 0');
    primary.exec('CREATE TABLE ev(id INTEGER PRIMARY KEY, msg TEXT)');
    primary.pragma('wal_checkpoint(TRUNCATE)');
    const replicaPath = tmp.file('r2.db');
    copyFileSync(primaryPath, replicaPath);
    primary.exec("INSERT INTO ev(msg) VALUES ('tx1')");
    primary.exec("INSERT INTO ev(msg) VALUES ('tx2')");
    const wal = readFileSync(`${primaryPath}-wal`);
    // Ship everything except the last 100 bytes: the final frame is incomplete.
    writeFileSync(`${replicaPath}-wal`, wal.subarray(0, wal.length - 100));
    const replica = open(replicaPath);
    assert.deepEqual(replica.prepare('SELECT msg FROM ev').pluck().all(), ['tx1']);
    assert.equal(replica.pragma('integrity_check', { simple: true }), 'ok');
  });
});
