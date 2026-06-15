export type ScriptKind='ServerScript'|'LocalScript'|'ModuleScript';
export interface ScriptNode{ id:string; name:string; kind:ScriptKind; instanceId:string; requires:string[]; symbols:string[]; }
export class ScriptGraph{
private readonly scripts=new Map<string,ScriptNode>();
register(script:ScriptNode):void{if(this.scripts.has(script.id)) throw new Error(`Script already exists: ${script.id}`);this.scripts.set(script.id,script);} 
get(id:string){return this.scripts.get(id);} 
list(){return [...this.scripts.values()];}
findByKind(kind:ScriptKind){return this.list().filter(s=>s.kind===kind);} 
findDependents(moduleId:string){return this.list().filter(s=>s.requires.includes(moduleId));}
updateSymbols(id:string,symbols:string[]){const s=this.scripts.get(id);if(!s) throw new Error(`Script not found: ${id}`);s.symbols=symbols;}
remove(id:string){return this.scripts.delete(id);} }
