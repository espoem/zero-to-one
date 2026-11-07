// Live Runtime Integration Suite: Probes local container engine (Docker or Podman)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

interface RuntimeProbe {
  engine: 'docker' | 'podman' | 'none';
  version?: string;
  cgroupVersion?: string;
  skipReason?: string;
}

function probeEngine(): RuntimeProbe {
  // 1. Try Docker daemon
  try {
    const versionOutput = execSync('docker version --format "{{.Server.Version}}"', {
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    let cgroupVersion = 'unknown';
    try {
      cgroupVersion = execSync('docker info --format "{{.CgroupVersion}}"', {
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      // Ignored
    }

    return {
      engine: 'docker',
      version: versionOutput,
      cgroupVersion,
    };
  } catch {
    // Docker unavailable or daemon not running
  }

  // 2. Try Podman
  try {
    const podmanVer = execSync('podman version --format "{{.Server.Version}}"', {
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    let podmanCgroups = 'unknown';
    try {
      podmanCgroups = execSync('podman info --format "{{.Host.CgroupsVersion}}"', {
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      // Ignored
    }

    return {
      engine: 'podman',
      version: podmanVer,
      cgroupVersion: podmanCgroups,
    };
  } catch {
    // Podman unavailable
  }

  return {
    engine: 'none',
    skipReason: 'Neither Docker nor Podman container daemon/machine is currently reachable',
  };
}

test('live container engine runtime inspection and cgroup hierarchy', async (t) => {
  const probe = probeEngine();

  if (probe.engine === 'none') {
    return t.skip(probe.skipReason ?? 'Container runtime unavailable');
  }

  assert.ok(probe.engine === 'docker' || probe.engine === 'podman');
  assert.ok(probe.version && probe.version.length > 0, `Expected valid ${probe.engine} version`);

  // Verify that if cgroups are reported, unified v2 is preferred
  if (probe.cgroupVersion && probe.cgroupVersion !== 'unknown') {
    assert.ok(
      probe.cgroupVersion === '2' || probe.cgroupVersion === 'v2',
      `Modern container runtimes should report cgroup v2 (found: ${probe.cgroupVersion})`,
    );
  }
});
