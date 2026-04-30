const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'new New syllabus hierarchy json with csat.txt');
const content = fs.readFileSync(filePath, 'utf-8');
const matches = content.match(/\[\s*\{[\s\S]*?\}\s*\]/g);

let merged = [];
if (matches) {
    matches.forEach(m => {
        try { merged = merged.concat(JSON.parse(m)); } catch (e) {}
    });
}

const microSyllabus = {};
merged.forEach(entry => {
    if (!microSyllabus[entry.subject]) microSyllabus[entry.subject] = {};
    
    let group = entry.sectionGroup || "General";
    // Simplify group name if it's too long
    if (group.includes(": ")) group = group.split(": ")[1];
    if (group.includes(" - ")) group = group.split(" - ")[0];

    if (!microSyllabus[entry.subject][group]) microSyllabus[entry.subject][group] = [];
    microSyllabus[entry.subject][group].push(entry.microTopic);
});

// Existing MAINS_SYLLABUS
const mainsSyllabus = {
  "GS1": {
    "History": ["Modern Indian history - middle of 18th century to present", "The Freedom Struggle - stages and contributors", "Post-independence consolidation", "World History - 18th century events"],
    "Culture": ["Art Forms, Literature and Architecture"],
    "Society": ["Salient features of Indian Society", "Role of women, population issues", "Globalization effects", "Social empowerment, secularism"],
    "Geography": ["World's physical geography", "Natural resources distribution", "Geophysical phenomena"]
  },
  "GS2": {
    "Polity": ["Constitution - evolution and features", "Union and States functions", "Separation of powers", "Constitutional comparison"],
    "Governance": ["Government policies and interventions", "Development industry - NGOs, SHGs", "Welfare schemes", "Health, Education, HR"],
    "IR": ["India and neighborhood", "Bilateral and global groupings", "International institutions"]
  },
  "GS3": {
    "Economy": ["Resource mobilization, growth", "Inclusive growth", "Government Budgeting", "Infrastructure: Energy, Ports, Roads"],
    "Agriculture": ["Cropping patterns, irrigation", "Subsidies, MSP, PDS", "Food processing", "Land reforms"],
    "Science": ["S&T developments", "Indigenization of technology", "IT, Space, Nano-tech"],
    "Environment": ["Conservation, pollution", "Disaster management"],
    "Security": ["Internal security challenges", "Cyber security, money-laundering", "Border management"]
  },
  "GS4": {
    "Ethics": ["Ethics and Human Interface", "Attitude, Aptitude", "Emotional Intelligence", "Probity in Governance"]
  }
};

const output = `export const MICRO_SYLLABUS = ${JSON.stringify(microSyllabus, null, 2)};\n\nexport const MAINS_SYLLABUS = ${JSON.stringify(mainsSyllabus, null, 2)};\n`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'syllabus.ts'), output);
console.log('Successfully updated src/data/syllabus.ts');
