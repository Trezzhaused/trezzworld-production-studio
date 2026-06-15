export type PropertyType = 'string' | 'number' | 'boolean' | 'color' | 'vector' | 'enum';

export interface PropertyDescriptor {
  key: string;
  label: string;
  type: PropertyType;
  value: unknown;
  options?: string[];
  readOnly?: boolean;
}

export class PropertyInspector {
  private target?: string;
  private properties: PropertyDescriptor[] = [];

  inspect(targetId: string, descriptors: PropertyDescriptor[]): void {
    this.target = targetId;
    this.properties = descriptors.map(d => ({ ...d }));
  }

  get(key: string): PropertyDescriptor | undefined {
    return this.properties.find(p => p.key === key);
  }

  set(key: string, value: unknown): void {
    const prop = this.properties.find(p => p.key === key);
    if (!prop) throw new Error(`Property not found: ${key}`);
    if (prop.readOnly) throw new Error(`Property is read-only: ${key}`);
    prop.value = value;
  }

  getTarget(): string | undefined {
    return this.target;
  }

  list(): PropertyDescriptor[] {
    return this.properties.map(p => ({ ...p }));
  }

  clear(): void {
    this.target = undefined;
    this.properties = [];
  }
}
