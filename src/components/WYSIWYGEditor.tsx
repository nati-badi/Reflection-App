import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useEditorBridge, RichText, editorHtml } from '@10play/tentap-editor';
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

  const [isReady, setIsReady] = useState(false);

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

  // Construct source-level HTML with dark/light theme baked directly into <head> before initial paint
  const customSource = useMemo(() => {
    const headStyle = `<style id="app-initial-theme">
      body, html, .ProseMirror, #root, div[contenteditable] {
        background-color: ${theme.colors.surface} !important;
        color: ${theme.colors.textPrimary} !important;
        caret-color: ${theme.colors.accent} !important;
      }
      .ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror li, .ProseMirror span, .ProseMirror div, .ProseMirror blockquote {
        color: ${theme.colors.textPrimary} !important;
        background-color: transparent !important;
      }
      .ProseMirror-focused {
        outline: none !important;
      }
      img[src*="palette"], svg[class*="droplet"], .highlight-background {
        display: none !important;
      }
    </style></head>`;

    return editorHtml.replace('</head>', headStyle);
  }, [theme.colors.surface, theme.colors.textPrimary, theme.colors.accent]);

  const editor = useEditorBridge({
    initialContent: htmlContent,
    autofocus: false,
    avoidIosKeyboard: true,
    disableColorHighlight: true,
    customSource,
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

  const applyThemeCSS = (bridge: ReturnType<typeof useEditorBridge>) => {
    if (!bridge?.injectCSS) return;
    console.log(`[WYSIWYGEditor] Injecting theme CSS into WebView. isDark: ${theme.dark}, surface: ${theme.colors.surface}`);
    const dynamicCss = `
      body, html, .ProseMirror, #root, div[contenteditable] {
        background-color: ${theme.colors.surface} !important;
        color: ${theme.colors.textPrimary} !important;
        caret-color: ${theme.colors.accent} !important;
      }
      .ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror li, .ProseMirror span, .ProseMirror div, .ProseMirror blockquote {
        color: ${theme.colors.textPrimary} !important;
        background-color: transparent !important;
      }
      .ProseMirror-focused {
        outline: none !important;
      }
      img[src*="palette"], svg[class*="droplet"], .highlight-background {
        display: none !important;
      }
    `;
    bridge.injectCSS(dynamicCss, 'app-theme-css');
    console.log('[WYSIWYGEditor] injectCSS executed successfully');
  };

  // Inject dynamic CSS deterministically when ready and whenever theme changes
  useEffect(() => {
    if (!editor) return;

    applyThemeCSS(editor);

    const unsub = editor._subscribeToEditorStateUpdate((state) => {
      if (state.isReady) {
        setIsReady(true);
        applyThemeCSS(editor);
      }
    });

    const t1 = setTimeout(() => {
      setIsReady(true);
      applyThemeCSS(editor);
    }, 150);

    return () => {
      unsub();
      clearTimeout(t1);
    };
  }, [editor, theme.colors.surface, theme.colors.textPrimary, theme.colors.accent, theme.dark]);

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
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <RichText editor={editor} style={styles.richText} />
      {!isReady && (
        <View 
          style={[
            StyleSheet.absoluteFillObject, 
            { backgroundColor: theme.colors.surface, borderRadius: 12 }
          ]} 
        />
      )}
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
