/**
 * Component that converts URLs in text to clickable links
 */

import React from 'react';
import Link from 'next/link';

interface LinkifyTextProps {
  text: string;
  className?: string;
}

// URL regex pattern that matches http, https, and www URLs
const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;

export function LinkifyText({ text, className = '' }: LinkifyTextProps) {
  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;

        // Check if this part is a URL
        if (part.match(/^https?:\/\//)) {
          // Full URL with protocol
          const isInternalLink = typeof window !== 'undefined' && part.includes(window.location.host);

          if (isInternalLink) {
            // Internal link - use Next.js Link
            const path = part.replace(/^https?:\/\/[^/]+/, '');
            return (
              <Link
                key={index}
                href={path}
                className="text-blue-400 hover:text-blue-300 underline break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </Link>
            );
          } else {
            // External link - use regular anchor
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }
        } else if (part.match(/^www\./)) {
          // URL starting with www (add https://)
          return (
            <a
              key={index}
              href={`https://${part}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        } else {
          // Regular text
          return <span key={index}>{part}</span>;
        }
      })}
    </span>
  );
}
