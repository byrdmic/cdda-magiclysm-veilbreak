#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { join, normalize } from "node:path";

// Get paths from .env (Bun auto-loads .env files)
const magiclysmDir = process.env.MAGICLYSM_DIR;
const ddaDataDir = process.env.DDA_DATA_DIR;

if (!magiclysmDir) {
  console.error("❌ MAGICLYSM_DIR not found in .env file");
  process.exit(1);
}

if (!ddaDataDir) {
  console.error("❌ DDA_DATA_DIR not found in .env file");
  process.exit(1);
}

const magiclysmMonstersDir = normalize(join(magiclysmDir, "monsters"));
const ddaMonstersDir = normalize(join(ddaDataDir, "monsters"));
const outputPath = normalize(join(import.meta.dir, "..", "monster_blacklist.json"));

interface MonsterEntry {
  id?: string;
  abstract?: string;
  type?: string;
}

interface MonsterBlacklist {
  type: "MONSTER_BLACKLIST";
  monsters: string[];
}

async function scanMonstersDir(dir: string): Promise<Set<string>> {
  const monsterIds = new Set<string>();

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name);

    for (const fileName of jsonFiles) {
      const filePath = normalize(join(dir, fileName));
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
          monsterIds.add(entry.id);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error scanning ${dir}:`, error);
  }

  return monsterIds;
}

async function generateBlacklist() {
  console.log(`🔍 Scanning base game monsters: ${ddaMonstersDir}`);
  const baseGameMonsters = await scanMonstersDir(ddaMonstersDir);
  console.log(`   Found ${baseGameMonsters.size} base game monsters\n`);

  console.log(`🔍 Scanning Magiclysm monsters: ${magiclysmMonstersDir}`);
  const magiclysmMonsters = await scanMonstersDir(magiclysmMonstersDir);
  console.log(`   Found ${magiclysmMonsters.size} Magiclysm monsters\n`);

  // Filter to only Magiclysm-exclusive monsters
  const exclusiveMonsters = [...magiclysmMonsters]
    .filter((id) => !baseGameMonsters.has(id))
    .sort();

  const overlappingCount = magiclysmMonsters.size - exclusiveMonsters.length;
  console.log(`📊 Results:`);
  console.log(`   - Base game monsters (excluded): ${overlappingCount}`);
  console.log(`   - Magiclysm-exclusive monsters: ${exclusiveMonsters.length}\n`);

  // Build the blacklist structure
  const blacklist: MonsterBlacklist = {
    type: "MONSTER_BLACKLIST",
    monsters: exclusiveMonsters,
  };

  // Write to file with pretty formatting
  await Bun.write(outputPath, JSON.stringify([blacklist], null, 2));

  console.log(`✅ Blacklist written to: ${outputPath}`);
  console.log(`\n📋 Preview (first 10 monsters):`);
  for (const id of exclusiveMonsters.slice(0, 10)) {
    console.log(`   - ${id}`);
  }
  if (exclusiveMonsters.length > 10) {
    console.log(`   ... and ${exclusiveMonsters.length - 10} more`);
  }
}

await generateBlacklist();
