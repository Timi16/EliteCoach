import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  aiTutorApi,
  contentApi,
  notificationsApi,
  extractErrorMessage,
} from "@/lib/api-client";
import { useSessionStore } from "@/lib/stores";
import { toast } from "sonner";
import {
  Send,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ContentChunk {
  id?: string;
  title: string;
  content?: string;
}

interface Module {
  id: string;
  title: string;
  content_chunks?: ContentChunk[];
}

export const Route = createFileRoute("/learn/$sessionId")({
  head: () => ({ meta: [{ title: "Learning room — EliteCoach" }] }),
  component: LearningRoomPage,
});

function LearningRoomPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const courseId = useSessionStore((s) => s.courseId);
  const messages = useSessionStore((s) => s.messages);
  const addMessage = useSessionStore((s) => s.addMessage);
  const clearSession = useSessionStore((s) => s.clearSession);

  const [modules, setModules] = useState<Module[]>([]);
  const [activeModule, setActiveModule] = useState(0);
  const [activeLesson, setActiveLesson] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSummary, setShowSummary] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"lesson" | "tutor">("lesson");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!courseId) return;
    contentApi
      .get(`/courses/${courseId}/curriculum`)
      .then((res) => {
        const mods = Array.isArray(res.data)
          ? res.data
          : (res.data?.modules ?? res.data?.items ?? []);
        setModules(mods);
      })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const currentModule = modules[activeModule];
  const currentLesson = currentModule?.content_chunks?.[activeLesson];

  const totalLessons = modules.reduce(
    (sum, m) => sum + (m.content_chunks?.length ?? 0),
    0,
  );
  const progress =
    totalLessons === 0 ? 0 : Math.round((completed.size / totalLessons) * 100);

  const lessonKey = (mi: number, li: number) => `${mi}-${li}`;

  const markComplete = () => {
    setCompleted((prev) =>
      new Set(prev).add(lessonKey(activeModule, activeLesson)),
    );
    toast.success("Lesson marked complete");
  };

  const goNext = () => {
    if (!currentModule) return;
    const lessons = currentModule.content_chunks ?? [];
    if (activeLesson < lessons.length - 1) {
      setActiveLesson(activeLesson + 1);
    } else if (activeModule < modules.length - 1) {
      setActiveModule(activeModule + 1);
      setActiveLesson(0);
    }
  };

  const goPrev = () => {
    if (activeLesson > 0) {
      setActiveLesson(activeLesson - 1);
    } else if (activeModule > 0) {
      setActiveModule(activeModule - 1);
      const prevMod = modules[activeModule - 1];
      setActiveLesson((prevMod?.content_chunks?.length ?? 1) - 1);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      ts: Date.now(),
    });
    setSending(true);
    try {
      const res = await aiTutorApi.post(
        `/api/v1/learning/sessions/${sessionId}/message`,
        {
          message: text,
          content: text,
        },
      );
      const reply =
        res.data?.response ??
        res.data?.message ??
        res.data?.reply ??
        res.data?.data?.response ??
        res.data?.data?.message ??
        "I'm here to help — could you give me a bit more detail?";
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: typeof reply === "string" ? reply : JSON.stringify(reply),
        ts: Date.now(),
      });
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "I had trouble reaching the AI tutor just now. Try again in a moment, or move on to the next lesson.",
        ts: Date.now(),
      });
      toast.error(extractErrorMessage(err, "AI tutor unreachable"));
    } finally {
      setSending(false);
    }
  };

  const endSession = async () => {
    try {
      const res = await aiTutorApi.post(
        `/api/v1/learning/sessions/${sessionId}/end`,
        {},
      );
      const summary =
        res.data?.summary ??
        res.data?.data?.summary ??
        "Session ended. Great work today — your progress has been saved.";
      setShowSummary(
        typeof summary === "string" ? summary : JSON.stringify(summary),
      );
      notificationsApi
        .post("/api/v1/notification/send", {
          channel: "IN_APP",
          subject: "Session ended",
          body: "Great session! Here's your summary.",
        })
        .catch(() => {});
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not end session"));
    }
  };

  const closeSummary = () => {
    setShowSummary(null);
    clearSession();
    navigate({ to: "/dashboard" });
  };

  const SidebarTree = (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-white/10">
        <Link
          to="/courses"
          className="label-caps text-coral hover:underline inline-block mb-3"
        >
          ← Exit
        </Link>
        <div className="text-sm font-semibold mb-3 truncate">
          Course progress
        </div>
        <div className="h-1 w-full bg-white/10 rounded-sm overflow-hidden">
          <div
            className="h-full bg-coral transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-white/60 mt-2 font-mono">
          {progress}% complete
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {modules.length === 0 ? (
          <div className="text-sm text-white/60 p-3">Loading curriculum...</div>
        ) : (
          modules.map((m, mi) => (
            <div key={m.id} className="mb-2">
              <div className="px-3 py-2 label-caps text-white/50">
                {String(mi + 1).padStart(2, "0")} · {m.title}
              </div>
              {(m.content_chunks ?? []).map((c, li) => {
                const isActive = mi === activeModule && li === activeLesson;
                const isDone = completed.has(lessonKey(mi, li));
                return (
                  <button
                    key={c.id ?? li}
                    onClick={() => {
                      setActiveModule(mi);
                      setActiveLesson(li);
                      setMobileTab("lesson");
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 rounded-sm transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                        isDone ? "bg-coral border-coral" : "border-white/30"
                      }`}
                    >
                      {isDone && <Check size={10} className="text-white" />}
                    </span>
                    <span className="line-clamp-2">{c.title}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const LessonCenter = (
    <div className="flex flex-col h-full bg-surface-card overflow-hidden">
      <div className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="text-sm text-text-secondary truncate">
          {currentModule?.title ?? "Lesson"}
        </div>
        <button
          onClick={endSession}
          className="h-9 px-3 text-sm border border-border hover:bg-surface transition-colors"
        >
          End session
        </button>
      </div>
      <div className="flex-1 overflow-auto px-8 py-10">
        {currentLesson ? (
          <div className="max-w-3xl mx-auto">
            <span className="label-caps text-coral mb-3 inline-block">
              Lesson
            </span>
            <h1 className="text-3xl font-bold tracking-tight mb-6">
              {currentLesson.title}
            </h1>
            <div className="prose prose-sm max-w-none text-text-primary leading-relaxed">
              {currentLesson.content ? (
                <ReactMarkdown>{currentLesson.content}</ReactMarkdown>
              ) : (
                <p className="text-text-secondary">
                  Lesson content will appear here. Use the AI tutor on the right
                  to ask questions about this topic.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">
              Welcome to your learning session
            </h1>
            <p className="text-text-secondary">
              Select a lesson from the left to begin. Your AI tutor is ready on
              the right.
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-border px-8 py-4 flex items-center justify-between bg-surface-card">
        <button
          onClick={goPrev}
          className="h-11 px-4 inline-flex items-center gap-2 border border-border text-sm font-medium hover:bg-surface transition-colors"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button
          onClick={markComplete}
          className="h-11 px-5 bg-coral text-coral-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Mark complete
        </button>
        <button
          onClick={goNext}
          className="h-11 px-4 inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const TutorPanel = (
    <div className="flex flex-col h-full bg-surface-card border-l border-border">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
          AI
        </div>
        <div>
          <div className="font-semibold text-sm">EliteCoach AI</div>
          <div className="text-xs text-text-secondary">Always here to help</div>
        </div>
      </div>
      <div ref={chatRef} className="flex-1 overflow-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-text-secondary bg-surface p-4 rounded-sm">
            👋 Hey there! I'm your AI tutor. Ask me anything about this lesson —
            I'll explain, quiz you, or break things down step by step.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 text-sm rounded-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-text-primary"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface px-4 py-3 text-sm rounded-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" />
                <span
                  className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                />
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask your tutor..."
            disabled={sending}
            className="flex-1 h-11 px-3 border border-border focus:border-primary outline-none text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="h-11 w-11 bg-primary text-primary-foreground hover:bg-primary-hover transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-surface overflow-hidden">
      {/* Desktop layout */}
      <div className="hidden md:grid flex-1 grid-cols-[260px_1fr_360px] overflow-hidden">
        <aside className="bg-navy text-navy-foreground overflow-hidden">
          {SidebarTree}
        </aside>
        {LessonCenter}
        {TutorPanel}
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden">
        <div className="bg-navy text-navy-foreground px-4 py-3 flex items-center justify-between">
          <Link to="/courses" className="text-sm">
            ← Exit
          </Link>
          <div className="text-xs font-mono">{progress}%</div>
        </div>
        <div className="flex border-b border-border bg-surface-card">
          <button
            onClick={() => setMobileTab("lesson")}
            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-sm font-medium ${
              mobileTab === "lesson"
                ? "border-b-2 border-primary text-primary"
                : "text-text-secondary"
            }`}
          >
            <BookOpen size={16} /> Lesson
          </button>
          <button
            onClick={() => setMobileTab("tutor")}
            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-sm font-medium ${
              mobileTab === "tutor"
                ? "border-b-2 border-primary text-primary"
                : "text-text-secondary"
            }`}
          >
            <MessageSquare size={16} /> Tutor
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {mobileTab === "lesson" ? LessonCenter : TutorPanel}
        </div>
      </div>

      {/* Summary modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-card w-full max-w-lg rounded-lg p-8 relative">
            <button
              onClick={closeSummary}
              className="absolute top-4 right-4 text-text-secondary"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <span className="label-caps text-coral mb-3 inline-block">
              Session summary
            </span>
            <h2 className="text-2xl font-bold mb-4">Great session!</h2>
            <div className="prose prose-sm max-w-none text-text-secondary mb-6 leading-relaxed">
              <ReactMarkdown>{showSummary}</ReactMarkdown>
            </div>
            <button
              onClick={closeSummary}
              className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
