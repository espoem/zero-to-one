import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
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

export interface PendingMcpApproval {
  tool: string;
  argsHash: string;
  principalId: string;
  expiresAtMs: number;
}

export interface McpSessionContext {
  principalId: string;
  allowedTools: ReadonlySet<string>;
  seenIds: Set<string>;
  pendingStates: Map<string, PendingMcpApproval>;
  hostApprovedStates: Map<string, string>; // requestState -> verified approver principal
  nowMs?: number;
}

export function hashAction(toolName: string, args: Record<string, unknown>): string {
  const keys = Object.keys(args).sort();
  const canonical: Record<string, unknown> = {};
  for (const k of keys) canonical[k] = args[k];
  return createHash('sha256')
    .update(`${toolName}:${JSON.stringify(canonical)}`)
    .digest('hex');
}

export function dispatchMcpRequest(req: McpToolRequest, ctx: McpSessionContext): McpToolResponse {
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

  if (ctx.seenIds.has(req.id)) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: {
        code: -32600,
        message: 'Duplicate JSON-RPC id: MRTR retries must allocate a new id',
      },
    };
  }
  ctx.seenIds.add(req.id);

  if (!ctx.allowedTools.has(req.params.name)) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: `Forbidden tool invocation: ${req.params.name}` },
    };
  }

  if (req.params.name === 'issue_refund') {
    const argsHash = hashAction(req.params.name, req.params.arguments);
    const now = ctx.nowMs ?? 1_000_000;
    const stateToken = req.params.requestState;

    // Never trust client-supplied inputResponses.approvedBy without a matching host-verified requestState
    if (!stateToken) {
      const nonce = `state_${randomUUID()}`;
      ctx.pendingStates.set(nonce, {
        tool: req.params.name,
        argsHash,
        principalId: ctx.principalId,
        expiresAtMs: now + 300_000,
      });
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          resultType: 'input_required',
          requestState: nonce,
          structuredContent: { prompt: 'HITL supervisor approval required for refund' },
        },
      };
    }

    const pending = ctx.pendingStates.get(stateToken);
    ctx.pendingStates.delete(stateToken); // Single-use token
    const verifiedApprover = ctx.hostApprovedStates.get(stateToken);
    ctx.hostApprovedStates.delete(stateToken);

    if (
      !pending ||
      now > pending.expiresAtMs ||
      pending.tool !== req.params.name ||
      pending.argsHash !== argsHash ||
      pending.principalId !== ctx.principalId ||
      !verifiedApprover
    ) {
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: {
          code: -32602,
          message: 'Invalid, expired, replayed, or argument-mismatched MRTR requestState',
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: req.id,
      result: {
        resultType: 'complete',
        structuredContent: {
          status: 'executed',
          tool: req.params.name,
          approvedBy: verifiedApprover,
        },
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
  | 'TOOL_BUDGET_EXHAUSTED'
  | 'COST_BUDGET_EXHAUSTED'
  | 'DEADLINE_EXCEEDED'
  | 'CYCLE_DETECTED'
  | 'HITL_INTERRUPT'
  | 'PLAN_EXHAUSTED';

export interface AgentStepAction {
  kind: 'tool' | 'finish' | 'hitl_pause';
  toolName?: string;
  args?: Record<string, unknown>;
  stepCostUsd: number;
  durationMs?: number;
  requiresApproval?: boolean;
}

export interface HarnessBudget {
  maxSteps: number;
  maxTools: number;
  maxCostUsd: number;
  maxDurationMs: number;
  cycleThreshold: number;
}

export interface HarnessCheckpoint {
  nextIndex: number;
  stepsExecuted: number;
  toolsCalled: number;
  totalCostUsd: number;
  elapsedMs: number;
  pendingActionHash?: string;
}

export interface HarnessRunResult {
  status: HarnessTerminationReason;
  stepsExecuted: number;
  toolsCalled: number;
  totalCostUsd: number;
  elapsedMs: number;
  checkpoint?: HarnessCheckpoint;
  interruptPayload?: { tool: string; args: Record<string, unknown>; actionHash: string };
}

export function runBoundedAgentLoop(
  budget: HarnessBudget,
  allowedTools: ReadonlySet<string>,
  plannedActions: readonly AgentStepAction[],
  options?: {
    approvedActionHashes?: ReadonlySet<string>;
    checkpoint?: HarnessCheckpoint;
  },
): HarnessRunResult {
  let stepsExecuted = options?.checkpoint?.stepsExecuted ?? 0;
  let toolsCalled = options?.checkpoint?.toolsCalled ?? 0;
  let totalCostUsd = options?.checkpoint?.totalCostUsd ?? 0;
  let elapsedMs = options?.checkpoint?.elapsedMs ?? 0;
  const startIdx = options?.checkpoint?.nextIndex ?? 0;
  const approvedHashes = options?.approvedActionHashes ?? new Set<string>();
  const actionCounts = new Map<string, number>();

  for (let idx = startIdx; idx < plannedActions.length; idx++) {
    const action = plannedActions[idx]!;
    if (stepsExecuted >= budget.maxSteps) {
      return {
        status: 'STEP_BUDGET_EXHAUSTED',
        stepsExecuted,
        toolsCalled,
        totalCostUsd,
        elapsedMs,
      };
    }
    if (totalCostUsd + action.stepCostUsd > budget.maxCostUsd) {
      return {
        status: 'COST_BUDGET_EXHAUSTED',
        stepsExecuted,
        toolsCalled,
        totalCostUsd,
        elapsedMs,
      };
    }
    const stepDuration = action.durationMs ?? 100;
    if (elapsedMs + stepDuration > budget.maxDurationMs) {
      return { status: 'DEADLINE_EXCEEDED', stepsExecuted, toolsCalled, totalCostUsd, elapsedMs };
    }

    const toolName = action.toolName ?? 'unknown';
    const args = action.args ?? {};
    const actionHash = hashAction(toolName, args);

    if (
      action.kind === 'hitl_pause' ||
      (action.requiresApproval && !approvedHashes.has(actionHash))
    ) {
      return {
        status: 'HITL_INTERRUPT',
        stepsExecuted,
        toolsCalled,
        totalCostUsd,
        elapsedMs,
        checkpoint: {
          nextIndex: idx,
          stepsExecuted,
          toolsCalled,
          totalCostUsd,
          elapsedMs,
          pendingActionHash: actionHash,
        },
        interruptPayload: { tool: toolName, args, actionHash },
      };
    }

    stepsExecuted++;
    totalCostUsd += action.stepCostUsd;
    elapsedMs += stepDuration;

    if (action.kind === 'finish') {
      return { status: 'COMPLETED', stepsExecuted, toolsCalled, totalCostUsd, elapsedMs };
    }

    if (action.kind === 'tool') {
      if (toolsCalled >= budget.maxTools) {
        return {
          status: 'TOOL_BUDGET_EXHAUSTED',
          stepsExecuted,
          toolsCalled,
          totalCostUsd,
          elapsedMs,
        };
      }
      if (!allowedTools.has(action.toolName ?? '')) {
        continue; // Blocked by host permission gate (counted as guardrail hit in telemetry)
      }
      const count = (actionCounts.get(actionHash) ?? 0) + 1;
      actionCounts.set(actionHash, count);
      if (count > budget.cycleThreshold) {
        return { status: 'CYCLE_DETECTED', stepsExecuted, toolsCalled, totalCostUsd, elapsedMs };
      }
      toolsCalled++;
    }
  }

  return { status: 'PLAN_EXHAUSTED', stepsExecuted, toolsCalled, totalCostUsd, elapsedMs };
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
  p50TimeToResolveMs: number;
  p90TimeToResolveMs: number;
}

function percentile(sorted: readonly number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
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
  const resolveTimes: number[] = [];

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
    resolveTimes.push(t.resolveMs);
  }
  resolveTimes.sort((a, b) => a - b);

  return {
    taskSuccessRate: successes / n,
    toolAccuracy: totalTools === 0 ? 1 : correctTools / totalTools,
    stepsPerTask: totalSteps / n,
    escalationRate: escalations / n,
    guardrailHitRate: totalActions === 0 ? 0 : guardrailHits / totalActions,
    overrideRate: proposals === 0 ? 0 : overrides / proposals,
    costPerTaskUsd: totalCost / n,
    p50TimeToResolveMs: percentile(resolveTimes, 50),
    p90TimeToResolveMs: percentile(resolveTimes, 90),
  };
}

describe('Bounded Agent Harness, MCP 2026-07-28 MRTR & 8 Operational Metrics', () => {
  it('enforces MCP 2026-07-28 _meta, tool allowlists, MRTR requestState binding, and new id rule', () => {
    const ctx: McpSessionContext = {
      principalId: 'user-42',
      allowedTools: new Set(['lookup_order', 'issue_refund']),
      seenIds: new Set<string>(),
      pendingStates: new Map(),
      hostApprovedStates: new Map(),
      nowMs: 1_000_000,
    };

    // Missing _meta protocolVersion -> -32602
    const badMeta = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-0',
        method: 'tools/call',
        params: { name: 'lookup_order', arguments: { id: 'ORD-1' } },
      },
      ctx,
    );
    assert.equal(badMeta.error?.code, -32602);

    // Negative: client cannot bypass round 1 by sending spoofed inputResponses.approvedBy with no server state
    const spoofedBypass = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-spoof-1',
        method: 'tools/call',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          clientCapabilities: { elicitation: {} },
        },
        params: {
          name: 'issue_refund',
          arguments: { orderId: 'ORD-1', amountCents: 2500 },
          requestState: 'forged-state',
          inputResponses: { approvedBy: 'supervisor-9' },
        },
      },
      ctx,
    );
    assert.equal(spoofedBypass.error?.code, -32602);

    // Step 1 of MRTR: returns input_required + opaque requestState
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
      ctx,
    );
    assert.equal(step1.result?.resultType, 'input_required');
    const state1 = step1.result?.requestState;
    assert.ok(state1);

    // Host supervisor approves state1, then client tries tampering amountCents from 2500 -> 250000
    ctx.hostApprovedStates.set(state1, 'supervisor-9');
    const tamperedArgs = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-tamper',
        method: 'tools/call',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          clientCapabilities: { elicitation: {} },
        },
        params: {
          name: 'issue_refund',
          arguments: { orderId: 'ORD-1', amountCents: 250000 },
          requestState: state1,
          inputResponses: { approved: true },
        },
      },
      ctx,
    );
    assert.equal(tamperedArgs.error?.code, -32602);

    // Re-initiate legitimate MRTR flow, verify reused id fails (-32600), and fresh id succeeds with host approver
    const step1b = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-1b',
        method: 'tools/call',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          clientCapabilities: { elicitation: {} },
        },
        params: { name: 'issue_refund', arguments: { orderId: 'ORD-1', amountCents: 2500 } },
      },
      ctx,
    );
    const state1b = step1b.result?.requestState ?? '';
    ctx.hostApprovedStates.set(state1b, 'supervisor-9');

    const reusedId = dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'req-1b',
        method: 'tools/call',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          clientCapabilities: { elicitation: {} },
        },
        params: {
          name: 'issue_refund',
          arguments: { orderId: 'ORD-1', amountCents: 2500 },
          requestState: state1b,
        },
      },
      ctx,
    );
    assert.equal(reusedId.error?.code, -32600);

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
      ctx,
    );
    assert.equal(forbidden.error?.code, -32601);

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
          requestState: state1b,
          inputResponses: { approvedBy: 'forged-client-claim' }, // ignored in favor of hostApprovedStates
        },
      },
      ctx,
    );
    assert.equal(step2.result?.resultType, 'complete');
    assert.equal(step2.result?.structuredContent?.['approvedBy'], 'supervisor-9');
  });

  it('halts runaway duplicate loops, enforces deadline/tool budgets, and supports checkpointed action-bound HITL resume', () => {
    const budget: HarnessBudget = {
      maxSteps: 10,
      maxTools: 10,
      maxCostUsd: 1.0,
      maxDurationMs: 2000,
      cycleThreshold: 2,
    };
    const allowed = new Set(['fetch_page', 'approve_wire']);

    const infiniteLoop: AgentStepAction[] = Array.from({ length: 8 }, () => ({
      kind: 'tool',
      toolName: 'fetch_page',
      args: { cursor: 'stale-cursor', page: 1 },
      stepCostUsd: 0.02,
      durationMs: 50,
    }));

    const loopResult = runBoundedAgentLoop(budget, allowed, infiniteLoop);
    assert.equal(loopResult.status, 'CYCLE_DETECTED');
    assert.equal(loopResult.stepsExecuted, 3);

    // Wall-clock deadline exceeded check
    const slowPlan: AgentStepAction[] = [
      {
        kind: 'tool',
        toolName: 'fetch_page',
        args: { page: 1 },
        stepCostUsd: 0.01,
        durationMs: 1200,
      },
      {
        kind: 'tool',
        toolName: 'fetch_page',
        args: { page: 2 },
        stepCostUsd: 0.01,
        durationMs: 1000,
      },
    ];
    assert.equal(runBoundedAgentLoop(budget, allowed, slowPlan).status, 'DEADLINE_EXCEEDED');

    // Tool budget exhaustion check
    assert.equal(
      runBoundedAgentLoop({ ...budget, maxTools: 1 }, allowed, [
        { kind: 'tool', toolName: 'fetch_page', args: { p: 1 }, stepCostUsd: 0.01 },
        { kind: 'tool', toolName: 'fetch_page', args: { p: 2 }, stepCostUsd: 0.01 },
      ]).status,
      'TOOL_BUDGET_EXHAUSTED',
    );

    // HITL interrupt before approve_wire, then resume from checkpoint using only the exact approved actionHash
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

    const paused = runBoundedAgentLoop(budget, allowed, hitlPlan);
    assert.equal(paused.status, 'HITL_INTERRUPT');
    assert.equal(paused.interruptPayload?.tool, 'approve_wire');
    assert.equal(paused.checkpoint?.nextIndex, 1);

    // Approving a different actionHash stays blocked at step 1
    const wrongApproval = runBoundedAgentLoop(budget, allowed, hitlPlan, {
      approvedActionHashes: new Set(['wrong-hash']),
      checkpoint: paused.checkpoint,
    });
    assert.equal(wrongApproval.status, 'HITL_INTERRUPT');

    // Exact actionHash resumes from checkpoint (step 1) without re-executing step 0
    const resumed = runBoundedAgentLoop(budget, allowed, hitlPlan, {
      approvedActionHashes: new Set([paused.interruptPayload!.actionHash]),
      checkpoint: paused.checkpoint,
    });
    assert.equal(resumed.status, 'COMPLETED');
    assert.equal(resumed.stepsExecuted, 3);
    assert.equal(resumed.toolsCalled, 2);
  });

  it('computes all 8 agent operational metrics including p50/p90 TTR and preserves rate bounds [0, 1]', () => {
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
    assert.equal(summary.p50TimeToResolveMs, 3200);
    assert.equal(summary.p90TimeToResolveMs, 8800);

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
          assert.ok(m.p90TimeToResolveMs >= m.p50TimeToResolveMs);
        },
      ),
    );
  });
});
