export interface MediaPackage {
  videos: string[];
  audio: string[];
  project: string;
  thumbnail: string;
}

export class MediaExporter {
  export(projectId: string): MediaPackage {
    return {
      videos: [`exports/${projectId}/final-4k.mp4`, `exports/${projectId}/social-vertical.mp4`],
      audio: [`exports/${projectId}/score.mp3`, `exports/${projectId}/voice.wav`],
      project: `exports/${projectId}/project.tps.json`,
      thumbnail: `exports/${projectId}/thumbnail.png`,
    };
  }
}
