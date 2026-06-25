"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  saveAcceptanceAction,
  syncPrototypeAnnotationsAction,
  updateTaskStatusAction,
} from "@/lib/actions";
import {
  ROLE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_FLOW,
  type AcceptanceItem,
  type PinmarkAnnotationPayload,
  type Prototype,
  type PrototypeAnnotation,
  type Requirement,
  type RoleTask,
  type TaskStatus,
} from "@/lib/types";
import { StatusBadge } from "@/components/ui";

type WorkspaceMode = "browse" | "review" | "pinmark";

type PinmarkMessage =
  | { source: "pinmark"; type: "ready"; payload?: undefined }
  | {
      source: "pinmark";
      type: "annotations-changed";
      payload: { projectId: string | null; annotations: PinmarkAnnotationPayload[] };
    }
  | {
      source: "pinmark";
      type: "annotation-selected";
      payload: {
        annotationId: string;
        acceptanceItemId: string | null;
        requirementId: string | null;
      };
    }
  | {
      source: "pinmark";
      type: "bind-complete";
      payload: { annotationId: string; acceptanceItemId: string };
    };

export function PrototypeWorkspace({
  projectId,
  projectSlug,
  projectName,
  requirements,
  acceptanceItems,
  savedAnnotations,
  tasks,
  prototypes,
}: {
  projectId: string;
  projectSlug: string;
  projectName: string;
  requirements: Requirement[];
  acceptanceItems: AcceptanceItem[];
  savedAnnotations: PrototypeAnnotation[];
  tasks: RoleTask[];
  prototypes: Prototype[];
}) {
  const [mode, setMode] = useState<WorkspaceMode>("browse");
  const [selectedReqId, setSelectedReqId] = useState(requirements[0]?.id ?? "");
  const [selectedAcceptanceId, setSelectedAcceptanceId] = useState(
    acceptanceItems[0]?.id ?? ""
  );
  const [scale, setScale] = useState(100);
  const [pinmarkReady, setPinmarkReady] = useState(false);
  const [liveAnnotations, setLiveAnnotations] = useState<PinmarkAnnotationPayload[]>([]);
  const [bindHint, setBindHint] = useState<string | null>(null);
  const pinmarkRef = useRef<HTMLIFrameElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedReq = requirements.find((r) => r.id === selectedReqId);
  const prototype =
    prototypes.find((p) => p.requirement_id === selectedReqId) ?? prototypes[0];

  const sidebarTasks = useMemo(
    () => tasks.filter((t) => t.requirement_id === selectedReqId),
    [tasks, selectedReqId]
  );

  const prototypeSrc = prototype?.external_url ?? prototype?.storage_path ?? null;

  const restoredPayloads = useMemo(
    () =>
      savedAnnotations.map((item) => ({
        ...(item.payload as PinmarkAnnotationPayload),
        id: item.pinmark_id,
        starPmAcceptanceItemId: item.acceptance_item_id,
        starPmRequirementId: item.requirement_id,
        title: item.title ?? (item.payload as PinmarkAnnotationPayload).title,
        description:
          item.description ?? (item.payload as PinmarkAnnotationPayload).description,
        type: item.annotation_type ?? (item.payload as PinmarkAnnotationPayload).type,
        shape: item.shape ?? (item.payload as PinmarkAnnotationPayload).shape,
      })),
    [savedAnnotations]
  );

  const bindingsByAcceptance = useMemo(() => {
    const map = new Map<string, PinmarkAnnotationPayload[]>();
    const source = liveAnnotations.length ? liveAnnotations : restoredPayloads;
    source.forEach((annotation) => {
      const key = annotation.starPmAcceptanceItemId;
      if (!key) return;
      const list = map.get(key) ?? [];
      list.push(annotation);
      map.set(key, list);
    });
    return map;
  }, [liveAnnotations, restoredPayloads]);

  const postToPinmark = useCallback((type: string, payload: Record<string, unknown>) => {
    pinmarkRef.current?.contentWindow?.postMessage(
      { source: "star-pm", type, payload },
      window.location.origin
    );
  }, []);

  const initPinmark = useCallback(() => {
    postToPinmark("init", {
      projectId,
      requirements: requirements.map((req) => ({ id: req.id, title: req.title })),
      acceptanceItems: acceptanceItems.map((item) => ({
        id: item.id,
        requirement_id: item.requirement_id,
        description: item.description,
      })),
      savedAnnotations: restoredPayloads,
    });
  }, [acceptanceItems, postToPinmark, projectId, requirements, restoredPayloads]);

  const scheduleSync = useCallback(
    (annotations: PinmarkAnnotationPayload[]) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        void syncPrototypeAnnotationsAction({
          projectId,
          annotations,
          actorName: "产品",
        });
      }, 800);
    },
    [projectId]
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as PinmarkMessage;
      if (!data || data.source !== "pinmark") return;

      if (data.type === "ready") {
        setPinmarkReady(true);
        initPinmark();
        return;
      }

      if (data.type === "annotations-changed") {
        setLiveAnnotations(data.payload.annotations);
        scheduleSync(data.payload.annotations);
        return;
      }

      if (data.type === "annotation-selected") {
        if (data.payload.acceptanceItemId) {
          setSelectedAcceptanceId(data.payload.acceptanceItemId);
        }
        if (data.payload.requirementId) {
          setSelectedReqId(data.payload.requirementId);
        }
        return;
      }

      if (data.type === "bind-complete") {
        setSelectedAcceptanceId(data.payload.acceptanceItemId);
        setBindHint(null);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [initPinmark, scheduleSync]);

  useEffect(() => {
    if (mode === "pinmark" && pinmarkReady) {
      initPinmark();
    }
  }, [mode, pinmarkReady, initPinmark]);

  function startBindAcceptance(item: AcceptanceItem) {
    setSelectedAcceptanceId(item.id);
    setSelectedReqId(item.requirement_id);
    setBindHint(`请在左侧原型上点击或框选，创建标注并绑定到「${item.description}」`);
    postToPinmark("bind-next", {
      acceptanceItemId: item.id,
      requirementId: item.requirement_id,
    });
  }

  function focusAcceptanceAnnotation(item: AcceptanceItem) {
    setSelectedAcceptanceId(item.id);
    setSelectedReqId(item.requirement_id);
    postToPinmark("select-acceptance", { acceptanceItemId: item.id });
  }

  const acceptanceForSelectedReq = acceptanceItems.filter(
    (item) => item.requirement_id === selectedReqId
  );

  return (
    <div className="pinmark-shell">
      <header className="pinmark-topbar">
        <div className="pinmark-brand">
          <span className="pinmark-logo">PM</span>
          <div>
            <strong>Star PM</strong>
            <span> 原型工作区</span>
          </div>
        </div>

        <div className="pinmark-title">{projectName}</div>

        <div className="pinmark-mode-switch">
          <button
            type="button"
            className={mode === "browse" ? "active" : ""}
            onClick={() => setMode("browse")}
          >
            浏览
          </button>
          <button
            type="button"
            className={mode === "review" ? "active" : ""}
            onClick={() => setMode("review")}
          >
            验收
          </button>
          <button
            type="button"
            className={mode === "pinmark" ? "active" : ""}
            onClick={() => setMode("pinmark")}
          >
            标注
          </button>
        </div>

        <div className="pinmark-toolbar">
          {mode !== "pinmark" ? (
            <>
              <button
                type="button"
                className="pinmark-tool-btn"
                onClick={() => setScale((s) => Math.max(50, s - 10))}
                title="缩小"
              >
                −
              </button>
              <span className="pinmark-scale">{scale}%</span>
              <button
                type="button"
                className="pinmark-tool-btn"
                onClick={() => setScale((s) => Math.min(150, s + 10))}
                title="放大"
              >
                +
              </button>
            </>
          ) : null}
          <a
            href="/pinmark/pinmark.html"
            target="_blank"
            rel="noreferrer"
            className="pinmark-tool-btn"
          >
            独立 PinMark
          </a>
          <Link href={`/projects/${projectSlug}/settings`} className="pinmark-tool-btn">
            上传原型
          </Link>
        </div>
      </header>

      {bindHint ? <div className="pinmark-bind-hint">{bindHint}</div> : null}

      <div className="pinmark-workspace">
        <section className="pinmark-stage-panel">
          <div className="pinmark-stage-wrap">
            {mode === "pinmark" ? (
              <iframe
                ref={pinmarkRef}
                title="PinMark 标注工具"
                src="/pinmark/pinmark.html?embed=star-pm"
                className="pinmark-frame-iframe pinmark-frame-full"
                sandbox="allow-scripts allow-same-origin allow-downloads"
              />
            ) : (
              <div
                className="pinmark-frame-shell"
                style={{ transform: `scale(${scale / 100})`, transformOrigin: "top center" }}
              >
                {prototypeSrc ? (
                  <iframe
                    title="prototype"
                    src={prototypeSrc}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    className="pinmark-frame-iframe"
                  />
                ) : (
                  <div className="pinmark-empty">
                    <p>尚未上传 HTML 原型或关联外链</p>
                    <p className="pinmark-empty-hint">
                      在
                      <Link href={`/projects/${projectSlug}/settings`}>项目设置</Link>
                      上传 ZIP / 填写链接；或切换到「标注」模式，在 PinMark 中导入 HTML
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="pinmark-side-panel">
          <div className="pinmark-side-head">
            <h2>{mode === "review" ? "验收清单" : mode === "pinmark" ? "验收绑定" : "需求列表"}</h2>
            <span>
              {mode === "pinmark" || mode === "review"
                ? `${acceptanceItems.length} 项验收`
                : `${requirements.length} 项需求`}
            </span>
          </div>

          {mode === "pinmark" || mode === "review" ? (
            <div className="pinmark-annotation-list">
              {requirements.map((req) => {
                const items = acceptanceItems.filter((item) => item.requirement_id === req.id);
                if (!items.length) return null;
                return (
                  <div key={req.id} className="pinmark-req-group">
                    <div className="pinmark-req-group-title">{req.title}</div>
                    {items.map((item) => {
                      const linked = bindingsByAcceptance.get(item.id) ?? [];
                      const active = item.id === selectedAcceptanceId;
                      return (
                        <div
                          key={item.id}
                          className={`pinmark-acceptance-item ${active ? "active" : ""}`}
                        >
                          <button
                            type="button"
                            className="pinmark-acceptance-main"
                            onClick={() => {
                              setSelectedAcceptanceId(item.id);
                              setSelectedReqId(item.requirement_id);
                            }}
                          >
                            <span className="pinmark-pin pinmark-pin-sm">
                              {linked.length || "·"}
                            </span>
                            <div>
                              <div className="pinmark-annotation-title">{item.description}</div>
                              <div className="pinmark-annotation-meta">
                                {linked.length
                                  ? `已绑定 ${linked.length} 条标注`
                                  : "尚未绑定原型标注"}
                              </div>
                            </div>
                          </button>
                          <div className="pinmark-acceptance-actions">
                            {mode === "pinmark" ? (
                              <>
                                <button
                                  type="button"
                                  className="pinmark-mini-btn primary"
                                  onClick={() => startBindAcceptance(item)}
                                >
                                  绑定标注
                                </button>
                                {linked.length ? (
                                  <button
                                    type="button"
                                    className="pinmark-mini-btn"
                                    onClick={() => focusAcceptanceAnnotation(item)}
                                  >
                                    定位
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                            {mode === "review" ? (
                              <>
                                <button
                                  type="button"
                                  className="pinmark-mini-btn pass"
                                  onClick={() =>
                                    void saveAcceptanceAction({
                                      itemId: item.id,
                                      passed: true,
                                      projectId,
                                      requirementId: item.requirement_id,
                                      actorName: "产品",
                                    })
                                  }
                                >
                                  通过
                                </button>
                                <button
                                  type="button"
                                  className="pinmark-mini-btn fail"
                                  onClick={() =>
                                    void saveAcceptanceAction({
                                      itemId: item.id,
                                      passed: false,
                                      projectId,
                                      requirementId: item.requirement_id,
                                      actorName: "产品",
                                    })
                                  }
                                >
                                  不通过
                                </button>
                              </>
                            ) : null}
                          </div>
                          {item.passed !== null ? (
                            <div
                              className={`pinmark-acceptance-status ${
                                item.passed ? "passed" : "failed"
                              }`}
                            >
                              {item.passed ? "已通过" : "未通过"}
                              {item.note ? ` · ${item.note}` : ""}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pinmark-annotation-list">
              {requirements.map((req, index) => {
                const reqTasks = tasks.filter((t) => t.requirement_id === req.id);
                const active = req.id === selectedReqId;
                return (
                  <button
                    key={req.id}
                    type="button"
                    className={`pinmark-annotation-item ${active ? "active" : ""}`}
                    onClick={() => setSelectedReqId(req.id)}
                  >
                    <span className="pinmark-pin">{index + 1}</span>
                    <div className="pinmark-annotation-body">
                      <div className="pinmark-annotation-title">{req.title}</div>
                      {req.sub_function ? (
                        <div className="pinmark-annotation-meta">{req.sub_function}</div>
                      ) : null}
                      <div className="pinmark-annotation-meta">
                        {reqTasks.map((t) => ROLE_LABELS[t.role]).join(" · ") || "待拆分任务"}
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </button>
                );
              })}
            </div>
          )}

          {selectedReq ? (
            <div className="pinmark-editor">
              <div className="pinmark-editor-head">当前需求</div>
              <h3>{selectedReq.title}</h3>
              {selectedReq.acceptance_criteria ? (
                <div className="pinmark-editor-block">
                  <div className="pinmark-editor-label">验收标准</div>
                  <p>{selectedReq.acceptance_criteria}</p>
                </div>
              ) : null}
              {selectedReq.detail_work ? (
                <div className="pinmark-editor-block">
                  <div className="pinmark-editor-label">详细说明</div>
                  <p>{selectedReq.detail_work}</p>
                </div>
              ) : null}

              {mode === "review" && acceptanceForSelectedReq.length > 0 ? (
                <div className="pinmark-editor-block">
                  <div className="pinmark-editor-label">本需求验收项</div>
                  <ul className="pinmark-inline-list">
                    {acceptanceForSelectedReq.map((item) => (
                      <li key={item.id}>{item.description}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {mode === "review" && sidebarTasks.length > 0 ? (
                <div className="pinmark-task-list">
                  {sidebarTasks.map((task) => (
                    <CompactTaskRow key={task.id} task={task} projectId={projectId} />
                  ))}
                </div>
              ) : null}

              <Link
                href={`/projects/${projectSlug}/requirements/${selectedReq.id}`}
                className="pinmark-link-btn"
              >
                打开需求详情 →
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function CompactTaskRow({
  task,
  projectId,
}: {
  task: RoleTask;
  projectId: string;
}) {
  return (
    <div className="pinmark-task-row">
      <div className="pinmark-task-row-head">
        <span>
          {ROLE_LABELS[task.role]}
          {task.assignee ? ` · ${task.assignee}` : ""}
        </span>
        <StatusBadge status={task.status} />
      </div>
      <div className="pinmark-task-actions">
        {TASK_STATUS_FLOW.slice(0, 5).map((status) => (
          <button
            key={status}
            type="button"
            className={task.status === status ? "active" : ""}
            onClick={() =>
              updateTaskStatusAction({
                taskId: task.id,
                status,
                actorName: "产品",
                actorRole: "admin",
                projectId,
              })
            }
          >
            {TASK_STATUS_LABELS[status as TaskStatus]}
          </button>
        ))}
      </div>
      {task.notes ? <p className="pinmark-task-note">{task.notes}</p> : null}
    </div>
  );
}
