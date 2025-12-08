"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { commentsApi } from "@/lib/api-client";
import { MessageSquare, Send, Reply, MoreVertical, Edit2, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  wager_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

interface WagerCommentsProps {
  wagerId: string;
}

export function WagerComments({ wagerId }: WagerCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const response = await commentsApi.list(wagerId);
      
      // API client returns { comments: [...] } directly
      const commentsData = response.comments || [];

      setComments(commentsData);
    } catch (error) {
      console.error("Error fetching comments:", error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [wagerId]);

  useEffect(() => {
    fetchComments();

    // Poll for updates every 30 seconds (replaces real-time subscriptions)
    const pollInterval = setInterval(() => {
      fetchComments();
    }, 30000);

    // Listen for custom comment update events
    const handleCommentUpdate = () => {
      fetchComments();
    };
    window.addEventListener('wager-comment-updated', handleCommentUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('wager-comment-updated', handleCommentUpdate);
    };
  }, [wagerId, fetchComments]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmitComment = async () => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to comment.",
        variant: "destructive",
      });
      return;
    }

    const trimmedContent = newComment.trim();
    if (!trimmedContent) {
      toast({
        title: "Comment cannot be empty",
        description: "Please enter a comment.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await commentsApi.create(wagerId, {
        content: trimmedContent,
      });

      setNewComment("");
      // Dispatch event to update comments
      window.dispatchEvent(new CustomEvent('wager-comment-updated'));
      await fetchComments();
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to post comment. Please try again.";
      toast({
        title: "Failed to post comment",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to reply.",
        variant: "destructive",
      });
      return;
    }

    const content = replyContent[parentId]?.trim();
    if (!content) {
      toast({
        title: "Reply cannot be empty",
        description: "Please enter a reply.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await commentsApi.create(wagerId, {
        content: content,
        parent_id: parentId,
      });

      setReplyContent({ ...replyContent, [parentId]: "" });
      setReplyingTo(null);
      // Dispatch event to update comments
      window.dispatchEvent(new CustomEvent('wager-comment-updated'));
      await fetchComments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to post reply. Please try again.";
      toast({
        title: "Failed to post reply",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    const content = editContent[commentId]?.trim();
    if (!content) {
      toast({
        title: "Comment cannot be empty",
        description: "Please enter a comment.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await commentsApi.update(wagerId, commentId, {
        content: content,
      });

      setEditingId(null);
      setEditContent({ ...editContent, [commentId]: "" });
      // Dispatch event to update comments
      window.dispatchEvent(new CustomEvent('wager-comment-updated'));
      await fetchComments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update comment. Please try again.";
      toast({
        title: "Failed to update comment",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    setDeletingId(commentId);
    try {
      await commentsApi.delete(wagerId, commentId);
      // Dispatch event to update comments
      window.dispatchEvent(new CustomEvent('wager-comment-updated'));
      await fetchComments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete comment. Please try again.";
      toast({
        title: "Failed to delete comment",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      {user ? (
        <div className="bg-card border border-border rounded-lg p-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmitComment();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Press Cmd/Ctrl + Enter to post</p>
            <button
              onClick={handleSubmitComment}
              disabled={submitting || !newComment.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition active:scale-95 touch-manipulation text-sm font-medium min-h-[44px]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Post
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Please log in to comment</p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="bg-card border border-border rounded-lg p-3">
              {/* Comment Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {comment.profiles?.avatar_url ? (
                      <img
                        src={comment.profiles.avatar_url}
                        alt={comment.profiles.username || "User"}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-primary">
                        {(comment.profiles?.username || "U")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {comment.profiles?.username || "Anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                {user?.id === comment.user_id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditContent({ ...editContent, [comment.id]: comment.content });
                      }}
                      className="p-1.5 hover:bg-muted rounded transition active:scale-95 touch-manipulation"
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="p-1.5 hover:bg-muted rounded transition active:scale-95 touch-manipulation"
                      title="Delete"
                    >
                      {deletingId === comment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Comment Content */}
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent[comment.id] || comment.content}
                    onChange={(e) =>
                      setEditContent({ ...editContent, [comment.id]: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(comment.id)}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditContent({ ...editContent, [comment.id]: "" });
                      }}
                      className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground mb-2 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              )}

              {/* Reply Button */}
              {!editingId && user && (
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
                >
                  <Reply className="h-3.5 w-3.5" />
                  {replyingTo === comment.id ? "Cancel" : "Reply"}
                </button>
              )}

              {/* Reply Input */}
              {replyingTo === comment.id && user && (
                <div className="mt-2 pl-4 border-l-2 border-primary/20">
                  <textarea
                    value={replyContent[comment.id] || ""}
                    onChange={(e) =>
                      setReplyContent({ ...replyContent, [comment.id]: e.target.value })
                    }
                    placeholder="Write a reply..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-2"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReply(comment.id)}
                      disabled={submitting || !replyContent[comment.id]?.trim()}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition text-sm font-medium"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyContent({ ...replyContent, [comment.id]: "" });
                      }}
                      className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 space-y-2 pl-4 border-l-2 border-muted">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="bg-muted/30 rounded-lg p-2">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {reply.profiles?.avatar_url ? (
                              <img
                                src={reply.profiles.avatar_url}
                                alt={reply.profiles.username || "User"}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-primary">
                                {(reply.profiles?.username || "U")[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {reply.profiles?.username || "Anonymous"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        {user?.id === reply.user_id && (
                          <button
                            onClick={() => handleDelete(reply.id)}
                            disabled={deletingId === reply.id}
                            className="p-1 hover:bg-muted rounded transition active:scale-95 touch-manipulation"
                            title="Delete"
                          >
                            {deletingId === reply.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap break-words">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>
    </div>
  );
}

