import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Edit2, Heart, MessageCircle, MoreHorizontal, Share2, Trash2 } from 'lucide-react';
import * as Shared from '../shared';
import {
  createSocialPostComment,
  deleteSocialPost,
  formatRelativeTime,
  getSocialPost,
  getSocialPostComments,
  getSocialPostShareUrl,
  getUserProfilePath,
  toggleSocialPostLike,
  toApiAssetUrl,
  toDisplayName,
  updateSocialPost,
  type ApiSocialComment,
  type ApiSocialPost,
} from '../lib/api';

export const PostPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isSignedIn, walletAddress } = Shared.useWallet();
  const [post, setPost] = useState<ApiSocialPost | null>(null);
  const [comments, setComments] = useState<ApiSocialComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editingPostContent, setEditingPostContent] = useState('');
  const [postAction, setPostAction] = useState<'edit' | 'delete' | null>(null);

  const postPermalink = id?.trim() || '';
  const isValidPostRoute = Boolean(postPermalink);
  const canInteract = isSignedIn && Boolean(walletAddress);

  useEffect(() => {
    let isMounted = true;

    if (!isValidPostRoute) {
      setPost(null);
      setComments([]);
      setLoading(false);
      return;
    }

    const loadPostData = async () => {
      setLoading(true);

      try {
        const [postResponse, commentsResponse] = await Promise.all([
          getSocialPost(postPermalink),
          getSocialPostComments(postPermalink),
        ]);

        if (!isMounted) {
          return;
        }

        setPost(postResponse);
        setComments(commentsResponse);
      } catch (error) {
        console.error('Failed to load post:', error);
        if (isMounted) {
          setPost(null);
          setComments([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPostData();

    return () => {
      isMounted = false;
    };
  }, [isValidPostRoute, postPermalink]);

  const handleToggleLike = async () => {
    if (!post || !canInteract || togglingLike) {
      return;
    }

    setTogglingLike(true);

    try {
      const response = await toggleSocialPostLike(post.id);
      setPost((current) =>
        current
          ? {
              ...current,
              likesCount: response.likesCount,
              likedByViewer: response.likedByViewer,
            }
          : current,
      );
    } catch (error) {
      console.error('Failed to toggle post like:', error);
    } finally {
      setTogglingLike(false);
    }
  };

  const handlePostComment = async () => {
    const content = newComment.trim();
    if (!post || !content || !canInteract || submittingComment) {
      return;
    }

    setSubmittingComment(true);

    try {
      const created = await createSocialPostComment(post.id, { content });
      setComments((current) => [created, ...current]);
      setPost((current) =>
        current
          ? {
              ...current,
              commentsCount: current.commentsCount + 1,
            }
          : current,
      );
      setNewComment('');
    } catch (error) {
      console.error('Failed to create comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCopyPostLink = async () => {
    if (!post) {
      return;
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard is not available in this browser.');
      }

      await navigator.clipboard.writeText(getSocialPostShareUrl(post.id));
    } catch (error) {
      console.error('Failed to copy post link:', error);
    }
  };

  const handleStartEditPost = () => {
    if (!post) {
      return;
    }

    setPostMenuOpen(false);
    setIsEditingPost(true);
    setEditingPostContent(post.content || '');
  };

  const handleCancelEditPost = () => {
    setPostMenuOpen(false);
    setIsEditingPost(false);
    setEditingPostContent('');
  };

  const handleSavePost = async () => {
    if (!post || postAction !== null) {
      return;
    }

    setPostAction('edit');
    setPostMenuOpen(false);

    try {
      const updated = await updateSocialPost(post.id, { content: editingPostContent });
      setPost(updated);
      setIsEditingPost(false);
      setEditingPostContent('');
    } catch (error) {
      console.error('Failed to update post:', error);
    } finally {
      setPostAction(null);
    }
  };

  const handleDeletePost = async () => {
    if (!post || postAction !== null || !window.confirm('Delete this post?')) {
      return;
    }

    setPostAction('delete');
    setPostMenuOpen(false);

    try {
      await deleteSocialPost(post.id);
      navigate('/profile');
    } catch (error) {
      console.error('Failed to delete post:', error);
    } finally {
      setPostAction(null);
    }
  };

  if (loading) {
    return (
      <div className="pt-28 pb-20 px-6 md:pl-[92px]">
        <div className="container-custom max-w-3xl">
          <div className="card p-6 text-sm text-muted">Loading post...</div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="pt-28 pb-20 px-6 md:pl-[92px]">
        <div className="container-custom max-w-3xl">
          <div className="flex items-center gap-4 mb-8">
            <Link to="/" className="w-10 h-10 bg-surface border border-border rounded-[10px] flex items-center justify-center text-muted hover:text-ink hover:border-ink transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-2xl font-black tracking-tighter">Post</h1>
          </div>
          <div className="card p-6 text-sm text-muted">This post could not be found.</div>
        </div>
      </div>
    );
  }

  const authorName = toDisplayName({ name: post.authorName, username: post.authorUsername, stxAddress: post.authorStxAddress });
  const avatarUrl = toApiAssetUrl(post.authorAvatar);
  const imageUrl = toApiAssetUrl(post.imageUrl);
  const authorProfilePath = getUserProfilePath({ username: post.authorUsername, stxAddress: post.authorStxAddress });
  const isOwnPost = Boolean(walletAddress && post.authorStxAddress && walletAddress.toLowerCase() === post.authorStxAddress.toLowerCase());

  return (
    <div className="pt-28 pb-20 px-6 md:pl-[92px]">
      <div className="container-custom max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="w-10 h-10 bg-surface border border-border rounded-[10px] flex items-center justify-center text-muted hover:text-ink hover:border-ink transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black tracking-tighter">Post</h1>
        </div>

        <div className="card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-12 h-12 rounded-[10px] object-cover" alt={authorName} referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-[10px] bg-surface border border-border flex items-center justify-center text-xs font-black uppercase">
                  {authorName.slice(0, 2)}
                </div>
              )}
              <div>
                <Link to={authorProfilePath} className="font-bold text-base hover:text-accent-orange transition-colors">{authorName}</Link>
                <p className="text-xs text-muted">{formatRelativeTime(post.createdAt)}</p>
              </div>
            </div>
            {isOwnPost ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPostMenuOpen((current) => !current)}
                  disabled={postAction !== null}
                  className="text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MoreHorizontal size={20} />
                </button>
                {postMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-36 overflow-hidden rounded-[15px] border border-border bg-surface shadow-xl">
                    <button type="button" onClick={handleStartEditPost} className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-bold text-muted transition-colors hover:bg-ink/5 hover:text-ink">
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button type="button" onClick={handleDeletePost} className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-bold text-muted transition-colors hover:bg-ink/5 hover:text-accent-red">
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {isEditingPost ? (
            <div className="mb-6 space-y-3">
              <textarea
                value={editingPostContent}
                onChange={(event) => setEditingPostContent(event.target.value)}
                rows={5}
                className="w-full rounded-[15px] border border-border bg-ink/5 px-4 py-3 text-sm outline-none focus:border-accent-orange"
                placeholder={post.imageUrl ? 'Add a caption for your post' : 'Update your post'}
              />
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={handleCancelEditPost} className="px-4 py-2 text-xs font-bold text-muted hover:text-ink transition-colors">Cancel</button>
                <button
                  type="button"
                  onClick={handleSavePost}
                  disabled={postAction === 'edit'}
                  className="btn-primary py-2 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            post.content ? <p className="text-base mb-6 leading-relaxed">{post.content}</p> : null
          )}
          {imageUrl && (
            <img src={imageUrl} className="w-full rounded-[15px] mb-6 object-cover max-h-96" alt="Post content" referrerPolicy="no-referrer" />
          )}
          <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-muted border-t border-border pt-4">
            <button
              onClick={handleToggleLike}
              disabled={!canInteract || togglingLike}
              className={`flex items-center gap-2 text-sm font-bold transition-colors ${post.likedByViewer ? 'text-accent-red' : 'hover:text-accent-red'} ${canInteract ? '' : 'cursor-not-allowed opacity-60'}`}
            >
              <Heart size={20} /> {post.likesCount}
            </button>
            <div className="flex items-center gap-2 text-sm font-bold text-accent-blue">
              <MessageCircle size={20} /> {post.commentsCount}
            </div>
            <button type="button" onClick={handleCopyPostLink} className="flex items-center gap-2 text-sm font-bold hover:text-accent-orange transition-colors">
              <Share2 size={20} /> Share
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-black text-lg mb-6">Comments ({post.commentsCount})</h3>

          {canInteract ? (
            <div className="flex gap-3 sm:gap-4 items-start mb-8">
              <div className="w-10 h-10 rounded-[10px] bg-surface border border-border flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                {(walletAddress || 'YO').slice(0, 2)}
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Write a comment..."
                  className="w-full bg-ink/5 border border-border rounded-[15px] p-4 text-sm focus:ring-1 focus:ring-accent-orange outline-none resize-none h-24 mb-3"
                />
                <div className="flex justify-end">
                  <button onClick={handlePostComment} disabled={submittingComment || !newComment.trim()} className="btn-primary py-2 px-6 w-full sm:w-auto justify-center disabled:opacity-60">
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 text-sm text-muted">Sign in to join the conversation on this post.</div>
          )}

          <div className="space-y-6">
            {comments.map((comment) => {
              const commentAuthorName = toDisplayName({ name: comment.authorName, username: comment.authorUsername, stxAddress: comment.authorStxAddress });
              const commentAvatarUrl = toApiAssetUrl(comment.authorAvatar);
              const commentAuthorProfilePath = getUserProfilePath({ username: comment.authorUsername, stxAddress: comment.authorStxAddress });

              return (
                <div key={comment.id} className="flex gap-3 sm:gap-4">
                  {commentAvatarUrl ? (
                    <img src={commentAvatarUrl} className="w-10 h-10 rounded-[10px] object-cover shrink-0" alt={commentAuthorName} referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-[10px] bg-surface border border-border flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                      {commentAuthorName.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 bg-ink/5 rounded-[15px] p-4 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1 sm:gap-4">
                      <Link to={commentAuthorProfilePath} className="font-bold text-sm hover:text-accent-orange transition-colors">{commentAuthorName}</Link>
                      <span className="text-xs text-muted shrink-0">{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                </div>
              );
            })}
            {comments.length === 0 && (
              <div className="text-sm text-muted">No comments yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
