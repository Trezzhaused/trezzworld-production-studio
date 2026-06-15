export interface InstanceNode {
  id:string;
  className:string;
  name:string;
  placeId:string;
  parentId?:string;
  properties:Record<string,unknown>;
}

export class InstanceGraph {
  private readonly instances=new Map<string,InstanceNode>();
  private readonly children=new Map<string,Set<string>>();

  add(instance:InstanceNode):void{
    if(this.instances.has(instance.id)) throw new Error(`Instance already exists: ${instance.id}`);
    this.instances.set(instance.id,instance);
    if(instance.parentId){
      const set=this.children.get(instance.parentId)??new Set<string>();
      set.add(instance.id);
      this.children.set(instance.parentId,set);
    }
  }

  get(id:string):InstanceNode|undefined{return this.instances.get(id);}

  getChildren(id:string):InstanceNode[]{
    const ids=this.children.get(id)??new Set<string>();
    return [...ids].map(i=>this.instances.get(i)).filter((x):x is InstanceNode=>x!==undefined);
  }

  updateProperties(id:string,properties:Record<string,unknown>):void{
    const inst=this.instances.get(id);
    if(!inst) throw new Error(`Instance not found: ${id}`);
    inst.properties={...inst.properties,...properties};
  }

  remove(id:string):boolean{
    const inst=this.instances.get(id);
    if(!inst) return false;
    if(inst.parentId){this.children.get(inst.parentId)?.delete(id);}    
    this.children.delete(id);
    this.instances.delete(id);
    return true;
  }

  list():InstanceNode[]{return [...this.instances.values()];}
}
