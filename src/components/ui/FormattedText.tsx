import React from 'react';

/**
 * Renders text with simple markdown-like formatting:
 * **bold**, _italic_, __underline__, ~~strikethrough~~
 */
export const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  if (!text) return null;

  let key = 0;

  // Simple approach: apply patterns sequentially
  // Split by bold first, then process remaining
  const processText = (input: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    // Combined regex for all patterns
    const combined = /(\*\*(.+?)\*\*)|(~~(.+?)~~)|(__(.+?)__)|(_(.+?)_)/g;
    let match: RegExpExecArray | null;

    while ((match = combined.exec(input)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(input.substring(lastIndex, match.index));
      }

      key++;
      if (match[2]) {
        // **bold**
        result.push(<strong key={key}>{match[2]}</strong>);
      } else if (match[4]) {
        // ~~strikethrough~~
        result.push(<span key={key} className="line-through">{match[4]}</span>);
      } else if (match[6]) {
        // __underline__
        result.push(<span key={key} className="underline">{match[6]}</span>);
      } else if (match[8]) {
        // _italic_
        result.push(<em key={key}>{match[8]}</em>);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < input.length) {
      result.push(input.substring(lastIndex));
    }

    return result.length > 0 ? result : [input];
  };

  const rendered = processText(text);

  return <span className={className}>{rendered}</span>;
};

export default FormattedText;
