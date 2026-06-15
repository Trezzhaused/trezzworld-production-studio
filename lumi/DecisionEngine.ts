export interface DecisionContext {
  goal: string;
  confidence?: number;
  risks?: string[];
  availableTools?: string[];
}

export interface DecisionResult {
  selectedStrategy: string;
  confidence: number;
  nextAction: string;
  timestamp: string;
}

export class DecisionEngine {
  evaluate(context: DecisionContext): DecisionResult {
    const confidence = context.confidence ?? 0.75;
    const strategy = confidence >= 0.8 ? 'execute' : confidence >= 0.5 ? 'plan' : 'review';
    const nextAction = strategy === 'execute' ? 'invoke-tools' : strategy === 'plan' ? 'refine-plan' : 'request-validation';
    return {
      selectedStrategy: strategy,
      confidence,
      nextAction,
      timestamp: new Date().toISOString(),
    };
  }
}
