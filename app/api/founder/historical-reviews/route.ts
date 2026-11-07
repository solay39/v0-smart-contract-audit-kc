import { historicalReviewHandler } from "@/lib/historical-review-http"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const GET = (req: Request) => historicalReviewHandler(req)
