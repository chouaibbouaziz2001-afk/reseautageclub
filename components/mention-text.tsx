"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { StorageAvatar } from './storage-avatar';
import { sanitizeText } from '@/lib/sanitize';

interface MentionTextProps {
  content: string;
  mentionedUserIds?: string[];
}

interface UserData {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface UserMapping {
  [fullName: string]: UserData;
}

export function MentionText({ content, mentionedUserIds = [] }: MentionTextProps) {
  const [userMapping, setUserMapping] = useState<UserMapping>({});

  useEffect(() => {
    if (mentionedUserIds.length === 0) {
      return;
    }

    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', mentionedUserIds);

      if (data && !error) {
        const mapping: UserMapping = {};
        data.forEach((user) => {
          // Store with lowercase key for case-insensitive lookup
          const normalizedName = user.full_name.toLowerCase();
          mapping[normalizedName] = {
            id: user.id,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
          };
        });
        setUserMapping(mapping);
      }
    };

    fetchUsers();
  }, [mentionedUserIds]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderContentWithLinks = (text: string): (string | JSX.Element)[] => {
    const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
    const parts: (string | JSX.Element)[] = [];
    const urlParts = text.split(URL_REGEX);
    let keyIndex = 0;

    urlParts.forEach((part) => {
      if (!part) return;

      if (part.match(/^https?:\/\//)) {
        const isInternalLink = typeof window !== 'undefined' && part.includes(window.location.host);

        if (isInternalLink) {
          const path = part.replace(/^https?:\/\/[^/]+/, '');
          parts.push(
            <Link
              key={`url-${keyIndex++}`}
              href={path}
              className="text-blue-400 hover:text-blue-300 underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        } else {
          parts.push(
            <a
              key={`url-${keyIndex++}`}
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
        parts.push(
          <a
            key={`url-${keyIndex++}`}
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
        parts.push(part);
      }
    });

    return parts;
  };

  const renderContentWithMentions = () => {
    // Sanitize content first to prevent XSS
    const safeContent = sanitizeText(content);

    const mentionRegex = /@([a-zA-Z0-9_.\-]+(?:\s+[a-zA-Z0-9_.\-]+)*)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(safeContent)) !== null) {
      const fullMatch = match[0];
      const userName = match[1].trim();
      // Normalize the name for case-insensitive lookup
      const normalizedUserName = userName.toLowerCase();
      const userData = userMapping[normalizedUserName];

      if (lastIndex < match.index) {
        const textBefore = safeContent.slice(lastIndex, match.index);
        parts.push(...renderContentWithLinks(textBefore));
      }

      if (userData) {
        parts.push(
          <Link
            key={`mention-${match.index}-${userData.id}`}
            href={`/profile/${userData.id}`}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-900 to-stone-900 hover:from-gray-800 hover:to-stone-800 border border-amber-500/30 rounded-full px-3 py-1.5 my-1 transition-all hover:shadow-lg hover:shadow-amber-500/20"
          >
            <StorageAvatar
              src={userData.avatar_url}
              alt={userData.full_name}
              fallback={getInitials(userData.full_name)}
              className="h-8 w-8 border border-amber-500/30"
            />
            <span className="text-gray-100 font-medium capitalize">{userData.full_name}</span>
          </Link>
        );
      } else {
        parts.push(...renderContentWithLinks(fullMatch));
      }

      lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < safeContent.length) {
      const textAfter = safeContent.slice(lastIndex);
      parts.push(...renderContentWithLinks(textAfter));
    }

    return parts.length > 0 ? parts : safeContent;
  };

  return <div className="whitespace-pre-wrap break-words">{renderContentWithMentions()}</div>;
}
