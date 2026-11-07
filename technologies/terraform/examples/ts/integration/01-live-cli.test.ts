// Module Integration: Live Terraform / OpenTofu CLI verification
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function findIaCCli(): 'terraform' | 'tofu' | null {
  try {
    execSync('terraform version', { stdio: 'ignore' });
    return 'terraform';
  } catch {
    // Check tofu fallback
  }

  try {
    execSync('tofu version', { stdio: 'ignore' });
    return 'tofu';
  } catch {
    return null;
  }
}

test('live CLI init, validate, and test in temporary workspace', (t) => {
  const cli = findIaCCli();
  if (!cli) {
    t.skip('Neither terraform nor tofu CLI is installed on this host; skipping live CLI test');
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-live-test-'));

  try {
    // 1. Write minimal hermetic configuration
    const mainTf = `
terraform {
  required_version = ">= 1.0.0"
}

variable "environment" {
  type    = string
  default = "test-env"
}

output "selected_environment" {
  value = var.environment
}
`;
    fs.writeFileSync(path.join(tmpDir, 'main.tf'), mainTf, 'utf-8');

    // 2. Write hermetic .tftest.hcl test file
    const testHcl = `
run "validate_environment_output" {
  command = plan
  assert {
    condition     = output.selected_environment == "test-env"
    error_message = "Output did not match default environment value"
  }
}
`;
    fs.writeFileSync(path.join(tmpDir, 'main.tftest.hcl'), testHcl, 'utf-8');

    // 3. Execute init with backend disabled
    const initOutput = execSync(`${cli} init -backend=false`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    assert.ok(
      initOutput.includes('successfully initialized') ||
        initOutput.includes('OpenTofu has been successfully initialized'),
    );

    // 4. Execute validate
    const validateOutput = execSync(`${cli} validate`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    assert.ok(
      validateOutput.includes('Success!') || validateOutput.includes('The configuration is valid'),
    );

    // 5. Execute test
    const testOutput = execSync(`${cli} test`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    assert.ok(testOutput.includes('pass') || testOutput.includes('PASS'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
