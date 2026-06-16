export interface Role {
  id: string;
  name: string;
  permissions: string[];
  description?: string;
}

export class RoleManager {
  private readonly roles = new Map<string, Role>();

  define(role: Role): void {
    if (this.roles.has(role.id)) throw new Error(`Role already defined: ${role.id}`);
    this.roles.set(role.id, { ...role, permissions: [...role.permissions] });
  }

  grantPermission(roleId: string, permission: string): void {
    const r = this.require(roleId);
    if (!r.permissions.includes(permission)) r.permissions.push(permission);
  }

  revokePermission(roleId: string, permission: string): void {
    const r = this.require(roleId);
    r.permissions = r.permissions.filter(p => p !== permission);
  }

  hasPermission(roleId: string, permission: string): boolean {
    return this.require(roleId).permissions.includes(permission);
  }

  get(id: string): Role | undefined { return this.roles.get(id); }

  list(): Role[] { return [...this.roles.values()].map(r => ({ ...r, permissions: [...r.permissions] })); }

  private require(id: string): Role {
    const r = this.roles.get(id);
    if (!r) throw new Error(`Role not found: ${id}`);
    return r;
  }
}
