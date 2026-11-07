// Live Cluster Integration Suite: Probes local Kubernetes CLI and cluster tooling
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

interface ClusterProbe {
  hasKubectl: boolean;
  kubectlVersion?: string;
  hasKind: boolean;
  kindVersion?: string;
  hasKubeconform: boolean;
  clusterReachable: boolean;
  skipReason?: string;
}

function probeClusterEnvironment(): ClusterProbe {
  let hasKubectl = false;
  let kubectlVersion: string | undefined;
  let hasKind = false;
  let kindVersion: string | undefined;
  let hasKubeconform = false;
  let clusterReachable = false;

  // 1. Check kubectl
  try {
    kubectlVersion = execSync('kubectl version --client --output=json', {
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    hasKubectl = true;
  } catch {
    // kubectl unavailable
  }

  // 2. Check cluster reachability if kubectl is present
  if (hasKubectl) {
    try {
      execSync('kubectl cluster-info', {
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      clusterReachable = true;
    } catch {
      // Cluster not running
    }
  }

  // 3. Check kind
  try {
    kindVersion = execSync('kind version', {
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    hasKind = true;
  } catch {
    // kind unavailable
  }

  // 4. Check kubeconform
  try {
    execSync('kubeconform -v', {
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    hasKubeconform = true;
  } catch {
    // kubeconform unavailable
  }

  const skipReason = !clusterReachable
    ? 'No live Kubernetes cluster currently reachable (kubectl cluster-info failed or timed out)'
    : undefined;

  return {
    hasKubectl,
    kubectlVersion,
    hasKind,
    kindVersion,
    hasKubeconform,
    clusterReachable,
    skipReason,
  };
}

test('live Kubernetes cluster reachability and toolchain inspection', async (t) => {
  const probe = probeClusterEnvironment();

  if (!probe.clusterReachable) {
    return t.skip(probe.skipReason ?? 'Kubernetes cluster unavailable');
  }

  assert.ok(probe.hasKubectl, 'Expected kubectl to be available');
  assert.ok(probe.clusterReachable, 'Expected live Kubernetes cluster to be reachable');
});
