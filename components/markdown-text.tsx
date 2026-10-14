import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

type InlineSegment = { text: string; bold: boolean };

type MarkdownBlock =
  | { type: 'heading'; segments: InlineSegment[] }
  | { type: 'bullet'; segments: InlineSegment[] }
  | { type: 'paragraph'; segments: InlineSegment[] };

type MarkdownTextProps = {
  content: string;
  /** 应用到所有文本块的基础样式（颜色、字号、行高随样式继承） */
  style?: StyleProp<TextStyle>;
  /** 小标题的覆盖样式 */
  headingStyle?: StyleProp<TextStyle>;
};

/** 解析 **加粗** 行内片段；未闭合的 ** 保持原样输出 */
function parseInlineSegments(line: string): InlineSegment[] {
  const pattern = /\*\*(.+?)\*\*/g;
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), bold: false });
  }
  return segments;
}

/** 支持 AI 输出里实际出现的最小子集：# 标题、- 列表、**加粗**、普通段落 */
function parseBlocks(content: string): MarkdownBlock[] {
  return content
    .split('\n')
    .map((rawLine) => {
      const line = rawLine.trim();
      const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
      if (headingMatch) {
        return { type: 'heading' as const, segments: parseInlineSegments(headingMatch[1]) };
      }
      const bulletMatch = line.match(/^[-*]\s+(.*)$/);
      if (bulletMatch) {
        return { type: 'bullet' as const, segments: parseInlineSegments(bulletMatch[1]) };
      }
      const segments = parseInlineSegments(line);
      // 整行只有一段加粗（如「**整体概览**」）按小标题渲染
      if (segments.length === 1 && segments[0].bold) {
        return { type: 'heading' as const, segments };
      }
      return { type: 'paragraph' as const, segments };
    })
    .filter((block) => block.type !== 'paragraph' || block.segments.length > 0);
}

function renderSegments(segments: InlineSegment[]) {
  return segments.map((segment, index) =>
    segment.bold ? (
      <Text key={index} style={styles.bold}>
        {segment.text}
      </Text>
    ) : (
      segment.text
    ),
  );
}

/** 轻量 markdown 文本渲染：覆盖 AI 分析输出用到的标题/列表/加粗，样式随传入 style 继承 */
export function MarkdownText({ content, style, headingStyle }: MarkdownTextProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);
  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <Text
              key={index}
              style={[index > 0 && styles.headingGap, style, styles.heading, headingStyle]}
            >
              {renderSegments(block.segments)}
            </Text>
          );
        }
        if (block.type === 'bullet') {
          return (
            <Text key={index} style={[styles.blockGap, style]}>
              {'•  '}
              {renderSegments(block.segments)}
            </Text>
          );
        }
        return (
          <Text key={index} style={[styles.blockGap, style]}>
            {renderSegments(block.segments)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontWeight: '700',
  },
  headingGap: {
    marginTop: 10,
  },
  blockGap: {
    marginBottom: 2,
  },
  bold: {
    fontWeight: '700',
  },
});
