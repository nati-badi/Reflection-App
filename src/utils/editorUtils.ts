/**
 * Utility functions for smart list continuation, renumbering,
 * backspace formatting removal, and Markdown list handling.
 */

export function renumberContentLists(content: string): string {
  const lines = content.split('\n');
  let currentListNum = 0;
  let inNumberedList = false;

  const newLines = lines.map((line) => {
    const match = line.match(/^(\s*)(\d+)\.(\s+.*|\s*)$/);
    if (match) {
      const indent = match[1];
      const rest = match[3];
      if (!inNumberedList) {
        inNumberedList = true;
        currentListNum = 1;
      } else {
        currentListNum++;
      }
      return `${indent}${currentListNum}.${rest}`;
    } else {
      inNumberedList = false;
      currentListNum = 0;
      return line;
    }
  });

  return newLines.join('\n');
}

export function processEditorTextChange(
  oldContent: string,
  newContent: string,
  cursorPos: number
): { content: string; newCursorPos: number } {
  // Case A: User pressed Enter (inserted newline)
  if (newContent.length === oldContent.length + 1) {
    const addedChar = newContent.charAt(cursorPos - 1);
    if (addedChar === '\n') {
      const textBeforeNewline = newContent.substring(0, cursorPos - 1);
      const lineStart = textBeforeNewline.lastIndexOf('\n') + 1;
      const prevLine = textBeforeNewline.substring(lineStart);

      // 1. Enter on empty numbered list item (e.g. "1. " or "2. ") -> Exit list
      const emptyNumberMatch = prevLine.match(/^(\s*)(\d+)\.\s*$/);
      if (emptyNumberMatch) {
        const beforeLine = newContent.substring(0, lineStart);
        const afterCursor = newContent.substring(cursorPos);
        const updatedContent = renumberContentLists(beforeLine + afterCursor);
        return {
          content: updatedContent,
          newCursorPos: lineStart,
        };
      }

      // 2. Enter on empty bullet list item (e.g. "- " or "* " or "• ") -> Exit list
      const emptyBulletMatch = prevLine.match(/^(\s*)([-*•])\s*$/);
      if (emptyBulletMatch) {
        const beforeLine = newContent.substring(0, lineStart);
        const afterCursor = newContent.substring(cursorPos);
        return {
          content: beforeLine + afterCursor,
          newCursorPos: lineStart,
        };
      }

      // 3. Enter on active numbered list item with text (e.g. "1. Hello") -> Continue numbered list
      const activeNumberMatch = prevLine.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (activeNumberMatch) {
        const indent = activeNumberMatch[1];
        const nextNum = parseInt(activeNumberMatch[2], 10) + 1;
        const prefix = `${indent}${nextNum}. `;

        const beforeCursor = newContent.substring(0, cursorPos);
        const afterCursor = newContent.substring(cursorPos);
        const rawContent = beforeCursor + prefix + afterCursor;
        const updatedContent = renumberContentLists(rawContent);

        return {
          content: updatedContent,
          newCursorPos: cursorPos + prefix.length,
        };
      }

      // 4. Enter on active bullet list item with text (e.g. "- Hello") -> Continue bullet list
      const activeBulletMatch = prevLine.match(/^(\s*)([-*•])\s+(.+)$/);
      if (activeBulletMatch) {
        const indent = activeBulletMatch[1];
        const bulletChar = activeBulletMatch[2];
        const prefix = `${indent}${bulletChar} `;

        const beforeCursor = newContent.substring(0, cursorPos);
        const afterCursor = newContent.substring(cursorPos);
        return {
          content: beforeCursor + prefix + afterCursor,
          newCursorPos: cursorPos + prefix.length,
        };
      }
    }
  }

  // Case B: User pressed Backspace (deleted 1 char)
  if (newContent.length === oldContent.length - 1) {
    const lineStart = oldContent.lastIndexOf('\n', Math.max(0, cursorPos - 1)) + 1;
    const lineEndIndex = oldContent.indexOf('\n', lineStart);
    const lineEnd = lineEndIndex === -1 ? oldContent.length : lineEndIndex;
    const oldLine = oldContent.substring(lineStart, lineEnd);
    
    const isListPrefix = /^(\s*)(\d+\.|[-*•])\s*$/.test(oldLine);
    if (isListPrefix && cursorPos <= lineStart + oldLine.length) {
      const beforeLine = oldContent.substring(0, lineStart);
      const afterLine = oldContent.substring(lineEnd);
      const updatedContent = renumberContentLists(beforeLine + afterLine);
      return {
        content: updatedContent,
        newCursorPos: lineStart,
      };
    }
  }

  // Default: Renumber any numbered list sequences if changed
  const renumbered = renumberContentLists(newContent);
  return {
    content: renumbered,
    newCursorPos: cursorPos,
  };
}
