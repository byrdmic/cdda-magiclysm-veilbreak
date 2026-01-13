#!/usr/bin/env bun
import { mkdir, readdir } from "node:fs/promises";
import { join, dirname, relative } from "node:path";

// Get the USER_MOD_DIR from .env (Bun auto-loads .env files)
const userModDir = process.env.USER_MOD_DIR;

if (!userModDir) {
  console.error("❌ USER_MOD_DIR not found in .env file");
  process.exit(1);
}

// Source directory (project root, one level up from utils/)
const sourceDir = join(import.meta.dir, "..");

// Destination directory
const destDir = join(userModDir, "magiclysm_veilbreak");

// Files/patterns to exclude
const excludePatterns = [
  ".env",
  ".git",
  ".gitignore",
  "node_modules",
  "utils",
  "*.ts",
  "*.md",
  ".claude",
  "tmpclaude-", // Claude Code temp files
  "package.json",
  "tsconfig.json",
  "bun.lock",
];

// Check if a file should be excluded
function shouldExclude(filePath: string): boolean {
  for (const pattern of excludePatterns) {
    if (filePath.includes(pattern)) {
      return true;
    }
    // Handle wildcard patterns
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      if (filePath.endsWith(ext)) {
        return true;
      }
    }
  }
  return false;
}

// Recursively find all files in a directory
async function* findFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip if excluded
    if (shouldExclude(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      yield* findFiles(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

async function copyModFiles() {
  console.log(`📦 Copying mod files to: ${destDir}`);
  console.log(`📂 Source directory: ${sourceDir}\n`);

  try {
    // Create destination directory if it doesn't exist
    await mkdir(destDir, { recursive: true });

    let copiedCount = 0;
    let skippedCount = 0;

    // Find and copy all files
    for await (const sourcePath of findFiles(sourceDir)) {
      const relativePath = relative(sourceDir, sourcePath);

      const destPath = join(destDir, relativePath);

      // Create parent directory if needed
      const parentDir = dirname(destPath);
      await mkdir(parentDir, { recursive: true });

      // Copy the file using Bun's native API
      const sourceFile = Bun.file(sourcePath);
      await Bun.write(destPath, sourceFile);

      console.log(`✓ Copied: ${relativePath}`);
      copiedCount++;
    }

    console.log(`\n✅ Done! Copied ${copiedCount} file(s)`);
    console.log(`📍 Destination: ${destDir}`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the copy operation
await copyModFiles();
