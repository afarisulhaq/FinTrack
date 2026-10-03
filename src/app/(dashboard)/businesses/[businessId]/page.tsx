import { BusinessesView } from "~/components/businesses/businesses-view";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <BusinessesView businessId={businessId} />;
}
