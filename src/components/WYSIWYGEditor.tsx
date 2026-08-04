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

  const editor = useEditorBridge({
    initialContent: htmlContent,
    autofocus: false,
    avoidIosKeyboard: true,
    theme: {
      toolbar: {
        toolbarBody: {
          backgroundColor: theme.colors.surface,
        },
      },
    },
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

  useEffect(() => {
    if (onBridgeReady && editor) {
      onBridgeReady(editor);
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
