import { build } from "esbuild";

console.log("Starting build...");
build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: "dist/",
  sourcemap: "linked",
  external: ["./node_modules/*"],
})
  .then(() => {
    console.log("Build completed.");
  })
  .catch((err) => {
    console.error("Build failed", err);
  });
