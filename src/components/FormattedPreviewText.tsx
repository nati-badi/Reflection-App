import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { parseFormattedPreview } from '../utils/markdownUtils';
import { useAppTheme } from '../hooks/useAppTheme';

interface FormattedPreviewTextProps {
  markdown: string;
  maxLength?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export const FormattedPreviewText: React.FC<FormattedPreviewTextProps> = ({
  markdown,
  maxLength = 65,
  style,
  numberOfLines = 2,
}) => {
  const { theme } = useAppTheme();
  const segments = parseFormattedPreview(markdown, maxLength);

  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <Text style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
      {segments.map((seg, idx) => (
        <Text
          key={idx}
          style={[
            seg.isBold && { fontFamily: theme.typography.fontFamily.bold },
            seg.isItalic && { fontStyle: 'italic' },
          ]}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
};
