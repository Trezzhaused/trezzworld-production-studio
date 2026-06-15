export interface DependencyEdge{from:string;to:string;}
export class DependencyGraph{
private readonly adjacency=new Map<string,Set<string>>();
addNode(id:string){if(!this.adjacency.has(id))this.adjacency.set(id,new Set());}
addDependency(from:string,to:string){this.addNode(from);this.addNode(to);this.adjacency.get(from)!.add(to);}
getDependencies(id:string):string[]{return [...(this.adjacency.get(id)??new Set())];}
getDependents(id:string):string[]{const result:string[]=[];for(const [k,v] of this.adjacency){if(v.has(id))result.push(k);}return result;}
hasCycle():boolean{const visited=new Set<string>();const stack=new Set<string>();const dfs=(n:string):boolean=>{if(stack.has(n))return true;if(visited.has(n))return false;visited.add(n);stack.add(n);for(const m of this.getDependencies(n)){if(dfs(m))return true;}stack.delete(n);return false;};for(const n of this.adjacency.keys()){if(dfs(n))return true;}return false;}
topologicalOrder():string[]{const indegree=new Map<string,number>();for(const n of this.adjacency.keys())indegree.set(n,0);for(const [,deps] of this.adjacency){for(const d of deps)indegree.set(d,(indegree.get(d)??0)+1);}const q=[...indegree.entries()].filter(([,v])=>v===0).map(([k])=>k);const order:string[]=[];while(q.length){const n=q.shift()!;order.push(n);for(const d of this.getDependencies(n)){indegree.set(d,indegree.get(d)!-1);if(indegree.get(d)===0)q.push(d);}}return order;}}