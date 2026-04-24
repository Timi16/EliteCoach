import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { identityApi, notificationsApi, extractErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile & settings — EliteCoach" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [prefs, setPrefs] = useState({ email: true, in_app: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    identityApi
      .get("/api/v1/users/profile")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        if (data) {
          setForm({
            firstName: data.firstName ?? user?.firstName ?? "",
            lastName: data.lastName ?? user?.lastName ?? "",
            email: data.email ?? user?.email ?? "",
          });
          if (data.userType || data.id) setUser({ ...(user ?? { email: data.email }), ...data });
        }
      })
      .catch(() => {
        if (user) setForm({ firstName: user.firstName ?? "", lastName: user.lastName ?? "", email: user.email });
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await identityApi.put("/api/v1/users/profile", form);
      toast.success("Profile updated");
      if (user) setUser({ ...user, ...form });
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save profile"));
    } finally {
      setSaving(false);
    }
  };

  const togglePref = async (k: "email" | "in_app", v: boolean) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    try {
      await notificationsApi.post("/api/v1/notification/preferences", {
        ...prefs,
        [k]: v,
      });
      toast.success("Preferences saved");
    } catch {
      // silent
    }
  };

  const initials = `${form.firstName?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <div className="container-1200 py-12 flex-1">
        <div className="mb-10">
          <span className="label-caps text-coral mb-2 inline-block">Account</span>
          <h1 className="text-4xl font-bold tracking-tight">Profile & settings</h1>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          <aside className="card-base text-center">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-4">
              {initials}
            </div>
            <h2 className="text-xl font-semibold">
              {form.firstName} {form.lastName}
            </h2>
            <p className="text-sm text-text-secondary mt-1">{form.email}</p>
            <span className="label-caps inline-block mt-4 px-3 py-1 bg-surface text-text-secondary rounded-sm">
              {user?.userType ?? "Learner"}
            </span>
          </aside>

          <div className="space-y-6">
            <div className="card-base">
              <h3 className="font-semibold mb-1">Personal details</h3>
              <p className="text-sm text-text-secondary mb-6">
                Update your name and contact info.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-text-secondary block mb-2">First name</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="label-caps text-text-secondary block mb-2">Last name</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label-caps text-text-secondary block mb-2">Email</label>
                  <input
                    value={form.email}
                    disabled
                    className="w-full h-12 px-4 border border-border bg-surface text-text-secondary"
                  />
                </div>
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="mt-6 h-11 px-5 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>

            <div className="card-base">
              <h3 className="font-semibold mb-1">Notifications</h3>
              <p className="text-sm text-text-secondary mb-6">
                Choose how you want to hear from EliteCoach.
              </p>
              <div className="space-y-4">
                {(
                  [
                    { key: "email", label: "Email notifications" },
                    { key: "in_app", label: "In-app notifications" },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
                  >
                    <span className="text-sm font-medium">{row.label}</span>
                    <button
                      onClick={() => togglePref(row.key, !prefs[row.key])}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        prefs[row.key] ? "bg-primary" : "bg-border"
                      }`}
                      aria-pressed={prefs[row.key]}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          prefs[row.key] ? "translate-x-6" : ""
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
