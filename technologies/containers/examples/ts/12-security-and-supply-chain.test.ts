// Module 12: Container Security and Supply Chain: Capabilities, Seccomp, Rootless, Image Hardening, and Version History
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { auditContainerSecurity, type ContainerSecurityProfile } from './lib/containers-model.ts';

test('gotcha: mounting /var/run/docker.sock inside container gives root control over host', () => {
  const insecureProfile: ContainerSecurityProfile = {
    capDrop: [],
    capAdd: [],
    noNewPrivileges: false,
    readOnlyRootfs: false,
    mountedVolumes: [
      { hostPath: '/var/run/docker.sock', containerPath: '/var/run/docker.sock', readOnly: false },
    ],
    seccompProfile: 'default',
  };

  const findings = auditContainerSecurity(insecureProfile);
  const socketFinding = findings.find((f) => f.title === 'Docker Socket Mount Escalation');

  assert.ok(socketFinding !== undefined);
  assert.equal(socketFinding?.severity, 'CRITICAL');
  assert.ok(
    socketFinding?.description.includes('root-equivalent control over the host Docker daemon'),
  );
});

test('hardened container security baseline: dropped caps, no-new-privileges, and read-only rootfs', () => {
  const hardenedProfile: ContainerSecurityProfile = {
    capDrop: ['ALL'],
    capAdd: ['NET_BIND_SERVICE'],
    noNewPrivileges: true,
    readOnlyRootfs: true,
    mountedVolumes: [{ hostPath: '/tmp/scratch', containerPath: '/tmp', readOnly: false }],
    seccompProfile: 'default',
  };

  const findings = auditContainerSecurity(hardenedProfile);

  // No CRITICAL or HIGH findings
  const criticalOrHigh = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  assert.equal(criticalOrHigh.length, 0);
  assert.equal(hardenedProfile.noNewPrivileges, true);
  assert.equal(hardenedProfile.readOnlyRootfs, true);
});

test('gotcha: CAP_SYS_ADMIN and seccomp unconfined break isolation boundaries', () => {
  const privilegedProfile: ContainerSecurityProfile = {
    capDrop: [],
    capAdd: ['CAP_SYS_ADMIN'],
    noNewPrivileges: false,
    readOnlyRootfs: false,
    mountedVolumes: [],
    seccompProfile: 'unconfined',
  };

  const findings = auditContainerSecurity(privilegedProfile);

  const capFinding = findings.find((f) => f.title === 'CAP_SYS_ADMIN Granted');
  assert.ok(capFinding !== undefined);
  assert.equal(capFinding?.severity, 'CRITICAL');

  const seccompFinding = findings.find((f) => f.title === 'Seccomp Unconfined');
  assert.ok(seccompFinding !== undefined);
  assert.equal(seccompFinding?.severity, 'HIGH');
});

test('property-based test: any profile mounting docker socket triggers CRITICAL finding', () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.constantFrom('default', 'unconfined', 'custom-strict') as fc.Arbitrary<
        'default' | 'unconfined' | 'custom-strict'
      >,
      (noNewPrivs, readOnly, seccomp) => {
        const profile: ContainerSecurityProfile = {
          capDrop: ['ALL'],
          capAdd: [],
          noNewPrivileges: noNewPrivs,
          readOnlyRootfs: readOnly,
          mountedVolumes: [
            {
              hostPath: '/var/run/docker.sock',
              containerPath: '/var/run/docker.sock',
              readOnly: false,
            },
          ],
          seccompProfile: seccomp,
        };

        const findings = auditContainerSecurity(profile);
        assert.ok(
          findings.some(
            (f) => f.title === 'Docker Socket Mount Escalation' && f.severity === 'CRITICAL',
          ),
        );
      },
    ),
  );
});
