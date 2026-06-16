export interface Version {
  id: string;
  major: number;
  minor: number;
  patch: number;
  label?: string;
  createdAt: string;
}

export class VersionManager {
  private readonly versions: Version[] = [];
  private current?: Version;

  bump(type: 'major' | 'minor' | 'patch', label?: string): Version {
    const prev = this.current ?? { major: 0, minor: 0, patch: 0 };
    const next: Version = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      major: type === 'major' ? prev.major + 1 : prev.major,
      minor: type === 'major' ? 0 : type === 'minor' ? prev.minor + 1 : prev.minor,
      patch: type === 'patch' ? prev.patch + 1 : 0,
      label,
      createdAt: new Date().toISOString(),
    };
    this.versions.push(next);
    this.current = next;
    return { ...next };
  }

  getCurrent(): Version | undefined { return this.current ? { ...this.current } : undefined; }

  getString(): string {
    if (!this.current) return '0.0.0';
    const { major, minor, patch, label } = this.current;
    return `${major}.${minor}.${patch}${label ? `-${label}` : ''}`;
  }

  history(): Version[] { return this.versions.map(v => ({ ...v })); }

  list(): Version[] { return this.history(); }
}
