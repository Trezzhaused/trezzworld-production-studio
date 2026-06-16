export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface TeamMember {
  userId: string;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamModel {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export class Team {
  constructor(private model: TeamModel) {}

  getId(): string { return this.model.id; }
  getName(): string { return this.model.name; }

  addMember(userId: string, role: TeamRole = 'viewer'): void {
    if (this.model.members.some(m => m.userId === userId)) {
      throw new Error(`User already in team: ${userId}`);
    }
    this.model.members.push({ userId, role, joinedAt: new Date().toISOString() });
  }

  removeMember(userId: string): boolean {
    const before = this.model.members.length;
    this.model.members = this.model.members.filter(m => m.userId !== userId);
    return this.model.members.length !== before;
  }

  setRole(userId: string, role: TeamRole): void {
    const m = this.model.members.find(x => x.userId === userId);
    if (!m) throw new Error(`Member not found: ${userId}`);
    m.role = role;
  }

  getMember(userId: string): TeamMember | undefined {
    return this.model.members.find(m => m.userId === userId);
  }

  listMembers(): TeamMember[] { return [...this.model.members]; }

  getModel(): TeamModel { return { ...this.model, members: [...this.model.members] }; }

  static create(name: string, ownerId: string): Team {
    const now = new Date().toISOString();
    return new Team({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      members: [{ userId: ownerId, role: 'owner', joinedAt: now }],
      createdAt: now,
    });
  }
}
