"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StarMapLayout, StarMapNode } from "@/lib/studio/idea-star-map";

type IdeaStarMapProps = {
  layout: StarMapLayout;
};

type HoverState = {
  node: StarMapNode;
  x: number;
  y: number;
};

export function IdeaStarMap({ layout }: IdeaStarMapProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const legend = useMemo(
    () => [
      { label: "灵感星", color: "#818cf8" },
      { label: "已落地星球", color: "#6366f1" },
      { label: "废弃流星", color: "#94a3b8" },
    ],
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = Math.floor(rect.width * dpr);
      canvas!.height = Math.floor(rect.height * dpr);
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawBackground(w: number, h: number, t: number) {
      const gradient = ctx!.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.65);
      gradient.addColorStop(0, "#1e1b4b");
      gradient.addColorStop(0.55, "#0f172a");
      gradient.addColorStop(1, "#020617");
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, w, h);

      for (let i = 0; i < 48; i++) {
        const sx = ((i * 73) % 1000) / 1000;
        const sy = ((i * 131) % 1000) / 1000;
        const blink = 0.25 + Math.sin(t * 0.02 + i) * 0.15;
        ctx!.fillStyle = `rgba(255,255,255,${blink})`;
        ctx!.beginPath();
        ctx!.arc(sx * w, sy * h, i % 5 === 0 ? 1.2 : 0.6, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawAnchor(x: number, y: number, radius: number, color: string, title: string) {
      const glow = ctx!.createRadialGradient(x, y, 0, x, y, radius * 3.2);
      glow.addColorStop(0, `${color}55`);
      glow.addColorStop(1, "transparent");
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(x, y, radius * 3.2, 0, Math.PI * 2);
      ctx!.fill();

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

    function drawNode(node: StarMapNode, w: number, h: number, t: number) {
      const x = node.x * w;
      const y = node.y * h;

      if (node.kind === "meteor") {
        const progress = (t * 0.004 + node.twinklePhase) % 1;
        const mx = x + progress * w * 0.25;
        const my = y + progress * h * 0.12;
        const trail = ctx!.createLinearGradient(mx - 24, my - 10, mx, my);
        trail.addColorStop(0, "transparent");
        trail.addColorStop(1, "rgba(148,163,184,0.85)");
        ctx!.strokeStyle = trail;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(mx - 24, my - 10);
        ctx!.lineTo(mx, my);
        ctx!.stroke();
        ctx!.fillStyle = "rgba(203,213,225,0.9)";
        ctx!.beginPath();
        ctx!.arc(mx, my, node.radius, 0, Math.PI * 2);
        ctx!.fill();
        return;
      }

      const pulse = node.kind === "star" ? 0.65 + Math.sin(t * 0.05 + node.twinklePhase) * 0.35 : 1;
      const glow = ctx!.createRadialGradient(x, y, 0, x, y, node.radius * (node.kind === "planet" ? 4 : 3));
      glow.addColorStop(0, `${node.glow}${node.kind === "planet" ? "aa" : "66"}`);
      glow.addColorStop(1, "transparent");
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(x, y, node.radius * (node.kind === "planet" ? 4 : 3), 0, Math.PI * 2);
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

    function render() {
      const rect = container!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      drawBackground(w, h, frame);

      for (const anchor of layoutRef.current.anchors) {
        drawAnchor(anchor.x * w, anchor.y * h, 7, anchor.color, anchor.title);
      }

      const meteors = layoutRef.current.nodes.filter((n) => n.kind === "meteor");
      const others = layoutRef.current.nodes.filter((n) => n.kind !== "meteor");
      for (const node of others) drawNode(node, w, h, frame);
      for (const node of meteors) drawNode(node, w, h, frame);

      frame += 1;
      raf = window.requestAnimationFrame(render);
    }

    resize();
    render();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, []);

  function hitTest(clientX: number, clientY: number): StarMapNode | null {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let hit: StarMapNode | null = null;
    let best = Infinity;

    for (const node of layout.nodes) {
      const nx = node.x * rect.width;
      const ny = node.y * rect.height;
      const dist = Math.hypot(nx - x, ny - y);
      const threshold = node.kind === "planet" ? 14 : 10;
      if (dist < threshold && dist < best) {
        best = dist;
        hit = node;
      }
    }
    return hit;
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
          <span className="rounded-full bg-white/10 px-2.5 py-1">今日 +{layout.stats.todayCount}</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1">{layout.stats.starCount} 颗星</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1">{layout.stats.planetCount} 颗星球</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1">{layout.stats.activeProjects} 个项目引力场</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[360px] w-full cursor-crosshair md:h-[420px]"
        onMouseMove={(e) => {
          const node = hitTest(e.clientX, e.clientY);
          if (!node) {
            setHover(null);
            return;
          }
          const rect = containerRef.current!.getBoundingClientRect();
          setHover({
            node,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const node = hitTest(e.clientX, e.clientY);
          if (node) router.push(node.href);
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-white/15 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <div className="font-medium">{hover.node.label}</div>
            <div className="mt-1 text-slate-400">
              {hover.node.kind === "planet"
                ? hover.node.status === "done"
                  ? "已完成"
                  : "已转项目"
                : hover.node.kind === "meteor"
                  ? "已归档"
                  : "灵感星"}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 px-5 py-3 text-xs text-slate-400">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="ml-auto text-slate-500">悬停查看 · 点击跳转</span>
      </div>
    </section>
  );
}
