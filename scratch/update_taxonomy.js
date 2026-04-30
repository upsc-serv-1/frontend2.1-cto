const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'new New syllabus hierarchy json with csat.txt');
const content = fs.readFileSync(filePath, 'utf-8');

// The file has multiple [...] arrays. We need to find all matches and merge them.
const matches = content.match(/\[\s*\{[\s\S]*?\}\s*\]/g);

let merged = [];
if (matches) {
    matches.forEach(m => {
        try {
            const arr = JSON.parse(m);
            merged = merged.concat(arr);
        } catch (e) {
            console.error('Failed to parse a block:', e.message);
        }
    });
}

const output = `export interface TaxonomyEntry {
  subject: string;
  sectionGroup: string | null;
  microTopic: string;
}

export const prelimsTaxonomy: TaxonomyEntry[] = ${JSON.stringify(merged, null, 2)};

export function getSyllabusHierarchy() {
  const hierarchy: any = {};

  prelimsTaxonomy.forEach(entry => {
    if (!hierarchy[entry.subject]) {
      hierarchy[entry.subject] = { sections: {} };
    }

    const sg = entry.sectionGroup || "General";
    const parts = sg.split(" - ");
    const sectionName = parts[0];
    const macroName = parts[1] || sectionName;

    if (!hierarchy[entry.subject].sections[sectionName]) {
      hierarchy[entry.subject].sections[sectionName] = { macros: {} };
    }

    if (!hierarchy[entry.subject].sections[sectionName].macros[macroName]) {
      hierarchy[entry.subject].sections[sectionName].macros[macroName] = [];
    }

    hierarchy[entry.subject].sections[sectionName].macros[macroName].push(entry.microTopic);
  });

  return hierarchy;
}
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'taxonomy.ts'), output);
console.log('Successfully updated src/data/taxonomy.ts');
