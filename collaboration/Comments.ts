export type CommentStatus = 'open' | 'resolved';

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  fileRef?: string;
  lineRef?: number;
  parentId?: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export class Comments {
  private readonly comments = new Map<string, Comment>();

  add(
    authorId: string,
    content: string,
    options: { fileRef?: string; lineRef?: number; parentId?: string } = {},
  ): Comment {
    const now = new Date().toISOString();
    const comment: Comment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      authorId, content, status: 'open',
      createdAt: now, updatedAt: now,
      ...options,
    };
    this.comments.set(comment.id, comment);
    return { ...comment };
  }

  resolve(id: string): Comment {
    const c = this.require(id);
    c.status = 'resolved';
    c.updatedAt = new Date().toISOString();
    return { ...c };
  }

  reopen(id: string): Comment {
    const c = this.require(id);
    c.status = 'open';
    c.updatedAt = new Date().toISOString();
    return { ...c };
  }

  edit(id: string, content: string): Comment {
    const c = this.require(id);
    c.content = content;
    c.updatedAt = new Date().toISOString();
    return { ...c };
  }

  delete(id: string): boolean { return this.comments.delete(id); }

  get(id: string): Comment | undefined {
    const c = this.comments.get(id);
    return c ? { ...c } : undefined;
  }

  list(status?: CommentStatus): Comment[] {
    const all = [...this.comments.values()].map(c => ({ ...c }));
    return status ? all.filter(c => c.status === status) : all;
  }

  thread(parentId: string): Comment[] {
    return this.list().filter(c => c.parentId === parentId);
  }

  private require(id: string): Comment {
    const c = this.comments.get(id);
    if (!c) throw new Error(`Comment not found: ${id}`);
    return c;
  }
}
