import { Generator } from '../capability/Generator';

export interface VideoRequest {
  prompt: string;
  durationMinutes: number;
}

export interface StoryboardShot {
  id: string;
  description: string;
  seconds: number;
}

export class VideoDirector implements Generator<VideoRequest, StoryboardShot[]> {
  readonly id = 'video-director';

  canHandle(input: VideoRequest): boolean {
    return input.durationMinutes > 0;
  }

  async generate(input: VideoRequest): Promise<StoryboardShot[]> {
    const shotCount = Math.max(6, input.durationMinutes * 4);
    const seconds = Math.max(2, Math.floor((input.durationMinutes * 60) / shotCount));

    return Array.from({ length: shotCount }, (_, index) => ({
      id: `shot-${index + 1}`,
      description: `${input.prompt} — shot ${index + 1}`,
      seconds,
    }));
  }
}
