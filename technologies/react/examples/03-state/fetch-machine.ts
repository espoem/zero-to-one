/**
 * A fetch lifecycle as an explicit finite-state machine (absorbed from TS M10.3, runtime half).
 * The *typing* of discriminated unions is taught in the TypeScript track (M12);
 * here the point is the design: impossible states are unrepresentable and
 * illegal events return the SAME state object, so React bails out of re-rendering.
 */
export type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: string[] }
  | { status: "error"; error: string };

export type FetchEvent =
  | { type: "FETCH" }
  | { type: "RESOLVE"; data: string[] }
  | { type: "REJECT"; error: string }
  | { type: "RESET" };

export function fetchMachine(state: FetchState, event: FetchEvent): FetchState {
  switch (state.status) {
    case "idle":
    case "error":
    case "success":
      if (event.type === "FETCH") return { status: "loading" };
      if (event.type === "RESET") return { status: "idle" };
      return state;
    case "loading":
      if (event.type === "RESOLVE") return { status: "success", data: event.data };
      if (event.type === "REJECT") return { status: "error", error: event.error };
      return state;
  }
}
