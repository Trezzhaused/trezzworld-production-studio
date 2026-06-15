export type JobStatus='pending'|'running'|'completed'|'failed'|'cancelled';

export interface JobDefinition {
  id:string;
  priority?:number;
  dependsOn?:string[];
  execute:()=>Promise<void>;
}

export class JobScheduler {
  private readonly jobs=new Map<string,JobDefinition>();
  private readonly status=new Map<string,JobStatus>();

  register(job:JobDefinition):void{
    if(this.jobs.has(job.id)) throw new Error(`Job already exists: ${job.id}`);
    this.jobs.set(job.id,job);
    this.status.set(job.id,'pending');
  }

  async run(id:string):Promise<void>{
    const job=this.jobs.get(id);
    if(!job) throw new Error(`Job not found: ${id}`);
    for(const dep of job.dependsOn??[]){
      if(this.status.get(dep)!=='completed') throw new Error(`Dependency not satisfied: ${dep}`);
    }
    this.status.set(id,'running');
    try{
      await job.execute();
      this.status.set(id,'completed');
    }catch(e){
      this.status.set(id,'failed');
      throw e;
    }
  }

  cancel(id:string):void{
    this.require(id);
    this.status.set(id,'cancelled');
  }

  getStatus(id:string):JobStatus{
    this.require(id);
    return this.status.get(id)!;
  }

  list():{id:string;status:JobStatus}[]{
    return [...this.jobs.keys()].map(id=>({id,status:this.status.get(id)!}));
  }

  private require(id:string):void{
    if(!this.jobs.has(id)) throw new Error(`Job not found: ${id}`);
  }
}
