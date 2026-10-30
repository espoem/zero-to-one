// Tell React that this environment is an act()-aware test harness.
// https://react.dev/reference/react/act#setting-up-your-test-environment
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
