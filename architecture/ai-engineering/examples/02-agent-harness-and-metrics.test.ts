import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fc from 'fast-check';

export interface McpMeta {
  'io.modelcontextprotocol/protocolVersion'?: string;
  clientInfo?: { name: string; version: string };
  clientCapabilities?: Record<string, unknown>;
  traceparent?: string;
}

export interface McpToolRequest {
  jsonrpc: '2.0';
  id: string;
  method: 'tools/call';
  _meta?: McpMeta;
  params: {
    name: string;
    arguments: Record<string, unknown>;
    requestState?: string;
    inputResponses?: Record<string, unknown>;
  };
}

export interface McpToolResponse {
  jsonrpc: '2.0';
  id: string;
  result?: {
    resultType: 'complete' | 'input_required';
    requestState?: string;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
}

export function dispatchMcpRequest(
  req: McpToolRequest,
  allowedTools: ReadonlySet<string>,
  seenIds: Set<string>,
): McpToolResponse {
  // Stateless MCP 2026-07-28 required _meta validation
  if (!req._meta?.['io.modelcontextprotocol/protocolVersion'] || !req._meta?.clientCapabilities) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: {
        code: -32602,
        message: 'Missing required _meta protocolVersion or clientCapabilities',
      },
    };
  }

  if (seenIds.has(req.id)) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: {
        code: -32600,
        message: 'Duplicate JSON-RPC id: MRTR retries must allocate a new id',
      },
    };
  }
  seenIds.add(req.id);

  if (!allowedTools.has(req.params.name)) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: `Forbidden tool invocation: ${req.params.name}` },
    };
  }

  if (req.params.name === 'issue_refund' && !req.params.inputResponses?.['approvedBy']) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: {
        resultType: 'input_required',
        requestState: 'state-refund-42',
        structuredContent: { prompt: 'HITL supervisor approval required for refund' },
      },
    };
  }

  return {
    jsonrpc: '2.0',
    id: req.id,
    result: {
      resultType: 'complete',
      structuredContent: { status: 'executed', tool: req.params.name },
    },
  };
}

export type HarnessTerminationReason =
  | 'COMPLETED'
  | 'STEP_BUDGET_EXHAUSTED'
  | 'COST_BUDGET_EXHAUSTED'
  | 'CYCLE_DETECTED'
  | 'HITL_INTERRUPT';

export interface AgentStepAction {
  kind: 'tool' | 'finish' | 'hitl_pause';
  toolName?: string;
  args?: Record<string, unknown>;
  stepCostUsd: number;
  requiresApproval?: boolean;
}

export interface HarnessBudget {
  maxSteps: number;
  maxTools: number;
  maxCostUsd: number;
  cycleThreshold: number;
}

export interface HarnessRunResult {
  status: HarnessTerminationReason;
  stepsExecuted: number;
  toolsCalled: number;
  totalCostUsd: number;
  interruptPayload?: Record<string, unknown>;
}

function hashAction(toolName: string, args: Record<string, unknown>): string {
  const keys = Object.keys(args).sort();
  const canonical: Record<string, unknown> = {};
  for (const k of keys) canonical[k] = args[k];
  return createHash('sha256')
    .update(`${toolName}:${JSON.stringify(canonical)}`)
    .digest('hex');
}

export function runBoundedAgentLoop(
  budget: HarnessBudget,
  allowedTools: ReadonlySet<string>,
  plannedActions: readonly AgentStepAction[],
  hitlApproved = false,
): HarnessRunResult {
  let stepsExecuted = 0;
  let toolsCalled = 0;
  let totalCostUsd = 0;
  const actionCounts = new Map<string, number>();

  for (const action of plannedActions) {
    if (stepsExecuted >= budget.maxSteps) {
      return { status: 'STEP_BUDGET_EXHAUSTED', stepsExecuted, toolsCalled, totalCostUsd };
    }
    if (totalCostUsd + action.stepCostUsd > budget.maxCostUsd) {
      return { status: 'COST_BUDGET_EXHAUSTED', stepsExecuted, toolsCalled, totalCostUsd };
    }

    stepsExecuted++;
    totalCostUsd += action.stepCostUsd;

    if (action.kind === 'finish') {
      return { status: 'COMPLETED', stepsExecuted, toolsCalled, totalCostUsd };
    }

    if (action.kind === 'hitl_pause' || (action.requiresApproval && !hitlApproved)) {
      return {
        status: 'HITL_INTERRUPT',
        stepsExecuted,
        toolsCalled,
        totalCostUsd,
        interruptPayload: { tool: action.toolName ?? 'unknown', args: action.args ?? {} },
      };
    }

    if (action.kind === 'tool') {
      if (toolsCalled >= budget.maxTools) {
        return { status: 'STEP_BUDGET_EXHAUSTED', stepsExecuted, toolsCalled, totalCostUsd };
      }
      const toolName = action.toolName ?? '';
      const args = action.args ?? {};
      if (!allowedTools.has(toolName)) {
        continue; // Blocked by host permission gate (counted as guardrail hit in telemetry)
      }
      const sig = hashAction(toolName, args);
      const count = (actionCounts.get(sig) ?? 0) + 1;
      actionCounts.set(sig, count);
      if (count > budget.cycleThreshold) {
        return { status: 'CYCLE_DETECTED', stepsExecuted, toolsCalled, totalCostUsd };
      }
      toolsCalled++;
    }
  }

  return { status: 'STEP_BUDGET_EXHAUSTED', stepsExecuted, toolsCalled, totalCostUsd };
}

export interface AgentTaskTrace {
  succeeded: boolean;
  correctToolCalls: number;
  totalToolCalls: number;
  steps: number;
  escalatedToHuman: boolean;
  guardrailHits: number;
  totalActions: number;
  humanOverrides: number;
  agentProposals: number;
  inputTokens: number;
  outputTokens: number;
  toolCallCostUsd: number;
  resolveMs: number;
}

export interface AgentMetricsSummary {
  taskSuccessRate: number;
  toolAccuracy: number;
  stepsPerTask: number;
  escalationRate: number;
  guardrailHitRate: number;
  overrideRate: number;
  costPerTaskUsd: number;
  meanTimeToResolveMs: number;
}

export function computeAgentMetrics(
  traces: readonly AgentTaskTrace[],
  pricePerInputToken: number,
  pricePerOutputToken: number,
): AgentMetricsSummary {
  const n = traces.length;
  assert.ok(n > 0, 'At least one trace is required');

  let successes = 0;
  let correctTools = 0;
  let totalTools = 0;
  let totalSteps = 0;
  let escalations = 0;
  let guardrailHits = 0;
  let totalActions = 0;
  let overrides = 0;
  let proposals = 0;
  let totalCost = 0;
  let totalMs = 0;

  for (const t of traces) {
    if (t.succeeded) successes++;
    correctTools += t.correctToolCalls;
    totalTools += t.totalToolCalls;
    totalSteps += t.steps;
    if (t.escalatedToHuman) escalations++;
    guardrailHits += t.guardrailHits;
    totalActions += t.totalActions;
    overrides += t.humanOverrides;
    proposals += t.agentProposals;
    totalCost +=
      t.inputTokens * pricePerInputToken + t.outputTokens * pricePerOutputToken + t.toolCallCostUsd;
    totalMs += t.resolveMs;
  }

  return {
    taskSuccessRate: successes / n,
    toolAccuracy: totalTools === 0 ? 1 : correctTools / totalTools,
    stepsPerTask: totalSteps / n,
    escalationRate: escalations / n,
    guardrailHitRate: totalActions === 0 ? 0 : guardrailHits / totalActions,
    overrideRate: proposals === 0 ? 0 : overrides / proposals,
    costPerTaskUsd: totalCost / n,
    meanTimeToResolveMs: totalMs / n,
  };
}

describe('Bounded Agent Harness, MCP 2026-07-28 MRTR & 8 Operational Metrics', () => {
  it('enforces MCP 2026-07-28 _meta, tool allowlists, and MRTR new JSON-RPC id requirement', () => {
    const allowed = new Set(['lookup_order', 'issue_refund']);
    const seenIds = new Set<string>();

    // Missing _meta protocolVersion -> -32602
    const badMeta = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-0',
        method: 'tools/call',
        params: { name: 'lookup_order', arguments: { id: 'ORD-1' } },
      },
      allowed,
      seenIds,
    );
    assert.equal(badMeta.error?.code, -32602);

    // Step 1 of MRTR: returns input_required + requestState
    const step1 = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'tools/call',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          clientCapabilities: { elicitation: {} },
        },
        params: { name: 'issue_refund', arguments: { orderId: 'ORD-1', amountCents: 2500 } },
      },
      allowed,
      seenIds,
    );
    assert.equal(step1.result?.resultType, 'input_required');
    assert.equal(step1.result?.requestState, 'state-refund-42');

    // Reusing req-1 violates MRTR new-id rule
    const reusedId = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'tools/call',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          clientCapabilities: { elicitation: {} },
        },
        params: {
          name: 'issue_refund',
          arguments: { orderId: 'ORD-1', amountCents: 2500 },
          requestState: 'state-refund-42',
          inputResponses: { approvedBy: 'supervisor-9' },
        },
      },
      allowed,
      seenIds,
    );
    assert.equal(reusedId.error?.code, -32600);

    // Disallowed tool invocation must fail closed with JSON-RPC error -32601 (never -32021 MissingRequiredClientCapability)
    const forbidden = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-forbidden',
        method: 'tools/call',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          clientCapabilities: { elicitation: {} },
        },
        params: { name: 'drop_database', arguments: {} },
      },
      allowed,
      seenIds,
    );
    assert.equal(forbidden.error?.code, -32601);

    // Fresh id req-2 succeeds
    const step2 = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-2',
        method: 'tools/call',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          clientCapabilities: { elicitation: {} },
        },
        params: {
          name: 'issue_refund',
          arguments: { orderId: 'ORD-1', amountCents: 2500 },
          requestState: 'state-refund-42',
          inputResponses: { approvedBy: 'supervisor-9' },
        },
      },
      allowed,
      seenIds,
    );
    assert.equal(step2.result?.resultType, 'complete');
  });

  it('halts runaway duplicate tool loops via SHA-256 cycle detection and supports HITL resume', () => {
    const budget: HarnessBudget = {
      maxSteps: 10,
      maxTools: 10,
      maxCostUsd: 1.0,
      cycleThreshold: 2,
    };
    const allowed = new Set(['fetch_page', 'approve_wire']);

    const infiniteLoop: AgentStepAction[] = Array.from({ length: 8 }, () => ({
      kind: 'tool',
      toolName: 'fetch_page',
      args: { cursor: 'stale-cursor', page: 1 },
      stepCostUsd: 0.02,
    }));

    const loopResult = runBoundedAgentLoop(budget, allowed, infiniteLoop);
    assert.equal(loopResult.status, 'CYCLE_DETECTED');
    assert.equal(loopResult.stepsExecuted, 3);

    // HITL interrupt before high-risk action, then resume with hitlApproved = true
    const hitlPlan: AgentStepAction[] = [
      { kind: 'tool', toolName: 'fetch_page', args: { id: 'claim-9' }, stepCostUsd: 0.01 },
      {
        kind: 'tool',
        toolName: 'approve_wire',
        args: { amountCents: 50000 },
        stepCostUsd: 0.01,
        requiresApproval: true,
      },
      { kind: 'finish', stepCostUsd: 0.01 },
    ];

    const paused = runBoundedAgentLoop(budget, allowed, hitlPlan, false);
    assert.equal(paused.status, 'HITL_INTERRUPT');
    assert.equal(paused.interruptPayload?.['tool'], 'approve_wire');

    const resumed = runBoundedAgentLoop(budget, allowed, hitlPlan, true);
    assert.equal(resumed.status, 'COMPLETED');
  });

  it('computes all 8 agent operational metrics accurately and preserves rate bounds [0, 1]', () => {
    const traces: AgentTaskTrace[] = [
      {
        succeeded: true,
        correctToolCalls: 3,
        totalToolCalls: 3,
        steps: 4,
        escalatedToHuman: false,
        guardrailHits: 0,
        totalActions: 4,
        humanOverrides: 0,
        agentProposals: 1,
        inputTokens: 4000,
        outputTokens: 500,
        toolCallCostUsd: 0.01,
        resolveMs: 3200,
      },
      {
        succeeded: false,
        correctToolCalls: 1,
        totalToolCalls: 2,
        steps: 6,
        escalatedToHuman: true,
        guardrailHits: 1,
        totalActions: 6,
        humanOverrides: 1,
        agentProposals: 1,
        inputTokens: 6000,
        outputTokens: 1500,
        toolCallCostUsd: 0.03,
        resolveMs: 8800,
      },
    ];

    const summary = computeAgentMetrics(traces, 0.000002, 0.00001);
    assert.equal(summary.taskSuccessRate, 0.5);
    assert.equal(summary.toolAccuracy, 0.8);
    assert.equal(summary.stepsPerTask, 5);
    assert.equal(summary.escalationRate, 0.5);
    assert.equal(summary.guardrailHitRate, 0.1);
    assert.equal(summary.overrideRate, 0.5);
    assert.ok(Math.abs(summary.costPerTaskUsd - 0.04) < 1e-9);
    assert.equal(summary.meanTimeToResolveMs, 6000);

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            succeeded: fc.boolean(),
            correctToolCalls: fc.nat({ max: 10 }),
            totalToolCalls: fc.nat({ max: 10 }),
            steps: fc.integer({ min: 1, max: 20 }),
            escalatedToHuman: fc.boolean(),
            guardrailHits: fc.nat({ max: 5 }),
            totalActions: fc.integer({ min: 1, max: 20 }),
            humanOverrides: fc.nat({ max: 5 }),
            agentProposals: fc.integer({ min: 1, max: 10 }),
            inputTokens: fc.nat({ max: 10000 }),
            outputTokens: fc.nat({ max: 5000 }),
            toolCallCostUsd: fc.double({ min: 0, max: 1, noNaN: true }),
            resolveMs: fc.integer({ min: 50, max: 30000 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (randTraces) => {
          const normalized = randTraces.map((t) => ({
            ...t,
            correctToolCalls: Math.min(t.correctToolCalls, t.totalToolCalls),
            guardrailHits: Math.min(t.guardrailHits, t.totalActions),
            humanOverrides: Math.min(t.humanOverrides, t.agentProposals),
          }));
          const m = computeAgentMetrics(normalized, 0.000001, 0.000005);
          assert.ok(m.taskSuccessRate >= 0 && m.taskSuccessRate <= 1);
          assert.ok(m.toolAccuracy >= 0 && m.toolAccuracy <= 1);
          assert.ok(m.escalationRate >= 0 && m.escalationRate <= 1);
          assert.ok(m.guardrailHitRate >= 0 && m.guardrailHitRate <= 1);
          assert.ok(m.overrideRate >= 0 && m.overrideRate <= 1);
          assert.ok(m.costPerTaskUsd >= 0);
        },
      ),
    );
  });
});
