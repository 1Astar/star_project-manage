/*! Star PM Bug Feedback Widget — vanilla, no deps */
(function () {
  if (typeof window === "undefined" || window.__STAR_PM_BUG_FEEDBACK__) return;
  window.__STAR_PM_BUG_FEEDBACK__ = true;

  function currentScript() {
    return document.currentScript || document.querySelector("script[data-star-bug-feedback]");
  }

  function cfgFrom(script) {
    if (!script) return {};
    return {
      token: script.getAttribute("data-token") || "",
      endpoint:
        script.getAttribute("data-endpoint") ||
        (script.src
          ? new URL("/api/public/bug-feedback", script.src).href
          : "/api/public/bug-feedback"),
      version: script.getAttribute("data-version") || "",
      label: script.getAttribute("data-label") || "反馈",
      offsetRight: script.getAttribute("data-offset-right") || "16",
      offsetBottom: script.getAttribute("data-offset-bottom") || "16",
    };
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function mount(options) {
    var opts = options || {};
    var token = opts.token || "";
    var endpoint = opts.endpoint || "/api/public/bug-feedback";
    var version = opts.version || "";
    var label = opts.label || "反馈";
    var offsetRight = opts.offsetRight || "16";
    var offsetBottom = opts.offsetBottom || "16";

    if (!token) {
      console.warn("[star-pm-bug-feedback] missing data-token");
      return function () {};
    }

    var host = document.createElement("div");
    host.setAttribute("data-star-bug-feedback-root", "1");
    host.style.cssText =
      "all:initial;position:fixed;z-index:2147483000;right:" +
      offsetRight +
      "px;bottom:" +
      offsetBottom +
      "px;font-family:system-ui,-apple-system,sans-serif;";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.setAttribute("aria-label", label);
    btn.style.cssText =
      "cursor:pointer;border:0;border-radius:999px;padding:10px 14px;background:#0f172a;color:#fff;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(15,23,42,.28);";

    var panel = document.createElement("div");
    panel.hidden = true;
    panel.style.cssText =
      "position:absolute;right:0;bottom:48px;width:min(320px,calc(100vw - 24px));background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px;padding:12px;box-shadow:0 16px 40px rgba(15,23,42,.2);";

    panel.innerHTML =
      '<div style="font-size:13px;font-weight:700;margin-bottom:8px">提交 Bug 反馈</div>' +
      '<textarea data-bf-text rows="4" placeholder="发生了什么？怎么复现？" style="width:100%;box-sizing:border-box;resize:vertical;border:1px solid #cbd5e1;border-radius:10px;padding:8px;font-size:13px;font-family:inherit;"></textarea>' +
      '<label style="display:block;margin-top:8px;font-size:12px;color:#64748b">可选截图' +
      '<input data-bf-file type="file" accept="image/*" style="display:block;margin-top:4px;font-size:12px" />' +
      "</label>" +
      '<div data-bf-meta style="margin-top:6px;font-size:11px;color:#94a3b8;word-break:break-all"></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;align-items:center">' +
      '<button data-bf-submit type="button" style="border:0;border-radius:999px;padding:8px 12px;background:#0369a1;color:#fff;font-size:12px;font-weight:600;cursor:pointer">提交</button>' +
      '<button data-bf-cancel type="button" style="border:0;border-radius:999px;padding:8px 12px;background:#f1f5f9;color:#334155;font-size:12px;cursor:pointer">取消</button>' +
      '<span data-bf-status style="font-size:12px;color:#64748b"></span>' +
      "</div>";

    host.appendChild(panel);
    host.appendChild(btn);
    document.body.appendChild(host);

    var textEl = panel.querySelector("[data-bf-text]");
    var fileEl = panel.querySelector("[data-bf-file]");
    var metaEl = panel.querySelector("[data-bf-meta]");
    var statusEl = panel.querySelector("[data-bf-status]");
    var submitEl = panel.querySelector("[data-bf-submit]");
    var cancelEl = panel.querySelector("[data-bf-cancel]");

    function refreshMeta() {
      var path = location.pathname + location.search;
      metaEl.textContent =
        "页面 " +
        path +
        (version ? " · v" + version : "");
    }

    function setOpen(open) {
      panel.hidden = !open;
      if (open) {
        refreshMeta();
        textEl.focus();
      }
    }

    btn.addEventListener("click", function () {
      setOpen(panel.hidden);
    });
    cancelEl.addEventListener("click", function () {
      setOpen(false);
    });

    submitEl.addEventListener("click", async function () {
      var description = (textEl.value || "").trim();
      if (!description) {
        statusEl.textContent = "请先写点内容";
        return;
      }
      submitEl.disabled = true;
      statusEl.textContent = "提交中…";
      try {
        var payload = {
          token: token,
          description: description,
          pagePath: location.pathname + location.search,
          pageUrl: location.href,
          appVersion: version || undefined,
          userAgent: navigator.userAgent,
        };
        var file = fileEl.files && fileEl.files[0];
        if (file) {
          var dataUrl = await fileToBase64(file);
          payload.screenshotBase64 = dataUrl;
          payload.screenshotMimeType = file.type || "image/png";
          payload.screenshotFileName = file.name || "screenshot.png";
        }
        var res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify(payload),
        });
        var data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) throw new Error(data.error || "提交失败");
        statusEl.textContent = data.requirementId ? "已提交并挂到需求" : "已提交到项目";
        textEl.value = "";
        fileEl.value = "";
        setTimeout(function () {
          setOpen(false);
          statusEl.textContent = "";
        }, 900);
      } catch (err) {
        statusEl.textContent = err && err.message ? err.message : "提交失败";
      } finally {
        submitEl.disabled = false;
      }
    });

    return function dispose() {
      host.remove();
    };
  }

  var script = currentScript();
  if (script) {
    script.setAttribute("data-star-bug-feedback", "1");
    var auto = cfgFrom(script);
    if (auto.token) mount(auto);
  }

  window.StarPmBugFeedback = { mount: mount };
})();
