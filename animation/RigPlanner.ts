export class RigPlanner {
  plan(clips: string[]): string[] {
    return clips.map((clip) => `${clip}:humanoid-rig`);
  }
}
