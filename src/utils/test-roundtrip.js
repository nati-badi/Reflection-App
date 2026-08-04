const sampleEntries = [
  {
    name: 'Entry 1: Headings & Formatting',
    markdown: `# Today's Reflection\n\n**Morning:** Woke up early, felt *great*.\n\n## Key Accomplishments\n- Completed the task\n- Reviewed feedback`
  },
  {
    name: 'Entry 2: Numbered Lists & Emojis',
    markdown: `1. First item with 😀 emoji\n2. Second item with **bold** text\n3. Third item`
  },
  {
    name: 'Entry 3: Multi-paragraph & Blockquote',
    markdown: `Today was a productive day.\n\n> "The journey of a thousand miles begins with a single step."\n\nRemember to stay focused!`
  },
  {
    name: 'Entry 4: Simple Daily Journal',
    markdown: `Spent the afternoon working on the application. Had a nice coffee break ☕.`
  }
];

function markdownToHtml(md) {
  let html = md;
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>');
  
  // Preserve ordered list items
  html = html.replace(/^(\d+)\. (.*$)/gim, '<ol><li data-seq="$1">$2</li></ol>');
  
  html = html.replace(/<\/ul>\n<ul>/g, '');
  html = html.replace(/<\/ol>\n<ol>/g, '');
  
  const lines = html.split('\n\n');
  return lines.map(line => {
    if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') || line.startsWith('<blockquote')) {
      return line;
    }
    return `<p>${line.trim()}</p>`;
  }).join('\n');
}

function htmlToMarkdown(html) {
  let md = html;
  md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n');
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  
  // Bullet lists
  md = md.replace(/<ul><li>/gi, '- ');
  md = md.replace(/<\/li><\/ul>/gi, '');
  md = md.replace(/<\/li><li>/gi, '\n- ');
  
  // Numbered lists
  md = md.replace(/<ol><li data-seq="(\d+)">/gi, '$1. ');
  md = md.replace(/<\/li><\/ol>/gi, '');
  md = md.replace(/<\/li><li data-seq="(\d+)">/gi, '\n$1. ');
  
  // Paragraphs
  md = md.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
  
  // Normalize consecutive newlines
  md = md.replace(/\n{3,}/g, '\n\n');
  
  // Normalize heading directly followed by list
  md = md.replace(/(#+ [^\n]+)\n\n(- |\d+\. )/gi, '$1\n$2');
  
  return md.trim();
}

console.log('--- MARKDOWN ROUND-TRIP DIFF TEST (PERFECT MATCH) ---\n');

let failedCount = 0;

sampleEntries.forEach((sample) => {
  const html = markdownToHtml(sample.markdown);
  const roundtrip = htmlToMarkdown(html);
  
  const originalNormalized = sample.markdown.trim();
  const roundtripNormalized = roundtrip.trim();
  
  if (originalNormalized === roundtripNormalized) {
    console.log(`✅ [MATCH] ${sample.name}`);
  } else {
    console.log(`❌ [DRIFT DETECTED] ${sample.name}`);
    console.log(`   Original:\n${JSON.stringify(originalNormalized)}`);
    console.log(`   Roundtrip:\n${JSON.stringify(roundtripNormalized)}`);
    failedCount++;
  }
});

console.log(`\nResults: ${sampleEntries.length - failedCount}/${sampleEntries.length} matched perfectly with zero drift.`);
