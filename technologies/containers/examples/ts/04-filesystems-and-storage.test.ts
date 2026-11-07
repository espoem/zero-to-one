// Module 04: Filesystems and Storage: OverlayFS, Snapshotters, Volumes, and Idmapped Mounts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { OverlayFsResolver, type OverlayFileEntry } from './lib/containers-model.ts';

test('overlayfs layer resolution: upperdir overrides lowerdirs in top-to-bottom order', () => {
  const baseLayer = new Map<string, OverlayFileEntry>([
    ['/etc/os-release', { path: '/etc/os-release', content: 'NAME="Debian"', sizeBytes: 14 }],
    ['/app/config.json', { path: '/app/config.json', content: '{"env":"prod"}', sizeBytes: 14 }],
  ]);

  const middleLayer = new Map<string, OverlayFileEntry>([
    ['/app/config.json', { path: '/app/config.json', content: '{"env":"staging"}', sizeBytes: 17 }],
    ['/app/server.js', { path: '/app/server.js', content: 'console.log("hi")', sizeBytes: 17 }],
  ]);

  const upperdir = new Map<string, OverlayFileEntry>([
    ['/app/config.json', { path: '/app/config.json', content: '{"env":"dev"}', sizeBytes: 13 }],
  ]);

  const overlay = new OverlayFsResolver([middleLayer, baseLayer], upperdir);

  // Upperdir takes absolute precedence
  assert.equal(overlay.getMergedFile('/app/config.json')?.content, '{"env":"dev"}');
  // Middle layer overrides base layer
  assert.equal(overlay.getMergedFile('/app/server.js')?.content, 'console.log("hi")');
  // Base layer preserved if untouched
  assert.equal(overlay.getMergedFile('/etc/os-release')?.content, 'NAME="Debian"');
  // Non-existent path returns null
  assert.equal(overlay.getMergedFile('/var/missing.txt'), null);
});

test('gotcha: overlayfs copy-up amplification copies entire lower file on first write', () => {
  // Scenario: A lower layer contains a 2 GB database file.
  const largeFileSize = 2 * 1024 * 1024 * 1024; // 2 GB
  const lowerLayer = new Map<string, OverlayFileEntry>([
    [
      '/var/lib/data.db',
      { path: '/var/lib/data.db', content: 'DATA_CHUNK', sizeBytes: largeFileSize },
    ],
  ]);
  const upperdir = new Map<string, OverlayFileEntry>();
  const overlay = new OverlayFsResolver([lowerLayer], upperdir);

  // App writes a single updated byte / small append to /var/lib/data.db in the container
  const writeRes = overlay.modifyFile('/var/lib/data.db', 'DATA_CHUNK_UPDATED');

  assert.equal(writeRes.copyUpTriggered, true, 'First write must trigger copy-up from lower layer');
  assert.equal(
    writeRes.copiedBytes,
    largeFileSize,
    'Entire 2 GB file was copied up to upperdir, causing I/O pause and disk space duplication!',
  );

  // Subsequent writes to the already copied-up file in upperdir do NOT trigger copy-up
  const secondWrite = overlay.modifyFile('/var/lib/data.db', 'DATA_CHUNK_UPDATED_AGAIN');
  assert.equal(secondWrite.copyUpTriggered, false);
  assert.equal(secondWrite.copiedBytes, 0);
});

test('gotcha: deleting files in later layers creates whiteout without shrinking lower layer', () => {
  const secretFileSize = 10 * 1024 * 1024; // 10 MB accidental secret / tarball
  const layer1 = new Map<string, OverlayFileEntry>([
    [
      '/root/.ssh/id_rsa',
      { path: '/root/.ssh/id_rsa', content: 'PRIVATE_KEY', sizeBytes: secretFileSize },
    ],
  ]);
  const upperdir = new Map<string, OverlayFileEntry>();
  const overlay = new OverlayFsResolver([layer1], upperdir);

  // RUN rm -f /root/.ssh/id_rsa in a subsequent Dockerfile instruction
  const deleteRes = overlay.deleteFile('/root/.ssh/id_rsa');

  assert.equal(
    deleteRes.whiteoutCreated,
    true,
    'Whiteout marker character device created in upperdir',
  );
  assert.equal(
    deleteRes.lowerShrunk,
    false,
    'Underlying lower layer storage is NOT shrunk by deletion',
  );

  // Merged view hides the file
  assert.equal(
    overlay.getMergedFile('/root/.ssh/id_rsa'),
    null,
    'File appears deleted in unified view',
  );

  // BUT lower layer still physically holds the 10 MB secret!
  const secretInLower = layer1.get('/root/.ssh/id_rsa');
  assert.ok(secretInLower !== undefined);
  assert.equal(secretInLower?.sizeBytes, secretFileSize);
  assert.equal(
    secretInLower?.content,
    'PRIVATE_KEY',
    'Sensitive data remains completely retrievable in image history',
  );
});

test('property-based test: overlayfs merged view always matches uppermost layer state', () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1, maxLength: 20 }), fc.string(), (filename, content) => {
      const lower = new Map<string, OverlayFileEntry>([
        [filename, { path: filename, content: 'initial', sizeBytes: 7 }],
      ]);
      const upper = new Map<string, OverlayFileEntry>([
        [filename, { path: filename, content, sizeBytes: Buffer.byteLength(content) }],
      ]);
      const overlay = new OverlayFsResolver([lower], upper);

      assert.equal(overlay.getMergedFile(filename)?.content, content);
    }),
  );
});
