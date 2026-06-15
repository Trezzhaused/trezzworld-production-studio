export type GoalStatus='pending'|'active'|'blocked'|'completed'|'failed';

export interface Goal {
  id:string;
  title:string;
  description?:string;
  priority:number;
  status:GoalStatus;
  progress:number;
  parentId?:string;
  dependencies:string[];
  createdAt:string;
  updatedAt:string;
}

export class GoalManager {
  private readonly goals=new Map<string,Goal>();

  createGoal(input:Omit<Goal,'createdAt'|'updatedAt'>):Goal{
    const now=new Date().toISOString();
    const goal:{[K in keyof Goal]:Goal[K]}={...input,createdAt:now,updatedAt:now};
    this.goals.set(goal.id,goal);
    return goal;
  }

  getGoal(id:string):Goal|undefined{return this.goals.get(id);}

  listGoals():Goal[]{return [...this.goals.values()].sort((a,b)=>b.priority-a.priority);}

  updateStatus(id:string,status:GoalStatus):Goal|undefined{
    const g=this.goals.get(id); if(!g)return undefined; g.status=status; g.updatedAt=new Date().toISOString(); return g;
  }

  updateProgress(id:string,progress:number):Goal|undefined{
    const g=this.goals.get(id); if(!g)return undefined; g.progress=Math.max(0,Math.min(100,progress)); g.updatedAt=new Date().toISOString(); return g;
  }

  addDependency(id:string,dependencyId:string):Goal|undefined{
    const g=this.goals.get(id); if(!g)return undefined; if(!g.dependencies.includes(dependencyId)) g.dependencies.push(dependencyId); g.updatedAt=new Date().toISOString(); return g;
  }

  removeGoal(id:string):boolean{return this.goals.delete(id);}
}
