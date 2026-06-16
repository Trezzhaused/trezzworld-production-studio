export class MP3Exporter {
  export(projectId: string): string {
    return `exports/${projectId}/soundtrack.mp3`;
  }
}
