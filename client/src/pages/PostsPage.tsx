import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Eye, Heart, MessageCircle, Search } from 'lucide-react';
import {
  formatRelativeTime,
  getSocialPostPath,
  getSocialPostsDirectory,
  getUserProfilePath,
  toApiAssetUrl,
  toDisplayName,
  type ApiSocialPost,
  type SocialPostRangeOption,
  type SocialPostSortOption,
} from '../lib/api';
import { PostText } from '../components/social/PostText';

const SORT_OPTIONS: Array<{ value: SocialPostSortOption; label: string }> = [
  { value: 'recent', label: 'Recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'likes', label: 'Most liked' },
  { value: 'views', label: 'Most viewed' },
];

const RANGE_OPTIONS: Array<{ value: SocialPostRangeOption; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

export const PostsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<ApiSocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const query = searchParams.get('query')?.trim() || '';
  const tag = searchParams.get('tag')?.trim() || '';
  const sort = (searchParams.get('sort') as SocialPostSortOption | null) || 'recent';
  const range = (searchParams.get('range') as SocialPostRangeOption | null) || 'all';
  const [searchDraft, setSearchDraft] = useState(query || (tag ? `#${tag}` : ''));

  useEffect(() => {
    setSearchDraft(query || (tag ? `#${tag}` : ''));
  }, [query, tag]);

  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const response = await getSocialPostsDirectory({
          query: query || undefined,
          tag: tag || undefined,
          sort,
          range,
          limit: 100,
        });

        if (!isMounted) {
          return;
        }

        setPosts(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load posts directory:', error);
        setPosts([]);
        setLoadError(error instanceof Error ? error.message : 'Failed to load posts.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, [query, range, sort, tag]);

  const resultsTitle = useMemo(() => {
    if (tag) {
      return `#${tag}`;
    }

    if (query) {
      return `Results for “${query}”`;
    }

    return 'All posts';
  }, [query, tag]);

  const updateFilters = (next: { query?: string; tag?: string; sort?: SocialPostSortOption; range?: SocialPostRangeOption }) => {
    const params = new URLSearchParams(searchParams);

    const nextQuery = next.query ?? query;
    const nextTag = next.tag ?? tag;
    const nextSort = next.sort ?? sort;
    const nextRange = next.range ?? range;

    if (nextQuery) {
      params.set('query', nextQuery);
    } else {
      params.delete('query');
    }

    if (nextTag) {
      params.set('tag', nextTag);
    } else {
      params.delete('tag');
    }

    if (nextSort && nextSort !== 'recent') {
      params.set('sort', nextSort);
    } else {
      params.delete('sort');
    }

    if (nextRange && nextRange !== 'all') {
      params.set('range', nextRange);
    } else {
      params.delete('range');
    }

    setSearchParams(params);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = searchDraft.trim();

    if (!trimmed) {
      updateFilters({ query: '', tag: '' });
      return;
    }

    if (trimmed.startsWith('#')) {
      updateFilters({ query: '', tag: trimmed.replace(/^#+/, '').toLowerCase() });
      return;
    }

    updateFilters({ query: trimmed, tag: '' });
  };

  return (
    <div className="pt-28 pb-20 px-6 md:pl-[92px]">
      <div className="container-custom max-w-5xl space-y-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="w-10 h-10 bg-surface border border-border rounded-[10px] flex items-center justify-center text-muted hover:text-ink hover:border-ink transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Posts</h1>
            <p className="text-sm text-muted">Search, filter, and explore the community timeline.</p>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search posts, authors, or #hashtags"
                className="w-full rounded-[15px] border border-border bg-ink/5 py-3 pl-11 pr-4 text-sm outline-none focus:border-accent-orange"
              />
            </div>
            <button type="submit" className="btn-primary py-3 px-5 text-sm justify-center">Search</button>
          </form>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted">Showing</p>
              <h2 className="text-xl font-black">{resultsTitle}</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={sort}
                onChange={(event) => updateFilters({ sort: event.target.value as SocialPostSortOption })}
                className="rounded-[15px] border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent-orange"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={range}
                onChange={(event) => updateFilters({ range: event.target.value as SocialPostRangeOption })}
                className="rounded-[15px] border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent-orange"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loadError ? <div className="card p-6 text-sm text-accent-red">{loadError}</div> : null}

        {loading ? (
          <div className="card p-6 text-sm text-muted">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="card p-6 text-sm text-muted">No posts matched your current filters.</div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const authorName = toDisplayName({ name: post.authorName, username: post.authorUsername, stxAddress: post.authorStxAddress });
              const authorProfilePath = getUserProfilePath({ username: post.authorUsername, stxAddress: post.authorStxAddress });
              const postPath = getSocialPostPath(post.id);
              const avatarUrl = toApiAssetUrl(post.authorAvatar);
              const imageUrl = toApiAssetUrl(post.imageUrl);

              return (
                <article key={post.id} className="card p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} className="w-11 h-11 rounded-[12px] object-cover" alt={authorName} referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-11 h-11 rounded-[12px] bg-surface border border-border flex items-center justify-center text-xs font-black uppercase shrink-0">
                          {authorName.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link to={authorProfilePath} className="block truncate text-sm font-bold hover:text-accent-orange transition-colors">{authorName}</Link>
                        <p className="text-xs text-muted">{formatRelativeTime(post.createdAt)}</p>
                      </div>
                    </div>
                    <Link to={postPath} className="text-xs font-bold text-accent-orange hover:underline shrink-0">Open</Link>
                  </div>

                  <PostText content={post.content} className="text-sm leading-7 text-ink/90" />

                  {imageUrl ? (
                    <Link to={postPath} className="block">
                      <img src={imageUrl} className="w-full rounded-[18px] object-cover max-h-96" alt="Post content" referrerPolicy="no-referrer" />
                    </Link>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs font-bold text-muted">
                    <span className="inline-flex items-center gap-2"><Heart size={15} /> {post.likesCount}</span>
                    <span className="inline-flex items-center gap-2"><MessageCircle size={15} /> {post.commentsCount}</span>
                    <span className="inline-flex items-center gap-2"><Eye size={15} /> {post.viewsCount}</span>
                    <Link to={postPath} className="inline-flex items-center gap-2 ml-auto hover:text-accent-orange transition-colors">
                      <ArrowRight size={15} /> Open post
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
