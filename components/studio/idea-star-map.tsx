"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StarMapAnchor, StarMapLayout, StarMapNode } from "@/lib/studio/idea-star-map";

type IdeaStarMapProps = {
  layout: StarMapLayout;
};

type HoverTarget =
  | { type: "node"; node: StarMapNode; x: number; y: number }
  | { type: "anchor"; anchor: StarMapAnchor; x: number; y: number };

const STAT_LINKS = [
  {
    key: "today" as const,
    href: "/stream?date=today",
    label: (n: number) => `今日 +${n}`,
  },
  {
    key: "star" as const,
    href: "/stream?kind=star",
    label: (n: number) => `${n} 颗星`,
  },
  {
    key: "planet" as const,
    href: "/stream?kind=planet",
    label: (n: number) => `${n} 颗星球`,
  },
  {
    key: "projects" as const,
    href: "/projects",
    label: (n: number) => `${n} 个项目引力场`,
  },
];

export function IdeaStarMap({ layout }: IdeaStarMapProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const legend = useMemo(
    () => [
      { label: "灵感星", color: "#818cf8", href: "/stream?kind=star" },
      { label: "已落地星球", color: "#6366f1", href: "/stream?kind=planet" },
      { label: "废弃流星", color: "#94a3b8", href: "/stream?kind=meteor" },
    ],
    []
  );

  const statValues = {
    today: layout.stats.todayCount,
    star: layout.stats.starCount,
    planet: layout.stats.planetCount,
    projects: layout.stats.activeProjects,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const FRAME_MS = 1000 / 18;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let raf = 0;
    let lastPaint = 0;
    let running = false;
    let inView = true;
    let pageVisible = document.visibilityState === "visible";
    let drawW = 0;
    let drawH = 0;
    let bgGradient: CanvasGradient | null = null;

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      drawW = rect.width;
      drawH = rect.height;
      canvas!.width = Math.floor(drawW * dpr);
      canvas!.height = Math.floor(drawH * dpr);
      canvas!.style.width = `${drawW}px`;
      canvas!.style.height = `${drawH}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgGradient = ctx!.createRadialGradient(
        drawW * 0.5,
        drawH * 0.45,
        0,
        drawW * 0.5,
        drawH * 0.5,
        drawW * 0.65
      );
      bgGradient.addColorStop(0, "#1e1b4b");
      bgGradient.addColorStop(0.55, "#0f172a");
      bgGradient.addColorStop(1, "#020617");
    }

    function drawBackground(t: number) {
      ctx!.fillStyle = bgGradient ?? "#0f172a";
      ctx!.fillRect(0, 0, drawW, drawH);

      for (let i = 0; i < 20; i++) {
        const sx = ((i * 73) % 1000) / 1000;
        const sy = ((i * 131) % 1000) / 1000;
        const blink = reduceMotion ? 0.35 : 0.25 + Math.sin(t * 0.02 + i) * 0.15;
        ctx!.fillStyle = `rgba(255,255,255,${blink})`;
        ctx!.fillRect(sx * drawW, sy * drawH, i % 5 === 0 ? 1.5 : 1, i % 5 === 0 ? 1.5 : 1);
      }
    }

    function drawAnchor(x: number, y: number, radius: number, color: string, title: string) {
      ctx!.globalAlpha = 0.35;
      ctx!.fillStyle = color;
      ctx!.beginPath();
      ctx!.arc(x, y, radius * 2.6, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalAlpha = 1;

      ctx!.strokeStyle = `${color}88`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.arc(x, y, radius * 1.8, 0, Math.PI * 2);
      ctx!.stroke();

      ctx!.fillStyle = color;
      ctx!.beginPath();
      ctx!.arc(x, y, radius, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = "rgba(255,255,255,0.75)";
      ctx!.font = "11px system-ui, sans-serif";
      ctx!.textAlign = "center";
      ctx!.fillText(title.length > 10 ? `${title.slice(0, 10)}…` : title, x, y + radius + 14);
    }

    function drawNode(node: StarMapNode, t: number) {
      const x = node.x * drawW;
      const y = node.y * drawH;

      if (node.kind === "meteor") {
        const progress = reduceMotion ? 0.35 : (t * 0.004 + node.twinklePhase) % 1;
        const mx = x + progress * drawW * 0.25;
        const my = y + progress * drawH * 0.12;
        ctx!.strokeStyle = "rgba(148,163,184,0.7)";
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(mx - 18, my - 8);
        ctx!.lineTo(mx, my);
        ctx!.stroke();
        ctx!.fillStyle = "rgba(203,213,225,0.9)";
        ctx!.beginPath();
        ctx!.arc(mx, my, node.radius, 0, Math.PI * 2);
        ctx!.fill();
        return;
      }

      const pulse = reduceMotion
        ? 1
        : node.kind === "star"
          ? 0.7 + Math.sin(t * 0.05 + node.twinklePhase) * 0.3
          : 1;
      const haloR = node.radius * (node.kind === "planet" ? 3.2 : 2.4);
      ctx!.globalAlpha = node.kind === "planet" ? 0.35 : 0.22 * pulse;
      ctx!.fillStyle = node.glow;
      ctx!.beginPath();
      ctx!.arc(x, y, haloR, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.globalAlpha = pulse;
      ctx!.fillStyle = node.color;
      ctx!.beginPath();
      ctx!.arc(x, y, node.radius, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalAlpha = 1;

      if (node.kind === "planet") {
        ctx!.strokeStyle = "rgba(255,255,255,0.35)";
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.ellipse(x, y, node.radius * 2.1, node.radius * 0.75, 0.4, 0, Math.PI * 2);
        ctx!.stroke();
      }
    }

    function paint() {
      if (drawW <= 0 || drawH <= 0) return;
      drawBackground(frame);

      for (const anchor of layoutRef.current.anchors) {
        drawAnchor(anchor.x * drawW, anchor.y * drawH, 7, anchor.color, anchor.title);
      }

      const nodes = layoutRef.current.nodes;
      for (const node of nodes) {
        if (node.kind !== "meteor") drawNode(node, frame);
      }
      for (const node of nodes) {
        if (node.kind === "meteor") drawNode(node, frame);
      }
      frame += 1;
    }

    function tick(now: number) {
      raf = 0;
      if (!running) return;
      if (now - lastPaint >= FRAME_MS) {
        lastPaint = now;
        paint();
      }
      raf = window.requestAnimationFrame(tick);
    }

    function startLoop() {
      if (running || reduceMotion) return;
      if (!inView || !pageVisible) return;
      running = true;
      lastPaint = 0;
      raf = window.requestAnimationFrame(tick);
    }

    function stopLoop() {
      running = false;
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    function onVisibility() {
      pageVisible = document.visibilityState === "visible";
      if (pageVisible) startLoop();
      else stopLoop();
    }

    resize();
    paint();
    if (!reduceMotion) startLoop();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      paint();
    });
    resizeObserver.observe(container);

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry?.isIntersecting ?? false;
        if (inView) startLoop();
        else stopLoop();
      },
      { threshold: 0.05 }
    );
    io.observe(container);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function hitTest(clientX: number, clientY: number): HoverTarget | null {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let bestNode: StarMapNode | null = null;
    let bestNodeDist = Infinity;
    let bestAnchor: StarMapAnchor | null = null;
    let bestAnchorDist = Infinity;

    for (const node of layout.nodes) {
      const nx = node.x * rect.width;
      const ny = node.y * rect.height;
      const dist = Math.hypot(nx - x, ny - y);
      const threshold = node.kind === "planet" ? 14 : 10;
      if (dist < threshold && dist < bestNodeDist) {
        bestNodeDist = dist;
        bestNode = node;
      }
    }

    for (const anchor of layout.anchors) {
      const ax = anchor.x * rect.width;
      const ay = anchor.y * rect.height;
      const dist = Math.hypot(ax - x, ay - y);
      if (dist < 22 && dist < bestAnchorDist) {
        bestAnchorDist = dist;
        bestAnchor = anchor;
      }
    }

    if (bestNode && (!bestAnchor || bestNodeDist <= bestAnchorDist)) {
      return { type: "node", node: bestNode, x, y };
    }
    if (bestAnchor) {
      return { type: "anchor", anchor: bestAnchor, x, y };
    }
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">我的创造宇宙</h2>
          <p className="mt-1 text-xs text-slate-400">
            灵感是星 · 落地成星球 · 废弃化作流星
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          {STAT_LINKS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="rounded-full bg-white/10 px-2.5 py-1 transition hover:bg-white/20 hover:text-white"
            >
              {item.label(statValues[item.key])}
            </Link>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`relative h-[360px] w-full md:h-[420px] ${hover ? "cursor-pointer" : "cursor-crosshair"}`}
        onMouseMove={(e) => {
          setHover(hitTest(e.clientX, e.clientY));
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const target = hitTest(e.clientX, e.clientY);
          if (!target) return;
          if (target.type === "node") router.push(target.node.href);
          else router.push(target.anchor.href);
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-white/15 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            {hover.type === "node" ? (
              <>
                <div className="font-medium">{hover.node.label}</div>
                <div className="mt-1 text-slate-400">
                  {hover.node.kind === "planet"
                    ? hover.node.status === "done"
                      ? "已完成 · 点击进入项目"
                      : "已转项目 · 点击进入项目"
                    : hover.node.kind === "meteor"
                      ? "已归档 · 点击查看"
                      : "灵感星 · 点击查看"}
                </div>
              </>
            ) : (
              <>
                <div className="font-medium">{hover.anchor.title}</div>
                <div className="mt-1 text-slate-400">项目引力场 · 点击进入</div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 px-5 py-3 text-xs text-slate-400">
        {legend.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="inline-flex items-center gap-1.5 transition hover:text-slate-200"
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.label}
          </Link>
        ))}
        <span className="ml-auto text-slate-500">悬停查看 · 点击跳转</span>
      </div>
    </section>
  );
}
