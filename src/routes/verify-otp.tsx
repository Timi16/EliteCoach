import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { identityApi, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-otp")({
  head: () => ({
    meta: [
      { title: "Verify your email — EliteCoach" },
      {
        name: "description",
        content: "Enter the 6-digit code sent to your email.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    email: (s.email as string) || "",
  }),
  component: VerifyOtpPage,
});

function VerifyOtpPage() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (i: number, val: string) => {
    const d = val.replace(/\D/g, "").slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Backspace" && !digits[i] && i > 0)
      refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const arr = text.split("").concat(Array(6).fill("")).slice(0, 6);
    setDigits(arr);
    refs.current[Math.min(text.length, 5)]?.focus();
  };

  const submit = async () => {
    const otp = digits.join("");
    if (otp.length !== 6) return toast.error("Enter all 6 digits");
    setLoading(true);
    try {
      await identityApi.post("/api/v1/auth/verify/otp-email", { email, otp });
      toast.success("Email verified — please log in");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(extractErrorMessage(err, "Invalid or expired code"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`Enter the 6-digit code sent to ${email || "your inbox"}.`}
    >
      <div className="space-y-6">
        <div className="flex gap-3 justify-between">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKey(e, i)}
              onPaste={handlePaste}
              inputMode="numeric"
              maxLength={1}
              className="w-12 h-14 text-center text-xl font-semibold border border-border focus:border-primary outline-none"
            />
          ))}
        </div>
        <button
          onClick={submit}
          disabled={loading}
          className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify code"}
        </button>
      </div>
    </AuthLayout>
  );
}
