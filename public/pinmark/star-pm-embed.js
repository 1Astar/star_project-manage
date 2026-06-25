(function initStarPmEmbed() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("embed") !== "star-pm") return;

  const starPm = {
    projectId: null,
    requirements: [],
    acceptanceItems: [],
    pendingBind: null,
    ready: false,
  };

  function whenReady(fn) {
    if (window.__PinMark) {
      fn(window.__PinMark);
      return;
    }
    setTimeout(() => whenReady(fn), 40);
  }

  function notifyParent(type, payload) {
    if (window.parent === window) return;
    window.parent.postMessage(
      { source: "pinmark", type, payload },
      window.location.origin
    );
  }

  function annotationExportList(pm) {
    return pm.state.annotations.map((annotation) => ({
      id: annotation.id,
      type: annotation.type,
      title: annotation.title,
      description: annotation.description,
      shape: annotation.shape,
      starPmAcceptanceItemId: annotation.starPmAcceptanceItemId || null,
      starPmRequirementId: annotation.starPmRequirementId || null,
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
      positionMode: annotation.positionMode,
      anchorPath: annotation.anchorPath,
      surfaceKey: annotation.surfaceKey,
      pageContext: annotation.pageContext,
      anchorRect: annotation.anchorRect,
      anchorRectMode: annotation.anchorRectMode,
      anchorScrollX: annotation.anchorScrollX,
      anchorScrollY: annotation.anchorScrollY,
      createdAt: annotation.createdAt,
    }));
  }

  function emitSync(pm) {
    notifyParent("annotations-changed", {
      projectId: starPm.projectId,
      annotations: annotationExportList(pm),
    });
  }

  function mergeSavedAnnotations(pm, saved) {
    if (!Array.isArray(saved) || !saved.length) return;
    const existingIds = new Set(pm.state.annotations.map((item) => item.id));
    saved.forEach((item) => {
      if (!item?.id || existingIds.has(item.id)) return;
      pm.state.annotations.push({ ...item });
      existingIds.add(item.id);
    });
    if (pm.state.annotations.length && !pm.state.selectedId) {
      pm.state.selectedId = pm.state.annotations[0].id;
    }
    pm.renderAll();
    pm.scheduleSave();
  }

  function applyBindingsToAnnotations(pm) {
    pm.state.annotations.forEach((annotation) => {
      if (!annotation.starPmAcceptanceItemId && starPm.pendingBind) return;
    });
    pm.renderAll();
  }

  function patchEditor(pm) {
    const annotation = pm.state.annotations.find((item) => item.id === pm.state.selectedId);
    if (!annotation || !pm.els.editor) return;

    const block = document.createElement("div");
    block.className = "field star-pm-bind-field";
    block.innerHTML = `
      <label for="starPmAcceptance">关联验收项</label>
      <select id="starPmAcceptance">
        <option value="">未关联</option>
        ${starPm.acceptanceItems
          .map((item) => {
            const req = starPm.requirements.find((r) => r.id === item.requirement_id);
            const label = req ? `${req.title} · ${item.description}` : item.description;
            const selected =
              annotation.starPmAcceptanceItemId === item.id ? "selected" : "";
            return `<option value="${item.id}" data-req="${item.requirement_id}" ${selected}>${escapeHtml(
              label
            )}</option>`;
          })
          .join("")}
      </select>
    `;

    const existing = pm.els.editor.querySelector(".star-pm-bind-field");
    if (existing) existing.remove();
    pm.els.editor.insertBefore(block, pm.els.editor.firstChild);

    const select = block.querySelector("#starPmAcceptance");
    select?.addEventListener("change", (event) => {
      const target = event.target;
      const option = target.selectedOptions[0];
      const acceptanceId = target.value || null;
      const requirementId = option?.dataset?.req || null;
      annotation.starPmAcceptanceItemId = acceptanceId;
      annotation.starPmRequirementId = requirementId;
      pm.renderList();
      pm.scheduleSave();
      emitSync(pm);
      notifyParent("annotation-bound", {
        annotationId: annotation.id,
        acceptanceItemId: acceptanceId,
        requirementId,
      });
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  whenReady((pm) => {
    document.body.classList.add("star-pm-embed");

    const style = document.createElement("style");
    style.textContent = `
      body.star-pm-embed .side-panel { display: none !important; }
      body.star-pm-embed .workspace { grid-template-columns: minmax(0, 1fr) !important; }
      body.star-pm-embed .topbar .brand span:last-child { display: none; }
      body.star-pm-embed .star-pm-bind-field select { width: 100%; }
    `;
    document.head.appendChild(style);

    const origCreate = pm.createAnnotationFromGesture;
    pm.createAnnotationFromGesture = function patchedCreate(start, end) {
      origCreate(start, end);
      if (starPm.pendingBind && pm.state.selectedId) {
        const annotation = pm.state.annotations.find((item) => item.id === pm.state.selectedId);
        if (annotation) {
          annotation.starPmAcceptanceItemId = starPm.pendingBind.acceptanceItemId;
          annotation.starPmRequirementId = starPm.pendingBind.requirementId;
          starPm.pendingBind = null;
          pm.renderAll();
          notifyParent("bind-complete", {
            annotationId: annotation.id,
            acceptanceItemId: annotation.starPmAcceptanceItemId,
          });
        }
      }
      emitSync(pm);
    };

    const origScheduleSave = pm.scheduleSave;
    pm.scheduleSave = function patchedSave() {
      origScheduleSave();
      if (starPm.ready) emitSync(pm);
    };

    const origRenderAll = pm.renderAll;
    pm.renderAll = function patchedRenderAll() {
      origRenderAll();
      patchEditor(pm);
    };

    const origSelect = pm.selectAnnotation;
    pm.selectAnnotation = function patchedSelect(id, shouldScroll) {
      origSelect(id, shouldScroll);
      const annotation = pm.state.annotations.find((item) => item.id === id);
      notifyParent("annotation-selected", {
        annotationId: id,
        acceptanceItemId: annotation?.starPmAcceptanceItemId ?? null,
        requirementId: annotation?.starPmRequirementId ?? null,
      });
    };

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== "star-pm") return;

      if (data.type === "init") {
        starPm.projectId = data.payload?.projectId ?? null;
        starPm.requirements = data.payload?.requirements ?? [];
        starPm.acceptanceItems = data.payload?.acceptanceItems ?? [];
        starPm.ready = true;
        mergeSavedAnnotations(pm, data.payload?.savedAnnotations ?? []);
        applyBindingsToAnnotations(pm);
        emitSync(pm);
        return;
      }

      if (data.type === "bind-next") {
        starPm.pendingBind = {
          acceptanceItemId: data.payload?.acceptanceItemId,
          requirementId: data.payload?.requirementId,
        };
        if (pm.state.html) {
          pm.setMode("annotate");
        }
        notifyParent("bind-pending", { acceptanceItemId: starPm.pendingBind.acceptanceItemId });
        return;
      }

      if (data.type === "select-annotation") {
        const id = data.payload?.annotationId;
        if (id) pm.selectAnnotation(id, true);
        return;
      }

      if (data.type === "select-acceptance") {
        const acceptanceItemId = data.payload?.acceptanceItemId;
        const linked = pm.state.annotations.find(
          (item) => item.starPmAcceptanceItemId === acceptanceItemId
        );
        if (linked) {
          pm.selectAnnotation(linked.id, true);
        }
      }
    });

    notifyParent("ready", {});
  });
})();
