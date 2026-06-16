export class PermissionManager {
  private readonly userRoles = new Map<string, Set<string>>();
  private readonly rolePermissions = new Map<string, Set<string>>();

  assignRole(userId: string, roleId: string): void {
    const roles = this.userRoles.get(userId) ?? new Set();
    roles.add(roleId);
    this.userRoles.set(userId, roles);
  }

  removeRole(userId: string, roleId: string): void {
    this.userRoles.get(userId)?.delete(roleId);
  }

  defineRolePermissions(roleId: string, permissions: string[]): void {
    this.rolePermissions.set(roleId, new Set(permissions));
  }

  can(userId: string, permission: string): boolean {
    for (const roleId of this.userRoles.get(userId) ?? []) {
      if (this.rolePermissions.get(roleId)?.has(permission)) return true;
    }
    return false;
  }

  require(userId: string, permission: string): void {
    if (!this.can(userId, permission)) {
      throw new Error(`Access denied: user "${userId}" lacks permission "${permission}"`);
    }
  }

  getRoles(userId: string): string[] { return [...(this.userRoles.get(userId) ?? [])]; }
  getPermissions(roleId: string): string[] { return [...(this.rolePermissions.get(roleId) ?? [])]; }
}
