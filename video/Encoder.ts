export class Encoder {
  encode(renderId: string, codec: 'h264' | 'h265' = 'h264'): string {
    return `${renderId}-${codec}`;
  }
}
