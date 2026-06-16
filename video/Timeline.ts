import { Scene, SubtitleCue, TimelineClip, Transition } from '../orchestration/ProductionContracts';

export class Timeline {
  assemble(scenes: Scene[], transitions: Transition[], subtitles: SubtitleCue[]): TimelineClip[] {
    const clips: TimelineClip[] = [];
    let cursor = 0;

    scenes.forEach((scene) => {
      clips.push({
        id: `clip-${scene.id}`,
        type: 'video',
        startSeconds: cursor,
        durationSeconds: scene.durationSeconds,
        payload: { sceneId: scene.id, title: scene.title },
      });

      const transition = transitions.find((item) => item.fromSceneId === scene.id);
      if (transition && transition.durationSeconds > 0) {
        clips.push({
          id: `transition-${transition.fromSceneId}-${transition.toSceneId}`,
          type: 'effect',
          startSeconds: cursor + scene.durationSeconds - transition.durationSeconds,
          durationSeconds: transition.durationSeconds,
          payload: { style: transition.style },
        });
      }

      cursor += scene.durationSeconds;
    });

    subtitles.forEach((cue, index) => {
      clips.push({
        id: `subtitle-${index + 1}`,
        type: 'subtitle',
        startSeconds: cue.startSeconds,
        durationSeconds: cue.endSeconds - cue.startSeconds,
        payload: { text: cue.text },
      });
    });

    return clips.sort((left, right) => left.startSeconds - right.startSeconds);
  }
}
