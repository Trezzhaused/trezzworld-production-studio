export interface ResourceQuota {
  maxMemoryMb: number;
  maxCpuPercent: number;
  maxConcurrentJobs: number;
}

export interface ResourceUsage {
  memoryMb: number;
  cpuPercent: number;
  activeJobs: number;
}

export class ResourceManager {
  private quota: ResourceQuota;
  private usage: ResourceUsage = { memoryMb: 0, cpuPercent: 0, activeJobs: 0 };

  constructor(quota: ResourceQuota = { maxMemoryMb: 2048, maxCpuPercent: 80, maxConcurrentJobs: 8 }) {
    this.quota = { ...quota };
  }

  canAccept(): boolean {
    return (
      this.usage.activeJobs < this.quota.maxConcurrentJobs &&
      this.usage.memoryMb < this.quota.maxMemoryMb &&
      this.usage.cpuPercent < this.quota.maxCpuPercent
    );
  }

  acquire(memoryMb: number, cpuPercent: number): void {
    this.usage.memoryMb += memoryMb;
    this.usage.cpuPercent += cpuPercent;
    this.usage.activeJobs++;
  }

  release(memoryMb: number, cpuPercent: number): void {
    this.usage.memoryMb = Math.max(0, this.usage.memoryMb - memoryMb);
    this.usage.cpuPercent = Math.max(0, this.usage.cpuPercent - cpuPercent);
    this.usage.activeJobs = Math.max(0, this.usage.activeJobs - 1);
  }

  setQuota(quota: Partial<ResourceQuota>): void {
    this.quota = { ...this.quota, ...quota };
  }

  getUsage(): ResourceUsage {
    return { ...this.usage };
  }

  getQuota(): ResourceQuota {
    return { ...this.quota };
  }
}
