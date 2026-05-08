import { NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/api-helpers";
import { handleTelegramReportRoute } from "@/lib/telegram/report-route";

export const POST = withErrorHandler(async (req: NextRequest) => {
  return handleTelegramReportRoute(req, "closing");
});
