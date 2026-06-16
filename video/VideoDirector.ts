import { ProductionRequest, ScriptSegment } from '../orchestration/ProductionContracts';

export class VideoDirector {
  generateScript(request: ProductionRequest): ScriptSegment[] {
    const totalSeconds = request.durationMinutes * 60;
    const segmentCount = Math.max(3, Math.ceil(request.durationMinutes * 2));
    const baseDuration = Math.floor(totalSeconds / segmentCount);

    return Array.from({ length: segmentCount }, (_, index) => {
      const isLast = index === segmentCount - 1;
      const usedSeconds = baseDuration * index;
      const remaining = totalSeconds - usedSeconds;
      const durationSeconds = isLast ? remaining : baseDuration;

      return {
        id: `script-${index + 1}`,
        text: `${request.projectTitle ?? 'Project'} beat ${index + 1}: ${request.prompt}`,
        durationSeconds,
      };
    });
  }
}
