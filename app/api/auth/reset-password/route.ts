import { after } from "next/server";
import { apiResponse, ApiError, withErrorHandler } from "@/lib/api-helpers";
import { sendPasswordChangedEmail } from "@/lib/email";
import { consumePasswordReset, hasSameRecoveryOrigin } from "@/lib/password-reset";
import { validateNewPassword } from "@/lib/password-validation";

const INVALID_TOKEN_MESSAGE = "Tautan reset tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.";

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

  const values = body as Record<string, unknown>;
  if (typeof values.token !== "string" || !/^[a-f0-9]{64}$/i.test(values.token)) {
    throw new ApiError(INVALID_TOKEN_MESSAGE, 400);
  }
  const password = validateNewPassword(values.password);
  if (typeof values.confirmPassword !== "string" || password !== values.confirmPassword) {
    throw new ApiError("Konfirmasi password tidak cocok.", 400);
  }

  let email: string | null;
  try {
    email = await consumePasswordReset(values.token, password);
  } catch {
    throw new ApiError("Gagal memproses tautan reset.", 500);
  }
  if (!email) throw new ApiError(INVALID_TOKEN_MESSAGE, 400);
  after(async () => {
    try {
      await sendPasswordChangedEmail(email);
    } catch {
      console.error("Password change notification failed.");
    }
  });
  return apiResponse(null, 200, "Password berhasil direset. Silakan masuk kembali.");
}

const handlePost = withErrorHandler(post);

export async function POST(request: Request) {
  const response = await handlePost(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
