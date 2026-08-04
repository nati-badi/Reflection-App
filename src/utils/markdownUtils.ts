export function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md;
  
  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Italic (*text* or _text_)
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Bullet lists
  html = html.replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>');
  
  // Numbered lists
  html = html.replace(/^(\d+)\. (.*$)/gim, '<ol><li data-seq="$1">$2</li></ol>');
  
  // Merge adjacent lists
  html = html.replace(/<\/ul>\n<ul>/g, '');
  html = html.replace(/<\/ol>\n<ol>/g, '');
  
  // Paragraphs
  const blocks = html.split('\n\n');
  return blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('<h') || 
      trimmed.startsWith('<ul') || 
      trimmed.startsWith('<ol') || 
      trimmed.startsWith('<blockquote')
    ) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).filter(Boolean).join('\n');
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;
  
  // Headings
  md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
  
  // Blockquotes
  md = md.replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n');
  
  // Bold & Italic
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  
  // Bullet lists
  md = md.replace(/<ul><li>/gi, '- ');
  md = md.replace(/<\/li><\/ul>/gi, '');
  md = md.replace(/<\/li><li>/gi, '\n- ');
  
  // Numbered lists
  md = md.replace(/<ol><li(?: data-seq="(\d+)")?>/gi, (_, seq) => `${seq || 1}. `);
  md = md.replace(/<\/li><\/ol>/gi, '');
  md = md.replace(/<\/li><li(?: data-seq="(\d+)")?>/gi, (_, seq) => `\n${seq || 1}. `);
  
  // Paragraphs & Line Breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
  
  // Clean up HTML tags leftover
  md = md.replace(/<[^>]+>/g, '');

  // Normalize consecutive newlines
  md = md.replace(/\n{3,}/g, '\n\n');
  
  // Normalize heading directly followed by list
  md = md.replace(/(#+ [^\n]+)\n\n(- |\d+\. )/gi, '$1\n$2');
  
  return md.trim();
}

export interface PreviewSegment {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
}

export function parseFormattedPreview(
  markdown: string,
  maxLength: number = 65
): PreviewSegment[] {
  if (!markdown) return [];

  // Step 1: Strip block markers and join lines with " · "
  const rawLines = markdown.split('\n');
  const cleanedLines: string[] = [];

  for (const line of rawLines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Strip heading syntax: #, ##, ###
    trimmed = trimmed.replace(/^#{1,3}\s+/, '');

    // Strip blockquote syntax: >
    trimmed = trimmed.replace(/^>\s+/, '');

    // Strip bullet/list syntax: -, *, •, or 1., 2.
    trimmed = trimmed.replace(/^(\s*)([-*•]|\d+\.)\s+/, '');

    if (trimmed) {
      cleanedLines.push(trimmed);
    }
  }

  const flattenedText = cleanedLines.join(' · ');
  if (!flattenedText) return [];

  // Step 2: Parse inline syntax (**bold**, *italic*) into segments
  const rawSegments: PreviewSegment[] = [];
  let lastIndex = 0;

  const regex = /(\*\*(.+?)\*\*|__(.+?)__|(?<![a-zA-Z0-9])\*(.+?)\*(?![a-zA-Z0-9])|(?<![a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9]))/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(flattenedText)) !== null) {
    if (match.index > lastIndex) {
      rawSegments.push({ text: flattenedText.substring(lastIndex, match.index) });
    }

    const fullMatch = match[0];
    if (fullMatch.startsWith('**') || fullMatch.startsWith('__')) {
      const boldText = match[2] || match[3];
      if (boldText) rawSegments.push({ text: boldText, isBold: true });
    } else if (fullMatch.startsWith('*') || fullMatch.startsWith('_')) {
      const italicText = match[4] || match[5];
      if (italicText) rawSegments.push({ text: italicText, isItalic: true });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < flattenedText.length) {
    rawSegments.push({ text: flattenedText.substring(lastIndex) });
  }

  // Step 3: Truncate across segments safely without cutting formatting tags
  const truncatedSegments: PreviewSegment[] = [];
  let currentLen = 0;

  for (const seg of rawSegments) {
    if (currentLen + seg.text.length <= maxLength) {
      truncatedSegments.push(seg);
      currentLen += seg.text.length;
    } else {
      const remaining = maxLength - currentLen;
      if (remaining > 0) {
        truncatedSegments.push({
          ...seg,
          text: seg.text.substring(0, remaining) + '...',
        });
      } else if (truncatedSegments.length > 0) {
        const lastSeg = truncatedSegments[truncatedSegments.length - 1];
        lastSeg.text = lastSeg.text + '...';
      }
      break;
    }
  }

  return truncatedSegments;
}
