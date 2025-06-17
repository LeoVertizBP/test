// Remove the demo import, import the actual component
// import { RuleSetDetailDemo } from '@/components/management/RuleSetDetail';
import RuleSetDetail from '@/components/management/RuleSetDetail';
import { Metadata } from 'next';

// Define props type for the page component to receive URL params
interface RuleSetDetailPageProps {
  params: { id: string }; // Next.js passes dynamic route segments in params.id
}

export const metadata: Metadata = {
  title: 'Rule Set Detail - Credit Compliance Tool',
  description: 'View and manage rule set details',
};

// Update the component function to accept props
export default function RuleSetDetailPage({ params }: RuleSetDetailPageProps) {
  const { id } = params; // Extract the id from the params

  // Render the actual detail component, passing the extracted id
  return <RuleSetDetail ruleSetId={id} />;
}
