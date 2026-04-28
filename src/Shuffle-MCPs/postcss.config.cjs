// Empty PostCSS config — prevents esbuild (via tsup) from walking up to the
// host app's root postcss.config.js, which requires tailwindcss and is not
// installed inside this standalone library package.
module.exports = { plugins: [] };
