import { after } from "next/server";
import { apiResponse, ApiError, withErrorHandler } from "@/lib/api-helpers";
import { hasSameRecoveryOrigin, requestPasswordReset } from "@/lib/password-reset";

const GENERIC_MESSAGE = "Jika akun terdaftar dan memiliki email pemulihan, Anda akan menerima tautan reset password.";

async function post(request: Request) {
  if (!hasSameRecoveryOrigin(request.headers.get("origin"))) {
    throw new ApiError("Origin tidak valid.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("Permintaan tidak valid.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("Permintaan tidak valid.", 400);
  }

  const identifier = (body as Record<string, unknown>).identifier;
  if (typeof identifier !== "string" || !identifier.trim() || identifier.length > 254) {
    throw new ApiError("Identifier tidak valid.", 400);
  }

  after(async () => {
    try {
      await requestPasswordReset(identifier);
    } catch {
      console.error("Password recovery request processing failed.");
    }
  });
  return apiResponse(null, 200, GENERIC_MESSAGE);
}

const handlePost = withErrorHandler(post);

export async function POST(request: Request) {
  const response = await handlePost(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
