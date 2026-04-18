import type { ConstructDefinition } from "@block-editor/template-schema";
import { BUILT_IN_CONSTRUCTS } from "./constructs";

const registry = new Map<string, ConstructDefinition>(
  BUILT_IN_CONSTRUCTS.map((c) => [c.id, c]),
);

export function registerConstruct(def: ConstructDefinition): void {
  registry.set(def.id, def);
}

export function getConstruct(id: string): ConstructDefinition | undefined {
  return registry.get(id);
}

export function getAllConstructs(): ConstructDefinition[] {
  return Array.from(registry.values());
}
