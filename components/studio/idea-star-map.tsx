"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  tickForceLayout,
  visibleSubgraph,
  type GraphNode,
  type StarMapLayout,
} from "@/lib/studio/idea-star-map";
import { cn } from "@/lib/utils";

type Props = {
  layout: StarMapLayout;
  onOpenCalendar?: () => void;
};

type FilterMode = "today" | "all";

type ViewTransform = { scale: number; tx: number; ty: number };

type DragState =
  | { mode: "node"; id: string; moved: boolean }
  | { mode: "pan"; moved: boolean }
  | null;

function kindLabel(kind: GraphNode["kind"]) {
  if (kind === "idea") return "灵感";
  if (kind === "project") return "项目";
  return "板块";
}

const MIN_SCALE = 0.45;
const MAX_SCALE = 2.6;
const CLICK_MOVE_PX = 5;

export function IdeaStarMap({ layout }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterMode>("today");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [view, setView] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 });
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const dragRef = useRef<DragState>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [, bump] = useState(0);

  const { nodes, edges } = useMemo(
    () => visibleSubgraph(layout.graph, filter, expanded),
    [layout.graph, filter, expanded]
  );

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) : null;
  const hovered = hoverId ? nodes.find((n) => n.id === hoverId) : null;
  const focus = hovered ?? selected;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, r.width), h: Math.max(360, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const pos = positionsRef.current;
    for (const n of nodes) {
      if (pos.has(n.id)) continue;
      const parentEdge = edges.find((e) => e.to === n.id && pos.has(e.from));
      if (parentEdge) {
        const p = pos.get(parentEdge.from)!;
        const a = Math.random() * Math.PI * 2;
        pos.set(n.id, {
          x: p.x + Math.cos(a) * 70,
          y: p.y + Math.sin(a) * 70,
        });
      } else {
        pos.set(n.id, {
          x: size.w * (0.3 + Math.random() * 0.4),
          y: size.h * (0.3 + Math.random() * 0.4),
        });
      }
    }
  }, [nodes, edges, size.w, size.h]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    let frames = 0;
    const maxFrames = 90;

    function loop() {
      if (!alive) return;
      if (!dragRef.current || dragRef.current.mode === "pan") {
        tickForceLayout(
          positionsRef.current,
          nodes,
          edges,
          size.w,
          size.h,
          pinned
        );
        frames += 1;
        bump((x) => x + 1);
      }
      if (frames < maxFrames && nodes.length > 0) {
        raf = requestAnimationFrame(loop);
      }
    }
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [nodes, edges, size.w, size.h, expanded, filter, pinned]);

  function screenToWorld(clientX: number, clientY: number) {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    return {
      x: (sx - view.tx) / view.scale,
      y: (sy - view.ty) / view.scale,
    };
  }

  function resetExpand() {
    setExpanded(new Set());
    setSelectedId(null);
  }

  function resetView() {
    setView({ scale: 1, tx: 0, ty: 0 });
  }

  function toggleExpand(node: GraphNode) {
    setSelectedId(node.id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

  function onNodePointerDown(node: GraphNode, e: ReactPointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode: "node", id: node.id, moved: false };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setSelectedId(node.id);
    setPinned((prev) => new Set(prev).add(node.id));
  }

  function onBackgroundPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    dragRef.current = { mode: "pan", moved: false };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const drag = dragRef.current;
    const last = lastPointerRef.current;
    if (!drag || !last) return;

    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    if (Math.hypot(dx, dy) > CLICK_MOVE_PX) drag.moved = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };

    if (drag.mode === "pan") {
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);
    const p = positionsRef.current.get(drag.id);
    if (p) {
      p.x = world.x;
      p.y = world.y;
      bump((x) => x + 1);
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    lastPointerRef.current = null;

    if (!drag) return;

    if (drag.mode === "pan") {
      if (!drag.moved) setSelectedId(null);
      return;
    }

    const node = nodes.find((n) => n.id === drag.id);
    if (!node) return;

    if (!drag.moved) {
      if (e.detail >= 2 && node.href) {
        router.push(node.href);
        return;
      }
      if (node.childCount > 0) toggleExpand(node);
      else if (node.href) router.push(node.href);
    }
  }

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    setView((v) => {
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const ratio = nextScale / v.scale;
      // 以光标为缩放中心
      return {
        scale: nextScale,
        tx: mx - (mx - v.tx) * ratio,
        ty: my - (my - v.ty) * ratio,
      };
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d12] shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">创造星图</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            拖节点 · 滚轮缩放 · 拖空白平移 · 单击展开 · 双击打开
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-black/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setFilter("today");
                resetExpand();
              }}
              className={cn(
                "rounded-full px-3 py-1.5 transition",
                filter === "today"
                  ? "bg-white/15 text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              今日
              <span className="ml-1 tabular-nums text-slate-500">
                {layout.stats.todayCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                resetExpand();
              }}
              className={cn(
                "rounded-full px-3 py-1.5 transition",
                filter === "all"
                  ? "bg-white/15 text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              全部
              <span className="ml-1 tabular-nums text-slate-500">
                {layout.stats.activeProjects}
              </span>
            </button>
          </div>
          {expanded.size > 0 ? (
            <button
              type="button"
              onClick={resetExpand}
              className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
            >
              收起全部
            </button>
          ) : null}
          <button
            type="button"
            onClick={resetView}
            className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
          >
            复位视图 {Math.round(view.scale * 100)}%
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[440px] w-full touch-none md:h-[520px]"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, #151822 0%, #0b0d12 55%, #07080c 100%)",
          }}
        />

        <svg className="absolute inset-0 h-full w-full" width={size.w} height={size.h}>
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {edges.map((e) => {
              const a = positionsRef.current.get(e.from);
              const b = positionsRef.current.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={`${e.from}-${e.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth={1 / view.scale}
                />
              );
            })}

            {nodes.map((n) => {
              const p = positionsRef.current.get(n.id);
              if (!p) return null;
              const isOpen = expanded.has(n.id);
              const isFocus = focus?.id === n.id;
              const r = n.radius + (isFocus ? 2 : 0) + (isOpen ? 1 : 0);
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x},${p.y})`}
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(ev) => onNodePointerDown(n, ev)}
                  onMouseEnter={() => setHoverId(n.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  {n.childCount > 0 ? (
                    <circle
                      r={r + 5}
                      fill="none"
                      stroke={
                        isOpen ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)"
                      }
                      strokeWidth={1 / view.scale}
                      strokeDasharray={isOpen ? undefined : "2 3"}
                    />
                  ) : null}
                  <circle
                    r={r}
                    fill={n.color}
                    opacity={0.95}
                    style={{
                      filter: isFocus ? `drop-shadow(0 0 8px ${n.color})` : undefined,
                    }}
                  />
                  {n.childCount > 0 && !isOpen ? (
                    <circle cx={r * 0.65} cy={-r * 0.65} r={3.2} fill="#f43f5e" />
                  ) : null}
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fill={isFocus ? "#f8fafc" : "#94a3b8"}
                    fontSize={11}
                    fontFamily="system-ui,sans-serif"
                  >
                    {n.label.length > 10 ? `${n.label.slice(0, 10)}…` : n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            {filter === "today" ? "今天还没有灵感节点" : "暂无项目节点"}
          </div>
        ) : null}

        {focus ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 md:left-auto md:right-3 md:w-72">
            <div className="rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2.5 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: focus.color }}
                />
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {kindLabel(focus.kind)}
                </span>
                {expanded.has(focus.id) ? (
                  <span className="text-[10px] text-emerald-400/90">已展开</span>
                ) : focus.childCount > 0 ? (
                  <span className="text-[10px] text-rose-400/90">
                    可展开 {focus.childCount}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-sm font-medium text-white">{focus.label}</div>
              {focus.detail ? (
                <div className="mt-0.5 text-xs leading-relaxed text-slate-400">
                  {focus.detail}
                </div>
              ) : null}
              <div className="mt-1.5 text-[10px] text-slate-600">
                拖动摆位置 · 滚轮缩放 · 空白处拖动画布
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4 border-t border-white/10 px-4 py-2.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-indigo-400" /> 项目
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-400" /> 板块
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-300" /> 灵感
        </span>
        <span className="ml-auto text-slate-600">
          {filter === "today"
            ? "今日：灵感 → 项目 → 板块"
            : "全部：项目 → 板块 → 灵感"}
        </span>
      </div>
    </section>
  );
}
