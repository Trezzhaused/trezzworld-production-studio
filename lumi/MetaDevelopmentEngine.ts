import { PatchOperation, PatchExecutor } from './PatchExecutor';
import { Planner } from './Planner';
import { CodeGenerator, TargetLanguage } from './CodeGenerator';
import { Validator } from './Validator';
import { ReviewDecision, ReviewEngine } from './ReviewEngine';
import { AutoFixEngine, AutoFixResult } from '../testing/AutoFixEngine';
import { TestResult } from '../testing/TestRunner';
import { RepositoryIntelligence, RepositorySnapshot } from './RepositoryIntelligence';
import { ArchitectureModule, ArchitectureValidator } from './ArchitectureValidator';

export type EngineStage =
  | 'architecture-planning'
  | 'task-generation'
  | 'code-generation'
  | 'repository-patching'
  | 'validation'
  | 'self-fix'
  | 'review'
  | 'commit-candidate';

export interface MetaDevelopmentRequest {
  goal: string;
  language: TargetLanguage;
  repository: RepositorySnapshot;
  architecture: ArchitectureModule[];
  patchOperations: PatchOperation[];
  failedTests?: TestResult[];
}

export interface StageResult {
  stage: EngineStage;
  ok: boolean;
  notes: string[];
}

export interface MetaDevelopmentResult {
  goal: string;
  status: 'ready-for-approval' | 'requires-escalation';
  stages: StageResult[];
  reviewDecision: ReviewDecision;
  generatedCode: string;
  repositoryIssues: number;
  autoFix: AutoFixResult;
  startedAt: string;
  completedAt: string;
}

export class MetaDevelopmentEngine {
  private readonly planner = new Planner();
  private readonly generator = new CodeGenerator();
  private readonly patcher = new PatchExecutor();
  private readonly validator = new Validator();
  private readonly reviewer = new ReviewEngine();
  private readonly fixer = new AutoFixEngine();
  private readonly repositoryIntelligence = new RepositoryIntelligence();
  private readonly architectureValidator = new ArchitectureValidator();

  run(request: MetaDevelopmentRequest): MetaDevelopmentResult {
    const startedAt = new Date().toISOString();
    const stages: StageResult[] = [];

    const architectureCheck = this.architectureValidator.validate(request.architecture);
    stages.push({
      stage: 'architecture-planning',
      ok: architectureCheck.valid,
      notes: architectureCheck.violations.map((violation) => violation.message),
    });

    const plan = this.planner.createPlan(request.goal);
    this.planner.addStep(plan, 'Analyze repository state');
    this.planner.addStep(plan, 'Generate implementation tasks');
    this.planner.addStep(plan, 'Generate and patch code');
    stages.push({
      stage: 'task-generation',
      ok: plan.steps.length >= 3,
      notes: plan.steps.map((step) => step.title),
    });

    const intelligence = this.repositoryIntelligence.analyze(request.repository);
    const generation = this.generator.generate({
      language: request.language,
      name: 'MetaDevelopmentCandidate',
      prompt: `${request.goal}\n\n${intelligence.improvementPlan.join('\n')}`,
    });
    stages.push({
      stage: 'code-generation',
      ok: generation.code.length > 0,
      notes: [intelligence.architectureSummary, ...intelligence.improvementPlan],
    });

    const patchResult = this.patcher.execute(request.patchOperations);
    stages.push({
      stage: 'repository-patching',
      ok: patchResult.success,
      notes: [`Applied ${patchResult.appliedOperations} patch operations.`],
    });

    const validation = this.validator.validate(generation.code);
    stages.push({
      stage: 'validation',
      ok: validation.passed,
      notes: validation.issues.map((issue) => `${issue.rule}: ${issue.message}`),
    });

    const autoFix = request.failedTests?.length ? this.applyFixes(request.failedTests) : { applied: [], failed: [], skipped: [] };
    const fixOk = autoFix.failed.length === 0;
    stages.push({
      stage: 'self-fix',
      ok: fixOk,
      notes: [
        `Applied: ${autoFix.applied.length}`,
        `Failed: ${autoFix.failed.length}`,
        `Skipped: ${autoFix.skipped.length}`,
      ],
    });

    const risk = validation.passed && architectureCheck.valid && fixOk ? 'low' : 'high';
    const review = this.reviewer.createReview(risk);
    const reviewed = risk === 'low'
      ? this.reviewer.approve(review, 'Autonomous loop produced a reviewable candidate.')
      : this.reviewer.reject(review, 'Escalation required due to validation or architecture issues.');

    stages.push({
      stage: 'review',
      ok: reviewed.decision === 'approved',
      notes: reviewed.comments,
    });
    stages.push({
      stage: 'commit-candidate',
      ok: reviewed.decision === 'approved',
      notes: [reviewed.decision === 'approved' ? 'Ready for human approval gate.' : 'Blocked pending escalation.'],
    });

    return {
      goal: request.goal,
      status: reviewed.decision === 'approved' ? 'ready-for-approval' : 'requires-escalation',
      stages,
      reviewDecision: reviewed.decision,
      generatedCode: generation.code,
      repositoryIssues: intelligence.issues.length,
      autoFix,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  private applyFixes(failures: TestResult[]): AutoFixResult {
    return {
      applied: [],
      failed: failures.map((failure) => failure.testId),
      skipped: [],
    };
  }
}
