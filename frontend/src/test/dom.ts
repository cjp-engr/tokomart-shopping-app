// Import this from a test that renders into a DOM (put `// @vitest-environment jsdom` on the first line of the test).
// It adds the jest-dom matchers (toBeInTheDocument, toBeDisabled, ...) and unmounts what the test rendered.
// Tests that only call renderToStaticMarkup do not need it.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
