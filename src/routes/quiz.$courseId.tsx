import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  assessmentsApi,
  buildNotificationPayload,
  coerceIntegerId,
  contentApi,
  notificationsApi,
  extractErrorMessage,
  normalizeCourses,
  unwrapApiData,
} from "@/lib/api-client";
import { TopNav } from "@/components/TopNav";
import { useAuthStore } from "@/lib/stores";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer?: string;
}

function parseQuestions(payload: unknown): Question[] {
  const data = unwrapApiData<unknown>(payload);
  const parsed =
    typeof data === "string"
      ? (() => {
          try {
            return JSON.parse(data) as unknown;
          } catch {
            return null;
          }
        })()
      : data;

  const candidates = Array.isArray(parsed)
    ? parsed
    : ((parsed as { questions?: unknown[]; items?: unknown[] } | null)
        ?.questions ??
      (parsed as { questions?: unknown[]; items?: unknown[] } | null)?.items ??
      []);

  return candidates
    .map<Question | null>((item, index) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const prompt =
        typeof value.question === "string"
          ? value.question
          : typeof value.prompt === "string"
            ? value.prompt
            : "";
      const options = Array.isArray(value.options)
        ? value.options.filter(
            (option): option is string => typeof option === "string",
          )
        : [];

      if (!prompt) return null;

      return {
        id:
          value.id != null
            ? String(value.id)
            : value.question_id != null
              ? String(value.question_id)
              : `generated-${index + 1}`,
        question: prompt,
        options,
        correct_answer:
          typeof value.correct_answer === "string"
            ? value.correct_answer
            : undefined,
      };
    })
    .filter((question): question is Question => question !== null);
}

export const Route = createFileRoute("/quiz/$courseId")({
  head: () => ({ meta: [{ title: "Quiz — EliteCoach" }] }),
  component: QuizPage,
});

function QuizPage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    passed?: boolean;
    perQuestion?: { id: string; correct: boolean }[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const numericCourseId = coerceIntegerId(courseId);

    if (numericCourseId == null) {
      setQuestions([
        {
          id: "demo-1",
          question: "What's the primary benefit of an AI tutor?",
          options: [
            "It replaces all human teachers",
            "It adapts explanations to your pace",
            "It only works for math",
            "It removes the need to study",
          ],
          correct_answer: "It adapts explanations to your pace",
        },
      ]);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    Promise.all([
      contentApi.get("/courses/").catch(() => ({ data: [] })),
      assessmentsApi.post(
        "/api/v1/assessments/generate-quiz",
        {},
        {
          params: {
            course_id: numericCourseId,
            topic: "Course assessment",
            num_questions: 5,
            level: "beginner",
          },
        },
      ),
    ])
      .then(([coursesRes, quizRes]) => {
        if (!alive) return;
        const matchedCourse = normalizeCourses(coursesRes.data).find(
          (course) => course.id === courseId,
        );
        const data = parseQuestions(quizRes.data);
        if (data.length === 0) {
          // Fallback demo question so UI is interactive even without API content
          setQuestions([
            {
              id: "demo-1",
              question:
                matchedCourse?.title ??
                "What's the primary benefit of an AI tutor?",
              options: [
                "It replaces all human teachers",
                "It adapts explanations to your pace",
                "It only works for math",
                "It removes the need to study",
              ],
              correct_answer: "It adapts explanations to your pace",
            },
          ]);
          return;
        }
        setQuestions(data);
      })
      .catch(() => {
        setQuestions([
          {
            id: "demo-1",
            question: "What's the primary benefit of an AI tutor?",
            options: [
              "It replaces all human teachers",
              "It adapts explanations to your pace",
              "It only works for math",
              "It removes the need to study",
            ],
            correct_answer: "It adapts explanations to your pace",
          },
        ]);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [courseId]);

  const current = questions[idx];
  const progress =
    questions.length === 0
      ? 0
      : Math.round(((idx + 1) / questions.length) * 100);

  const submit = async () => {
    setSubmitting(true);
    try {
      const numericCourseId = coerceIntegerId(courseId);
      if (numericCourseId == null) {
        throw new Error("This quiz requires a numeric course ID.");
      }

      const res = await assessmentsApi.post("/api/v1/assessments/submit", {
        course_id: numericCourseId,
        questions,
        answers: questions.map((question) => ({
          question_id: question.id,
          answer: answers[question.id] ?? "",
        })),
      });
      const payload = unwrapApiData<unknown>(res.data);
      const assessmentId =
        typeof payload === "object" && payload
          ? ((
              payload as {
                assessment_id?: number | string;
                assessmentId?: number | string;
              }
            ).assessment_id ??
            (
              payload as {
                assessment_id?: number | string;
                assessmentId?: number | string;
              }
            ).assessmentId)
          : undefined;

      const resultsRes =
        assessmentId != null
          ? await assessmentsApi
              .get(`/api/v1/assessments/results/${assessmentId}`)
              .catch(() => null)
          : null;
      const data = resultsRes
        ? unwrapApiData<Record<string, unknown>>(resultsRes.data)
        : typeof payload === "object" && payload
          ? (payload as Record<string, unknown>)
          : {};
      const score = Number(data.score ?? data.percentage ?? 0);
      const total = Number(data.total ?? questions.length);
      const passed = Boolean(data.passed ?? score >= 70);
      const perSource = Array.isArray(data.per_question)
        ? data.per_question
        : Array.isArray(data.results)
          ? data.results
          : null;
      const per: { id: string; correct: boolean }[] = perSource
        ? perSource
            .map((entry) => {
              if (!entry || typeof entry !== "object") return null;
              const value = entry as Record<string, unknown>;
              const id =
                value.id ?? value.question_id ?? value.questionId ?? null;
              const correct =
                typeof value.correct === "boolean"
                  ? value.correct
                  : typeof value.is_correct === "boolean"
                    ? value.is_correct
                    : undefined;
              if (id == null || correct == null) return null;
              return { id: String(id), correct };
            })
            .filter(
              (
                entry,
              ): entry is {
                id: string;
                correct: boolean;
              } => entry !== null,
            )
        : questions.map((q) => ({
            id: q.id,
            correct: answers[q.id] === q.correct_answer,
          }));
      setResult({ score, total, passed, perQuestion: per });
      notificationsApi
        .post(
          "/api/v1/notification/send",
          buildNotificationPayload({
            to: user?.email,
            subject: "Quiz complete",
            body: `You scored ${typeof score === "number" ? score : 0}%`,
          }),
        )
        .catch(() => {});
    } catch (err) {
      // local scoring fallback
      const correct = questions.filter(
        (q) => answers[q.id] === q.correct_answer,
      ).length;
      const score = Math.round((correct / questions.length) * 100);
      setResult({
        score,
        total: questions.length,
        passed: score >= 70,
        perQuestion: questions.map((q) => ({
          id: q.id,
          correct: answers[q.id] === q.correct_answer,
        })),
      });
      toast.error(extractErrorMessage(err, "Could not submit, scored locally"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <TopNav />
        <div className="container-1200 py-20">
          <div className="h-64 bg-surface-card animate-pulse" />
        </div>
      </div>
    );
  }

  if (result) {
    const ringPct = Math.min(100, Math.max(0, result.score));
    return (
      <div className="min-h-screen bg-surface">
        <TopNav />
        <div className="container-1200 py-16 max-w-2xl">
          <div className="card-base text-center py-12">
            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="var(--border)"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="var(--coral)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(ringPct / 100) * 276.46} 276.46`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold">{ringPct}%</span>
              </div>
            </div>
            <span
              className={`label-caps inline-block px-3 py-1 rounded-sm ${
                result.passed
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {result.passed ? "Passed" : "Did not pass"}
            </span>
            <h1 className="text-3xl font-bold mt-4 mb-2">Quiz complete</h1>
            <p className="text-text-secondary">
              You answered {questions.length} question
              {questions.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="card-base mt-6">
            <h3 className="font-semibold mb-4">Per-question breakdown</h3>
            <div className="divide-y divide-border">
              {(result.perQuestion ?? []).map((p, i) => {
                const q = questions.find((qq) => qq.id === p.id);
                return (
                  <div key={p.id} className="py-3 flex items-start gap-3">
                    <span
                      className={`w-6 h-6 flex items-center justify-center shrink-0 ${
                        p.correct
                          ? "bg-success text-white"
                          : "bg-destructive text-white"
                      }`}
                    >
                      {p.correct ? <Check size={14} /> : <X size={14} />}
                    </span>
                    <div className="text-sm">
                      <div className="font-medium">
                        Q{i + 1}. {q?.question ?? "Question"}
                      </div>
                      <div className="text-text-secondary text-xs mt-1">
                        Your answer: {answers[p.id] ?? "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Link
              to="/dashboard"
              className="flex-1 h-12 inline-flex items-center justify-center bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
            >
              Back to dashboard
            </Link>
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
                setIdx(0);
              }}
              className="flex-1 h-12 border border-border font-medium hover:bg-surface transition-colors"
            >
              Retake quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen bg-surface">
        <TopNav />
        <div className="container-1200 py-20 text-center">
          <p className="text-text-secondary">
            No quiz available for this course yet.
          </p>
        </div>
      </div>
    );
  }

  const selected = answers[current.id];
  const isLast = idx === questions.length - 1;

  return (
    <div className="min-h-screen bg-surface">
      <TopNav />
      <div className="container-1200 py-12 max-w-2xl">
        <div className="mb-10">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="label-caps text-text-secondary">
              Question {idx + 1} of {questions.length}
            </span>
            <span className="font-mono text-text-secondary">{progress}%</span>
          </div>
          <div className="h-1 w-full bg-border rounded-sm overflow-hidden">
            <div
              className="h-full bg-coral transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight leading-tight mb-8">
          {current.question}
        </h1>

        <div className="space-y-3 mb-10">
          {current.options.map((opt) => {
            const isSel = selected === opt;
            return (
              <button
                key={opt}
                onClick={() => setAnswers((a) => ({ ...a, [current.id]: opt }))}
                className={`w-full text-left p-5 border-2 transition-colors ${
                  isSel
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface-card hover:border-primary/40"
                }`}
              >
                <span className="font-medium">{opt}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between gap-3">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="h-12 px-5 border border-border font-medium hover:bg-surface transition-colors disabled:opacity-50"
          >
            ← Previous
          </button>
          {isLast ? (
            <button
              onClick={submit}
              disabled={!selected || submitting}
              className="h-12 px-6 bg-coral text-coral-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit quiz"}
            </button>
          ) : (
            <button
              onClick={() => setIdx((i) => i + 1)}
              disabled={!selected}
              className="h-12 px-6 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
