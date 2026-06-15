export type DiffOperation='insert'|'update'|'delete';

export interface DiffRecord{
  operation:DiffOperation;
  targetId:string;
  before?:unknown;
  after?:unknown;
}

export class DiffEngine{
  diff<T extends {id:string}>(before:T[],after:T[]):DiffRecord[]{
    const result:DiffRecord[]=[];
    const oldMap=new Map(before.map(i=>[i.id,i]));
    const newMap=new Map(after.map(i=>[i.id,i]));

    for(const [id,oldItem] of oldMap){
      if(!newMap.has(id)){
        result.push({operation:'delete',targetId:id,before:oldItem});
      }else{
        const next=newMap.get(id)!;
        if(JSON.stringify(oldItem)!==JSON.stringify(next)){
          result.push({operation:'update',targetId:id,before:oldItem,after:next});
        }
      }
    }

    for(const [id,newItem] of newMap){
      if(!oldMap.has(id)){
        result.push({operation:'insert',targetId:id,after:newItem});
      }
    }

    return result;
  }
}
