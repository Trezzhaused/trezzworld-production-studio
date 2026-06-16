import { AssetItem, RenderArtifact, SubtitleCue, ValidationIssue, ValidationReport } from '../orchestration/ProductionContracts';

export interface QualityInput {
  assets: AssetItem[];
  subtitles: SubtitleCue[];
  exports: RenderArtifact[];
  expectedResolution: string;
  frameRate: number;
  audioPeakDb: number;
}

export class QualityControl {
  validate(input: QualityInput): ValidationReport {
    const issues: ValidationIssue[] = [];

    if (input.assets.length === 0) {
      issues.push({
        code: 'ASSET_MISSING',
        message: 'No assets were generated.',
        severity: 'error',
      });
    }

    input.exports.forEach((artifact) => {
      if (!artifact.path.endsWith('.mp4')) {
        issues.push({
          code: 'EXPORT_FORMAT',
          message: `Unsupported export format in ${artifact.id}.`,
          severity: 'error',
        });
      }

      if (artifact.resolution.length < 7) {
        issues.push({
          code: 'RESOLUTION_INVALID',
          message: `Resolution is invalid for ${artifact.id}.`,
          severity: 'error',
        });
      }
    });

    if (!input.exports.some((artifact) => artifact.resolution === input.expectedResolution)) {
      issues.push({
        code: 'RESOLUTION_TARGET_MISSING',
        message: `Expected output resolution ${input.expectedResolution} was not exported.`,
        severity: 'warning',
      });
    }

    if (input.frameRate <= 0 || input.frameRate > 120) {
      issues.push({
        code: 'FRAME_RATE_INVALID',
        message: `Frame rate ${input.frameRate}fps is outside expected bounds.`,
        severity: 'error',
      });
    }

    if (input.audioPeakDb > 0) {
      issues.push({
        code: 'AUDIO_CLIPPING',
        message: `Audio clipping detected at +${input.audioPeakDb.toFixed(1)} dB.`,
        severity: 'error',
      });
    }

    if (input.subtitles.some((cue) => /\bteh\b/i.test(cue.text))) {
      issues.push({
        code: 'CAPTION_SPELLING',
        message: 'Subtitle spelling issue detected.',
        severity: 'warning',
      });
    }

    return {
      ok: !issues.some((issue) => issue.severity === 'error'),
      issues,
    };
  }
}
