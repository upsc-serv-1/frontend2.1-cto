import React from 'react';
import { Text } from 'react-native';

// Regex for Years: 
// 1. BC/AD/BCE/CE patterns (1-4 digits)
// 2. Standalone 3-4 digit numbers NOT followed by units (to avoid "100 questions")
// 3. MYA (Million Years Ago)
const YEAR_PATTERN = '(?:\\d{1,4}\\s*(?:BC|BCE|AD|CE)|\\d{3,4}(?!\\s*(?:questions?|marks?|items?|kg|km|m|cm|%|percent|min|sec|hours?|days?|weeks?|months?))|\\d+(?:\\.\\d+)?\\s*(?:mya|million years ago))';

// Case-insensitive regex for finding all matches in a string
const YEAR_REGEX = new RegExp(`\\b${YEAR_PATTERN}\\b`, 'gi');

// Case-insensitive regex for checking if a split part is exactly a year pattern
const STANDALONE_YEAR_REGEX = new RegExp(`^${YEAR_PATTERN}$`, 'i');

/**
 * Renders text with "Smart Detection" for years and optional search query highlighting.
 * Automatically identifies years (3-4 digits, BC/AD, MYA) and applies a heavier font weight.
 */
export const renderSmartText = (
  text: string, 
  colors: any, 
  query?: string, 
  baseStyle?: any
) => {
  if (!text) return null;

  // 2. Combine with Search Query if provided
  let combinedRegex: RegExp;
  if (query && query.trim()) {
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Combine both into a single capturing group for splitting
    combinedRegex = new RegExp(`(${escapedQuery}|\\b${YEAR_PATTERN}\\b)`, 'gi');
  } else {
    combinedRegex = new RegExp(`(\\b${YEAR_PATTERN}\\b)`, 'gi');
  }

  const parts = text.split(combinedRegex);
  const queryLower = query?.trim().toLowerCase();

  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        if (!part) return null;
        
        const partLower = part.toLowerCase();
        
        // Match Search Query (Highest priority)
        if (queryLower && partLower === queryLower) {
          return (
            <Text key={i} style={{ fontWeight: '900', color: colors.primaryDark || colors.primary }}>
              {part}
            </Text>
          );
        }
        
        // Match Year/MYA
        if (STANDALONE_YEAR_REGEX.test(part)) {
          return (
            <Text key={i} style={{ fontWeight: '800', color: colors.textPrimary }}>
              {part}
            </Text>
          );
        }
        
        // Normal text
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
};

/**
 * Pre-processes markdown text to bold years so they stand out when rendered by a Markdown component.
 */
export const boldYearsMarkdown = (text: string) => {
  if (!text) return "";
  // Avoid double-bolding if already surrounded by ** or __
  return text.replace(YEAR_REGEX, (match, offset, fullText) => {
    const before = fullText.slice(Math.max(0, offset - 2), offset);
    const after = fullText.slice(offset + match.length, offset + match.length + 2);
    if ((before === '**' && after === '**') || (before === '__' && after === '__')) {
      return match;
    }
    return `**${match}**`;
  });
};
