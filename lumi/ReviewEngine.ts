export type ReviewDecision = 'approved' | 'rejected' | 'pending';

export interface ReviewRecord {
  id: string;
  risk: 'low' | 'medium' | 'high';
  decision: ReviewDecision;
  comments: string[];
  rollbackSnapshotId?: string;
  reviewedAt: string;
}

export class ReviewEngine {
  createReview(risk: 'low' | 'medium' | 'high', rollbackSnapshotId?: string): ReviewRecord {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      risk,
      decision: 'pending',
      comments: [],
      rollbackSnapshotId,
      reviewedAt: new Date().toISOString(),
    };
  }

  approve(review: ReviewRecord, comment?: string): ReviewRecord {
    review.decision = 'approved';
    if (comment) review.comments.push(comment);
    review.reviewedAt = new Date().toISOString();
    return { ...review, comments: [...review.comments] };
  }

  reject(review: ReviewRecord, comment: string): ReviewRecord {
    review.decision = 'rejected';
    review.comments.push(comment);
    review.reviewedAt = new Date().toISOString();
    return { ...review, comments: [...review.comments] };
  }
}
