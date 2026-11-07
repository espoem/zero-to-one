// Live Runner & Supply-Chain CLI Integration Suite: Probes local gitlab-ci-local, cosign, and syft
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

interface ToolProbe {
  tool: string;
  installed: boolean;
  version?: string;
}

function probeCliTool(cmd: string, versionArg = '--version'): ToolProbe {
  try {
    const output = execSync(`${cmd} ${versionArg}`, {
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return {
      tool: cmd,
      installed: true,
      version: output.split('\n')[0] ?? output,
    };
  } catch {
    return {
      tool: cmd,
      installed: false,
    };
  }
}

test('live local runner emulator inspection: gitlab-ci-local', async (t) => {
  const probe = probeCliTool('gitlab-ci-local');
  if (!probe.installed) {
    return t.skip(
      'gitlab-ci-local CLI is not installed on host. Run `npm install -g gitlab-ci-local` or use Docker to enable local pipeline execution.',
    );
  }

  assert.ok(probe.version && probe.version.length > 0);
});

test('live supply-chain security tooling inspection: cosign v3 and syft', async (t) => {
  const cosignProbe = probeCliTool('cosign', 'version');
  const syftProbe = probeCliTool('syft', 'version');

  if (!cosignProbe.installed && !syftProbe.installed) {
    return t.skip(
      'Neither cosign nor syft is installed in host PATH. Keyless signing and SBOM generation integration tests skipped.',
    );
  }

  if (cosignProbe.installed) {
    assert.ok(cosignProbe.version && cosignProbe.version.length > 0);
  }

  if (syftProbe.installed) {
    assert.ok(syftProbe.version && syftProbe.version.length > 0);
  }
});
