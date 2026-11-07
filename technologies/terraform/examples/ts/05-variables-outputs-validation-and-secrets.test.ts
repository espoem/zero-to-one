// Module 05: Variables, Outputs, Custom Conditions, Ephemeral Values, and Write-Only Secrets
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateVariable,
  ValidationError,
  ConditionAssertionError,
  renderPlanOutput,
  filterStateAttributes,
  type VariableDefinition,
} from './lib/terraform-model.ts';

test('variable custom validation rules and error formatting', () => {
  const envVarDef: VariableDefinition = {
    name: 'environment',
    type: 'string',
    validations: [
      {
        condition: (val) => ['dev', 'staging', 'prod'].includes(val as string),
        errorMessage: 'Environment must be one of: dev, staging, prod.',
      },
    ],
  };

  // Valid value
  const valid = evaluateVariable(envVarDef, 'prod');
  assert.equal(valid.value, 'prod');

  // Negative test: Invalid value triggers ValidationError with custom error message
  assert.throws(
    () => evaluateVariable(envVarDef, 'sandbox'),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /Environment must be one of: dev, staging, prod/);
      return true;
    },
  );
});

test('preconditions, postconditions, and non-blocking check blocks', () => {
  const runCondition = (
    type: 'precondition' | 'postcondition' | 'check',
    passed: boolean,
    errorMsg: string,
  ) => {
    if (!passed) {
      if (type === 'check') {
        return { warning: `WARNING: Check block assertion failed: ${errorMsg}` };
      }
      throw new ConditionAssertionError(type, errorMsg);
    }
    return { ok: true };
  };

  // Precondition failure halts execution before resource action
  assert.throws(
    () => runCondition('precondition', false, 'AMI must be from trusted account 123456789012'),
    (err: unknown) => {
      assert.ok(err instanceof ConditionAssertionError);
      assert.equal(err.conditionType, 'precondition');
      return true;
    },
  );

  // Postcondition failure halts execution after reading/applying resource
  assert.throws(
    () => runCondition('postcondition', false, 'Allocated storage must be encrypted with KMS'),
    (err: unknown) => {
      assert.ok(err instanceof ConditionAssertionError);
      assert.equal(err.conditionType, 'postcondition');
      return true;
    },
  );

  // Check block is non-blocking (advisory warning only)
  const checkOutcome = runCondition('check', false, 'Certificate expires in less than 30 days');
  assert.ok('warning' in checkOutcome && typeof checkOutcome.warning === 'string');
  assert.match(checkOutcome.warning, /Certificate expires in less than 30 days/);
});

test('production gotcha: sensitive = true redacts console output but writes plaintext to state', () => {
  const secretPassword = 'UltraSecretProductionPassword!2026';

  // 1. In plan/CLI rendering, sensitive values are masked:
  const cliOutput = renderPlanOutput(secretPassword, true, false);
  assert.equal(cliOutput, '(sensitive value)');
  assert.equal(cliOutput.includes(secretPassword), false);

  // 2. In .tfstate JSON persistence:
  const rawAttrs = {
    id: 'db-prod',
    admin_username: 'postgres',
    admin_password: secretPassword,
  };
  const schema = {
    id: { sensitive: false },
    admin_username: { sensitive: false },
    admin_password: { sensitive: true },
  };

  const { stateAttributes } = filterStateAttributes(rawAttrs, schema);

  // CRITICAL GOTCHA: The sensitive password is saved IN PLAINTEXT inside the state file!
  assert.equal(stateAttributes['admin_password'], secretPassword);
});

test('ephemeral values and write-only arguments are omitted from state entirely', () => {
  const ephemeralOAuthToken = 'ghp_oauth_ephemeral_token_xyz';
  const writeOnlyMasterKey = 'wo_master_key_987654';

  const rawAttrs = {
    id: 'vault-secret-1',
    endpoint: 'https://vault.internal:8200',
    auth_token: ephemeralOAuthToken,
    master_key_wo: writeOnlyMasterKey,
  };

  const schema = {
    id: {},
    endpoint: {},
    auth_token: { ephemeral: true },
    master_key_wo: { writeOnly: true },
  };

  const { stateAttributes, omittedAttributes } = filterStateAttributes(rawAttrs, schema);

  // Ephemeral and write-only fields are NOT in stateAttributes
  assert.equal(stateAttributes['auth_token'], undefined);
  assert.equal(stateAttributes['master_key_wo'], undefined);
  assert.deepEqual(omittedAttributes.sort(), ['auth_token', 'master_key_wo']);

  // Only non-ephemeral data survives into state
  assert.deepEqual(stateAttributes, {
    id: 'vault-secret-1',
    endpoint: 'https://vault.internal:8200',
  });
});
