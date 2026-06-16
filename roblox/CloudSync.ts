export interface SyncState {
  lastSyncedAt?: string;
  pendingChanges: number;
  syncing: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  changesSynced: number;
}

export class CloudSync {
  private state: SyncState = { pendingChanges: 0, syncing: false };

  addPendingChange(): void {
    this.state.pendingChanges++;
  }

  async sync(): Promise<SyncResult> {
    if (this.state.syncing) throw new Error('Sync already in progress');
    this.state.syncing = true;
    const changesSynced = this.state.pendingChanges;
    // Simulate cloud sync
    this.state.pendingChanges = 0;
    this.state.lastSyncedAt = new Date().toISOString();
    this.state.syncing = false;
    return { success: true, syncedAt: this.state.lastSyncedAt, changesSynced };
  }

  getState(): SyncState {
    return { ...this.state };
  }

  hasPendingChanges(): boolean {
    return this.state.pendingChanges > 0;
  }
}
