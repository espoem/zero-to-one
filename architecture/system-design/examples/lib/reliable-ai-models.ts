import { createHash } from 'node:crypto';

/**
 * Executable models for Module 25: Reliable AI Systems — Validator Sandwich,
 * Semantic Caching Guards, Calibrated HITL Routing, Bounded Agent Loops,
 * and Multi-Provider Circuit Breakers.
 *
 * Covers:
 *  1. Token/cost accounting, workload economics, and calibration metrics (ECE, Brier score)
 *  2. ValidatorSandwichPipeline: top-bun input guardrails (token cap, PII redaction,
 *     prompt-injection screening + structural isolation), constrained structured-output
 *     parsing with finish-reason inspection and bounded retry-with-error-feedback,
 *     and mandatory bottom-bun output guardrails (range, business invariants, grounded citations)
 *  3. SemanticCacheGuard: tenant-isolated exact + cosine-similarity semantic cache with
 *     mandatory negation polarity, numeric/entity slot equivalence, provenance versioning,
 *     and read-path validation (plus an explicit naive cosine-only mode for counterexample tests)
 *  4. ProviderCircuitBreakerRouter + BoundedAgentExecutor: outcome-aware per-provider
 *     circuit breakers with bounded half-open probes, degradation fallback ladder,
 *     max steps / max tool calls / max USD spend / wall-clock ceilings, cycle detection,
 *     and tool-boundary authorization (OWASP LLM06 / LLM10)
 *  5. ConfidenceHitlRouter + DualDimensionRateLimiter: calibrated four-way uncertainty
 *     routing (AUTO_APPROVE, ESCALATE_MODEL, HITL_QUEUE, FAIL_CLOSED) with SLA/cost tracking
 *     and atomic RPM + TPM + USD/tenant admission control
 */

// ---------------------------------------------------------------------------
// 1. Quantitative Token Economics & Calibration Metrics
// ---------------------------------------------------------------------------

export interface TokenCostInput {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  inputPricePerMillionUsd: number;
  cachedInputPricePerMillionUsd: number;
  outputPricePerMillionUsd: number;
}

/**
 * Computes exact per-request LLM inference cost in USD, accounting for
 * provider prompt-prefix cache discounts and reasoning tokens billed at output rates.
 */
export function estimateAiRequestCostUsd(params: TokenCostInput): number {
  const reasoningTokens = params.reasoningTokens ?? 0;
  if (
    params.inputTokens < 0 ||
    params.cachedInputTokens < 0 ||
    params.outputTokens < 0 ||
    reasoningTokens < 0
  ) {
    throw new RangeError('Token counts must be non-negative');
  }
  if (params.cachedInputTokens > params.inputTokens) {
    throw new RangeError('cachedInputTokens cannot exceed inputTokens');
  }

  const uncachedInput = params.inputTokens - params.cachedInputTokens;
  const uncachedInputCost = (uncachedInput / 1_000_000) * params.inputPricePerMillionUsd;
  const cachedInputCost =
    (params.cachedInputTokens / 1_000_000) * params.cachedInputPricePerMillionUsd;
  const outputCost =
    ((params.outputTokens + reasoningTokens) / 1_000_000) * params.outputPricePerMillionUsd;

  return Number((uncachedInputCost + cachedInputCost + outputCost).toFixed(8));
}

export interface WorkloadEconomicsInput {
  dailyRequests: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  retryMultiplier: number;
  cacheHitRate: number;
  inputPricePerMillionUsd: number;
  outputPricePerMillionUsd: number;
  cacheLookupCostUsd?: number;
}

export interface WorkloadEconomicsResult {
  uncachedDailyTokens: number;
  gatedDailyTokens: number;
  uncachedDailyCostUsd: number;
  gatedDailyCostUsd: number;
  savingsRatio: number;
}

export function estimateWorkloadEconomics(params: WorkloadEconomicsInput): WorkloadEconomicsResult {
  if (params.cacheHitRate < 0 || params.cacheHitRate > 1) {
    throw new RangeError('cacheHitRate must be in [0, 1]');
  }
  if (params.retryMultiplier < 1) {
    throw new RangeError('retryMultiplier must be >= 1');
  }

  const singleCallCost = estimateAiRequestCostUsd({
    inputTokens: params.avgInputTokens,
    cachedInputTokens: 0,
    outputTokens: params.avgOutputTokens,
    inputPricePerMillionUsd: params.inputPricePerMillionUsd,
    cachedInputPricePerMillionUsd: 0,
    outputPricePerMillionUsd: params.outputPricePerMillionUsd,
  });

  const lookupCost = params.cacheLookupCostUsd ?? 0.00001;
  const uncachedDailyCostUsd = params.dailyRequests * params.retryMultiplier * singleCallCost;
  const missRequests = params.dailyRequests * (1 - params.cacheHitRate);
  const gatedDailyCostUsd = missRequests * singleCallCost + params.dailyRequests * lookupCost;
  const tokensPerCall = params.avgInputTokens + params.avgOutputTokens;
  const uncachedDailyTokens = Math.round(
    params.dailyRequests * params.retryMultiplier * tokensPerCall,
  );
  const gatedDailyTokens = Math.round(missRequests * tokensPerCall);
  const savingsRatio = uncachedDailyCostUsd > 0 ? 1 - gatedDailyCostUsd / uncachedDailyCostUsd : 0;

  return {
    uncachedDailyTokens,
    gatedDailyTokens,
    uncachedDailyCostUsd: Number(uncachedDailyCostUsd.toFixed(4)),
    gatedDailyCostUsd: Number(gatedDailyCostUsd.toFixed(4)),
    savingsRatio: Number(savingsRatio.toFixed(4)),
  };
}

export interface CalibrationObservation {
  confidence: number;
  correct: boolean;
}

/**
 * Expected Calibration Error (ECE) over equal-width confidence bins in [0, 1].
 * Lower is better; 0.0 represents perfect calibration.
 */
export function computeExpectedCalibrationError(
  observations: readonly CalibrationObservation[],
  numBins = 10,
): number {
  if (observations.length === 0) return 0;
  if (numBins <= 0) throw new RangeError('numBins must be positive');

  const binSums = new Array<number>(numBins).fill(0);
  const binCorrect = new Array<number>(numBins).fill(0);
  const binCounts = new Array<number>(numBins).fill(0);

  for (const obs of observations) {
    const clamped = Math.max(0, Math.min(1, obs.confidence));
    const idx = Math.min(numBins - 1, Math.floor(clamped * numBins));
    binSums[idx] = (binSums[idx] ?? 0) + clamped;
    binCorrect[idx] = (binCorrect[idx] ?? 0) + (obs.correct ? 1 : 0);
    binCounts[idx] = (binCounts[idx] ?? 0) + 1;
  }

  let ece = 0;
  for (let i = 0; i < numBins; i++) {
    const count = binCounts[i] ?? 0;
    if (count === 0) continue;
    const avgConf = (binSums[i] ?? 0) / count;
    const avgAcc = (binCorrect[i] ?? 0) / count;
    ece += (count / observations.length) * Math.abs(avgAcc - avgConf);
  }
  return Number(ece.toFixed(6));
}

/**
 * Brier score: mean squared error between predicted probability and binary outcome.
 */
export function computeBrierScore(observations: readonly CalibrationObservation[]): number {
  if (observations.length === 0) return 0;
  let sumSq = 0;
  for (const obs of observations) {
    const clamped = Math.max(0, Math.min(1, obs.confidence));
    const y = obs.correct ? 1 : 0;
    const diff = clamped - y;
    sumSq += diff * diff;
  }
  return Number((sumSq / observations.length).toFixed(6));
}

// ---------------------------------------------------------------------------
// 2. Validator Sandwich Pipeline (Input Guard -> Structured LLM -> Output Guard)
// ---------------------------------------------------------------------------

export type RefundDecisionAction = 'approve_refund' | 'deny_refund' | 'escalate';

export interface SupportClaimInput {
  requestId: string;
  /** Must originate from verified session auth, never from the user prompt body. */
  authenticatedTenantId: string;
  userPrompt: string;
  orderTotalCents: number;
  /** Authoritative document/policy IDs retrieved for grounding verification. */
  sourceContextIds: readonly string[];
}

export interface RefundDecisionPayload {
  action: RefundDecisionAction;
  refundAmountCents: number;
  citationIds: readonly string[];
  reasoning: string;
}

export type FinishReason = 'stop' | 'length' | 'content_filter' | 'refusal';

export interface ModelRawResponse {
  finishReason: FinishReason;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
}

export interface ValidatorSandwichConfig {
  maxInputTokens: number;
  maxRetries: number;
  systemPromptSecretMarker?: string;
}

export interface SandwichTelemetry {
  requestId: string;
  tenantId: string;
  attempts: number;
  redactedPiiCount: number;
  estimatedInputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  finishReasons: readonly FinishReason[];
  modelId: string;
}

export type ValidatorSandwichResult =
  | {
      ok: true;
      degraded: false;
      disposition: 'VALIDATED';
      decision: RefundDecisionPayload;
      sanitizedPrompt: string;
      telemetry: SandwichTelemetry;
    }
  | {
      ok: false;
      degraded: true;
      disposition: 'REJECTED_INPUT' | 'FAIL_CLOSED_ESCALATE';
      reason: string;
      telemetry: SandwichTelemetry;
    };

export type ModelInvocationFn = (args: {
  isolatedPrompt: string;
  attempt: number;
  validationFeedback?: string;
}) => ModelRawResponse;

const ALLOWED_ACTIONS = new Set<RefundDecisionAction>([
  'approve_refund',
  'deny_refund',
  'escalate',
]);

const ALLOWED_DECISION_KEYS = new Set<string>([
  'action',
  'refundAmountCents',
  'citationIds',
  'reasoning',
]);

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(the\s+)?system\s+prompt/i,
  /<\|(system|im_start|im_end)\|>/i,
  /###\s*system\b/i,
  /override\s+policy\s+and\s+approve/i,
  /reveal\s+(your\s+)?system\s+prompt/i,
];

const PII_PATTERNS: readonly { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
  { pattern: /\b(?:\d[ -]*?){16}\b/g, replacement: '[REDACTED_PAN]' },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
];

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return Math.ceil(trimmed.length / 4);
}

export class ValidatorSandwichPipeline {
  private readonly config: ValidatorSandwichConfig;

  constructor(config: ValidatorSandwichConfig) {
    if (config.maxInputTokens <= 0) {
      throw new RangeError('maxInputTokens must be positive');
    }
    if (config.maxRetries < 0) {
      throw new RangeError('maxRetries must be non-negative');
    }
    this.config = config;
  }

  /**
   * Top Bun: deterministic input validation, token-budget enforcement,
   * PII redaction, prompt-injection screening, and delimiter isolation.
   */
  public validateAndSanitizeInput(input: SupportClaimInput):
    | {
        ok: true;
        sanitizedPrompt: string;
        isolatedPrompt: string;
        redactedPiiCount: number;
        estimatedTokens: number;
      }
    | { ok: false; reason: string; redactedPiiCount: number; estimatedTokens: number } {
    if (!input.authenticatedTenantId.trim()) {
      return {
        ok: false,
        reason: 'MISSING_AUTHENTICATED_TENANT',
        redactedPiiCount: 0,
        estimatedTokens: 0,
      };
    }
    if (!Number.isInteger(input.orderTotalCents) || input.orderTotalCents < 0) {
      return { ok: false, reason: 'INVALID_ORDER_TOTAL', redactedPiiCount: 0, estimatedTokens: 0 };
    }
    const rawPrompt = input.userPrompt.trim();
    if (rawPrompt.length < 5) {
      return { ok: false, reason: 'INPUT_TOO_SHORT', redactedPiiCount: 0, estimatedTokens: 0 };
    }

    const estimatedTokens = estimateTokenCount(rawPrompt);
    if (estimatedTokens > this.config.maxInputTokens) {
      return {
        ok: false,
        reason: 'INPUT_TOKEN_CAP_EXCEEDED',
        redactedPiiCount: 0,
        estimatedTokens,
      };
    }

    // Screen for direct / delimiter prompt injection before incurring LLM spend
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(rawPrompt)) {
        return {
          ok: false,
          reason: 'PROMPT_INJECTION_DETECTED',
          redactedPiiCount: 0,
          estimatedTokens,
        };
      }
    }

    // Deterministic PII redaction so sensitive tokens never leave trust boundary
    let sanitized = rawPrompt;
    let redactedPiiCount = 0;
    for (const { pattern, replacement } of PII_PATTERNS) {
      const matches = sanitized.match(pattern);
      if (matches) {
        redactedPiiCount += matches.length;
        sanitized = sanitized.replace(pattern, replacement);
      }
    }

    // Escape closing delimiter tags to enforce instruction-vs-data separation
    const escaped = sanitized.replace(/<\/?untrusted_user_data>/gi, '[ESCAPED_TAG]');
    const isolatedPrompt = [
      'Evaluate the claim strictly using authorized source IDs:',
      `ALLOWED_CITATIONS: ${input.sourceContextIds.join(', ')}`,
      `MAX_REFUND_CENTS: ${input.orderTotalCents}`,
      '<untrusted_user_data>',
      escaped,
      '</untrusted_user_data>',
    ].join('\n');

    return {
      ok: true,
      sanitizedPrompt: sanitized,
      isolatedPrompt,
      redactedPiiCount,
      estimatedTokens,
    };
  }

  /**
   * Bottom Bun: mandatory structural, numeric, grounding, and policy validation.
   * Must be executed on EVERY egress path (fresh model outputs, cached reads, and repairs).
   */
  public validateEgress(
    candidate: unknown,
    input: SupportClaimInput,
  ): { ok: true; decision: RefundDecisionPayload } | { ok: false; reason: string } {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      return { ok: false, reason: 'SCHEMA_NOT_OBJECT' };
    }

    const record = candidate as Record<string, unknown>;

    // Enforce strict additionalProperties: false
    for (const key of Object.keys(record)) {
      if (!ALLOWED_DECISION_KEYS.has(key)) {
        return { ok: false, reason: `SCHEMA_UNEXPECTED_PROPERTY:${key}` };
      }
    }

    const action = record['action'];
    const refundAmountCents = record['refundAmountCents'];
    const citationIds = record['citationIds'];
    const reasoning = record['reasoning'];

    if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action as RefundDecisionAction)) {
      return { ok: false, reason: 'SCHEMA_INVALID_ACTION' };
    }
    if (
      typeof refundAmountCents !== 'number' ||
      !Number.isInteger(refundAmountCents) ||
      refundAmountCents < 0
    ) {
      return { ok: false, reason: 'SCHEMA_INVALID_REFUND_AMOUNT' };
    }
    if (
      !Array.isArray(citationIds) ||
      !citationIds.every((id) => typeof id === 'string' && id.trim().length > 0)
    ) {
      return { ok: false, reason: 'SCHEMA_INVALID_CITATIONS' };
    }
    if (typeof reasoning !== 'string' || reasoning.trim().length < 5) {
      return { ok: false, reason: 'SCHEMA_INVALID_REASONING' };
    }

    // Domain Business Invariant 1: Refund cannot exceed order total (CFG cannot enforce dynamic ceilings)
    if (refundAmountCents > input.orderTotalCents) {
      return { ok: false, reason: 'POLICY_REFUND_EXCEEDS_ORDER_TOTAL' };
    }

    // Domain Business Invariant 2: Denied or escalated claims cannot emit a positive payout
    if (action !== 'approve_refund' && refundAmountCents !== 0) {
      return { ok: false, reason: 'POLICY_NON_APPROVAL_WITH_PAYOUT' };
    }

    // Domain Business Invariant 3: Grounding check — every citation MUST exist in retrieved context
    const allowedCitations = new Set(input.sourceContextIds);
    if (action !== 'escalate' && citationIds.length === 0) {
      return { ok: false, reason: 'UNGROUNDED_MISSING_CITATION' };
    }
    for (const id of citationIds) {
      if (!allowedCitations.has(id)) {
        return { ok: false, reason: `UNGROUNDED_CITATION:${id}` };
      }
    }

    // Policy / Leakage Check: no unredacted PII or secret system markers in output reasoning
    if (
      this.config.systemPromptSecretMarker &&
      reasoning.includes(this.config.systemPromptSecretMarker)
    ) {
      return { ok: false, reason: 'POLICY_SYSTEM_PROMPT_LEAKAGE' };
    }
    for (const { pattern } of PII_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(reasoning)) {
        return { ok: false, reason: 'POLICY_PII_LEAK_IN_OUTPUT' };
      }
    }

    return {
      ok: true,
      decision: {
        action: action as RefundDecisionAction,
        refundAmountCents,
        citationIds: [...citationIds],
        reasoning: reasoning.trim(),
      },
    };
  }

  public execute(
    input: SupportClaimInput,
    invokeModel: ModelInvocationFn,
  ): ValidatorSandwichResult {
    const topBun = this.validateAndSanitizeInput(input);
    const baseTelemetry: SandwichTelemetry = {
      requestId: input.requestId,
      tenantId: input.authenticatedTenantId,
      attempts: 0,
      redactedPiiCount: topBun.redactedPiiCount,
      estimatedInputTokens: topBun.estimatedTokens,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      finishReasons: [],
      modelId: 'none',
    };

    if (!topBun.ok) {
      return {
        ok: false,
        degraded: true,
        disposition: 'REJECTED_INPUT',
        reason: topBun.reason,
        telemetry: baseTelemetry,
      };
    }

    const finishReasons: FinishReason[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let lastModelId = 'unknown';
    let lastFailureReason = 'UNKNOWN_FAILURE';
    let feedback: string | undefined;

    const maxAttempts = 1 + this.config.maxRetries;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = invokeModel({
        isolatedPrompt: topBun.isolatedPrompt,
        attempt,
        validationFeedback: feedback,
      });

      totalInputTokens += response.inputTokens;
      totalOutputTokens += response.outputTokens;
      finishReasons.push(response.finishReason);
      lastModelId = response.modelId;

      // Critical: inspect terminal finish_reason BEFORE attempting JSON.parse
      if (response.finishReason !== 'stop') {
        lastFailureReason = `MODEL_NON_STOP_FINISH_REASON:${response.finishReason}`;
        if (response.finishReason === 'refusal' || response.finishReason === 'content_filter') {
          // Do not burn retries on safety refusals; fail closed immediately
          return {
            ok: false,
            degraded: true,
            disposition: 'FAIL_CLOSED_ESCALATE',
            reason: lastFailureReason,
            telemetry: {
              ...baseTelemetry,
              attempts: attempt,
              totalInputTokens,
              totalOutputTokens,
              finishReasons,
              modelId: lastModelId,
            },
          };
        }
        feedback = `Previous response terminated with ${response.finishReason}. Return concise valid JSON.`;
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.rawText);
      } catch {
        lastFailureReason = 'INVALID_JSON_SYNTAX';
        feedback = 'Output was not valid JSON. Emit strict JSON matching the schema.';
        continue;
      }

      const bottomBun = this.validateEgress(parsed, input);
      if (bottomBun.ok) {
        return {
          ok: true,
          degraded: false,
          disposition: 'VALIDATED',
          decision: bottomBun.decision,
          sanitizedPrompt: topBun.sanitizedPrompt,
          telemetry: {
            ...baseTelemetry,
            attempts: attempt,
            totalInputTokens,
            totalOutputTokens,
            finishReasons,
            modelId: lastModelId,
          },
        };
      }

      lastFailureReason = bottomBun.reason;
      feedback = `Output failed deterministic guardrail (${bottomBun.reason}). Correct the violation.`;
    }

    return {
      ok: false,
      degraded: true,
      disposition: 'FAIL_CLOSED_ESCALATE',
      reason: lastFailureReason,
      telemetry: {
        ...baseTelemetry,
        attempts: maxAttempts,
        totalInputTokens,
        totalOutputTokens,
        finishReasons,
        modelId: lastModelId,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// 3. Semantic Cache Guard (Tenant-Isolated + Negation/Slot-Equivalence Guard)
// ---------------------------------------------------------------------------

export interface SemanticSlots {
  negationCount: number;
  hasNegation: boolean;
  numericTokens: readonly string[];
  unitAndCurrencyTokens: readonly string[];
}

export interface CacheProvenance {
  tenantId: string;
  promptVersion: string;
  modelId: string;
  schemaHash: string;
  locale: string;
}

export interface SemanticCacheLookupRequest {
  queryText: string;
  embedding: readonly number[];
  provenance: CacheProvenance;
}

export interface SemanticCacheEntry<T> {
  exactKey: string;
  queryText: string;
  embedding: readonly number[];
  slots: SemanticSlots;
  provenance: CacheProvenance;
  value: T;
  createdAtMs: number;
  expiresAtMs: number;
  poisoned: boolean;
}

export interface SemanticCacheLookupResult<T> {
  hit: boolean;
  matchType: 'EXACT' | 'SEMANTIC' | 'MISS';
  similarity: number;
  value?: T;
  rejectedReason?: string;
}

export interface SemanticCacheConfig<T> {
  similarityThreshold: number;
  defaultTtlMs: number;
  nowMs?: () => number;
  /** Mandatory read-path guardrail (Bottom Bun on cache reads). */
  validateOnRead?: (value: T) => boolean;
}

const NEGATION_REGEX =
  /\b(not|no|never|dont|don't|do\s+not|cannot|can't|wont|won't|without|keep|retain|avoid|stop\s+canceling)\b/gi;
const NUMBER_OR_ID_REGEX = /\b(?:ord|acct|inv|tx)?[-_#]?\d+(?:\.\d+)?\b/gi;
const UNIT_CURRENCY_REGEX =
  /\b(usd|eur|gbp|jpy|km|kilometers?|miles?|mi|kg|lbs?|celsius|fahrenheit|last\s+month|last\s+year|today|yesterday)\b/gi;

export function extractSemanticSlots(queryText: string): SemanticSlots {
  const lower = queryText.toLowerCase();
  const negations = lower.match(NEGATION_REGEX) ?? [];
  const numerics = (lower.match(NUMBER_OR_ID_REGEX) ?? []).map((t) => t.trim()).sort();
  const units = (lower.match(UNIT_CURRENCY_REGEX) ?? []).map((t) => t.trim()).sort();

  return {
    negationCount: negations.length,
    hasNegation: negations.length > 0,
    numericTokens: numerics,
    unitAndCurrencyTokens: units,
  };
}

export function areSemanticSlotsEquivalent(a: SemanticSlots, b: SemanticSlots): boolean {
  if (a.hasNegation !== b.hasNegation || a.negationCount !== b.negationCount) {
    return false;
  }
  if (a.numericTokens.length !== b.numericTokens.length) {
    return false;
  }
  for (let i = 0; i < a.numericTokens.length; i++) {
    if (a.numericTokens[i] !== b.numericTokens[i]) return false;
  }
  if (a.unitAndCurrencyTokens.length !== b.unitAndCurrencyTokens.length) {
    return false;
  }
  for (let i = 0; i < a.unitAndCurrencyTokens.length; i++) {
    if (a.unitAndCurrencyTokens[i] !== b.unitAndCurrencyTokens[i]) return false;
  }
  return true;
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    throw new RangeError('Embeddings must be non-empty and have identical dimensions');
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function computeExactCacheKey(queryText: string, provenance: CacheProvenance): string {
  const normalizedQuery = queryText.trim().toLowerCase().replace(/\s+/g, ' ');
  const payload = JSON.stringify({
    t: provenance.tenantId,
    p: provenance.promptVersion,
    m: provenance.modelId,
    s: provenance.schemaHash,
    l: provenance.locale,
    q: normalizedQuery,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export class SemanticCacheGuard<T> {
  private readonly similarityThreshold: number;
  private readonly defaultTtlMs: number;
  private readonly nowMs: () => number;
  private readonly validateOnRead?: (value: T) => boolean;
  private readonly exactIndex = new Map<string, SemanticCacheEntry<T>>();
  private readonly entries: SemanticCacheEntry<T>[] = [];

  constructor(config: SemanticCacheConfig<T>) {
    if (config.similarityThreshold < -1 || config.similarityThreshold > 1) {
      throw new RangeError('similarityThreshold must be in [-1, 1]');
    }
    this.similarityThreshold = config.similarityThreshold;
    this.defaultTtlMs = config.defaultTtlMs;
    this.nowMs = config.nowMs ?? (() => 0);
    this.validateOnRead = config.validateOnRead;
  }

  public put(
    req: SemanticCacheLookupRequest,
    value: T,
    ttlMs = this.defaultTtlMs,
  ): SemanticCacheEntry<T> {
    const now = this.nowMs();
    const exactKey = computeExactCacheKey(req.queryText, req.provenance);
    const entry: SemanticCacheEntry<T> = {
      exactKey,
      queryText: req.queryText,
      embedding: [...req.embedding],
      slots: extractSemanticSlots(req.queryText),
      provenance: { ...req.provenance },
      value,
      createdAtMs: now,
      expiresAtMs: now + ttlMs,
      poisoned: false,
    };
    this.exactIndex.set(exactKey, entry);
    const existingIdx = this.entries.findIndex((e) => e.exactKey === exactKey);
    if (existingIdx >= 0) {
      this.entries[existingIdx] = entry;
    } else {
      this.entries.push(entry);
    }
    return entry;
  }

  public revokeByProvenance(filter: Partial<CacheProvenance>): number {
    let revoked = 0;
    for (const entry of this.entries) {
      const matches =
        (filter.tenantId === undefined || entry.provenance.tenantId === filter.tenantId) &&
        (filter.promptVersion === undefined ||
          entry.provenance.promptVersion === filter.promptVersion) &&
        (filter.modelId === undefined || entry.provenance.modelId === filter.modelId) &&
        (filter.schemaHash === undefined || entry.provenance.schemaHash === filter.schemaHash) &&
        (filter.locale === undefined || entry.provenance.locale === filter.locale);
      if (matches && !entry.poisoned) {
        entry.poisoned = true;
        revoked++;
      }
    }
    return revoked;
  }

  public lookup(
    req: SemanticCacheLookupRequest,
    options?: { unsafeNaiveCosineOnly?: boolean },
  ): SemanticCacheLookupResult<T> {
    const now = this.nowMs();

    // Counterexample mode: demonstrates the classic Semantic Cache False-Hit / Cross-Tenant Poisoning bug
    if (options?.unsafeNaiveCosineOnly) {
      let bestEntry: SemanticCacheEntry<T> | undefined;
      let bestSim = -1;
      for (const entry of this.entries) {
        if (now >= entry.expiresAtMs) continue;
        const sim = cosineSimilarity(req.embedding, entry.embedding);
        if (sim >= this.similarityThreshold && sim > bestSim) {
          bestSim = sim;
          bestEntry = entry;
        }
      }
      if (bestEntry) {
        return {
          hit: true,
          matchType: 'SEMANTIC',
          similarity: Number(bestSim.toFixed(6)),
          value: bestEntry.value,
        };
      }
      return { hit: false, matchType: 'MISS', similarity: 0 };
    }

    // 1. Exact cache lookup (scoped by full provenance tuple)
    const exactKey = computeExactCacheKey(req.queryText, req.provenance);
    const exactEntry = this.exactIndex.get(exactKey);
    if (exactEntry && now < exactEntry.expiresAtMs && !exactEntry.poisoned) {
      if (this.validateOnRead && !this.validateOnRead(exactEntry.value)) {
        return {
          hit: false,
          matchType: 'MISS',
          similarity: 1,
          rejectedReason: 'READ_GUARDRAIL_FAILED',
        };
      }
      return {
        hit: true,
        matchType: 'EXACT',
        similarity: 1,
        value: exactEntry.value,
      };
    }

    // 2. Guarded semantic lookup: conjunctive predicate across provenance + similarity + slot equivalence + read validation
    const reqSlots = extractSemanticSlots(req.queryText);
    let bestEntry: SemanticCacheEntry<T> | undefined;
    let bestSim = -1;
    let nearestRejectedReason: string | undefined;
    let nearestRejectedSim = -1;

    for (const entry of this.entries) {
      if (now >= entry.expiresAtMs || entry.poisoned) continue;

      const sim = cosineSimilarity(req.embedding, entry.embedding);
      if (sim < this.similarityThreshold) continue;

      if (entry.provenance.tenantId !== req.provenance.tenantId) {
        if (sim > nearestRejectedSim) {
          nearestRejectedSim = sim;
          nearestRejectedReason = 'CROSS_TENANT_ISOLATION_REJECTED';
        }
        continue;
      }

      if (
        entry.provenance.promptVersion !== req.provenance.promptVersion ||
        entry.provenance.modelId !== req.provenance.modelId ||
        entry.provenance.schemaHash !== req.provenance.schemaHash ||
        entry.provenance.locale !== req.provenance.locale
      ) {
        if (sim > nearestRejectedSim) {
          nearestRejectedSim = sim;
          nearestRejectedReason = 'PROVENANCE_MISMATCH_REJECTED';
        }
        continue;
      }

      if (!areSemanticSlotsEquivalent(reqSlots, entry.slots)) {
        if (sim > nearestRejectedSim) {
          nearestRejectedSim = sim;
          nearestRejectedReason = 'SEMANTIC_SLOT_MISMATCH_REJECTED';
        }
        continue;
      }

      if (this.validateOnRead && !this.validateOnRead(entry.value)) {
        if (sim > nearestRejectedSim) {
          nearestRejectedSim = sim;
          nearestRejectedReason = 'READ_GUARDRAIL_FAILED';
        }
        continue;
      }

      if (sim > bestSim) {
        bestSim = sim;
        bestEntry = entry;
      }
    }

    if (bestEntry) {
      return {
        hit: true,
        matchType: 'SEMANTIC',
        similarity: Number(bestSim.toFixed(6)),
        value: bestEntry.value,
      };
    }

    return {
      hit: false,
      matchType: 'MISS',
      similarity: nearestRejectedSim > 0 ? Number(nearestRejectedSim.toFixed(6)) : 0,
      rejectedReason: nearestRejectedReason,
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Multi-Provider Circuit Breaker Router + Bounded Agent Executor
// ---------------------------------------------------------------------------

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderBreakerConfig {
  failureThreshold: number;
  openDurationMs: number;
  halfOpenSuccessesRequired: number;
  maxHalfOpenProbes: number;
  timeoutMs: number;
}

export interface ProviderOutcome {
  ok: boolean;
  output?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  errorReason?: string;
}

export interface ProviderTarget {
  providerId: string;
  modelId: string;
  tier: 'primary' | 'secondary' | 'deterministic_fallback';
  invoke: (prompt: string) => ProviderOutcome;
}

interface BreakerRuntimeState {
  state: CircuitState;
  consecutiveFailures: number;
  openedAtMs: number;
  halfOpenSuccesses: number;
  inFlightHalfOpenProbes: number;
}

export interface RoutedInferenceResult {
  ok: boolean;
  providerId: string;
  modelId: string;
  degraded: boolean;
  output?: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  attemptedProviders: readonly string[];
  errorReason?: string;
}

export class ProviderCircuitBreakerRouter {
  private readonly targets: readonly ProviderTarget[];
  private readonly config: ProviderBreakerConfig;
  private readonly nowMs: () => number;
  private readonly states = new Map<string, BreakerRuntimeState>();

  constructor(
    targets: readonly ProviderTarget[],
    config: ProviderBreakerConfig,
    nowMs: () => number = () => 0,
  ) {
    if (targets.length === 0) {
      throw new RangeError('At least one provider target is required');
    }
    this.targets = targets;
    this.config = config;
    this.nowMs = nowMs;
    for (const target of targets) {
      this.states.set(target.providerId, {
        state: 'CLOSED',
        consecutiveFailures: 0,
        openedAtMs: 0,
        halfOpenSuccesses: 0,
        inFlightHalfOpenProbes: 0,
      });
    }
  }

  public getCircuitState(providerId: string): CircuitState {
    const runtime = this.states.get(providerId);
    if (!runtime) throw new Error(`Unknown provider: ${providerId}`);
    if (
      runtime.state === 'OPEN' &&
      this.nowMs() - runtime.openedAtMs >= this.config.openDurationMs
    ) {
      return 'HALF_OPEN';
    }
    return runtime.state;
  }

  public route(prompt: string): RoutedInferenceResult {
    const attemptedProviders: string[] = [];
    let cumulativeCostUsd = 0;
    let cumulativeInputTokens = 0;
    let cumulativeOutputTokens = 0;
    let cumulativeLatencyMs = 0;
    let lastError = 'ALL_PROVIDERS_UNAVAILABLE';

    for (let idx = 0; idx < this.targets.length; idx++) {
      const target = this.targets[idx];
      if (!target) continue;
      const runtime = this.states.get(target.providerId);
      if (!runtime) continue;

      const now = this.nowMs();
      if (runtime.state === 'OPEN') {
        if (now - runtime.openedAtMs < this.config.openDurationMs) {
          continue; // Fast-fail to next target in degradation ladder
        }
        runtime.state = 'HALF_OPEN';
        runtime.halfOpenSuccesses = 0;
        runtime.inFlightHalfOpenProbes = 0;
      }

      if (
        runtime.state === 'HALF_OPEN' &&
        runtime.inFlightHalfOpenProbes >= this.config.maxHalfOpenProbes
      ) {
        continue; // Bound concurrent probes during recovery
      }

      attemptedProviders.push(target.providerId);
      if (runtime.state === 'HALF_OPEN') {
        runtime.inFlightHalfOpenProbes++;
      }

      let outcome: ProviderOutcome;
      try {
        outcome = target.invoke(prompt);
      } catch (err) {
        outcome = {
          ok: false,
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          errorReason: err instanceof Error ? err.message : 'PROVIDER_EXCEPTION',
        };
      } finally {
        if (runtime.state === 'HALF_OPEN' && runtime.inFlightHalfOpenProbes > 0) {
          runtime.inFlightHalfOpenProbes--;
        }
      }

      cumulativeCostUsd += outcome.costUsd;
      cumulativeInputTokens += outcome.inputTokens;
      cumulativeOutputTokens += outcome.outputTokens;
      cumulativeLatencyMs += outcome.latencyMs;

      // Outcome-aware failure classification: timeouts count as failures even if provider returns ok
      const timedOut = outcome.latencyMs > this.config.timeoutMs;
      const succeeded = outcome.ok && !timedOut;

      if (succeeded) {
        if (runtime.state === 'HALF_OPEN') {
          runtime.halfOpenSuccesses++;
          if (runtime.halfOpenSuccesses >= this.config.halfOpenSuccessesRequired) {
            runtime.state = 'CLOSED';
            runtime.consecutiveFailures = 0;
            runtime.halfOpenSuccesses = 0;
          }
        } else {
          runtime.consecutiveFailures = 0;
        }

        return {
          ok: true,
          providerId: target.providerId,
          modelId: target.modelId,
          degraded: idx > 0,
          output: outcome.output,
          costUsd: Number(cumulativeCostUsd.toFixed(8)),
          inputTokens: cumulativeInputTokens,
          outputTokens: cumulativeOutputTokens,
          latencyMs: cumulativeLatencyMs,
          attemptedProviders,
        };
      }

      // Failure path: update breaker state and fall through to next provider in ladder
      lastError = timedOut ? 'PROVIDER_TIMEOUT' : (outcome.errorReason ?? 'PROVIDER_FAILURE');
      if (runtime.state === 'HALF_OPEN') {
        runtime.state = 'OPEN';
        runtime.openedAtMs = now;
        runtime.halfOpenSuccesses = 0;
      } else {
        runtime.consecutiveFailures++;
        if (runtime.consecutiveFailures >= this.config.failureThreshold) {
          runtime.state = 'OPEN';
          runtime.openedAtMs = now;
        }
      }
    }

    return {
      ok: false,
      providerId: 'none',
      modelId: 'none',
      degraded: true,
      costUsd: Number(cumulativeCostUsd.toFixed(8)),
      inputTokens: cumulativeInputTokens,
      outputTokens: cumulativeOutputTokens,
      latencyMs: cumulativeLatencyMs,
      attemptedProviders,
      errorReason: lastError,
    };
  }
}

export interface AgentToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

export type AgentPlanStep =
  | { kind: 'final_answer'; answer: string }
  | { kind: 'tool_call'; call: AgentToolCall };

export interface AgentPrincipal {
  principalId: string;
  tenantId: string;
  allowedTools: readonly string[];
}

export interface AgentBudgetConfig {
  maxSteps: number;
  maxToolCalls: number;
  maxCumulativeTokens?: number;
  maxCumulativeCostUsd: number;
  maxWallClockMs: number;
  maxIdenticalCallRepeats: number;
}

export interface OtelGenAiSpan {
  operationName: 'invoke_agent' | 'chat' | 'execute_tool';
  providerName?: string;
  requestModel?: string;
  inputTokens?: number;
  outputTokens?: number;
  toolName?: string;
  costUsd: number;
  durationMs: number;
  status: 'ok' | 'error';
  detail?: string;
}

export type AgentHaltReason =
  | 'COMPLETED'
  | 'MAX_STEPS_EXCEEDED'
  | 'MAX_TOOL_CALLS_EXCEEDED'
  | 'MAX_TOKENS_EXCEEDED'
  | 'MAX_BUDGET_EXCEEDED'
  | 'WALL_CLOCK_TIMEOUT'
  | 'CYCLE_DETECTED'
  | 'UNAUTHORIZED_TOOL_CALL'
  | 'ALL_PROVIDERS_UNAVAILABLE';

export interface AgentExecutionResult {
  completed: boolean;
  haltReason: AgentHaltReason;
  answer?: string;
  stepsExecuted: number;
  toolCallsExecuted: number;
  cumulativeTokens: number;
  cumulativeCostUsd: number;
  degradedUsed: boolean;
  spans: readonly OtelGenAiSpan[];
}

/**
 * Recursively serializes arbitrary JSON-compatible values with deterministically
 * sorted object keys at every nesting depth (avoiding JSON.stringify's array-replacer
 * trap that strips nested keys).
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalizeJson(item))).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const key of sortedKeys) {
    const val = obj[key];
    if (val === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${canonicalizeJson(val)}`);
  }
  return `{${parts.join(',')}}`;
}

export class BoundedAgentExecutor {
  private readonly router: ProviderCircuitBreakerRouter;
  private readonly budget: AgentBudgetConfig;
  private readonly tools: ReadonlyMap<
    string,
    (
      args: Record<string, unknown>,
      principal: AgentPrincipal,
    ) => { output: string; durationMs: number }
  >;
  private readonly nowMs: () => number;
  private readonly advanceClockMs?: (ms: number) => void;

  constructor(options: {
    router: ProviderCircuitBreakerRouter;
    budget: AgentBudgetConfig;
    tools: ReadonlyMap<
      string,
      (
        args: Record<string, unknown>,
        principal: AgentPrincipal,
      ) => { output: string; durationMs: number }
    >;
    nowMs?: () => number;
    advanceClockMs?: (ms: number) => void;
  }) {
    this.router = options.router;
    this.budget = options.budget;
    this.tools = options.tools;
    this.nowMs = options.nowMs ?? (() => 0);
    this.advanceClockMs = options.advanceClockMs;
  }

  public run(
    initialPrompt: string,
    principal: AgentPrincipal,
    parsePlan: (rawModelOutput: string) => AgentPlanStep,
  ): AgentExecutionResult {
    const startMs = this.nowMs();
    const spans: OtelGenAiSpan[] = [];
    const allowedToolsSet = new Set(principal.allowedTools);
    const callFingerprints = new Map<string, number>();

    let stepsExecuted = 0;
    let toolCallsExecuted = 0;
    let cumulativeTokens = 0;
    let cumulativeCostUsd = 0;
    let degradedUsed = false;
    let context = initialPrompt;

    const finish = (
      completed: boolean,
      haltReason: AgentHaltReason,
      answer?: string,
    ): AgentExecutionResult => ({
      completed,
      haltReason,
      ...(answer !== undefined ? { answer } : {}),
      stepsExecuted,
      toolCallsExecuted,
      cumulativeTokens,
      cumulativeCostUsd: Number(cumulativeCostUsd.toFixed(8)),
      degradedUsed,
      spans,
    });

    while (true) {
      if (this.nowMs() - startMs >= this.budget.maxWallClockMs) {
        return finish(false, 'WALL_CLOCK_TIMEOUT');
      }

      if (stepsExecuted >= this.budget.maxSteps) {
        return finish(false, 'MAX_STEPS_EXCEEDED');
      }

      if (
        this.budget.maxCumulativeTokens !== undefined &&
        cumulativeTokens >= this.budget.maxCumulativeTokens
      ) {
        return finish(false, 'MAX_TOKENS_EXCEEDED');
      }

      if (cumulativeCostUsd >= this.budget.maxCumulativeCostUsd) {
        return finish(false, 'MAX_BUDGET_EXCEEDED');
      }

      const routed = this.router.route(context);
      stepsExecuted++;
      cumulativeTokens += routed.inputTokens + routed.outputTokens;
      cumulativeCostUsd += routed.costUsd;
      if (routed.degraded) degradedUsed = true;
      if (this.advanceClockMs) {
        this.advanceClockMs(routed.latencyMs);
      }

      spans.push({
        operationName: 'chat',
        providerName: routed.providerId,
        requestModel: routed.modelId,
        inputTokens: routed.inputTokens,
        outputTokens: routed.outputTokens,
        costUsd: routed.costUsd,
        durationMs: routed.latencyMs,
        status: routed.ok ? 'ok' : 'error',
        detail: routed.errorReason,
      });

      if (!routed.ok || routed.output === undefined) {
        return finish(false, 'ALL_PROVIDERS_UNAVAILABLE');
      }

      if (
        this.budget.maxCumulativeTokens !== undefined &&
        cumulativeTokens > this.budget.maxCumulativeTokens
      ) {
        return finish(false, 'MAX_TOKENS_EXCEEDED');
      }

      if (cumulativeCostUsd > this.budget.maxCumulativeCostUsd) {
        return finish(false, 'MAX_BUDGET_EXCEEDED');
      }

      const plan = parsePlan(routed.output);
      if (plan.kind === 'final_answer') {
        return finish(true, 'COMPLETED', plan.answer);
      }

      // Enforce Tool-Boundary Authorization against authenticated principal (OWASP LLM06)
      const { toolName, args } = plan.call;
      if (!allowedToolsSet.has(toolName) || !this.tools.has(toolName)) {
        spans.push({
          operationName: 'execute_tool',
          toolName,
          costUsd: 0,
          durationMs: 0,
          status: 'error',
          detail: 'UNAUTHORIZED_TOOL_CALL',
        });
        return finish(false, 'UNAUTHORIZED_TOOL_CALL');
      }

      if (toolCallsExecuted >= this.budget.maxToolCalls) {
        return finish(false, 'MAX_TOOL_CALLS_EXCEEDED');
      }

      // Cycle Detection: recursively sort all nested keys before SHA-256 hashing
      const canonicalArgs = canonicalizeJson(args);
      const fingerprint = createHash('sha256').update(`${toolName}:${canonicalArgs}`).digest('hex');
      const seenCount = (callFingerprints.get(fingerprint) ?? 0) + 1;
      callFingerprints.set(fingerprint, seenCount);
      if (seenCount > this.budget.maxIdenticalCallRepeats) {
        return finish(false, 'CYCLE_DETECTED');
      }

      const toolFn = this.tools.get(toolName);
      if (!toolFn) {
        return finish(false, 'UNAUTHORIZED_TOOL_CALL');
      }

      const toolRes = toolFn(args, principal);
      toolCallsExecuted++;
      if (this.advanceClockMs) {
        this.advanceClockMs(toolRes.durationMs);
      }

      spans.push({
        operationName: 'execute_tool',
        toolName,
        costUsd: 0,
        durationMs: toolRes.durationMs,
        status: 'ok',
      });

      context = `${context}\n[tool:${toolName}] ${toolRes.output}`;
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Calibrated Confidence & HITL Uncertainty Router + Dual-Dimension Limiter
// ---------------------------------------------------------------------------

export type ConfidenceRouteBucket =
  | 'AUTO_APPROVE'
  | 'ESCALATE_MODEL'
  | 'HITL_QUEUE'
  | 'FAIL_CLOSED';

export interface UncertaintySignals {
  /** Calibrated token log-probability or sequence confidence in [0, 1]. */
  logprobScore: number;
  /** Independent verifier or multi-sample semantic consistency agreement in [0, 1]. */
  verifierAgreement: number;
  /** Uncalibrated self-reported LLM score (tracked for divergence audit, never trusted alone). */
  verbalizedConfidence?: number;
  /** High-risk irreversible actions (e.g., wire transfer) cannot bypass HITL. */
  irreversibleAction?: boolean;
  /** Monetary or business impact of a false auto-approval (USD). */
  errorImpactUsd: number;
}

export interface HitlRouterConfig {
  autoApproveThreshold: number;
  escalateModelThreshold: number;
  hitlQueueThreshold: number;
  humanReviewCostUsd: number;
  escalationModelCostUsd: number;
  maxHitlQueueDepth: number;
  /** Calibration temperature T > 1 softens overconfident raw scores. */
  calibrationTemperature?: number;
}

export interface HitlRoutingDecision {
  bucket: ConfidenceRouteBucket;
  calibratedConfidence: number;
  expectedAutoErrorCostUsd: number;
  estimatedHandlingCostUsd: number;
  overconfidenceDivergence: number;
  reason: string;
}

export interface HitlRouterMetrics {
  totalRouted: number;
  counts: Record<ConfidenceRouteBucket, number>;
  currentHitlQueueDepth: number;
  hitlQueueLoadRatio: number;
  totalHandlingCostUsd: number;
  totalExpectedAutoErrorCostUsd: number;
  humanOverrides: number;
  autoAcceptedVerified: number;
  overrideRate: number;
}

export class ConfidenceHitlRouter {
  private readonly config: HitlRouterConfig;
  private readonly counts: Record<ConfidenceRouteBucket, number> = {
    AUTO_APPROVE: 0,
    ESCALATE_MODEL: 0,
    HITL_QUEUE: 0,
    FAIL_CLOSED: 0,
  };
  private currentHitlQueueDepth = 0;
  private totalHandlingCostUsd = 0;
  private totalExpectedAutoErrorCostUsd = 0;
  private humanOverrides = 0;
  private autoAcceptedVerified = 0;

  constructor(config: HitlRouterConfig) {
    if (
      !(
        config.hitlQueueThreshold < config.escalateModelThreshold &&
        config.escalateModelThreshold < config.autoApproveThreshold
      )
    ) {
      throw new RangeError(
        'Thresholds must satisfy hitlQueueThreshold < escalateModelThreshold < autoApproveThreshold',
      );
    }
    this.config = config;
  }

  /**
   * Combines log-probability and verifier agreement with temperature scaling.
   * Deliberately excludes verbalized LLM confidence from raising the score.
   */
  public calibrate(signals: UncertaintySignals): {
    calibratedConfidence: number;
    overconfidenceDivergence: number;
  } {
    const lp = Math.max(0.001, Math.min(0.999, signals.logprobScore));
    const va = Math.max(0.001, Math.min(0.999, signals.verifierAgreement));
    // Weighted blend favoring independent verification (0.6 verifier + 0.4 logprob)
    const rawBlended = 0.4 * lp + 0.6 * va;
    const temp = this.config.calibrationTemperature ?? 1.2;
    const logit = Math.log(rawBlended / (1 - rawBlended));
    const calibrated = 1 / (1 + Math.exp(-(logit / temp)));
    const overconfidenceDivergence =
      signals.verbalizedConfidence !== undefined
        ? Math.max(0, signals.verbalizedConfidence - calibrated)
        : 0;

    return {
      calibratedConfidence: Number(calibrated.toFixed(6)),
      overconfidenceDivergence: Number(overconfidenceDivergence.toFixed(6)),
    };
  }

  public route(signals: UncertaintySignals): HitlRoutingDecision {
    const { calibratedConfidence, overconfidenceDivergence } = this.calibrate(signals);
    const pError = 1 - calibratedConfidence;
    const expectedAutoErrorCostUsd = Number((pError * signals.errorImpactUsd).toFixed(4));

    let bucket: ConfidenceRouteBucket;
    let reason: string;
    let handlingCost = 0;

    if (calibratedConfidence < this.config.hitlQueueThreshold) {
      bucket = 'FAIL_CLOSED';
      reason = 'BELOW_MINIMUM_CALIBRATED_CONFIDENCE';
      handlingCost = 0;
    } else if (signals.irreversibleAction) {
      // Mandatory human approval boundary for irreversible financial/external actions
      if (this.currentHitlQueueDepth >= this.config.maxHitlQueueDepth) {
        bucket = 'FAIL_CLOSED';
        reason = 'HITL_CAPACITY_EXHAUSTED_IRREVERSIBLE';
      } else {
        bucket = 'HITL_QUEUE';
        reason = 'IRREVERSIBLE_ACTION_REQUIRES_HUMAN_DIFF_APPROVAL';
        this.currentHitlQueueDepth++;
        handlingCost = this.config.humanReviewCostUsd;
      }
    } else if (
      calibratedConfidence >= this.config.autoApproveThreshold &&
      expectedAutoErrorCostUsd < this.config.humanReviewCostUsd
    ) {
      bucket = 'AUTO_APPROVE';
      reason = 'CALIBRATED_CONFIDENCE_AND_RISK_WITHIN_AUTO_BAND';
      handlingCost = 0;
      this.totalExpectedAutoErrorCostUsd += expectedAutoErrorCostUsd;
    } else if (calibratedConfidence >= this.config.escalateModelThreshold) {
      bucket = 'ESCALATE_MODEL';
      reason = 'MODERATE_UNCERTAINTY_RETRY_STRONGER_MODEL';
      handlingCost = this.config.escalationModelCostUsd;
    } else if (this.currentHitlQueueDepth < this.config.maxHitlQueueDepth) {
      bucket = 'HITL_QUEUE';
      reason = 'UNCERTAIN_ROUTED_TO_HUMAN_REVIEW';
      this.currentHitlQueueDepth++;
      handlingCost = this.config.humanReviewCostUsd;
    } else {
      bucket = 'FAIL_CLOSED';
      reason = 'HITL_QUEUE_AT_CAPACITY_SHED_SAFE';
      handlingCost = 0;
    }

    this.counts[bucket]++;
    this.totalHandlingCostUsd += handlingCost;

    return {
      bucket,
      calibratedConfidence,
      expectedAutoErrorCostUsd,
      estimatedHandlingCostUsd: Number(handlingCost.toFixed(4)),
      overconfidenceDivergence,
      reason,
    };
  }

  public recordHumanAuditOutcome(wasAutoApprovedOverridden: boolean): void {
    this.autoAcceptedVerified++;
    if (wasAutoApprovedOverridden) {
      this.humanOverrides++;
    }
  }

  public drainHitlQueue(reviewedCount: number): void {
    this.currentHitlQueueDepth = Math.max(0, this.currentHitlQueueDepth - reviewedCount);
  }

  public getMetrics(): HitlRouterMetrics {
    const totalRouted =
      this.counts.AUTO_APPROVE +
      this.counts.ESCALATE_MODEL +
      this.counts.HITL_QUEUE +
      this.counts.FAIL_CLOSED;
    return {
      totalRouted,
      counts: { ...this.counts },
      currentHitlQueueDepth: this.currentHitlQueueDepth,
      hitlQueueLoadRatio:
        totalRouted > 0 ? Number((this.counts.HITL_QUEUE / totalRouted).toFixed(4)) : 0,
      totalHandlingCostUsd: Number(this.totalHandlingCostUsd.toFixed(4)),
      totalExpectedAutoErrorCostUsd: Number(this.totalExpectedAutoErrorCostUsd.toFixed(4)),
      humanOverrides: this.humanOverrides,
      autoAcceptedVerified: this.autoAcceptedVerified,
      overrideRate:
        this.autoAcceptedVerified > 0
          ? Number((this.humanOverrides / this.autoAcceptedVerified).toFixed(4))
          : 0,
    };
  }
}

export interface DualLimiterConfig {
  windowMs: number;
  maxRequestsPerWindow: number;
  maxTokensPerWindow: number;
  maxSpendUsdPerWindow: number;
  nowMs?: () => number;
}

interface TenantWindowUsage {
  windowStartMs: number;
  requests: number;
  tokens: number;
  spendUsd: number;
}

/**
 * Atomic multi-dimensional admission control enforcing RPM, TPM, and USD ceilings
 * per authenticated tenant (with fail-closed outage semantics when Redis is down).
 */
export class DualDimensionRateLimiter {
  private readonly config: DualLimiterConfig;
  private readonly nowMs: () => number;
  private readonly usage = new Map<string, TenantWindowUsage>();
  private backendAvailable = true;

  constructor(config: DualLimiterConfig) {
    this.config = config;
    this.nowMs = config.nowMs ?? (() => 0);
  }

  public setBackendAvailable(available: boolean): void {
    this.backendAvailable = available;
  }

  public tryAcquire(args: {
    authenticatedTenantId: string;
    estimatedTokens: number;
    estimatedCostUsd: number;
  }): { allowed: boolean; reason?: string } {
    if (!this.backendAvailable) {
      // Fail-closed protects the wallet during Redis outage (vs fail-open unbounded spend)
      return { allowed: false, reason: 'LIMITER_BACKEND_UNAVAILABLE_FAIL_CLOSED' };
    }

    const now = this.nowMs();
    let bucket = this.usage.get(args.authenticatedTenantId);
    if (!bucket || now - bucket.windowStartMs >= this.config.windowMs) {
      bucket = { windowStartMs: now, requests: 0, tokens: 0, spendUsd: 0 };
      this.usage.set(args.authenticatedTenantId, bucket);
    }

    // All three checks happen atomically before mutating any counter
    if (bucket.requests + 1 > this.config.maxRequestsPerWindow) {
      return { allowed: false, reason: 'RPM_LIMIT_EXCEEDED' };
    }
    if (bucket.tokens + args.estimatedTokens > this.config.maxTokensPerWindow) {
      return { allowed: false, reason: 'TPM_LIMIT_EXCEEDED' };
    }
    if (bucket.spendUsd + args.estimatedCostUsd > this.config.maxSpendUsdPerWindow + 1e-12) {
      return { allowed: false, reason: 'TENANT_USD_BUDGET_EXCEEDED' };
    }

    bucket.requests += 1;
    bucket.tokens += args.estimatedTokens;
    bucket.spendUsd += args.estimatedCostUsd;
    return { allowed: true };
  }
}
