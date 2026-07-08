const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
const lines = html.split('\n');

const units = [];
const practicals = [];

let currentUnit = null;
let currentSection = null;
let questionBuffer = null;
let inPractical = false;
let practicalDepth = 0;
let practicalBuffer = null;
let inScript = false;
let inStyle = false;

function getDifficulty(styleAttr) {
  if (!styleAttr) return 1;
  if (styleAttr.includes('#7c3aed')) return 4;
  if (styleAttr.includes('#d97706')) return 3;
  if (styleAttr.includes('#2563eb')) return 2;
  return 1;
}

function getQuestionNum(html) {
  const m = html.match(/<div class="q-num">(\d+)<\/div>/);
  return m ? parseInt(m[1]) : null;
}

function saveQuestion() {
  if (!questionBuffer || !currentUnit || !currentSection) return;
  const qHtml = questionBuffer.join('\n');
  const num = getQuestionNum(qHtml);
  const diff = getDifficulty(qHtml);

  const obj = {
    num,
    difficulty: diff,
    html: qHtml
  };

  if (currentSection === 'mcq') {
    if (!currentUnit.mcqs) currentUnit.mcqs = [];
    currentUnit.mcqs.push(obj);
  } else if (currentSection === 'short') {
    if (!currentUnit.shorts) currentUnit.shorts = [];
    currentUnit.shorts.push(obj);
  }
  questionBuffer = null;
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Track script/style state
  if (trimmed.startsWith('<script')) { inScript = true; continue; }
  if (trimmed.startsWith('</script>')) { inScript = false; continue; }
  if (trimmed.startsWith('<style')) { inStyle = true; continue; }
  if (trimmed.startsWith('</style>')) { inStyle = false; continue; }
  if (inScript || inStyle) continue;

  // Unit header
  if (trimmed.startsWith('<div class="unit-header"')) {
    saveQuestion();

    const idMatch = trimmed.match(/id="([^"]+)"/);
    const codeMatch = trimmed.match(/UNIT (\d+)/);
    const titleMatch = trimmed.match(/<h2>([^<]+)<\/h2>/);
    const statsMatch = trimmed.match(/unit-stats">([^<]+)<\/div>/);

    const unitCode = codeMatch ? codeMatch[1] : null;
    currentUnit = {
      code: unitCode,
      id: idMatch ? idMatch[1] : '',
      title: titleMatch ? titleMatch[1] : '',
      stats: statsMatch ? statsMatch[1] : ''
    };
    // Read next few lines for full header
    let j = i + 1;
    while (j < lines.length && j < i + 10) {
      const l = lines[j].trim();
      if (l.startsWith('<div class="unit-code"')) {
        const c = l.match(/UNIT (\d+)/);
        if (c) currentUnit.code = c[1];
      } else if (l.startsWith('<h2>')) {
        currentUnit.title = l.replace(/<\/?h2>/g, '');
      } else if (l.startsWith('<div class="unit-stats"')) {
        const s = l.match(/unit-stats">([^<]+)<\/div>/);
        if (s) currentUnit.stats = s[1];
      }
      j++;
    }
    if (currentUnit.code) {
      currentUnit.mcqs = [];
      currentUnit.shorts = [];
      units.push(currentUnit);
    }
    continue;
  }

  // Section header
  if (trimmed.startsWith('<div class="section-header"')) {
    saveQuestion();
    const titleMatch = trimmed.match(/<h3>([^<]+)<\/h3>/);
    if (titleMatch) {
      const t = titleMatch[1].toLowerCase();
      if (t.includes('multiple choice')) currentSection = 'mcq';
      else if (t.includes('short questions')) currentSection = 'short';
      else if (t.includes('practical')) currentSection = 'practical';
      else currentSection = null;
    } else {
      // Multi-line section header
      for (let k = i + 1; k < Math.min(i + 5, lines.length); k++) {
        const l = lines[k].trim();
        if (l.startsWith('<h3>')) {
          const t = l.replace(/<\/?h3>/g, '').toLowerCase();
          if (t.includes('multiple choice')) currentSection = 'mcq';
          else if (t.includes('short questions')) currentSection = 'short';
          else if (t.includes('practical')) currentSection = 'practical';
          else currentSection = null;
          break;
        }
      }
    }
    continue;
  }

  // Practical section
  if (trimmed.startsWith('<div class="practical-section"')) {
    inPractical = true;
    practicalDepth = 1;
    practicalBuffer = [line];
    currentSection = null;
    saveQuestion();
    continue;
  }

  if (inPractical) {
    practicalBuffer.push(line);
    // Track depth based on <div and </div>
    const openDivs = (line.match(/<div/g) || []).length;
    const closeDivs = (line.match(/<\/div>/g) || []).length;
    practicalDepth += openDivs - closeDivs;

    if (practicalDepth <= 0 && closeDivs > 0) {
      inPractical = false;
      practicals.push(practicalBuffer.join('\n'));
      practicalBuffer = null;
    }
    continue;
  }

  // Question div capture
  if (trimmed.startsWith('<div class="question"') || trimmed.startsWith('<div class="question "')) {
    saveQuestion();
    questionBuffer = [line];
    let depth = 1;
    let j = i + 1;
    while (j < lines.length && depth > 0) {
      const l = lines[j];
      questionBuffer.push(l);
      const opens = (l.match(/<div/g) || []).length;
      const closes = (l.match(/<\/div>/g) || []).length;
      depth += opens - closes;
      j++;
    }
    i = j - 1;
    continue;
  }
}

// Save final question
saveQuestion();

// Build output
const output = { units, practicals };

fs.writeFileSync(
  path.join(__dirname, '..', 'questions.json'),
  JSON.stringify(output, null, 2),
  'utf-8'
);

// Generate questions-data.js (synchronous script tag compatible)
const jsContent = 'const QUESTIONS_DATA = ' + JSON.stringify(output) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'questions-data.js'), jsContent, 'utf-8');

// Stats
let mcqTotal = 0;
let shortTotal = 0;
for (const u of units) {
  mcqTotal += (u.mcqs || []).length;
  shortTotal += (u.shorts || []).length;
}
console.log(`Extracted ${units.length} units`);
console.log(`MCQs: ${mcqTotal}`);
console.log(`Short Questions: ${shortTotal}`);
console.log(`Practical sections: ${practicals.length}`);
console.log('Saved to questions.json');
console.log('Saved to questions-data.js (' + (jsContent.length / 1024).toFixed(1) + ' KB)');
