export interface PlaceNode {
  id:string;
  name:string;
  universeId:string;
  metadata?:Record<string,unknown>;
}

export class PlaceGraph {
  private readonly places=new Map<string,PlaceNode>();

  add(place:PlaceNode):void{
    if(this.places.has(place.id)) throw new Error(`Place already exists: ${place.id}`);
    this.places.set(place.id,place);
  }

  get(id:string):PlaceNode|undefined{
    return this.places.get(id);
  }

  remove(id:string):boolean{
    return this.places.delete(id);
  }

  list():PlaceNode[]{
    return [...this.places.values()];
  }

  findByUniverse(universeId:string):PlaceNode[]{
    return this.list().filter(p=>p.universeId===universeId);
  }
}
