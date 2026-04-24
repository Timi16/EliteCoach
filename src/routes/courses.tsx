import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { CourseCard, CourseCardData } from "@/components/CourseCard";
import { contentApi } from "@/lib/api-client";
import { EmptyState } from "@/components/EmptyState";
import { Filter } from "lucide-react";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "All courses — EliteCoach" },
      {
        name: "description",
        content: "Browse 200+ AI-powered courses across data science, design, business and more.",
      },
      { property: "og:title", content: "All courses — EliteCoach" },
      {
        property: "og:description",
        content: "Browse 200+ courses across data science, design, business and more.",
      },
    ],
  }),
  component: CatalogPage,
});

const DOMAINS = ["Data Science", "Design", "Business", "Development", "AI", "Marketing"];
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

function CatalogPage() {
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "popular">("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (domains.length === 1) params.set("domain", domains[0]);
    if (difficulty) params.set("difficulty_level", difficulty);

    contentApi
      .get(`/courses/?${params.toString()}`)
      .then((res) => {
        if (!alive) return;
        const data: CourseCardData[] = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
        setCourses(data);
      })
      .catch(() => setCourses([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [domains, difficulty]);

  const sorted = useMemo(() => {
    const list = [...courses];
    if (sort === "newest") {
      list.sort((a, b) => {
        const ad = new Date(a.published_date ?? a.created_at ?? 0).getTime();
        const bd = new Date(b.published_date ?? b.created_at ?? 0).getTime();
        return bd - ad;
      });
    }
    return list;
  }, [courses, sort]);

  const toggleDomain = (d: string) =>
    setDomains((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const FilterPanel = (
    <div className="space-y-8">
      <div>
        <div className="label-caps text-text-secondary mb-4">Domain</div>
        <div className="space-y-3">
          {DOMAINS.map((d) => (
            <label key={d} className="flex items-center gap-3 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={domains.includes(d)}
                onChange={() => toggleDomain(d)}
                className="w-4 h-4 accent-primary"
              />
              {d}
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="label-caps text-text-secondary mb-4">Difficulty</div>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer text-sm">
            <input
              type="radio"
              name="difficulty"
              checked={difficulty === ""}
              onChange={() => setDifficulty("")}
              className="w-4 h-4 accent-primary"
            />
            Any
          </label>
          {DIFFICULTIES.map((d) => (
            <label key={d} className="flex items-center gap-3 cursor-pointer text-sm">
              <input
                type="radio"
                name="difficulty"
                checked={difficulty === d}
                onChange={() => setDifficulty(d)}
                className="w-4 h-4 accent-primary"
              />
              {d.charAt(0) + d.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />

      <div className="container-1200 py-12 flex-1">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-4">
          <div>
            <span className="label-caps text-coral mb-2 inline-block">Catalog</span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">All courses</h1>
            <p className="text-text-secondary mt-3 max-w-xl leading-relaxed">
              Hand-picked, expert-led courses across {DOMAINS.length} core
              domains. Every one ships with an AI tutor and a real assessment
              at the end. <span className="font-mono text-text-primary">{sorted.length} results</span>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden h-11 px-4 border border-border inline-flex items-center gap-2 text-sm font-medium"
            >
              <Filter size={16} /> Filters
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "popular")}
              className="h-11 px-3 border border-border bg-surface-card text-sm"
            >
              <option value="newest">Newest</option>
              <option value="popular">Most enrolled</option>
            </select>
          </div>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-10">
          <aside className="hidden lg:block">{FilterPanel}</aside>

          <div>
            {loading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card-base h-64 animate-pulse" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState
                title="No courses found"
                description="Try adjusting your filters or check back soon for new courses."
              />
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {sorted.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-surface-card p-6 overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">Filters</h3>
              <button onClick={() => setFiltersOpen(false)} className="text-text-secondary">
                Close
              </button>
            </div>
            {FilterPanel}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
