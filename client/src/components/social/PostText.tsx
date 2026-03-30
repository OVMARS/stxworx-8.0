import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocialPostsPagePath, getUserProfilePath } from '../../lib/api';

const TOKEN_REGEX = /(@[a-zA-Z0-9_]{3,30}|#[a-zA-Z0-9_]+)/g;

type PostTextProps = {
  content?: string | null;
  className?: string;
};

export const PostText = ({ content, className = '' }: PostTextProps) => {
  const navigate = useNavigate();
  const text = content || '';

  if (!text.trim()) {
    return null;
  }

  const segments: Array<{ type: 'text' | 'mention' | 'hashtag'; value: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_REGEX)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    segments.push({
      type: token.startsWith('@') ? 'mention' : 'hashtag',
      value: token,
    });
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return (
    <div className={`whitespace-pre-wrap break-words text-inherit ${className}`.trim()}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <React.Fragment key={`${segment.type}-${index}`}>{segment.value}</React.Fragment>;
        }

        if (segment.type === 'mention') {
          const username = segment.value.slice(1).toLowerCase();

          return (
            <button
              key={`${segment.type}-${index}`}
              type="button"
              onClick={() => navigate(getUserProfilePath({ username }))}
              className="inline bg-transparent p-0 font-bold text-accent-blue transition-colors hover:text-accent-orange"
            >
              {segment.value}
            </button>
          );
        }

        const tag = segment.value.slice(1).toLowerCase();

        return (
          <button
            key={`${segment.type}-${index}`}
            type="button"
            onClick={() => navigate(getSocialPostsPagePath({ tag }))}
            className="inline bg-transparent p-0 font-bold text-accent-orange transition-colors hover:text-accent-blue"
          >
            {segment.value}
          </button>
        );
      })}
    </div>
  );
};
