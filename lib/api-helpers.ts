import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiResponse<T>(data: T, status = 200, message?: string) {
  return NextResponse.json(
    { success: true, data, message },
    { status }
  );
}

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

export function withErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>
) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      console.error("API Error:", error);
      if (error instanceof ApiError) {
        return apiError(error.message, error.status);
      }

      return apiError(
        error instanceof Error ? error.message : "Internal Server Error",
        500
      );
    }
  };
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    throw new ApiError("Unauthorized", 401);
  }

  if (session.user.isActive === false) {
    throw new ApiError("User is inactive", 403);
  }
  
  return session.user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  
  if (user.role !== "ADMIN") {
    throw new ApiError("Forbidden: Admin access required", 403);
  }
  
  return user;
}
