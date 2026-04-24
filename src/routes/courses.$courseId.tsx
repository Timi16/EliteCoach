import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { contentApi, aiTutorApi, notificationsApi, extractErrorMessage } from "@/lib/api-client";
import { useAuthStore, useSessionStore } from "@/lib/stores";
import { toast } from "sonner";
import { ChevronDown, Clock, BookOpen, Award } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description?: string;
  domain?: string;
  difficulty_level?: string;
  tutor_name?: string;
  skills?: string[];
}

interface ContentChunk {
  id?: string;
  title: string;
  content?: string;
  duration_minutes?: number;
}

interface Module {
  id: string;
  title: string;
  order_index?: number;
  content_chunks?: ContentChunk[];
}

export const Route = createFileRoute("/courses/$courseId")({
  head: ({ params }) => ({
    meta: [
      { title: `Course — EliteCoach` },
      { name: "description", content: `Course details for ${params.courseId} on EliteCoach.` },
    ],
  }),
  component: CourseDetailPage,
});

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setSession = useSessionStore((s) => s.setSession);

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      contentApi.get(`/courses/${courseId}`).catch(() => ({ data: null })),
      contentApi.get(`/courses/${courseId}/curriculum`).catch(() => ({ data: null })),
    ]).then(([c, cur]) => {
      if (!alive) return;
      setCourse(c.data ?? null);
      const mods = Array.isArray(cur.data) ? cur.data : (cur.data?.modules ?? cur.data?.items ?? []);
      setModules(mods);
      if (mods[0]) setOpenModule(mods[0].id);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [courseId]);

  const startLearning = async () => {
    if (!isLoggedIn) {
      toast.error("Please log in to start learning");
      navigate({ to: "/login" });
      return;
    }
    setStarting(true);
    try {
      const res = await aiTutorApi.post("/api/v1/learning/sessions/start", {
        course_id: courseId,
        user_id: user?.id ?? user?.userId,
      });
      const sessionId =
        res.data?.session_id ?? res.data?.id ?? res.data?.data?.session_id ?? res.data?.data?.id;
      if (!sessionId) throw new Error("No session id returned");
      setSession({ sessionId, courseId });

      // Fire enrollment notification (non-blocking)
      notificationsApi
        .post("/api/v1/notification/send", {
          channel: "IN_APP",
          subject: "Enrolled!",
          body: `You've joined ${course?.title ?? "the course"}`,
        })
        .catch(() => {});

      navigate({ to: "/learn/$sessionId", params: { sessionId } });
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not start learning session"));
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <TopNav />
        <div className="container-1200 py-20">
          <div className="h-64 bg-surface-card animate-pulse" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <TopNav />
        <div className="container-1200 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Course not found</h1>
          <Link to="/courses" className="text-primary font-medium">
            ← Back to catalog
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />

      {/* HERO */}
      <section className="bg-navy text-navy-foreground">
        <div className="container-1200 py-16 grid lg:grid-cols-[1fr_360px] gap-12">
          <div>
            <Link to="/courses" className="label-caps text-coral mb-4 inline-block hover:underline">
              ← All courses
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
              {course.title}
            </h1>
            {course.description && (
              <p className="text-white/70 text-lg leading-relaxed max-w-2xl mb-6">
                {course.description}
              </p>
            )}
            <div className="flex items-center flex-wrap gap-3 mb-8">
              {course.domain && (
                <span className="label-caps bg-white/10 px-3 py-1.5">{course.domain}</span>
              )}
              {course.difficulty_level && (
                <span className="label-caps bg-white/10 px-3 py-1.5">{course.difficulty_level}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-coral flex items-center justify-center font-semibold">
                {(course.tutor_name ?? "EC").charAt(0)}
              </div>
              <div>
                <div className="text-sm font-medium">{course.tutor_name ?? "EliteCoach"}</div>
                <div className="text-xs text-white/60">Course tutor</div>
              </div>
            </div>
          </div>

          {/* Floating enroll card */}
          <div className="lg:sticky lg:top-24 self-start bg-surface-card text-text-primary rounded-lg p-6 border border-border">
            <div className="h-2 w-full bg-coral mb-4 rounded-sm -mt-6 -mx-6 rounded-t-lg" />
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <BookOpen size={16} className="text-primary" /> {modules.length} modules
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <Clock size={16} className="text-primary" /> Self-paced learning
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <Award size={16} className="text-primary" /> Certificate of completion
              </div>
            </div>
            <button
              onClick={startLearning}
              disabled={starting}
              className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors mt-6 disabled:opacity-60"
            >
              {starting ? "Starting..." : "Start learning →"}
            </button>
            <Link
              to="/quiz/$courseId"
              params={{ courseId }}
              className="w-full h-12 inline-flex items-center justify-center border border-border font-medium mt-3 hover:bg-surface transition-colors"
            >
              Take assessment
            </Link>
          </div>
        </div>
      </section>

      {/* CURRICULUM */}
      <section className="bg-surface-card section-y">
        <div className="container-1200 grid lg:grid-cols-[1fr_360px] gap-12">
          <div>
            <span className="label-caps text-coral mb-3 inline-block">Curriculum</span>
            <h2 className="text-3xl font-semibold mb-8">What you'll learn</h2>

            {course.skills && course.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-10">
                {course.skills.map((s) => (
                  <span key={s} className="px-3 py-1.5 bg-surface text-sm rounded-sm">
                    {s}
                  </span>
                ))}
              </div>
            )}

            <div className="border border-border">
              {modules.length === 0 ? (
                <div className="p-6 text-text-secondary text-sm">
                  Curriculum will appear once it's published.
                </div>
              ) : (
                modules.map((m, idx) => {
                  const open = openModule === m.id;
                  return (
                    <div key={m.id} className="border-b border-border last:border-b-0">
                      <button
                        onClick={() => setOpenModule(open ? null : m.id)}
                        className="w-full flex items-center justify-between p-5 hover:bg-surface text-left"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm text-coral">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="font-semibold">{m.title}</span>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      {open && (
                        <div className="px-5 pb-5 pl-16 space-y-2">
                          {(m.content_chunks ?? []).length === 0 ? (
                            <div className="text-sm text-text-secondary">No lessons yet</div>
                          ) : (
                            (m.content_chunks ?? []).map((c, i) => (
                              <div
                                key={c.id ?? i}
                                className="flex items-center justify-between py-2 border-b border-border last:border-b-0 text-sm"
                              >
                                <span>{c.title}</span>
                                {c.duration_minutes && (
                                  <span className="text-xs text-text-secondary font-mono">
                                    {c.duration_minutes} min
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="card-base">
              <h3 className="font-semibold mb-2">AI-powered tutor</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Every lesson comes with an always-on tutor that adapts to your questions and pace.
              </p>
            </div>
            <div className="card-base">
              <h3 className="font-semibold mb-2">Hands-on assessments</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Test what you've learned with adaptive quizzes after each module.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </div>
  );
}
