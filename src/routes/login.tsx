import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import {
  identityApi,
  extractErrorMessage,
  normalizeUserType,
  unwrapApiData,
} from "@/lib/api-client";
import { type AuthUser, useAuthStore } from "@/lib/stores";
import { toast } from "sonner";

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — EliteCoach" },
      {
        name: "description",
        content: "Log in to EliteCoach to continue learning.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await identityApi.post("/api/v1/auth/login", {
        email,
        password,
      });
      const data = unwrapApiData<Record<string, unknown>>(res.data);
      const nestedTokens =
        data.tokens && typeof data.tokens === "object"
          ? (data.tokens as Record<string, unknown>)
          : data.auth && typeof data.auth === "object"
            ? (data.auth as Record<string, unknown>)
            : null;
      const accessToken =
        pickString(
          data.accessToken,
          data.access_token,
          data.token,
          data.jwt,
          nestedTokens?.accessToken,
          nestedTokens?.access_token,
          nestedTokens?.token,
          nestedTokens?.jwt,
        ) ?? null;
      const refreshToken =
        pickString(
          data.refreshToken,
          data.refresh_token,
          nestedTokens?.refreshToken,
          nestedTokens?.refresh_token,
        ) ?? "";
      const rawUser =
        data?.user && typeof data.user === "object"
          ? (data.user as Record<string, unknown>)
          : data?.profile && typeof data.profile === "object"
            ? (data.profile as Record<string, unknown>)
            : ({ email } as Record<string, unknown>);
      const user: AuthUser = {
        ...rawUser,
        email:
          typeof rawUser.email === "string" && rawUser.email
            ? rawUser.email
            : email,
        firstName:
          pickString(rawUser.firstName, rawUser.first_name) ?? undefined,
        lastName: pickString(rawUser.lastName, rawUser.last_name) ?? undefined,
        id: pickString(rawUser.id) ?? undefined,
        userId: pickString(rawUser.userId, rawUser.user_id) ?? undefined,
        userType: normalizeUserType(
          rawUser.userType ??
            rawUser.user_type ??
            data.userType ??
            data.user_type,
        ),
      };
      if (!accessToken) throw new Error("No access token returned");
      setSession({ user, accessToken, refreshToken });
      toast.success(
        `Welcome back${user.firstName ? ", " + user.firstName : ""}`,
      );
      if (user.userType === "TUTOR") navigate({ to: "/tutor/courses" });
      else navigate({ to: "/dashboard" });
    } catch (err) {
      const message = extractErrorMessage(err, "Login failed");
      toast.error(message);
      setErrors({
        password: /invalid|unauthorized|credential|password|email/i.test(
          message,
        )
          ? message
          : "Login failed. Check the API response shape or your credentials.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your learning journey."
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label-caps text-text-secondary block mb-2">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none transition-colors"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label-caps text-text-secondary block mb-2">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none transition-colors"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-[13px] text-destructive mt-1">
              {errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Log in"}
        </button>

        <p className="text-sm text-text-secondary text-center">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-primary font-medium hover:underline"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
