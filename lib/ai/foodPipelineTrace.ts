import { randomUUID } from 'node:crypto';

export type FoodPipelineProviderOutcome = 'matched' | 'no_match' | 'not_configured' | 'failed';

export type FoodPipelineTrace = {
  requestId: string;
  endpoint: string;
  routeVersion: string;
  startedAt: string;
  totalDurationMs: number | null;
  openaiIntent: {
    attempted: boolean;
    succeeded: boolean;
    model: string | null;
    failureReason: string | null;
    durationMs: number | null;
  };
  providers: Array<{
    provider: string;
    configured: boolean;
    attempted: boolean;
    succeeded: boolean;
    outcome: FoodPipelineProviderOutcome;
    durationMs: number;
  }>;
  selectedProvider: string | null;
  selectedMatchType: string | null;
  usedAiEstimate: boolean;
  usedMock: boolean;
  clarificationRequired: boolean;
  failureReasons: string[];
};

export function createFoodPipelineTrace(args: { requestId?: string; endpoint?: string; routeVersion?: string } = {}): FoodPipelineTrace {
  return {
    requestId: args.requestId ?? randomUUID(),
    endpoint: args.endpoint ?? '/api/meal-assistant',
    routeVersion: args.routeVersion ?? 'meal-assistant.v1',
    startedAt: new Date().toISOString(),
    totalDurationMs: null,
    openaiIntent: {
      attempted: false,
      succeeded: false,
      model: null,
      failureReason: null,
      durationMs: null,
    },
    providers: [],
    selectedProvider: null,
    selectedMatchType: null,
    usedAiEstimate: false,
    usedMock: false,
    clarificationRequired: false,
    failureReasons: [],
  };
}

export function recordOpenAIIntent(trace: FoodPipelineTrace, result: {
  succeeded: boolean;
  model?: string | null;
  failureReason?: string | null;
  durationMs: number;
}) {
  trace.openaiIntent = {
    attempted: true,
    succeeded: result.succeeded,
    model: result.model ?? null,
    failureReason: result.failureReason ?? null,
    durationMs: result.durationMs,
  };
  if (result.failureReason && !trace.failureReasons.includes(result.failureReason)) {
    trace.failureReasons.push(result.failureReason);
  }
}

export function recordProviderAttempt(trace: FoodPipelineTrace, result: {
  provider: string;
  configured: boolean;
  succeeded: boolean;
  outcome: FoodPipelineProviderOutcome;
  durationMs: number;
  selected?: boolean;
  matchType?: string | null;
}) {
  trace.providers.push({
    provider: result.provider,
    configured: result.configured,
    attempted: true,
    succeeded: result.succeeded,
    outcome: result.outcome,
    durationMs: result.durationMs,
  });
  if (result.selected) {
    trace.selectedProvider = result.provider;
    trace.selectedMatchType = result.matchType ?? null;
  }
  if (!result.configured && !trace.failureReasons.includes('provider_not_configured')) {
    trace.failureReasons.push('provider_not_configured');
  }
  if (result.outcome === 'failed' && !trace.failureReasons.includes(`${result.provider}_unavailable`)) {
    trace.failureReasons.push(`${result.provider}_unavailable`);
  }
}

export function finishFoodPipelineTrace(trace: FoodPipelineTrace, args: { usedAiEstimate?: boolean; usedMock?: boolean; clarificationRequired?: boolean } = {}) {
  trace.totalDurationMs = Math.max(0, Date.now() - Date.parse(trace.startedAt));
  trace.usedAiEstimate = Boolean(args.usedAiEstimate ?? trace.usedAiEstimate);
  trace.usedMock = Boolean(args.usedMock ?? trace.usedMock);
  trace.clarificationRequired = Boolean(args.clarificationRequired ?? trace.clarificationRequired);
  return trace;
}

export function sanitizedFoodPipelineTrace(trace: FoodPipelineTrace) {
  return {
    ...trace,
    failureReasons: [...trace.failureReasons],
    providers: trace.providers.map((provider) => ({ ...provider })),
  } satisfies FoodPipelineTrace;
}

export function logFoodPipelineTrace(trace: FoodPipelineTrace) {
  console.info('[food-pipeline]', JSON.stringify(sanitizedFoodPipelineTrace(trace)));
}
