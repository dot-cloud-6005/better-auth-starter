Place the sql.js WebAssembly bundle here for offline / CSP restricted environments.

Required file names (sql.js@1.13.0):
  sql-wasm.wasm
  sql-wasm.js (optional copy if you want local fallback for script too)

You can obtain them from node_modules/sql.js/dist/ after installing dependencies.

Example copy commands (PowerShell):
  cp node_modules/sql.js/dist/sql-wasm.wasm public/sqljs/

The runtime first attempts to load /sqljs/sql-wasm.wasm before falling back to the CDN.
