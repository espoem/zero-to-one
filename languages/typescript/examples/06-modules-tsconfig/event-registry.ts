/**
 * A tiny "library" module whose interface is open for augmentation by other modules
 * (the pattern used by Express' Request, Vue's ComponentCustomProperties, etc.).
 */
// biome-ignore lint: intentionally empty, filled by declaration merging
export interface EventRegistry {}

export function emit<K extends keyof EventRegistry>(name: K, payload: EventRegistry[K]): string {
  return `${String(name)}:${JSON.stringify(payload)}`;
}
