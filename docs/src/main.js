import { WebViewer } from "@rerun-io/web-viewer";

/* =====================================================================
   THREE viewers on this page, each its own WebViewer instance (own wasm
   runtime, own memory), lazily booted when scrolled into view:

     (6) SINGLE-STEP (#singlestep) — the MAIN full-geometry results. One
         mode; visible/occluded/interior/ambient are entity toggles.
     (7) BENCHMARK   (#adyton)     — a glimpse of the raw ADYTON labels. One
         mode; just the 8 scene tabs.
     (8) ROLLOUT     (#rollout)    — zero-shot autoregressive rollout, with a
         Single-view / Multi-view mode toggle.

   THE THINGS YOU EDIT:
   - SCENES below: the 8 ADYTON scenes (id, label, base filename), used by
     rolloutSingleView and benchmark.
   - The four scenario lists (singlestep / benchmark / rolloutSingleView /
     rolloutMultiView), one entry per recording {file, rec, rbl}. Recordings
     live under public/recordings/<list>/ with their .rbl blueprints in a
     blueprints/ subfolder. `rolloutSingleView` and `benchmark` have all 8
     scenes (benchmark ships two persistent-deformation samples, so 9 tabs);
     `singlestep` and `rolloutMultiView` have only the glancing-hit scene so
     far ([[FILL]] append the rest as they arrive).

   Per-entry fields:
   - `file` is resolved against public/recordings/ (or set `url` for an
     absolute URL on a GitHub Release / Hugging Face).
   - `rec` is the recording id (`rerun rrd print file.rrd`). It makes tab
     switches activate the right recording instantly. An undeclared id still
     works while it is the only one loading.
   - `rbl` (optional) is a saved Rerun blueprint. It is app-scoped — it binds
     by application_id, so it styles ONLY its matching recording. Blueprints
     do NOT migrate across versions: keep @rerun-io/web-viewer in package.json
     equal to the rerun version that SAVED the .rbl (currently 0.34.0).
   - Keep conditions (surface/ambient/interior/occluded, ours vs gt) INSIDE
     each recording as sibling entity paths, toggled under a fixed camera. Do
     NOT make them separate recordings.

   VERSION MATCH: recording *data* is migrated across versions on load (the
   0.23.4 eval files work in the 0.34 viewer); blueprints are not.
===================================================================== */
const BASE = import.meta.env.BASE_URL || "/";
// Resolve a path against public/recordings/; absolute URLs (e.g. a Hugging
// Face `/resolve/` link) pass through untouched, so `file:` and `rbl:` accept
// either form.
const abs = (rel) =>
  /^https?:\/\//.test(rel) ? rel : new URL(BASE + "recordings/" + rel, window.location.href).href;
// Recordings too large for GitHub (>100 MB/file, >1 GB Pages site) are served
// from this Hugging Face dataset, mirroring the public/recordings/ layout.
const HF = "https://huggingface.co/datasets/AlexPeng/delphi-recordings/resolve/main/";

// The 8 ADYTON scenes, shared across every mode of both viewers. Grouped:
// contact/collision (cc), deformation (df), free/gravity motion (fg).
const SCENES = [
  { id: "direct",       label: "Direct Hit",              base: "cc_direct_eval_0186_delphi_fg_f70",       rec: "2ee3c1b0abf246e590d8a21f81293bea" },
  { id: "glancing",     label: "Glancing Hit",            base: "cc_glancing_eval_0003_delphi_fg",         rec: "3f90e6a22e6a40e7ab72b3914044c906" },
  { id: "simultaneous", label: "Simultaneous Hit",        base: "cc_simultaneous_eval_0017_delphi_fg",     rec: "5fcf5ed3db17424287e7664145c20efc" },
  { id: "persistent",   label: "Persistent deformation",  base: "df_persistent_eval_0016_delphi_fg_f90",   rec: "4f548b761aaf459eb312366d492b7b86" },
  { id: "recovery",     label: "Recoverable deformation", base: "df_recovery_eval_0038_delphi_fg_f70",     rec: "84c180c76c8f4fed87573c57146b7abd" },
  { id: "freefall",     label: "Freefall Motion",         base: "fg_freefall_eval_0012_delphi_fg",         rec: "37ef19a69fd94e2ba24243e0ef6847fd" },
  { id: "projectile",   label: "Projectile Motion",       base: "fg_projectile_eval_0049_delphi_fg_f90",   rec: "1425316889934b0f8f38ccbddd5b37f6" },
  { id: "spin",         label: "Spin-dominant Motion",    base: "fg_spin_dominant_eval_0031_delphi_fg_f90", rec: "0df9cd0eab38434893b103ac4aa4ed3c" },
];

// --- (1) Single-step full-geometry prediction — THE MAIN RESULTS ---------
// One prediction per observation across the whole geometry: predicted vs
// ground-truth material points and displacement arrows (world/x_pred,
// world/arrows_pred vs world/x_target, world/arrows_gt) plus the ambient
// off-surface field — all sibling entity paths INSIDE each recording, toggled
// under a fixed camera. Files live in public/recordings/singlestep_full/.
//
// One saved blueprint styles ALL four scenes: the recordings were relabeled to
// a single shared application_id (`field_single_step_delphi`) with
// `rerun rrd route --application-id`, so the app-scoped .rbl in blueprints/
// binds to every scene — no per-recording blueprint needed. The relabel is a
// lossless metadata change; each recording's `rec` (recording id, what the
// tabs switch on) is unchanged. [[FILL]] append more scenes as they arrive
// (get `rec` from `rerun rrd print`); give each the same shared app id so this
// one blueprint keeps applying.
const SS_RBL =
  "singlestep_full/blueprints/field_single_step_cc_simultaneous_eval_0001_delphi.rbl";
const singlestep = [
  { id: "ss_direct",       label: "Direct Hit",              file: "singlestep_full/field_single_step_cc_direct_eval_0006_delphi.rrd",       rec: "db1c9cb1e5e24c38a0a44fd5d70187ab", rbl: SS_RBL },
  { id: "ss_simultaneous", label: "Simultaneous Hit",        file: "singlestep_full/field_single_step_cc_simultaneous_eval_0040_delphi.rrd", rec: "d626bf7a868c4094a6c96424300cf4a6", rbl: SS_RBL },
  { id: "ss_persistent",   label: "Persistent deformation",  file: "singlestep_full/field_single_step_df_persistent_eval_0089_delphi.rrd",   rec: "6768a781358f44f1bbd2377c7861cbbe", rbl: SS_RBL },
  { id: "ss_recovery",     label: "Recoverable deformation", file: "singlestep_full/field_single_step_df_recovery_eval_0048_delphi.rrd",     rec: "702e87f595e445b385e9c83f31c6824b", rbl: SS_RBL },
];

// --- (2) ADYTON benchmark, at a glimpse ----------------------------------
// The full-point ground-truth labels with 4D correspondence the model is
// trained against — one raw eval recording per scene, under
// data_preview/ on the HF dataset. Each file bakes its Rerun blueprint INTO
// the .rrd (saved as the recording's default blueprint), so there is no
// separate .rbl — opening the recording applies its own layout. The `rec` ids
// come from `rerun rrd print file.rrd`. Persistent deformation ships two
// samples (0000 / 0001), so this is 9 tabs across the 8 scene types.
const benchmark = [
  { id: "bm_direct",        label: "Direct Hit",                file: HF + "data_preview/gt_data_cc_direct_eval_0000.rrd",       rec: "3b2b60378d8647fba0a7bd931304637c" },
  { id: "bm_glancing",      label: "Glancing Hit",              file: HF + "data_preview/gt_data_cc_glancing_eval_0000.rrd",     rec: "3c2698a02ce34b1fa225e1fb80d2e7d8" },
  { id: "bm_simultaneous",  label: "Simultaneous Hit",          file: HF + "data_preview/gt_data_cc_simultaneous_eval_0000.rrd", rec: "819084637831465f93cd5975fee7fcae" },
  { id: "bm_persistent",    label: "Persistent deformation",    file: HF + "data_preview/gt_data_df_persistent_eval_0000.rrd",   rec: "fe2ecd63d2e047a196a6869ff898d530" },
  { id: "bm_persistent2",   label: "Persistent deformation II", file: HF + "data_preview/gt_data_df_persistent_eval_0001.rrd",   rec: "024b224fd8fb4a99b3e271d86f5de2fc" },
  { id: "bm_recovery",      label: "Recoverable deformation",   file: HF + "data_preview/gt_data_df_recovery_eval_0000.rrd",     rec: "6aac4347cf3746979b6bfb6369d6bdc0" },
  { id: "bm_freefall",      label: "Freefall Motion",           file: HF + "data_preview/gt_data_fg_freefall_eval_0000.rrd",     rec: "f0d0c4711b4a4197a35a17708d840339" },
  { id: "bm_projectile",    label: "Projectile Motion",         file: HF + "data_preview/gt_data_fg_projectile_eval_0000.rrd",   rec: "d3101bc5ed1841a6afbc43db6638b920" },
  { id: "bm_spin",          label: "Spin-dominant Motion",      file: HF + "data_preview/gt_data_fg_spin_dominant_eval_0000.rrd", rec: "2599a8edb85740cca87948c68600fe6f" },
];

// --- (3) Autoregressive rollout — zero-shot inference-time capability -----
// Single-view (LIVE): the real eval recordings in singleview_rollout/, each
// paired with its retargeted phase_b blueprint (scripts route one saved .rbl
// to every scene's app id).
const rolloutSingleView = SCENES.map((s) => ({
  id: `sv_${s.id}`,
  label: s.label,
  file: `singleview_rollout/${s.base}.rrd`,
  rec: s.rec,
  rbl: `singleview_rollout/blueprints/phase_b_${s.base}.rbl`,
}));
// Multi-view: the .rrd lives on the HF dataset (it is >100 MB); its .rbl stays
// in public/recordings/multiview_rollout/blueprints/. Only the
// glancing-hit scene is provided so far; [[FILL]] append the other scenes as
// their recordings arrive.
const rolloutMultiView = [
  {
    id: "mv_glancing",
    label: "Glancing Hit",
    file: HF + "multiview_rollout/cc_glancing_0002_delphi_fg_f90.rrd",
    rec: "582547a517474448b82ae9671a66431c",
    rbl: "multiview_rollout/blueprints/phase_c_cc_glancing_0002_delphi_fg_f90.rbl",
  },
];

// Flip both to false if the page is ever pinned back to a 0.23.x viewer
// (no recording_open event, no theme option); the 500 ms watchdog below
// keeps everything working either way, just with coarser load detection.
const CAPS = { recordingOpenEvent: true, themeOption: true };

// The eight eval recordings are ~15 MB each. Two decode fine, but three
// concurrently open exhausts a viewer's wasm heap (silent OOM). So:
//   - PREFETCH_ALL off: never auto-download the whole ~120 MB set.
//   - KEEP_OPEN caps how many recordings stay resident per viewer; switching
//     to a new one evicts the oldest beyond the cap (viewer.close frees heap).
// Blueprints (~60 KB) are opened once and kept — never evicted.
const PREFETCH_ALL = false;
const KEEP_OPEN = 2; // default max recordings resident at once, per viewer (>=1)
// (a viewer with an unusually large recording can override this via cfg.keepOpen)
// Generous: real recordings are tens of MB and a cross-version file is
// migrated in-browser on load, which adds a few seconds.
const LOAD_TIMEOUT_MS = 45000;
const TIMELINE = "frame"; // fallback timeline name for the ancient-viewer probe

const safe = (fn) => { try { return fn(); } catch { return undefined; } };
const idle = (cb) =>
  "requestIdleCallback" in window
    ? requestIdleCallback(cb, { timeout: 2000 })
    : setTimeout(cb, 500);

/* ---------------------------------------------------- download progress
   The viewer exposes no load-progress events, but it downloads each .rrd with
   the page's window.fetch and streams the body. Wrap fetch for the recording
   URLs we register (exact match; everything else — wasm, .rbl — passes through
   untouched) and count bytes as the viewer reads them. Content-Length gives
   the total (CORS-safelisted, so it is readable from Hugging Face too). */
const progressHandlers = new Map(); // recording url -> (total) => { progress(loaded), done() }
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
  const track = url && progressHandlers.get(url);
  const res = await nativeFetch(input, init);
  if (!track || !res.ok || !res.body) return res;
  const total = Number(res.headers.get("content-length")) || 0;
  const body = res.body; // reading the getter neither locks nor consumes it
  let counted = null;
  const countedBody = () => {
    if (!counted) {
      let loaded = 0;
      const h = track(total);
      counted = body.pipeThrough(new TransformStream({
        transform(chunk, c) { loaded += chunk.byteLength; h.progress(loaded); c.enqueue(chunk); },
        flush() { h.done(); },
      }));
    }
    return counted;
  };
  // Shadow the prototype accessors on this one Response, so whichever way the
  // viewer reads it (streamed body or arrayBuffer) goes through the counter.
  Object.defineProperty(res, "body", { configurable: true, get: countedBody });
  Object.defineProperty(res, "arrayBuffer", { configurable: true, value: () => new Response(countedBody()).arrayBuffer() });
  return res;
};

const fmtMB = (n) => (n / 1e6).toFixed(n < 1e8 ? 1 : 0);

// Loading overlay: a small material-point grid swept by a displacement wave,
// plus a byte-accurate progress bar. Built once per viewer frame.
function createLoader(frame) {
  const el = document.createElement("div");
  el.className = "viewer-loader";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  const COLS = 17, ROWS = 7;
  const dots = Array.from({ length: COLS * ROWS }, (_, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    return `<i style="--d:${(c * 0.075 + r * 0.03).toFixed(3)}s"></i>`;
  }).join("");
  el.innerHTML =
    `<div class="vl-field" style="--cols:${COLS}" aria-hidden="true">${dots}</div>` +
    `<div class="vl-title"></div>` +
    `<div class="vl-bar"><span></span></div>` +
    `<div class="vl-meta"></div>`;
  frame.appendChild(el);
  const title = el.querySelector(".vl-title");
  const bar = el.querySelector(".vl-bar");
  const fill = bar.querySelector("span");
  const meta = el.querySelector(".vl-meta");
  let shown = false;
  return {
    // info = null hides it; otherwise { title, loaded?, total?, meta? }
    set(info) {
      if (!info) {
        if (shown) { el.classList.remove("on"); shown = false; }
        return;
      }
      if (!shown) { el.classList.add("on"); shown = true; }
      title.innerHTML = info.title;
      const known = info.total > 0;
      bar.classList.toggle("indet", !known);
      fill.style.width = known ? `${Math.min(100, (100 * info.loaded) / info.total).toFixed(1)}%` : "";
      meta.textContent = info.meta ?? (known
        ? `${fmtMB(info.loaded)} / ${fmtMB(info.total)} MB · ${Math.floor((100 * info.loaded) / info.total)}%`
        : info.loaded ? `${fmtMB(info.loaded)} MB` : "");
    },
  };
}

// Normalize a raw scenario into the runtime shape. `mode` is stamped on so the
// per-viewer lookup logic can find a scenario's mode.
const normalize = (s, mode) => ({
  ...s,
  mode,
  // The viewer does NOT resolve relative URLs against the page — it would
  // parse "recordings/x.rrd" as host "recordings". Always hand it an
  // absolute URL.
  url: s.url || abs(s.file),
  rblUrl: s.rbl ? abs(s.rbl) : null, // optional blueprint, opened alongside the rrd
  rec: s.rec || "adyton_demo_" + s.id,
  state: "unloaded", // unloaded | loading | ready | error
  timer: null,
  actualRec: null,   // recording id observed at load time (may differ from rec)
  activated: false,  // first activation rewinds the timeline to its start
  wasPlaying: false, // last observed play state (loopAtEnd detects the stop at the end)
  rblOpened: false,  // blueprint opened once, then kept (tiny; never evicted)
  dl: null,          // current download { loaded, total, done, last } (see progressHandlers)
});

/* =====================================================================
   createViewer — one self-contained Rerun viewer bound to a DOM subtree.
   Everything below closes over `cfg` so multiple viewers coexist without
   sharing state. Returns a small debug handle.
   cfg = { frame, mount, tabs, modeTabs?, descEl?, noteEl?, modes,
           defaultModeId?, timePanel? }
===================================================================== */
function createViewer(cfg) {
  const { frame, mount, tabs, modeTabs = null, descEl = null, noteEl = null } = cfg;
  const keepOpen = cfg.keepOpen ?? KEEP_OPEN;
  // Bottom time panel state: "expanded" shows the full streams/entity tree,
  // "collapsed" keeps just the scrubber. Recordings with only a handful of
  // entity paths leave dead space under an expanded tree, so those viewers set
  // "collapsed" to hand that space back to the 3D view.
  const timePanel = cfg.timePanel ?? "expanded";
  const modes = cfg.modes.map((m) => ({ ...m, scenarios: m.scenarios.map((s) => normalize(s, m)) }));
  // stamp the real mode object reference (normalize captured a pre-spread copy)
  modes.forEach((m) => m.scenarios.forEach((s) => { s.mode = m; }));
  const ALL = modes.flatMap((m) => m.scenarios); // for id/recording lookups + eviction

  const viewer = new WebViewer();
  let bootState = "idle"; // idle | starting | ready | failed
  let bootPromise = null;
  let currentMode = modes.find((m) => m.id === cfg.defaultModeId) || modes[0];
  let selected = currentMode.scenarios[0];
  let prefetchArmed = false;
  const openOrder = []; // ready recordings, least-recently-active first
  const openedRbls = new Set(); // blueprint URLs opened this session (deduped)

  const tabFor = (s) => tabs.querySelector(`[data-id="${s.id}"]`);
  const wantedRec = (s) => s.actualRec || s.rec;

  /* ------------------------------------------------------- loader */

  const loader = createLoader(frame);
  let renderQueued = false;
  // Coalesce to one render per frame, so a hide immediately followed by a show
  // (e.g. boot finishing, then the first load starting) never flickers.
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderLoader(); });
  }

  // The overlay stays up until the selected recording is FULLY downloaded, not
  // just opened: the viewer shows a recording as soon as its first chunk
  // arrives and fills it in as the rest streams, which reads as broken.
  function renderLoader() {
    const s = selected;
    if (bootState === "starting") {
      loader.set({ title: "Starting the <b>Rerun</b> viewer", meta: "one-time runtime download, cached afterwards" });
      return;
    }
    const dl = s.dl;
    const downloading =
      bootState === "ready" && (s.state === "loading" || (s.state === "ready" && dl && !dl.done));
    if (!downloading) { loader.set(null); return; }
    loader.set(dl
      ? { title: `Loading <b>${s.label}</b>`, loaded: dl.loaded, total: dl.total }
      : { title: `Loading <b>${s.label}</b>`, meta: "connecting…" });
  }

  for (const s of ALL) {
    // One tracker per fetch; a stale fetch (evicted, then reloaded) is ignored.
    progressHandlers.set(s.url, (total) => {
      const dl = { loaded: 0, total, done: false, last: performance.now(), armed: performance.now() };
      s.dl = dl;
      queueRender();
      return {
        progress(loaded) {
          if (s.dl !== dl) return;
          const now = performance.now();
          dl.loaded = loaded;
          dl.last = now;
          // A 200 MB file on a slow link can outlast LOAD_TIMEOUT_MS; while
          // bytes keep arriving it is not stalled, so push the timeout back.
          if (s.state === "loading" && s.timer && now - dl.armed > 1000) {
            clearTimeout(s.timer);
            s.timer = setTimeout(() => onLoadFailed(s), LOAD_TIMEOUT_MS);
            dl.armed = now;
          }
          queueRender();
        },
        done() {
          if (s.dl !== dl) return;
          dl.done = true;
          queueRender();
          enforceActive(); // rewind now, as the overlay fades
        },
      };
    });
  }

  function note(html) {
    if (!noteEl) return;
    noteEl.innerHTML = html;
    noteEl.style.display = "grid";
  }
  function hideNote() { if (noteEl) noteEl.style.display = "none"; }

  /* -------------------------------------------------------------- boot */

  function ensureBoot() {
    if (!bootPromise) bootPromise = boot();
    return bootPromise;
  }

  async function boot() {
    bootState = "starting";
    hideNote(); // the loader overlay covers the mount from here on
    queueRender();
    const opts = {
      hide_welcome_screen: true,
      width: "100%",
      height: "100%",
      ...(CAPS.themeOption ? { theme: "dark" } : {}),
    };
    try {
      await viewer.start(null, mount, opts);
    } catch (firstErr) {
      // WebGPU can be flaky; one retry on WebGL before giving up.
      console.warn("[DELPHI viewer] start failed, retrying with WebGL", firstErr);
      safe(() => viewer.stop());
      mount.innerHTML = "";
      try {
        await viewer.start(null, mount, { ...opts, render_backend: "webgl" });
      } catch (err) {
        bootFailed(err);
        throw err;
      }
    }
    bootState = "ready";
    queueRender();

    // Clean embed: tabs replace the recording list, so tuck the side panels
    // away (still one click to expand — entity toggling lives there), keep
    // the timeline out for scrubbing.
    safe(() => viewer.override_panel_state("blueprint", "collapsed"));
    safe(() => viewer.override_panel_state("selection", "collapsed"));
    safe(() => viewer.override_panel_state("time", timePanel));

    if (CAPS.recordingOpenEvent) {
      safe(() => viewer.on("recording_open", onRecordingOpen));
    }
    safe(() => viewer.on("selection_change", (event) => {
      for (const item of event.items || []) {
        if (item.type === "entity") console.log("[selected]", item.entity_path);
      }
    }));

    setInterval(watchdog, 500);
  }

  function bootFailed(err) {
    console.error("[DELPHI viewer]", err);
    bootState = "failed";
    queueRender();
    for (const s of ALL) {
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
      tabFor(s)?.removeAttribute("aria-busy");
    }
    note(
      "<div><b>The interactive viewer could not start in this browser.</b></div>" +
      "<div>It needs WebAssembly and WebGL2/WebGPU (recent Chrome or Firefox, Safari 16.4+).<br>Reloading the page sometimes helps.</div>"
    );
  }

  /* ------------------------------------------------ load & switch */

  function select(s) {
    selected = s;
    syncTabs();
    queueRender();
    ensureBoot().then(() => {
      if (s.state === "ready") enforceActive();
      else beginLoad(s);
    }).catch(() => { /* boot failure already surfaced */ });
  }

  // --- bounded memory: keep at most KEEP_OPEN recordings resident ---
  function touchOpen(s) {
    const i = openOrder.indexOf(s);
    if (i >= 0) openOrder.splice(i, 1);
    openOrder.push(s);
  }

  function evict(s) {
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    safe(() => viewer.close(s.url)); // frees the wasm heap; the blueprint stays open
    s.state = "unloaded";
    s.actualRec = null;
    s.activated = false;
    s.wasPlaying = false;
    s.dl = null;
    const i = openOrder.indexOf(s);
    if (i >= 0) openOrder.splice(i, 1);
    const tab = tabFor(s);
    tab?.removeAttribute("aria-busy");
    tab?.removeAttribute("data-state");
  }

  // Evict least-recently-active recordings until at most `limit` stay resident.
  // Never evicts the selected tab.
  function evictTo(limit) {
    let i = 0;
    while (openOrder.length > limit && i < openOrder.length) {
      if (openOrder[i] === selected) { i++; continue; }
      evict(openOrder[i]); // splices it out, so don't advance i
    }
  }

  function beginLoad(s) {
    if (bootState !== "ready" || s.state === "loading" || s.state === "ready") return;
    if (s.state === "error") safe(() => viewer.close(s.url)); // reset the receiver before retrying
    s.state = "loading";
    s.dl = null; // set again when the viewer's fetch starts streaming
    queueRender();
    const tab = tabFor(s);
    tab?.setAttribute("aria-busy", "true");
    tab?.removeAttribute("data-state");
    // Make room BEFORE opening: three ~15 MB recordings resident at once OOM the
    // viewer, so evict down to keepOpen-1 first, holding the peak at keepOpen.
    evictTo(keepOpen - 1);
    try {
      // A .rbl carries its own target application_id and binds to whichever
      // recording of that app is active. But once the last recording of an app
      // is closed (evict() above), the viewer drops that app's blueprint too,
      // so the next recording falls back to Rerun's heuristic layout (every
      // entity gets its own view, hidden ones included). So RE-open the .rbl on
      // every load — close its old receiver first so it is fetched and
      // re-activated fresh (~60 KB, HTTP-cached). This also resets any toggles
      // left over from the previous scene of a shared-blueprint app.
      // (#nobp in the URL skips it — to compare Rerun's auto-layout.)
      if (s.rblUrl && !location.hash.includes("nobp")) {
        if (openedRbls.has(s.rblUrl)) safe(() => viewer.close(s.rblUrl));
        viewer.open(s.rblUrl);
        openedRbls.add(s.rblUrl);
        s.rblOpened = true;
      }
      viewer.open(s.url);
    } catch (err) {
      // a synchronous throw here means the viewer itself keeled over
      bootFailed(err);
      return;
    }
    s.timer = setTimeout(() => onLoadFailed(s), LOAD_TIMEOUT_MS);
  }

  function onRecordingOpen(ev) {
    let s = ALL.find((x) => x.rec === ev.recording_id || x.actualRec === ev.recording_id);
    if (!s) {
      // Unknown id — a real recording whose id we didn't declare. Safe to
      // attribute only when exactly one scenario is mid-load, which is always
      // true here: clicks and prefetch load one recording at a time. A
      // blueprint (.rbl) opens as its own store; if it fires this event it is
      // ignored once the single loading recording has been matched.
      const loading = ALL.filter((x) => x.state === "loading" && !x.actualRec);
      if (loading.length === 1) s = loading[0];
    }
    if (!s) return;
    s.actualRec = ev.recording_id; // wantedRec() now uses the real id for set_active
    markReady(s);
  }

  // True once the viewer knows this recording — these getters return
  // null/undefined for unknown recording ids and are side-effect free.
  function probeLoaded(s) {
    const rec = wantedRec(s);
    if (typeof viewer.get_active_timeline === "function")
      return !!safe(() => viewer.get_active_timeline(rec));
    if (typeof viewer.get_time_range === "function")
      return !!safe(() => viewer.get_time_range(rec, TIMELINE));
    // Ancient viewer without probe getters: confirm via a set/get roundtrip,
    // but only for the tab the user is actually waiting on.
    if (s === selected) {
      safe(() => viewer.set_active_recording_id(rec));
      return safe(() => viewer.get_active_recording_id()) === rec;
    }
    return false;
  }

  function markReady(s) {
    if (s.state === "ready") return;
    s.state = "ready";
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    const tab = tabFor(s);
    tab?.removeAttribute("aria-busy");
    tab?.removeAttribute("data-state");
    prefetchArmed = true;
    queueRender(); // the overlay waits for the download to finish, not just open
    touchOpen(s); // now resident (beginLoad already made room under KEEP_OPEN)
    // A background prefetch open() auto-activates its recording; enforceActive
    // immediately snaps the viewer back to the selected tab.
    enforceActive();
    pumpPrefetch();
  }

  function onLoadFailed(s) {
    if (s.state !== "loading") return;
    s.state = "error";
    s.timer = null;
    queueRender();
    const tab = tabFor(s);
    tab?.removeAttribute("aria-busy");
    tab?.setAttribute("data-state", "error");
    if (s === selected) {
      note(
        `<div><b>Couldn't load “${s.label}”.</b></div>` +
        `<div>(${s.url}) — check your connection, then click the tab to retry.</div>`
      );
    }
    pumpPrefetch();
  }

  // The invariant that makes switching seamless regardless of whether open()
  // auto-activates new recordings: the selected tab is the single source of
  // truth — whenever the viewer's active recording drifts from it, snap back.
  function enforceActive() {
    if (bootState !== "ready" || selected.state !== "ready") return;
    touchOpen(selected); // keep the visible recording most-recent, so it is never evicted
    const want = wantedRec(selected);
    if (safe(() => viewer.get_active_recording_id()) !== want) {
      safe(() => viewer.set_active_recording_id(want));
    }
    // Rewind to the recording's start on first view — deferred until its
    // download finishes, since it starts playing under the loading overlay
    // and would otherwise be revealed mid-timeline. Use its own active
    // timeline (never assume a name).
    if (!selected.activated && !(selected.dl && !selected.dl.done)) {
      selected.activated = true;
      const tl = safe(() => viewer.get_active_timeline(want));
      const range = tl && safe(() => viewer.get_time_range(want, tl));
      if (range) {
        safe(() => viewer.set_current_time(want, tl, range.min));
        safe(() => viewer.set_playing(want, true));
      }
    }
    loopAtEnd(selected, want);
    hideNote();
  }

  // Recordings auto-play once and then park on their LAST frame. Loop instead:
  // when playback stops on its own at the end of the range, rewind and play
  // again. Keyed on the playing -> stopped transition AT the end, so a user who
  // pauses mid-timeline (or scrubs while paused) is left alone.
  function loopAtEnd(s, rec) {
    const playing = safe(() => viewer.get_playing(rec));
    if (s.wasPlaying && playing === false) {
      const tl = safe(() => viewer.get_active_timeline(rec));
      const range = tl && safe(() => viewer.get_time_range(rec, tl));
      const cur = range && safe(() => viewer.get_current_time(rec, tl));
      if (range && cur >= range.max) {
        safe(() => viewer.set_current_time(rec, tl, range.min));
        safe(() => viewer.set_playing(rec, true));
        s.wasPlaying = true;
        return;
      }
    }
    s.wasPlaying = playing;
  }

  function watchdog() {
    if (bootState !== "ready") return;
    const now = performance.now();
    for (const s of ALL) {
      if (s.state === "loading" && probeLoaded(s)) markReady(s);
      // Opened, but the rest of the stream stopped arriving: stop waiting and
      // show what did load rather than leaving the overlay up forever.
      if (s.state === "ready" && s.dl && !s.dl.done && now - s.dl.last > LOAD_TIMEOUT_MS) {
        s.dl.done = true;
        queueRender();
      }
    }
    enforceActive();
  }

  function pumpPrefetch() {
    if (!PREFETCH_ALL || !prefetchArmed || bootState !== "ready") return;
    if (ALL.some((s) => s.state === "loading")) return; // one at a time
    // Prefetch stays within the visible mode — no point pulling recordings the
    // user can't reach without switching modes.
    const next = currentMode.scenarios.find((s) => s.state === "unloaded");
    if (next) idle(() => beginLoad(next));
  }

  /* ------------------------------------------------------------ ui */

  function syncTabs() {
    [...tabs.children].forEach((b) => {
      const isSel = b.dataset.id === selected.id;
      b.setAttribute("aria-selected", String(isSel));
      b.tabIndex = isSel ? 0 : -1;
    });
  }

  function syncModeTabs() {
    if (!modeTabs) return;
    [...modeTabs.children].forEach((b) => {
      const isSel = b.dataset.mode === currentMode.id;
      b.setAttribute("aria-selected", String(isSel));
      b.tabIndex = isSel ? 0 : -1;
    });
  }

  // Rebuild the scene tab strip for the current mode.
  function renderScenarioTabs() {
    tabs.innerHTML = "";
    currentMode.scenarios.forEach((s) => {
      const b = document.createElement("button");
      b.className = "scn";
      b.textContent = s.label;
      b.dataset.id = s.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(s === selected));
      b.tabIndex = s === selected ? 0 : -1;
      // reflect the state of a recording that may already be resident/erroring
      if (s.state === "loading") b.setAttribute("aria-busy", "true");
      if (s.state === "error") b.setAttribute("data-state", "error");
      b.addEventListener("click", () => select(s));
      tabs.appendChild(b);
    });
  }

  // Switch mode: show its tabs, update the blurb, select its first scene.
  function selectMode(m) {
    if (m === currentMode) return;
    currentMode = m;
    if (descEl && m.desc) descEl.textContent = m.desc;
    syncModeTabs();
    renderScenarioTabs();
    select(m.scenarios[0]);
  }

  // Build the mode switcher (only when there's more than one mode).
  if (modeTabs && modes.length > 1) {
    modes.forEach((m) => {
      const b = document.createElement("button");
      b.className = "mode";
      b.textContent = m.label;
      b.dataset.mode = m.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(m === currentMode));
      b.tabIndex = m === currentMode ? 0 : -1;
      b.addEventListener("click", () => selectMode(m));
      modeTabs.appendChild(b);
    });
    modeTabs.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const i = modes.indexOf(currentMode);
      const n = modes.length;
      const next = modes[(i + (e.key === "ArrowRight" ? 1 : n - 1)) % n];
      selectMode(next);
      modeTabs.querySelector(`[data-mode="${next.id}"]`)?.focus();
    });
  }
  if (descEl && currentMode.desc) descEl.textContent = currentMode.desc;
  renderScenarioTabs();

  tabs.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const list = currentMode.scenarios;
    const i = list.indexOf(selected);
    const n = list.length;
    const next = list[(i + (e.key === "ArrowRight" ? 1 : n - 1)) % n];
    select(next);
    tabFor(next)?.focus();
  });

  // Boot lazily: the runtime is a ~12 MB (gzipped) wasm download, so wait
  // until the section is near the viewport. A tab click boots immediately.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        io.disconnect();
        select(selected);
      }
    }, { rootMargin: "800px 0px" });
    io.observe(frame);
  } else {
    select(selected);
  }

  return { viewer, modes, scenarios: ALL, get selected() { return selected; } };
}

/* =====================================================================
   Instantiate the three viewers.
===================================================================== */

// (6) MAIN RESULTS — single-step full-geometry prediction (#singlestep).
// One mode, so no switcher; visible/occluded/interior/ambient are entity
// toggles inside each recording.
const singleStepViewer = createViewer({
  frame:    document.getElementById("ssFrame"),
  mount:    document.getElementById("ssMount"),
  tabs:     document.getElementById("ssScenarios"),
  modeTabs: null,
  descEl:   document.getElementById("ssDesc"),
  noteEl:   document.getElementById("ssNote"),
  // Single-step recordings are ~56 MB each — hold only one resident.
  keepOpen: 1,
  modes: [
    {
      id: "fullgeom",
      label: "Full geometry",
      desc: "One prediction from one observation, over the full geometry. Compare the predicted material points and displacement field against ground truth, and toggle the ambient off-surface field, to inspect where the field predicts — seen or unseen — across every scene.",
      scenarios: singlestep,
    },
  ],
});

// (7) ADYTON benchmark, at a glimpse (#adyton). One glimpse mode.
const benchmarkViewer = createViewer({
  frame:    document.getElementById("bmFrame"),
  mount:    document.getElementById("bmMount"),
  tabs:     document.getElementById("bmScenarios"),
  modeTabs: null,
  descEl:   document.getElementById("bmDesc"),
  noteEl:   document.getElementById("bmNote"),
  // The ground-truth recordings are ~90–207 MB each (raw 0.23.x exports,
  // migrated in the browser on load) — even bigger than the multi-view file.
  // Hold only ONE resident so it never shares the wasm heap with another.
  keepOpen: 1,
  // These GT recordings expose just a few entity paths (context / world /
  // camera / depth), so an expanded streams tree leaves dead space under it.
  // Collapse the time panel to a compact scrubber and give that space back to
  // the 3D view.
  timePanel: "collapsed",
  modes: [
    {
      id: "glimpse",
      label: "Data glimpse",
      desc: "A glimpse into ADYTON itself — raw simulated scenes with full-point 4D-correspondence labels, rendered with their saved Rerun blueprints. Rotate and scrub the ground-truth material-point motion the model is trained against.",
      scenarios: benchmark,
    },
  ],
});

// (8) Autoregressive rollout (#rollout): Single-view / Multi-view toggle. We
// default-select single-view because it is the mode wired to real recordings
// today; multi-view is a [[FILL]] scaffold.
const rolloutViewer = createViewer({
  frame:    document.getElementById("arFrame"),
  mount:    document.getElementById("arMount"),
  tabs:     document.getElementById("arScenarios"),
  modeTabs: document.getElementById("arModes"),
  descEl:   document.getElementById("arDesc"),
  noteEl:   document.getElementById("arNote"),
  // The multi-view recording is ~103 MB — far bigger than the ~15 MB eval
  // files this cap was tuned for. Hold only ONE recording resident in this
  // viewer so it never shares the heap with another.
  keepOpen: 1,
  defaultModeId: "singleview",
  modes: [
    {
      id: "singleview",
      label: "Single-view",
      desc: "Zero-shot autoregressive rollout from a single camera — the field is re-queried from its own predictions across the timeline. Rotate, scrub, and toggle entity paths to compare prediction against ground-truth material points, including inside the object.",
      scenarios: rolloutSingleView,
    },
    {
      id: "multiview",
      label: "Multi-view",
      desc: "The same inference-time rollout fused across multiple cameras. Extra views resolve occlusion and tighten the amodal interior without any retraining.",
      scenarios: rolloutMultiView,
    },
  ],
});

// debug handle (harmless in prod; lets you poke any viewer from the console)
window.__delphi = { singleStep: singleStepViewer, benchmark: benchmarkViewer, rollout: rolloutViewer };
