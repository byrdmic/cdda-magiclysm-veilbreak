#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { join, normalize } from "node:path";

// Get the MAGICLYSM_DIR from .env (Bun auto-loads .env files)
const magiclysmDir = process.env.MAGICLYSM_DIR;

if (!magiclysmDir) {
  console.error("❌ MAGICLYSM_DIR not found in .env file");
  process.exit(1);
}

// Normalize path to use Windows backslashes
const monstersDir = normalize(join(magiclysmDir, "monsters"));

interface MonsterEntry {
  id?: string;
  abstract?: string;
  type?: string;
}

async function auditMonsters() {
  console.log(`🔍 Scanning monsters in: ${monstersDir}\n`);

  try {
    const entries = await readdir(monstersDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name);

    const monsterIds: string[] = [];
    let filesScanned = 0;

    for (const fileName of jsonFiles) {
      const filePath = normalize(join(monstersDir, fileName));
      const file = Bun.file(filePath);
      const content = await file.json();

      // CDDA JSON files contain arrays of objects
      const entries: MonsterEntry[] = Array.isArray(content)
        ? content
        : [content];

      for (const entry of entries) {
        // Only include entries with type "MONSTER" and an "id" field
        // Skip entries that use "abstract" instead of "id"
        if (entry.type === "MONSTER" && entry.id && !entry.abstract) {
          monsterIds.push(entry.id);
        }
      }

      filesScanned++;
      console.log(`📄 Scanned: ${fileName}`);
    }

    // Sort and deduplicate
    const uniqueIds = [...new Set(monsterIds)].sort();

    console.log(`\n${"─".repeat(50)}`);
    console.log(`✅ Found ${uniqueIds.length} monster IDs in ${filesScanned} files\n`);

    // Output IDs one per line
    for (const id of uniqueIds) {
      console.log(id);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

await auditMonsters();
