export class VoiceRenderer {
  render(projectId: string): string {
    return `exports/${projectId}/voice.wav`;
  }
}
