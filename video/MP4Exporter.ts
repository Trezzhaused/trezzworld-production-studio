export class MP4Exporter {
  export(encodedId: string, projectId: string): string {
    return `exports/${projectId}/${encodedId}.mp4`;
  }
}
