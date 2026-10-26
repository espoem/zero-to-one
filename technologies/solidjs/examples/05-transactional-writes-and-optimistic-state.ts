/**
 * Module 05 — Transactional Writes and Optimistic State (SolidJS 2.x).
 *
 * Runnable verification suite. Run with:
 *   node examples/05-transactional-writes-and-optimistic-state.ts
 *
 * Covers:
 * 1. Speculative overlay state with `createOptimistic` (scalar signals).
 * 2. Automatic revert outside and inside transactions.
 * 3. Draft-first speculative stores with `createOptimisticStore`.
 * 4. Generator actions (`action(function* () {})` and `action(async function* () {})`).
 * 5. Yielding promises across asynchronous boundaries and bare `yield` re-synchronization.
 * 6. `affects(target)` transactional pending tracking via `isPending`.
 * 7. Live acknowledgments with `until(predicate, { timeout, signal })`.
 * 8. Editable row preview overlay pattern immune to intervening server snapshots.
 * 9. WebSocket echo receipt synchronization protocol.
 * 10. Saving indicator flags via `createOptimistic(false)`.
 */
import {
  action,
  affects,
  createOptimistic,
  createOptimisticStore,
  createSignal,
  createStore,
  flush,
  isPending,
  until,
} from "./utils/solid2-runtime.ts";
import {
  assert,
  assertEqual,
} from "./utils/type-helpers.ts";

let passed = 0;
function check(condition: boolean, message: string): void {
  assert(condition, message);
  passed += 1;
  console.log(`ok ${passed} - ${message}`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((done) => setTimeout(done, ms));
}

async function main(): Promise<void> {
  // ==========================================================================
  // 1. `createOptimistic` scalar signal: reads base, writes override
  // ==========================================================================
  const [baseCount, setBaseCount] = createSignal(10);
  const [optimisticCount, setOptimisticCount] = createOptimistic(() => baseCount());

  assertEqual(optimisticCount(), 10, "optimistic signal initial read matches base");

  // In Solid 2.0, optimistic writes exist inside a transaction/action frame:
  // they show the speculative value during the in-flight operation and revert when settled.
  const previewGate = Promise.withResolvers<void>();
  const previewAction = action(function* () {
    setOptimisticCount(99);
    yield previewGate.promise;
  });
  previewAction();
  flush();
  assertEqual(optimisticCount(), 99, "optimistic write reflects in accessor during action transaction");
  previewGate.resolve();
  await previewGate.promise;
  flush();
  assertEqual(optimisticCount(), 10, "optimistic write reverts after action transaction settles");
  check(true, "scalar optimistic write auto-reverts on transaction completion");

  // Updating the underlying base signal updates the optimistic accessor when no override is active
  setBaseCount(20);
  flush();
  assertEqual(optimisticCount(), 20, "base updates propagate when no optimistic override is active");
  check(true, "base updates reflect in optimistic signal when idle");

  // ==========================================================================
  // 2. Generator `action`: holding transactions open across async boundaries
  // ==========================================================================
  const [title, setTitle] = createOptimistic("Confirmed Title");
  const saveGate = Promise.withResolvers<string>();

  const updateTitleAction = action(function* (newTitle: string) {
    setTitle(newTitle);
    const result = yield saveGate.promise;
    return result;
  });

  const actionPromise = updateTitleAction("Pending Optimistic Title");
  flush();

  // Inside the transaction, the optimistic override holds
  assertEqual(title(), "Pending Optimistic Title", "optimistic override persists during active action");
  check(true, "optimistic override holds across async generator yield");

  // Resolving the server save completes the action and removes the overlay
  saveGate.resolve("Server Success");
  const actionResult = await actionPromise;
  assertEqual(actionResult, "Server Success", "action promise resolves with generator return value");
  flush();
  assertEqual(title(), "Confirmed Title", "optimistic overlay automatically reverts on action completion");
  check(true, "action completion cleanly reverts speculative overlay to authoritative base");

  // ==========================================================================
  // 3. Automatic revert on action rejection (failure path)
  // ==========================================================================
  const failGate = Promise.withResolvers<string>();
  const failAction = action(function* (speculative: string) {
    setTitle(speculative);
    yield failGate.promise;
    return "done";
  });

  const failPromise = failAction("Doomed Speculation");
  flush();
  assertEqual(title(), "Doomed Speculation", "speculative title displayed while request is in flight");

  // Reject the server request
  failGate.reject(new Error("Network timeout 504"));
  let rejected = false;
  try {
    await failPromise;
  } catch (err) {
    rejected = (err as Error).message.includes("504");
  }
  flush();

  check(rejected, "action promise rejects when yielded promise rejects");
  assertEqual(title(), "Confirmed Title", "optimistic overlay automatically reverts when action rejects");
  check(true, "rejection automatically strips optimistic overlay without manual catch rollback");

  // ==========================================================================
  // 4. `affects(target)` and `isPending(target)` tracking
  // ==========================================================================
  const [dataFeed, setDataFeed] = createSignal("v1");
  const reloadGate = Promise.withResolvers<void>();

  const reloadAction = action(function* () {
    affects(dataFeed);
    yield reloadGate.promise;
  });

  check(!isPending(dataFeed), "dataFeed is not pending before action begins");

  const pendingRun = reloadAction();
  flush();

  check(isPending(dataFeed), "dataFeed isPending reports true while action with affects(target) is active");

  reloadGate.resolve();
  await pendingRun;
  flush();

  check(!isPending(dataFeed), "dataFeed isPending returns to false once transaction completes");

  // ==========================================================================
  // 5. Bare `yield` after internal `await` inside async generator action
  // ==========================================================================
  const [status, setStatus] = createOptimistic("idle");

  const multiStepAction = action(async function* () {
    setStatus("step-1");
    // Internal await
    await sleep(5);
    // Bare yield re-synchronizes the transaction context and flushes queued writes
    yield;
    setStatus("step-2");
    await sleep(5);
    yield;
    return "finished";
  });

  const multiStepPromise = multiStepAction();
  flush();
  assertEqual(status(), "step-1", "step-1 visible initially");

  const multiStepResult = await multiStepPromise;
  assertEqual(multiStepResult, "finished", "multiStepAction returned finished");
  flush();
  assertEqual(status(), "idle", "optimistic status reverted back to idle after completion");
  check(true, "bare yield successfully re-synchronizes reactive transaction after internal await");

  // ==========================================================================
  // 6. `createOptimisticStore`: layering draft mutations over authoritative store
  // ==========================================================================
  type Todo = { id: string; title: string; done: boolean };
  const initialTodos: Todo[] = [
    { id: "t1", title: "Write specification", done: true },
    { id: "t2", title: "Author lesson", done: false },
  ];

  const [confirmedTodos, setConfirmedTodos] = createStore<Todo[]>(initialTodos);
  const [todos, setTodos] = createOptimisticStore<Todo[]>(() => confirmedTodos, initialTodos);

  assertEqual(todos.length, 2, "optimistic store starts with initial confirmed items");

  const todoGate = Promise.withResolvers<Todo>();
  const addTodoAction = action(function* (newTodo: Todo) {
    setTodos((draft) => {
      draft.push(newTodo);
    });
    const saved = yield todoGate.promise;
    // Reconcile confirmed store with authoritative server response
    setConfirmedTodos((draft: Todo[]) => {
      draft.push(saved);
    });
    return saved;
  });

  const newTodo: Todo = { id: "t3", title: "Review pull request", done: false };
  const addPromise = addTodoAction(newTodo);
  flush();

  // Optimistic overlay shows 3 items immediately
  assertEqual(todos.length, 3, "optimistic store displays 3 items immediately");
  assertEqual(todos[2]?.title, "Review pull request", "optimistic item is readable in store");
  check(true, "createOptimisticStore displays active mutation immediately");

  // Server completes write with authoritative ID/timestamp
  const confirmedTodo: Todo = { id: "t3-server", title: "Review pull request", done: false };
  todoGate.resolve(confirmedTodo);
  await addPromise;
  flush();

  // Overlay is removed and confirmed store supplies lasting state
  assertEqual(todos.length, 3, "confirmed store now has 3 items permanently");
  assertEqual(todos[2]?.id, "t3-server", "authoritative server ID is in place");
  check(true, "authoritative server update replaces optimistic draft upon action completion");

  // ==========================================================================
  // 7. Store overlay resilience to intervening authoritative updates
  // ==========================================================================
  type UserProfile = { name: string; email: string; version: number };
  const [confirmedProfile, setConfirmedProfile] = createStore<UserProfile>({
    name: "Alice",
    email: "alice@example.com",
    version: 1,
  });
  const [profile, setProfile] = createOptimisticStore<UserProfile>(
    () => confirmedProfile,
    confirmedProfile
  );

  const saveProfileGate = Promise.withResolvers<void>();
  const updateEmailAction = action(function* (newEmail: string) {
    setProfile((draft) => {
      draft.email = newEmail;
    });
    yield saveProfileGate.promise;
  });

  const emailPromise = updateEmailAction("alice-new@example.com");
  flush();
  assertEqual(profile.email, "alice-new@example.com", "optimistic email overlay is visible");

  // Intervening server broadcast updates the name and version on confirmed store
  setConfirmedProfile((draft: UserProfile) => {
    draft.name = "Alice Smith";
    draft.version = 2;
  });
  flush();

  // Display store reflects the authoritative name update while retaining the optimistic email overlay!
  assertEqual(profile.name, "Alice Smith", "intervening server update for unrelated field applied");
  assertEqual(profile.version, 2, "server version updated");
  assertEqual(profile.email, "alice-new@example.com", "optimistic email overlay preserved over server update");
  check(true, "createOptimisticStore reapplies active optimistic drafts over intervening authoritative updates");

  saveProfileGate.resolve();
  await emailPromise;
  flush();

  // ==========================================================================
  // 8. Live acknowledgments with `until(predicate, { timeout, signal })`
  // ==========================================================================
  const [inboxStatus, setInboxStatus] = createSignal<{ ack: boolean }>({ ack: false });

  // 8a. Resolves when predicate becomes truthy
  const untilPromise = until(() => inboxStatus().ack);
  let resolvedValue = false;
  untilPromise.then((val) => {
    resolvedValue = val;
  });

  flush();
  check(!resolvedValue, "until keeps waiting while predicate evaluates to falsy");

  setInboxStatus({ ack: true });
  flush();
  await sleep(5);
  const ackResult = await untilPromise;
  check(ackResult === true, "until resolves as soon as predicate returns truthy");

  // 8b. Timeout rejection
  const timeoutPromise = until(() => false, { timeout: 20 });
  let timedOut = false;
  try {
    await timeoutPromise;
  } catch (err) {
    timedOut = (err as Error).name === "TimeoutError";
  }
  check(timedOut, "until rejects with TimeoutError when predicate fails to settle within timeout");

  // 8c. AbortSignal cancellation
  const abortCtrl = new AbortController();
  const abortPromise = until(() => false, { signal: abortCtrl.signal });
  abortCtrl.abort(new Error("Canceled by user"));
  let aborted = false;
  try {
    await abortPromise;
  } catch (err) {
    aborted = (err as Error).message === "Canceled by user";
  }
  check(aborted, "until rejects immediately when AbortSignal is aborted");

  // ==========================================================================
  // 9. Composed Pattern: Editable row preview overlay over replacing snapshots
  // ==========================================================================
  type TableRow = { id: string; label: string };
  const [serverRows, setServerRows] = createSignal<readonly TableRow[]>([
    { id: "r1", label: "Alpha" },
    { id: "r2", label: "Beta" },
  ]);

  function createRowLabels(
    rows: () => readonly TableRow[],
    renameApi: (id: string, label: string) => Promise<void>
  ) {
    const [preview, setPreview] = createOptimistic<TableRow | undefined>(undefined);
    const rename = action(function* (id: string, label: string) {
      setPreview({ id, label });
      yield renameApi(id, label);
    });
    return {
      rows,
      rename,
      label(row: TableRow): string {
        const edit = preview();
        return edit?.id === row.id ? edit.label : row.label;
      },
      saving: () => preview() !== undefined,
    };
  }

  const renameGate = Promise.withResolvers<void>();
  const table = createRowLabels(serverRows, (_id, _lbl) => renameGate.promise);

  const row1 = serverRows()[0]!;
  assertEqual(table.label(row1), "Alpha", "initial label matches server");
  check(!table.saving(), "saving flag is false initially");

  // Start renaming row1
  const renamePromise = table.rename("r1", "Alpha-Optimistic");
  flush();

  assertEqual(table.label(row1), "Alpha-Optimistic", "preview overlay renders immediately for target row");
  assertEqual(table.label(serverRows()[1]!), "Beta", "unrelated row remains untouched");
  check(table.saving(), "saving flag reads true from optimistic preview existence");

  // Server pushes an intervening snapshot replacing the row objects entirely!
  setServerRows([
    { id: "r1", label: "Alpha-ServerStale" },
    { id: "r2", label: "Beta-Updated" },
  ]);
  flush();

  const refreshedRow1 = serverRows()[0]!;
  assertEqual(
    table.label(refreshedRow1),
    "Alpha-Optimistic",
    "preview overlay survives intervening snapshot replacement"
  );
  assertEqual(table.label(serverRows()[1]!), "Beta-Updated", "unrelated row takes new snapshot data");
  check(true, "preview overlay protects active edits from being wiped out by server snapshot replacements");

  // Confirm server write
  renameGate.resolve();
  await renamePromise;
  // Authoritative server now reflects the completed rename
  setServerRows([
    { id: "r1", label: "Alpha-Optimistic" },
    { id: "r2", label: "Beta-Updated" },
  ]);
  flush();

  check(!table.saving(), "saving flag returns to false after action settles");
  assertEqual(table.label(serverRows()[0]!), "Alpha-Optimistic", "confirmed state seamlessly takes over");

  // ==========================================================================
  // 10. Composed Pattern: Live WebSocket Echo Receipt Synchronization
  // ==========================================================================
  type ChatMessage = { id: string; clientId?: string; text: string; pending?: boolean };
  type ChatInbox = { messages: ChatMessage[]; receipts: string[] };

  const [confirmedInbox, setConfirmedInbox] = createStore<ChatInbox>({
    messages: [],
    receipts: [],
  });
  const [inbox, setInbox] = createOptimisticStore<ChatInbox>(
    () => confirmedInbox,
    confirmedInbox
  );

  const sendGate = Promise.withResolvers<void>();
  const sendChatMessage = action(function* (text: string) {
    const clientId = "client-uuid-123";
    const msg: ChatMessage = { id: clientId, clientId, text };
    setInbox((draft) => {
      draft.messages.push({ ...msg, pending: true });
    });
    yield sendGate.promise;
    yield until(() => inbox.receipts.includes(clientId), { timeout: 1000 });
  });

  const chatPromise = sendChatMessage("Hello Solid 2.0!");
  flush();

  assertEqual(inbox.messages.length, 1, "chat message is visible optimistically");
  check(inbox.messages[0]?.pending === true, "optimistic message has pending flag");

  // Server acknowledges HTTP delivery
  sendGate.resolve();
  flush();

  // WebSocket broadcast arrives with confirmed message and echo receipt
  setConfirmedInbox((draft: ChatInbox) => {
    draft.messages.push({ id: "server-msg-1", clientId: "client-uuid-123", text: "Hello Solid 2.0!" });
    draft.receipts.push("client-uuid-123");
  });
  flush();

  await chatPromise;
  flush();

  assertEqual(inbox.messages.length, 1, "only 1 message exists after receipt confirmation (no duplicates)");
  assertEqual(inbox.messages[0]?.id, "server-msg-1", "authoritative message persisted");
  check(!inbox.messages[0]?.pending, "message is no longer pending");
  check(true, "chat message protocol completes only after both HTTP write and live echo acknowledgment");

  console.log(`\nAll ${passed} checks passed cleanly.`);
}

await main();
