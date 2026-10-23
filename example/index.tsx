// biome-ignore lint/correctness/noUnusedImports: React is required by the classic JSX transform.
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App/App';

const container = document.getElementById('container');

if (container == null) {
  throw new Error('Missing #container');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
