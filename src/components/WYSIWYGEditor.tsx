import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useEditorBridge, RichText } from '@10play/tentap-editor';
import { Theme } from '../constants/theme';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdownUtils';

interface WYSIWYGEditorProps {
  initialContent: string; // Markdown string
  onChangeMarkdown: (markdown: string) => void;
  theme: Theme;
  onBridgeReady?: (bridge: ReturnType<typeof useEditorBridge>) => void;
}

export function WYSIWYGEditor({ initialContent, onChangeMarkdown, theme, onBridgeReady }: WYSIWYGEditorProps) {
  // Convert initial Markdown to HTML so TipTap parses strong/em/h1-3/ul/ol/blockquote HTML tags natively
  const htmlContent = useMemo(() => markdownToHtml(initialContent), [initialContent]);

  const editorTheme = useMemo(() => ({
    webview: {
      backgroundColor: theme.colors.surface,
    },
    toolbar: {
      toolbarBody: {
        backgroundColor: theme.colors.surface,
      },
    },
  }), [theme.colors.surface]);

  const editor = useEditorBridge({
    initialContent: htmlContent,
    autofocus: false,
    avoidIosKeyboard: true,
    theme: editorTheme,
    onChange: async () => {
      if (editor) {
        try {
          const html = await editor.getHTML();
          const markdown = htmlToMarkdown(html);
          onChangeMarkdown(markdown);
        } catch (e) {
          // fallback if getHTML fails during unmount
        }
      }
    },
  });

  // Inject dynamic CSS whenever theme changes (Dark Mode background fix)
  useEffect(() => {
    if (editor?.injectCSS) {
      const dynamicCss = `
        body, html, .ProseMirror {
          background-color: ${theme.colors.surface} !important;
          color: ${theme.colors.textPrimary} !important;
          caret-color: ${theme.colors.accent} !important;
        }
        .ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror li, .ProseMirror span, .ProseMirror div {
          color: ${theme.colors.textPrimary} !important;
        }
      `;
      editor.injectCSS(dynamicCss, 'app-theme-css');
    }
  }, [editor, theme.colors.surface, theme.colors.textPrimary, theme.colors.accent]);

  // Expose insertTextAtCursor on bridge instance
  useEffect(() => {
    if (editor) {
      (editor as any).insertTextAtCursor = (text: string) => {
        const escapedText = JSON.stringify(text);
        const js = `
          (function() {
            try {
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const node = document.createTextNode(${escapedText});
                range.insertNode(node);
                range.setStartAfter(node);
                range.setEndAfter(node);
                sel.removeAllRanges();
                sel.addRange(range);
              } else {
                const pm = document.querySelector('.ProseMirror');
                if (pm) {
                  const node = document.createTextNode(${escapedText});
                  pm.appendChild(node);
                }
              }
              const pmEl = document.querySelector('.ProseMirror');
              if (pmEl) {
                pmEl.dispatchEvent(new Event('input', { bubbles: true }));
              }
            } catch (e) {
              console.warn('insertText error:', e);
            }
          })();
          true;
        `;
        if (editor.injectJS) {
          editor.injectJS(js);
        }
      };

      if (onBridgeReady) {
        onBridgeReady(editor);
      }
    }
  }, [editor, onBridgeReady]);

  return (
    <View style={styles.container}>
      <RichText editor={editor} style={styles.richText} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 250,
  },
  richText: {
    flex: 1,
  },
});
