import { isFounderRequest } from "@/lib/founder-auth"
import { redirect } from "next/navigation"
import { HistoricalReviews } from "@/components/historical-reviews"
export const dynamic = "force-dynamic"
export default async function HistoricalReviewsPage() {
  if (!await isFounderRequest(new Request("http://internal/"))) redirect("/")
  return <HistoricalReviews />
}
