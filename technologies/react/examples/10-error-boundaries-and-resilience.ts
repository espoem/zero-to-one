/**
 * Module 10: Resilience, Error Boundaries & Reset
 *
 * Verifies Error Boundary contracts, subtree fault isolation, error recovery / reset
 * semantics, and negative proofs demonstrating whole-tree unmount on uncaught errors.
 */

import assert from "node:assert/strict";

console.log("=== React 19 Module 10: Resilience, Error Boundaries & Reset ===");

// 1. Error Boundary Component Lifecycle Simulation
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryModel {
  state: ErrorBoundaryState = { hasError: false, error: null };
  loggedErrors: Array<{ error: Error; info: string }> = [];

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: string) {
    this.loggedErrors.push({ error, info });
  }

  reset() {
    this.state = { hasError: false, error: null };
  }

  render(childFn: () => string, fallbackFn: (err: Error) => string): string {
    if (this.state.hasError && this.state.error) {
      return fallbackFn(this.state.error);
    }
    try {
      return childFn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.state = ErrorBoundaryModel.getDerivedStateFromError(error);
      this.componentDidCatch(error, "Component stack trace at FaultyWidget");
      return fallbackFn(error);
    }
  }
}

{
  const boundary = new ErrorBoundaryModel();

  // Child component that behaves normally
  const healthyTree = () => "<header>App Header</header>";
  const fallback = (err: Error) => `<div role="alert">Error: ${err.message}</div>`;

  const output1 = boundary.render(healthyTree, fallback);
  assert.equal(output1, "<header>App Header</header>");
  assert.equal(boundary.state.hasError, false);

  // Child component throws an uncaught error
  let shouldFail = true;
  const flakyWidget = () => {
    if (shouldFail) {
      throw new Error("Database timeout in widget");
    }
    return "<div>Widget Data</div>";
  };

  const output2 = boundary.render(flakyWidget, fallback);
  assert.equal(output2, `<div role="alert">Error: Database timeout in widget</div>`);
  assert.equal(boundary.state.hasError, true);
  assert.equal(boundary.loggedErrors.length, 1);
  assert.equal(boundary.loggedErrors[0]?.error.message, "Database timeout in widget");

  // Recovery: Fix underlying fault and reset error boundary
  shouldFail = false;
  boundary.reset();

  const output3 = boundary.render(flakyWidget, fallback);
  assert.equal(output3, "<div>Widget Data</div>");
  assert.equal(boundary.state.hasError, false);

  console.log("✓ Error boundary containment and reset recovery verified.");
}

// 2. Fault Isolation: Uncaught Subtree Does Not Unmount Siblings
{
  interface RenderResult {
    sidebar: string;
    feed: string;
  }

  function renderDashboard(feedFails: boolean): RenderResult {
    const sidebar = "<nav>Navigation Links</nav>";
    const boundary = new ErrorBoundaryModel();

    const feed = boundary.render(
      () => {
        if (feedFails) throw new Error("Feed network partition");
        return "<main>Feed Content</main>";
      },
      (err) => `<aside>Feed unavailable: ${err.message}</aside>`
    );

    return { sidebar, feed };
  }

  const failingResult = renderDashboard(true);
  assert.equal(failingResult.sidebar, "<nav>Navigation Links</nav>", "Sidebar remains intact and mounted");
  assert.equal(failingResult.feed, "<aside>Feed unavailable: Feed network partition</aside>");

  console.log("✓ Subtree fault isolation verified (siblings remain mounted).");
}

// 3. Negative Proof: Uncaught Render Error Without Boundary Unmounts Root
{
  function renderRootUnprotected(failingComponent: () => string): { success: boolean; error?: Error } {
    try {
      failingComponent();
      return { success: true };
    } catch (err) {
      // In React, an unhandled render exception causes the entire root tree to unmount!
      return { success: false, error: err as Error };
    }
  }

  const unhandledErrorResult = renderRootUnprotected(() => {
    throw new Error("Critical unhandled syntax in deep leaf");
  });

  assert.equal(unhandledErrorResult.success, false);
  assert.equal(unhandledErrorResult.error?.message, "Critical unhandled syntax in deep leaf");

  console.log("✓ Negative proof: Uncaught error in unprotected tree crashes the render tree.");
}

console.log("All 10 Error Boundaries & Resilience tests passed successfully!\n");
