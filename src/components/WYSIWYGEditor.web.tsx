import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Theme } from '../constants/theme';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdownUtils';

interface WYSIWYGEditorProps {
  initialContent: string; // Markdown string
  onChangeMarkdown: (markdown: string) => void;
  theme: Theme;
  onBridgeReady?: (bridge: any) => void;
}

export function WYSIWYGEditor({ initialContent, onChangeMarkdown, theme, onBridgeReady }: WYSIWYGEditorProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Expose bridge interface for toolbar compatibility on web
  const bridge = useRef({
    toggleBold: () => {
      document.execCommand('bold', false);
      handleInput();
    },
    toggleItalic: () => {
      document.execCommand('italic', false);
      handleInput();
    },
    toggleHeading: (level: number = 2) => {
      document.execCommand('formatBlock', false, `<h${level}>`);
      handleInput();
    },
    toggleBulletList: () => {
      document.execCommand('insertUnorderedList', false);
      handleInput();
    },
    toggleOrderedList: () => {
      document.execCommand('insertOrderedList', false);
      handleInput();
    },
    insertContent: (str: string) => {
      document.execCommand('insertText', false, str);
      handleInput();
    },
    getHTML: async () => {
      return contentRef.current?.innerHTML || '';
    },
  });

  useEffect(() => {
    if (onBridgeReady) {
      onBridgeReady(bridge.current);
    }
  }, [onBridgeReady]);

  // Set initial content HTML on mount
  useEffect(() => {
    if (contentRef.current && !isInternalChange.current) {
      const html = markdownToHtml(initialContent);
      contentRef.current.innerHTML = html;
    }
  }, [initialContent]);

  const handleInput = () => {
    if (contentRef.current) {
      isInternalChange.current = true;
      const html = contentRef.current.innerHTML;
      const markdown = htmlToMarkdown(html);
      onChangeMarkdown(markdown);
      setTimeout(() => {
        isInternalChange.current = false;
      }, 50);
    }
  };

  return (
    <View style={styles.container}>
      <div
        ref={contentRef}
        contentEditable
        onInput={handleInput}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          minHeight: '250px',
          outline: 'none',
          color: theme.colors.textPrimary,
          fontSize: '16px',
          fontFamily: theme.typography.fontFamily.regular,
          lineHeight: '1.6',
          backgroundColor: 'transparent',
          overflowY: 'auto',
          wordBreak: 'break-word',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 250,
  },
});
