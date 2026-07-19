export function renderJudgeDemoPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Turn live meeting transcripts into presenter-approved shared structure maps">
  <title>Live Alignment Copilot · Judge Demo</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #f4f7ff;
      --muted: #97a3bc;
      --canvas: #080b14;
      --surface: #101522;
      --surface-2: #171d2d;
      --line: #29334a;
      --mint: #6ef3c5;
      --mint-deep: #163f37;
      --violet: #b7a4ff;
      --violet-deep: #30295a;
      --amber: #ffcf70;
      --red: #ff7d8d;
      --shadow: 0 24px 70px rgb(0 0 0 / 34%);
    }

    * { box-sizing: border-box; }
    html { min-width: 320px; background: var(--canvas); }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background:
        radial-gradient(circle at 7% 0%, rgb(110 243 197 / 10%), transparent 27rem),
        radial-gradient(circle at 88% 12%, rgb(183 164 255 / 12%), transparent 32rem),
        var(--canvas);
      font-family: Inter, "Noto Sans JP", "Yu Gothic UI", system-ui, sans-serif;
      letter-spacing: .01em;
    }

    button, textarea { font: inherit; }
    button { touch-action: manipulation; }
    .shell { width: min(1720px, calc(100% - 32px)); margin: 0 auto; padding: 14px 0 0; }

    .topbar {
      display: flex;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 10px;
    }
    .brand { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
    .brand-mark {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 1px solid rgb(110 243 197 / 45%);
      border-radius: 13px;
      color: var(--mint);
      background: linear-gradient(145deg, rgb(110 243 197 / 14%), rgb(183 164 255 / 12%));
      font-weight: 800;
      box-shadow: inset 0 0 24px rgb(110 243 197 / 8%);
      flex: 0 0 auto;
    }
    .eyebrow { margin: 0 0 4px; color: var(--mint); font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    h1 { max-width: 980px; margin: 0; font-size: clamp(24px, 2.5vw, 30px); line-height: 1.1; letter-spacing: -.035em; }
    .subtitle { max-width: 1100px; margin: 7px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .hero-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
    .capability {
      display: inline-flex;
      margin: 0;
      padding: 4px 9px;
      border: 1px solid rgb(183 164 255 / 28%);
      border-radius: 999px;
      color: var(--violet);
      background: rgb(48 41 90 / 30%);
      font-size: 10px;
      font-weight: 750;
    }
    .runtime-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 28px;
      padding: 5px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgb(16 21 34 / 85%);
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
    }
    .runtime-badge::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 14px currentColor; }
    .runtime-badge.gpt { color: var(--mint); border-color: rgb(110 243 197 / 35%); }
    .runtime-badge.gpt::before { background: var(--mint); }

    .safety-rail {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      margin-bottom: 10px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--line);
    }
    .rail-step { position: relative; min-width: 0; padding: 9px 13px; background: rgb(16 21 34 / 94%); }
    .rail-step strong { display: block; font-size: 12px; }
    .rail-step span { display: block; color: var(--muted); font-size: 10px; line-height: 1.4; }
    .rail-step strong .rail-index { display: inline; }
    .rail-index { margin-right: 7px; color: var(--violet); font-variant-numeric: tabular-nums; }

    .actionbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 15px;
      background: rgb(16 21 34 / 88%);
      box-shadow: var(--shadow);
    }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .button {
      min-height: 38px;
      padding: 8px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      color: var(--ink);
      background: var(--surface-2);
      cursor: pointer;
      font-size: 12px;
      font-weight: 750;
      transition: transform .16s ease, border-color .16s ease, background .16s ease;
    }
    .button:hover:not(:disabled) { transform: translateY(-1px); border-color: #465574; }
    .button:focus-visible { outline: 2px solid var(--violet); outline-offset: 2px; }
    .button:disabled { cursor: not-allowed; opacity: .42; }
    .button-primary { border-color: rgb(110 243 197 / 42%); color: #07130f; background: var(--mint); }
    .button-approve { border-color: rgb(110 243 197 / 35%); color: var(--mint); background: var(--mint-deep); }
    .button-reject { border-color: rgb(255 125 141 / 32%); color: var(--red); background: rgb(89 30 42 / 45%); }
    .stage-note { color: var(--muted); font-size: 11px; text-align: right; }
    .stage-note strong { color: var(--ink); }

    .error-banner {
      margin: 0 0 16px;
      padding: 12px 15px;
      border: 1px solid rgb(255 125 141 / 40%);
      border-radius: 12px;
      color: #ffd9de;
      background: rgb(82 25 36 / 72%);
      font-size: 12px;
    }
    .error-banner[hidden] { display: none; }

    .workspace {
      display: grid;
      grid-template-columns: minmax(280px, .85fr) minmax(340px, 1.08fr) minmax(360px, 1.32fr);
      gap: 14px;
      align-items: stretch;
    }
    .panel {
      min-width: 0;
      min-height: 400px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(180deg, rgb(23 29 45 / 94%), rgb(13 17 28 / 96%));
      box-shadow: var(--shadow);
    }
    .panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      min-height: 64px;
      padding: 13px 16px 11px;
      border-bottom: 1px solid var(--line);
    }
    .panel-kicker { margin: 0 0 5px; color: var(--violet); font-size: 10px; font-weight: 850; letter-spacing: .16em; text-transform: uppercase; }
    h2 { margin: 0; font-size: 16px; letter-spacing: -.01em; }
    .count { padding: 4px 8px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
    .panel-body { padding: 13px 16px 16px; }

    .conversation {
      width: 100%;
      min-height: 190px;
      resize: vertical;
      padding: 15px;
      border: 1px solid #323e58;
      border-radius: 13px;
      outline: none;
      color: var(--ink);
      background: #0b0f1a;
      line-height: 1.85;
      font-size: 13px;
      transition: border-color .16s ease, box-shadow .16s ease;
    }
    .conversation:focus { border-color: var(--violet); box-shadow: 0 0 0 3px rgb(183 164 255 / 12%); }
    .hint { margin: 13px 2px 0; color: var(--muted); font-size: 11px; line-height: 1.65; }
    .hint strong { color: var(--mint); }

    .proposal-list { display: grid; gap: 9px; max-height: 180px; overflow: auto; padding-right: 3px; }
    .proposal-card {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      color: inherit;
      background: #0d121e;
      cursor: pointer;
      text-align: left;
    }
    .proposal-card:hover { border-color: #465574; }
    .proposal-card.selected { border-color: var(--violet); background: rgb(48 41 90 / 48%); box-shadow: inset 3px 0 0 var(--violet); }
    .proposal-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .command-type { color: var(--ink); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; font-weight: 800; }
    .status { padding: 3px 7px; border-radius: 999px; color: var(--amber); background: rgb(255 207 112 / 12%); font-size: 9px; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
    .status.approved, .status.partially_approved { color: var(--mint); background: rgb(110 243 197 / 12%); }
    .status.rejected { color: var(--red); background: rgb(255 125 141 / 12%); }
    .rationale { display: block; margin: 8px 0 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
    .confidence { display: block; margin-top: 9px; color: var(--violet); font-size: 10px; font-variant-numeric: tabular-nums; }
    .json-block {
      min-height: 100px;
      max-height: 100px;
      margin: 12px 0 0;
      overflow: auto;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 11px;
      color: #c9d2e8;
      background: #080b13;
      font: 10px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .json-label { margin: 11px 0 0; color: var(--mint); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }

    .preview-stack { display: grid; gap: 13px; }
    .scene-card { border: 1px solid var(--line); border-radius: 14px; background: #0c111c; overflow: hidden; }
    .scene-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 13px; border-bottom: 1px solid var(--line); }
    .scene-title { font-size: 12px; font-weight: 800; }
    .scene-title.preview { color: var(--violet); }
    .scene-title.approved { color: var(--mint); }
    .scene-meta { color: var(--muted); font-size: 9px; font-variant-numeric: tabular-nums; }
    .scene-canvas { min-height: 90px; padding: 10px; background-image: radial-gradient(circle, #273047 1px, transparent 1px); background-size: 18px 18px; }
    .node-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .node {
      min-width: 0;
      padding: 10px;
      border: 1px solid #39445e;
      border-radius: 11px;
      background: rgb(19 25 40 / 94%);
    }
    .preview-tone .node { border-color: rgb(183 164 255 / 45%); box-shadow: inset 0 0 20px rgb(183 164 255 / 5%); }
    .approved-tone .node { border-color: rgb(110 243 197 / 35%); }
    .node.highlighted { border-color: var(--amber); box-shadow: 0 0 0 2px rgb(255 207 112 / 10%); }
    .node-label { overflow: hidden; color: var(--ink); font-size: 11px; font-weight: 780; text-overflow: ellipsis; white-space: nowrap; }
    .node-kind { margin-top: 4px; overflow-wrap: anywhere; color: var(--muted); font-size: 9px; font-family: ui-monospace, monospace; }
    .edge-list { display: grid; gap: 6px; margin-top: 10px; }
    .edge { padding: 6px 8px; border-left: 2px solid var(--violet); color: var(--muted); background: rgb(183 164 255 / 6%); font-size: 9px; line-height: 1.4; overflow-wrap: anywhere; }
    .approved-tone .edge { border-left-color: var(--mint); background: rgb(110 243 197 / 6%); }
    .empty { display: grid; place-items: center; min-height: 64px; color: var(--muted); font-size: 11px; text-align: center; line-height: 1.7; }
    .approval-lock { display: flex; align-items: center; gap: 8px; margin-top: 12px; color: var(--mint); font-size: 10px; }
    .approval-lock::before { content: "✓"; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; color: #06110e; background: var(--mint); font-weight: 900; }

    @media (max-width: 1180px) {
      .workspace { grid-template-columns: 1fr 1fr; }
      .panel:last-child { grid-column: 1 / -1; min-height: auto; }
    }
    @media (max-width: 760px) {
      .shell { width: min(100% - 20px, 680px); padding-top: 16px; }
      .topbar, .actionbar { align-items: stretch; flex-direction: column; }
      .hero-meta { align-items: stretch; flex-direction: column; }
      .capability { align-self: flex-start; }
      .runtime-badge { align-self: stretch; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
      .safety-rail, .workspace { grid-template-columns: 1fr; }
      .panel, .panel:last-child { grid-column: auto; min-height: auto; }
      .stage-note { text-align: left; }
      .conversation { min-height: 250px; }
      .node-grid { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">LA</div>
        <div>
          <p class="eyebrow">Live Alignment Copilot · OpenAI Build Week</p>
          <h1>Turn messy live meetings into presenter-approved shared structure maps.</h1>
          <p class="subtitle">Live Alignment Copilot turns live meeting transcripts into structured diagram proposals. AI can suggest changes, but only presenter-approved commands are published to the audience view.</p>
          <div class="hero-meta">
            <p class="capability">Supports Japanese and multilingual transcripts</p>
            <div class="runtime-badge" id="plannerBadge" data-testid="planner-mode">Checking planner mode…</div>
          </div>
        </div>
      </div>
    </header>

    <section class="safety-rail" aria-label="Safe publication flow">
      <div class="rail-step"><strong><span class="rail-index">01</span>AI proposal</strong><span>Transcript becomes reviewable diagram changes</span></div>
      <div class="rail-step"><strong><span class="rail-index">02</span>Validated command</strong><span>Only schema-valid SceneCommands enter review</span></div>
      <div class="rail-step"><strong><span class="rail-index">03</span>Presenter approval</strong><span>Approve or reject every proposed change</span></div>
      <div class="rail-step"><strong><span class="rail-index">04</span>Published audience map</strong><span>Only approved structure is shared</span></div>
    </section>

    <section class="actionbar" aria-label="Demo controls">
      <div class="actions">
        <button class="button button-primary" id="runPlanner" type="button">Run planner</button>
        <button class="button button-approve" id="approveProposal" type="button" disabled>Approve</button>
        <button class="button button-reject" id="rejectProposal" type="button" disabled>Reject</button>
        <button class="button" id="undoScene" type="button" disabled>Undo</button>
        <button class="button" id="resetDemo" type="button">Reset</button>
      </div>
      <div class="stage-note"><strong id="decisionCount">0 review decisions logged</strong><br>Approve publishes. Reject leaves the audience map unchanged.</div>
    </section>

    <p class="error-banner" id="errorBanner" role="alert" hidden></p>

    <section class="workspace" aria-label="Live Alignment Copilot workspace">
      <article class="panel">
        <header class="panel-head">
          <div><p class="panel-kicker">Live transcript</p><h2>Meeting transcript</h2></div>
          <span class="count">English · editable</span>
        </header>
        <div class="panel-body">
          <label for="conversationInput" class="hint" style="display:block;margin:0 0 9px">One speaker turn per line, for example: <strong>Support Lead:</strong> meeting detail</label>
          <textarea class="conversation" id="conversationInput" data-testid="conversation-input" aria-label="Live meeting transcript input" spellcheck="false"></textarea>
          <p class="hint"><strong>Keyless mode</strong> replays 10 fixed proposals. Optional GPT mode interprets edited text. Keys stay server-side.</p>
        </div>
      </article>

      <article class="panel">
        <header class="panel-head">
          <div><p class="panel-kicker">AI proposal · validated</p><h2>Review queue</h2></div>
          <span class="count" id="proposalCount">0 proposals</span>
        </header>
        <div class="panel-body">
          <div class="proposal-list" id="proposalList" aria-live="polite"></div>
          <p class="json-label">Validated SceneCommand · strict JSON</p>
          <pre class="json-block" id="commandJson" data-testid="command-json">Run planner to inspect a schema-validated command.</pre>
        </div>
      </article>

      <article class="panel">
        <header class="panel-head">
          <div><p class="panel-kicker">Presenter approval</p><h2>Preview → Published map</h2></div>
          <span class="count" id="audienceRevision">revision 0</span>
        </header>
        <div class="panel-body preview-stack">
          <section class="scene-card" aria-label="Selected proposal preview">
            <header class="scene-head"><span class="scene-title preview">AI proposal preview</span><span class="scene-meta" id="previewMeta">not selected</span></header>
            <div class="scene-canvas preview-tone" id="previewScene" data-testid="proposal-preview"></div>
          </section>
          <section class="scene-card" aria-label="Approved audience state">
            <header class="scene-head"><span class="scene-title approved">Published audience map</span><span class="scene-meta" id="audienceMeta">0 nodes · 0 edges</span></header>
            <div class="scene-canvas approved-tone" id="audienceScene" data-testid="audience-scene"></div>
          </section>
          <div class="approval-lock">Two gates protect the audience: schema validation + presenter approval</div>
        </div>
      </article>
    </section>
  </main>

  <script>
    (() => {
      "use strict";
      let demoState = null;
      let selectedCommandId = null;
      let busy = false;

      const elements = {
        plannerBadge: document.getElementById("plannerBadge"),
        runPlanner: document.getElementById("runPlanner"),
        approveProposal: document.getElementById("approveProposal"),
        rejectProposal: document.getElementById("rejectProposal"),
        undoScene: document.getElementById("undoScene"),
        resetDemo: document.getElementById("resetDemo"),
        decisionCount: document.getElementById("decisionCount"),
        errorBanner: document.getElementById("errorBanner"),
        conversationInput: document.getElementById("conversationInput"),
        proposalCount: document.getElementById("proposalCount"),
        proposalList: document.getElementById("proposalList"),
        commandJson: document.getElementById("commandJson"),
        previewMeta: document.getElementById("previewMeta"),
        previewScene: document.getElementById("previewScene"),
        audienceRevision: document.getElementById("audienceRevision"),
        audienceMeta: document.getElementById("audienceMeta"),
        audienceScene: document.getElementById("audienceScene")
      };

      async function request(path, body) {
        const options = body === undefined ? {} : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        };
        const response = await fetch(path, options);
        if (!response.ok) throw new Error("Demo request failed");
        return response.json();
      }

      function setBusy(value) {
        busy = value;
        elements.runPlanner.disabled = value;
        elements.resetDemo.disabled = value;
        renderActionState();
      }

      function proposals() {
        return demoState && demoState.presenter && Array.isArray(demoState.presenter.proposalQueue)
          ? demoState.presenter.proposalQueue
          : [];
      }

      function selectedProposal() {
        const items = proposals();
        return items.find((item) => item.commandId === selectedCommandId) || items.find((item) => item.status === "pending") || items[0] || null;
      }

      function render() {
        if (!demoState) return;
        if (!selectedCommandId || !proposals().some((item) => item.commandId === selectedCommandId)) {
          const fallback = selectedProposal();
          selectedCommandId = fallback ? fallback.commandId : null;
        }

        elements.plannerBadge.textContent = demoState.planner.label + " · " + demoState.planner.model;
        elements.plannerBadge.classList.toggle("gpt", demoState.planner.mode === "gpt-5.6");
        elements.conversationInput.value = demoState.transcriptText;
        const decisionsCount = demoState.presenter.decisionsCount;
        elements.decisionCount.textContent = String(decisionsCount) + " review decision" + (decisionsCount === 1 ? "" : "s") + " logged";
        elements.errorBanner.hidden = !demoState.error;
        elements.errorBanner.textContent = demoState.error ? demoState.error.message : "";
        elements.proposalCount.textContent = String(proposals().length) + " proposals";
        elements.audienceRevision.textContent = "revision " + String(demoState.audience.scene.revision);

        renderProposalList();
        renderSelectedProposal();
        renderScene(elements.audienceScene, demoState.audience.scene, "Nothing has been published yet.\\nApprove a validated proposal to update this audience map.");
        elements.audienceMeta.textContent = String(demoState.audience.scene.nodes.length) + " nodes · " + String(demoState.audience.scene.edges.length) + " edges";
        renderActionState();
      }

      function renderProposalList() {
        elements.proposalList.replaceChildren();
        const items = proposals();
        if (items.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "Run planner to generate 10 reviewable diagram proposals.";
          elements.proposalList.append(empty);
          return;
        }

        items.forEach((proposal) => {
          const card = document.createElement("button");
          card.type = "button";
          card.className = "proposal-card" + (proposal.commandId === selectedCommandId ? " selected" : "");
          card.setAttribute("aria-pressed", proposal.commandId === selectedCommandId ? "true" : "false");

          const top = document.createElement("span");
          top.className = "proposal-top";
          const type = document.createElement("span");
          type.className = "command-type";
          type.textContent = proposal.type;
          const status = document.createElement("span");
          status.className = "status " + proposal.status;
          status.textContent = proposal.status;
          top.append(type, status);

          const rationale = document.createElement("span");
          rationale.className = "rationale";
          rationale.textContent = proposal.rationale;
          const confidence = document.createElement("span");
          confidence.className = "confidence";
          confidence.textContent = "confidence " + Math.round(proposal.confidence * 100) + "% · " + proposal.commandId;
          card.append(top, rationale, confidence);
          card.addEventListener("click", () => {
            selectedCommandId = proposal.commandId;
            render();
          });
          elements.proposalList.append(card);
        });
      }

      function renderSelectedProposal() {
        const proposal = selectedProposal();
        if (!proposal) {
          elements.commandJson.textContent = "Run planner to inspect a schema-validated command.";
          elements.previewMeta.textContent = "not selected";
          renderScene(elements.previewScene, { nodes: [], edges: [] }, "Select a proposal to preview the change before publication.");
          return;
        }
        selectedCommandId = proposal.commandId;
        elements.commandJson.textContent = JSON.stringify(proposal.command, null, 2);
        elements.previewMeta.textContent = proposal.status + " · " + proposal.preview.nodeCount + " nodes";
        renderScene(elements.previewScene, proposal.previewScene, "This command does not add a visible element by itself.");
      }

      function renderScene(container, scene, emptyText) {
        container.replaceChildren();
        const nodes = Array.isArray(scene.nodes) ? scene.nodes : [];
        const edges = Array.isArray(scene.edges) ? scene.edges : [];
        if (nodes.length === 0 && edges.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = emptyText;
          container.append(empty);
          return;
        }

        const nodeGrid = document.createElement("div");
        nodeGrid.className = "node-grid";
        nodes.forEach((node) => {
          const item = document.createElement("div");
          item.className = "node" + (node.highlighted ? " highlighted" : "");
          const label = document.createElement("div");
          label.className = "node-label";
          label.textContent = node.label;
          const kind = document.createElement("div");
          kind.className = "node-kind";
          kind.textContent = node.kind + " · " + node.id;
          item.append(label, kind);
          nodeGrid.append(item);
        });
        container.append(nodeGrid);

        if (edges.length > 0) {
          const edgeList = document.createElement("div");
          edgeList.className = "edge-list";
          edges.forEach((edge) => {
            const item = document.createElement("div");
            item.className = "edge";
            item.textContent = edge.fromNodeId + " → " + edge.toNodeId + (edge.label ? " · " + edge.label : "");
            edgeList.append(item);
          });
          container.append(edgeList);
        }
      }

      function renderActionState() {
        const proposal = selectedProposal();
        const pending = proposal && proposal.status === "pending";
        elements.approveProposal.disabled = busy || !pending;
        elements.rejectProposal.disabled = busy || !pending;
        elements.undoScene.disabled = busy || !demoState || !demoState.canUndo;
      }

      async function perform(action) {
        setBusy(true);
        try {
          demoState = await action();
          render();
        } catch {
          elements.errorBanner.hidden = false;
          elements.errorBanner.textContent = "Cannot connect to the local demo server. Check that the demo is running.";
        } finally {
          setBusy(false);
        }
      }

      elements.runPlanner.addEventListener("click", () => perform(() => request("/api/plan", { transcriptText: elements.conversationInput.value })));
      elements.approveProposal.addEventListener("click", () => {
        const proposal = selectedProposal();
        if (proposal) perform(() => request("/api/approve", { commandId: proposal.commandId }));
      });
      elements.rejectProposal.addEventListener("click", () => {
        const proposal = selectedProposal();
        if (proposal) perform(() => request("/api/reject", { commandId: proposal.commandId }));
      });
      elements.undoScene.addEventListener("click", () => perform(() => request("/api/undo", {})));
      elements.resetDemo.addEventListener("click", () => {
        selectedCommandId = null;
        perform(() => request("/api/reset", {}));
      });

      perform(() => request("/api/state"));
    })();
  </script>
</body>
</html>
`;
}
