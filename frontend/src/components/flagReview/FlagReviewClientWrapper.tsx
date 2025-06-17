'use client';

import RequireAuth from '@/components/auth/RequireAuth';
import ConnectedFlagReviewContent from '@/components/flagReview/ConnectedFlagReviewContent';

export default function FlagReviewClientWrapper() {
  return (
    <RequireAuth>
      <ConnectedFlagReviewContent />
    </RequireAuth>
  );
}
