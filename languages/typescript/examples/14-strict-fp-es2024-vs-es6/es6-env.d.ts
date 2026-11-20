// Minimal timer declarations for the strict ES2015 compilation target (`lib: ["ES2015"]`).
// Keeps global scope free of DOM/Node ES2016–ES2024 globals while typing debounce/throttle timers.
declare function setTimeout(callback: () => void, ms?: number): unknown;
declare function clearTimeout(id: unknown): void;
