import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { useAuthStore } from "@/lib/stores";
import { aiTutorApi, contentApi } from "@/lib/api-client";
import { CourseCard, CourseCardData } from "@/components/CourseCard";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EliteCoach" }] }),
  component: DashboardPage,
});

interface SessionRow {
  id: string;
  course_id?: string;
  course_title?: string;
  duration_minutes?: number;
  score?: number;
  created_at?: string;
}

function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [path, setPath] = useState<{
    goal?: string;
    next_course?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      aiTutorApi.get("/api/v1/learning/sessions").catch(() => ({ data: [] })),
      contentApi.get("/courses/").catch(() => ({ data: [] })),
      user?.id || user?.userId
        ? aiTutorApi
            .get(`/api/v1/learning/paths/${user.id ?? user.userId}`)
            .catch(() => ({ data: null }))
        : Promise.resolve({ data: null }),
    ]).then(([s, c, p]) => {
      if (!alive) return;
      const sList: SessionRow[] = Array.isArray(s.data)
        ? s.data
        : (s.data?.items ?? []);
      const cList: CourseCardData[] = Array.isArray(c.data)
        ? c.data
        : (c.data?.items ?? []);
      setSessions(sList.slice(0, 8));
      setCourses(cList.slice(0, 6));
      setPath(p.data ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const greeting = (() => {
    if (!now) return "Welcome back";
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const avgScore =
    sessions.filter((s) => typeof s.score === "number").length > 0
      ? Math.round(
          sessions
            .filter((s) => typeof s.score === "number")
            .reduce((a, s) => a + (s.score ?? 0), 0) /
            sessions.filter((s) => typeof s.score === "number").length,
        )
      : 0;

  const thisWeek = mounted
    ? sessions.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at).getTime();
        return Date.now() - d < 7 * 24 * 60 * 60 * 1000;
      }).length
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <div className="container-1200 py-12 flex-1">
        <div className="mb-12">
          <span className="label-caps text-coral mb-2 inline-block">
            Dashboard
          </span>
          <h1 className="text-4xl font-bold tracking-tight">
            {greeting}
            {user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-text-secondary mt-2">
            {now
              ? now.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "\u00A0"}
          </p>
        </div>

        {/* STATS */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            {
              label: "Courses in progress",
              value: courses.length,
              accent: "bg-primary",
            },
            {
              label: "Sessions this week",
              value: thisWeek,
              accent: "bg-coral",
            },
            {
              label: "Avg quiz score",
              value: `${avgScore}%`,
              accent: "bg-success",
            },
          ].map((s) => (
            <div key={s.label} className="card-base relative overflow-hidden">
              <div className={`absolute top-0 left-0 h-1 w-full ${s.accent}`} />
              <div className="label-caps text-text-secondary mb-3">
                {s.label}
              </div>
              <div className="text-4xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* MY COURSES */}
        <div className="mb-12">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl font-semibold">My courses</h2>
            <Link
              to="/courses"
              className="text-sm text-primary font-medium hover:underline"
            >
              Browse all →
            </Link>
          </div>
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card-base h-64 animate-pulse" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              title="No courses yet"
              description="Browse the catalog and enroll in your first course."
              action={
                <Link
                  to="/courses"
                  className="h-11 px-4 inline-flex items-center bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
                >
                  Browse catalog
                </Link>
              }
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.slice(0, 3).map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          {/* RECENT SESSIONS */}
          <div className="lg:col-span-2 card-base p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold">Recent sessions</h3>
            </div>
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-sm">
                No sessions yet — start learning to see your activity here.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr className="text-left">
                    <th className="px-6 py-3 label-caps text-text-secondary">
                      Date
                    </th>
                    <th className="px-6 py-3 label-caps text-text-secondary">
                      Course
                    </th>
                    <th className="px-6 py-3 label-caps text-text-secondary">
                      Duration
                    </th>
                    <th className="px-6 py-3 label-caps text-text-secondary">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-6 py-4 text-text-secondary">
                        {s.created_at
                          ? new Date(s.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        {s.course_title ?? s.course_id ?? "Session"}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {s.duration_minutes ? `${s.duration_minutes} min` : "—"}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {typeof s.score === "number" ? `${s.score}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* LEARNING PATH WIDGET */}
          <div className="card-base bg-navy text-white border-navy">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-coral" />
              <span className="label-caps text-coral">Learning Path</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {path?.goal ?? "Set your career goal"}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              {path?.next_course
                ? `Next up: ${path.next_course}`
                : "Generate a personalised learning path to reach your next role."}
            </p>
            <Link
              to="/learning-path"
              className="inline-flex items-center gap-2 text-coral font-medium text-sm hover:underline"
            >
              View path <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
