// Reuse the existing cross-module visual matrix, adding chart/access verification.
process.env.HALO_CAPTURE_DIR='test-results/halo3';
await import('./halo2-browser.mjs');
await import('./halo3-charts-browser.mjs');
