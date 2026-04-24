import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import {
  contentApi,
  extractErrorMessage,
  normalizeCourses,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores";
import { toast } from "sonner";
import { Plus, X, Edit, Loader2, Sparkles } from "lucide-react";

interface Course {
  id: string;
  title: string;
  domain?: string;
  difficulty_level?: string;
  published_date?: string;
  created_at?: string;
}

export const Route = createFileRoute("/tutor/courses")({
  head: () => ({ meta: [{ title: "Tutor CMS — EliteCoach" }] }),
  component: TutorCoursesPage,
});

function TutorCoursesPage() {
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    domain: "",
    difficulty_level: "BEGINNER",
  });
  const [moduleForm, setModuleForm] = useState({
    title: "",
    order_index: 1,
    content_chunks: "",
    assessment_id: "",
    is_human_required: false,
  });
  const [creating, setCreating] = useState(false);
  const [savingModule, setSavingModule] = useState(false);

  const reload = () => {
    setLoading(true);
    contentApi
      .get("/courses/")
      .then((res) => {
        setCourses(normalizeCourses(res.data) as Course[]);
      })
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const submitCreate = async () => {
    setCreating(true);
    try {
      await contentApi.post("/courses/", {
        ...createForm,
        skill_tags: [],
        tutor_id: user?.id ?? user?.userId ?? user?.email ?? "tutor",
      });
      toast.success("Course created");
      setCreateOpen(false);
      setCreateForm({
        title: "",
        description: "",
        domain: "",
        difficulty_level: "BEGINNER",
      });
      reload();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not create course"));
    } finally {
      setCreating(false);
    }
  };

  const submitModule = async () => {
    if (!moduleOpen) return;
    setSavingModule(true);
    try {
      const chunks = moduleForm.content_chunks
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((title) => ({ title }));
      await contentApi.post(`/courses/${moduleOpen}/modules`, {
        title: moduleForm.title,
        order_index: moduleForm.order_index,
        content_chunks: chunks,
        assessment_id: moduleForm.assessment_id || undefined,
        is_human_required: moduleForm.is_human_required,
      });
      toast.success("Module added");
      setModuleOpen(null);
      setModuleForm({
        title: "",
        order_index: 1,
        content_chunks: "",
        assessment_id: "",
        is_human_required: false,
      });
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not add module"));
    } finally {
      setSavingModule(false);
    }
  };

  const ingest = async (courseId: string) => {
    setIngesting(courseId);
    try {
      await contentApi.post(`/courses/internal/ingest?course_id=${courseId}`);
      toast.success("Course ingested");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Ingest failed"));
    } finally {
      setIngesting(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <div className="container-1200 py-12 flex-1">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <span className="label-caps text-coral mb-2 inline-block">
              Tutor CMS
            </span>
            <h1 className="text-4xl font-bold tracking-tight">
              Manage courses
            </h1>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="h-11 px-4 bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 hover:bg-primary-hover transition-colors"
          >
            <Plus size={16} /> New course
          </button>
        </div>

        <div className="card-base p-0 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-secondary">
              Loading...
            </div>
          ) : courses.length === 0 ? (
            <div className="p-12 text-center text-text-secondary text-sm">
              No courses yet — create your first.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr className="text-left">
                  <th className="px-6 py-3 label-caps text-text-secondary">
                    Title
                  </th>
                  <th className="px-6 py-3 label-caps text-text-secondary">
                    Domain
                  </th>
                  <th className="px-6 py-3 label-caps text-text-secondary">
                    Difficulty
                  </th>
                  <th className="px-6 py-3 label-caps text-text-secondary">
                    Published
                  </th>
                  <th className="px-6 py-3 label-caps text-text-secondary text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-6 py-4 font-medium">{c.title}</td>
                    <td className="px-6 py-4 text-text-secondary">
                      {c.domain ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {c.difficulty_level ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-mono text-xs">
                      {(c.published_date ?? c.created_at)
                        ? new Date(
                            c.published_date ?? c.created_at!,
                          ).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => {
                            setModuleOpen(c.id);
                          }}
                          className="h-9 px-3 border border-border text-xs hover:bg-surface inline-flex items-center gap-1"
                        >
                          <Plus size={12} /> Module
                        </button>
                        <button
                          onClick={() => ingest(c.id)}
                          disabled={ingesting === c.id}
                          className="h-9 px-3 border border-border text-xs hover:bg-surface inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          {ingesting === c.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          Ingest
                        </button>
                        <button
                          className="h-9 px-3 border border-border text-xs hover:bg-surface inline-flex items-center gap-1"
                          onClick={() => toast("Edit coming soon")}
                        >
                          <Edit size={12} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE COURSE PANEL */}
      {createOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCreateOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-surface-card overflow-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">New course</h2>
              <button
                onClick={() => setCreateOpen(false)}
                className="text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Title
                </label>
                <input
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, title: e.target.value })
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-border focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Domain
                </label>
                <input
                  value={createForm.domain}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, domain: e.target.value })
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Difficulty
                </label>
                <select
                  value={createForm.difficulty_level}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      difficulty_level: e.target.value,
                    })
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none bg-surface-card"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
              <button
                onClick={submitCreate}
                disabled={creating || !createForm.title}
                className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create course"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MODULE PANEL */}
      {moduleOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setModuleOpen(null)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-surface-card overflow-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">Add module</h2>
              <button
                onClick={() => setModuleOpen(null)}
                className="text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Module title
                </label>
                <input
                  value={moduleForm.title}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, title: e.target.value })
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Order index
                </label>
                <input
                  type="number"
                  value={moduleForm.order_index}
                  onChange={(e) =>
                    setModuleForm({
                      ...moduleForm,
                      order_index: Number(e.target.value),
                    })
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Content chunks (one per line)
                </label>
                <textarea
                  rows={5}
                  value={moduleForm.content_chunks}
                  onChange={(e) =>
                    setModuleForm({
                      ...moduleForm,
                      content_chunks: e.target.value,
                    })
                  }
                  placeholder={
                    "Lesson 1: Introduction\nLesson 2: Core concepts"
                  }
                  className="w-full px-4 py-3 border border-border focus:border-primary outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Assessment ID
                </label>
                <input
                  value={moduleForm.assessment_id}
                  onChange={(e) =>
                    setModuleForm({
                      ...moduleForm,
                      assessment_id: e.target.value,
                    })
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none font-mono text-sm"
                />
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={moduleForm.is_human_required}
                  onChange={(e) =>
                    setModuleForm({
                      ...moduleForm,
                      is_human_required: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-primary"
                />
                Human review required
              </label>
              <button
                onClick={submitModule}
                disabled={savingModule || !moduleForm.title}
                className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {savingModule ? "Saving..." : "Add module"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
