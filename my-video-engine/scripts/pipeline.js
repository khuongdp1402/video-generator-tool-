#!/usr/bin/env node

/**
 * Pipeline script - orchestrates the full video generation process:
 * 1. Run TTS generation (Python script)
 * 2. Render video with Remotion
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

// ANSI color helpers
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function run(label, command) {
  console.log(`\n${colors.cyan("▶")} ${colors.bold(label)}`);
  console.log(`  ${colors.yellow(command)}\n`);
  try {
    execSync(command, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/bin:${process.env.PATH}`,
      },
    });
    console.log(`  ${colors.green("✓")} ${label} completed.\n`);
  } catch (err) {
    console.error(`  ${colors.red("✗")} ${label} failed!`);
    process.exit(1);
  }
}

function main() {
  console.log(colors.bold("\n🎬 AI Video Engine Pipeline\n"));
  console.log("=".repeat(50));

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Step 1: Generate TTS audio
  run(
    "Step 1/2: Generating TTS Audio",
    "node scripts/tts_generator.js"
  );

  // Step 2: Render video with Remotion
  const outputFile = path.join(OUTPUT_DIR, "final.mp4");
  run(
    "Step 2/2: Rendering Video",
    `npx remotion render src/index.ts VideoComposition "${outputFile}"`
  );

  // Done
  console.log("=".repeat(50));
  console.log(
    `\n${colors.green("🎉")} ${colors.bold("Video generated successfully!")}`
  );
  console.log(`   Output: ${colors.cyan(outputFile)}`);

  // Show file size
  if (fs.existsSync(outputFile)) {
    const stats = fs.statSync(outputFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`   Size: ${colors.cyan(sizeMB + " MB")}`);
  }
  console.log("");
}

main();
