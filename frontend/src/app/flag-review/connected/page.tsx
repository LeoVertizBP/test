import ConnectedFlagReviewContent from '@/components/flagReview/ConnectedFlagReviewContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Flag Review - Credit Compliance Tool',
  description: 'Review and manage compliance flags with real-time API integration',
};

export default function ConnectedFlagReviewPage() {
  return <ConnectedFlagReviewContent />;
}
