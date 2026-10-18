/**
 * Contradictome Main Application Logic
 */

let currentData = null;
let dialecticalGraph = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Graph
  dialecticalGraph = new DialecticalGraph('cy', (nodeData) => {
    populateStudyDrawer(nodeData);
  });

  // 2. Setup Event Listeners
  setupEventListeners();

  // 3. Load Benchmarks and initialize default controversy
  loadBenchmarks();
});

function setupEventListeners() {
  // Audit Button & Input
  const btnAnalyze = document.getElementById('btnAnalyze');
  const hypothesisInput = document.getElementById('hypothesisInput');

  btnAnalyze.addEventListener('click', () => {
    const val = hypothesisInput.value.trim();
    if (val) {
      runAudit({ hypothesis: val });
    }
  });

  hypothesisInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = hypothesisInput.value.trim();
      if (val) {
        runAudit({ hypothesis: val });
      }
    }
  });

  // Benchmark Dropdown Selector
  const benchmarkSelector = document.getElementById('benchmarkSelector');
  benchmarkSelector.addEventListener('change', (e) => {
    const bId = e.target.value;
    if (bId) {
      runAudit({ benchmark_id: bId });
    }
  });

  // Preset Tags
  document.querySelectorAll('.preset-tag').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const bId = e.currentTarget.dataset.id;
      if (bId) {
        benchmarkSelector.value = bId;
        runAudit({ benchmark_id: bId });
      }
    });
  });

  // Tab Switching
  document.querySelectorAll('.workspace-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const targetTabId = e.currentTarget.dataset.tab;
      switchTab(targetTabId);
    });
  });

  // Graph Filters
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
      e.currentTarget.classList.add('active-filter');
      const stance = e.currentTarget.dataset.filter;
      dialecticalGraph.filterStance(stance);
    });
  });

  // Fit Graph Button
  document.getElementById('btnFitGraph').addEventListener('click', () => {
    dialecticalGraph.fit();
  });

  // Modals (Settings & Export)
  setupModals();
}

function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.workspace-tab').forEach((tab) => {
    if (tab.dataset.tab === tabId) {
      tab.classList.remove('inactive-tab');
      tab.classList.add('active-tab');
    } else {
      tab.classList.remove('active-tab');
      tab.classList.add('inactive-tab');
    }
  });

  // Update tab panes
  document.querySelectorAll('.tab-content').forEach((content) => {
    if (content.id === tabId) {
      content.classList.remove('hidden');
      if (tabId === 'tab-graph') {
        setTimeout(() => dialecticalGraph.fit(), 50);
      }
    } else {
      content.classList.add('hidden');
    }
  });

  // Graph controls visibility
  const graphControls = document.getElementById('graphControls');
  if (tabId === 'tab-graph') {
    graphControls.classList.remove('hidden');
  } else {
    graphControls.classList.add('hidden');
  }
}

async function loadBenchmarks() {
  try {
    const res = await fetch('/api/benchmarks');
    const json = await res.json();
    if (json.success) {
      const selector = document.getElementById('benchmarkSelector');
      selector.innerHTML = '<option value="">⚡ Load a Landmark Scientific Controversy...</option>';
      json.benchmarks.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.title} [${b.domain}]`;
        selector.appendChild(opt);
      });

      // Automatically load the first landmark controversy
      if (json.benchmarks.length > 0) {
        selector.value = json.benchmarks[0].id;
        runAudit({ benchmark_id: json.benchmarks[0].id });
      }
    }
  } catch (err) {
    console.error('Failed to load benchmarks:', err);
  }
}

async function runAudit(payload) {
  const btnAnalyze = document.getElementById('btnAnalyze');
  const originalHtml = btnAnalyze.innerHTML;
  btnAnalyze.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Auditing...`;
  btnAnalyze.disabled = true;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success && result.data) {
      currentData = result.data;
      renderAuditResults(result.data);
    } else {
      alert('Error during dialectical audit: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Audit failed:', err);
    alert('Failed to connect to dialectical audit service.');
  } finally {
    btnAnalyze.innerHTML = originalHtml;
    btnAnalyze.disabled = false;
    lucide.createIcons();
  }
}

function renderAuditResults(data) {
  // 1. Update Hypothesis Input Field
  document.getElementById('hypothesisInput').value = data.hypothesis || '';

  // 2. Update Gauge & Stats
  const score = data.consensus_score !== undefined ? data.consensus_score : 50;
  document.getElementById('consensusScoreText').textContent = `${score}%`;
  document.getElementById('consensusLabelText').textContent = data.consensus_label || 'Active Controversy';
  
  // SVG gauge animation (perimeter 2 * pi * 20 = 125.6)
  const maxOffset = 125.6;
  const offset = maxOffset - (score / 100) * maxOffset;
  const gauge = document.getElementById('gaugeCircle');
  gauge.style.strokeDashoffset = offset;
  
  // Color the gauge by stance
  if (score >= 65) {
    gauge.style.stroke = '#10b981'; // Green
  } else if (score <= 35) {
    gauge.style.stroke = '#f43f5e'; // Red
  } else {
    gauge.style.stroke = '#f59e0b'; // Amber
  }

  document.getElementById('proCountBadge').textContent = data.pro_count || 0;
  document.getElementById('conCountBadge').textContent = data.con_count || 0;
  document.getElementById('boundaryCountBadge').textContent = data.boundary_count || 0;

  document.getElementById('rootContradictionText').textContent = data.root_contradiction || data.summary || 'Contradiction analyzed.';

  // 3. Render Cytoscape Graph
  if (data.graph) {
    dialecticalGraph.loadGraph(data.graph);
  }

  // 4. Populate Study Drawer with first paper
  if (data.papers && data.papers.length > 0) {
    populateStudyDrawer({
      type: 'paper',
      title: data.papers[0].title,
      authors: data.papers[0].authors,
      year: data.papers[0].year,
      journal: data.papers[0].journal,
      doi: data.papers[0].doi,
      stance: data.papers[0].stance,
      claim: data.papers[0].claim,
      quote: data.papers[0].evidence_quote,
      factors: data.papers[0].factors
    });
  }

  // 5. Render Boundary Factor Matrix Table
  renderFactorMatrix(data.factor_matrix);

  // 6. Render Resolving Protocol
  renderResolvingProtocol(data.tie_breaker_experiment);
}

function populateStudyDrawer(data) {
  if (!data) return;

  const drawerStanceBadge = document.getElementById('drawerStanceBadge');
  const stance = (data.stance || 'PRO').toUpperCase();
  drawerStanceBadge.textContent = stance;

  if (stance === 'PRO') {
    drawerStanceBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800';
  } else if (stance === 'CON') {
    drawerStanceBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800';
  } else {
    drawerStanceBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800';
  }

  document.getElementById('drawerTitle').textContent = data.title || 'Selected Study';
  document.getElementById('drawerAuthors').textContent = data.authors || 'Researchers';
  document.getElementById('drawerJournal').textContent = data.journal || 'Journal';
  document.getElementById('drawerYear').textContent = data.year || '2023';

  // DOI Link
  const doiContainer = document.getElementById('drawerDoiContainer');
  const doiLink = document.getElementById('drawerDoiLink');
  const doiText = document.getElementById('drawerDoiText');
  if (data.doi) {
    doiContainer.classList.remove('hidden');
    doiLink.href = `https://doi.org/${data.doi}`;
    doiText.textContent = `DOI: ${data.doi}`;
  } else {
    doiContainer.classList.add('hidden');
  }

  // Claims & Quotes
  document.getElementById('drawerClaim').textContent = data.claim || 'Empirical finding not specified.';
  document.getElementById('drawerQuote').textContent = data.quote || 'Evidence quote not available.';

  // Factors
  const factors = data.factors || {};
  document.getElementById('drawerModelSystem').textContent = factors.model_system || 'Standard model';
  document.getElementById('drawerIntervention').textContent = factors.intervention || 'Targeted protocol';
  document.getElementById('drawerReadout').textContent = factors.readout || 'Primary endpoint';
  document.getElementById('drawerConfounder').textContent = factors.confounders || 'None documented';
}

function renderFactorMatrix(matrix) {
  const tbody = document.getElementById('matrixBody');
  tbody.innerHTML = '';

  if (!matrix || !matrix.rows || matrix.rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500">No comparative factors extracted.</td></tr>';
    return;
  }

  matrix.rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition cursor-pointer';

    const stance = String(row[1] || '').toUpperCase();
    let badgeClass = 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/80';
    if (stance === 'CON') badgeClass = 'text-rose-400 bg-rose-950/60 border border-rose-800/80';
    if (stance === 'BOUNDARY') badgeClass = 'text-amber-400 bg-amber-950/60 border border-amber-800/80';

    tr.innerHTML = `
      <td class="p-3 font-semibold text-slate-200 font-mono text-[11px]">${escapeHtml(row[0])}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${badgeClass}">${escapeHtml(stance)}</span>
      </td>
      <td class="p-3 text-slate-300">${escapeHtml(row[2])}</td>
      <td class="p-3 text-slate-300">${escapeHtml(row[3])}</td>
      <td class="p-3 text-slate-300">${escapeHtml(row[4])}</td>
      <td class="p-3 text-rose-300 font-mono text-[11px]">${escapeHtml(row[5])}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderResolvingProtocol(protocol) {
  if (!protocol) return;

  document.getElementById('protocolDesignType').textContent = protocol.design_type || '2x2 Factorial Invariance Study';
  document.getElementById('protocolTitle').textContent = protocol.title || 'Resolving Experiment Protocol';
  document.getElementById('protocolRationale').textContent = protocol.rationale || '';
  document.getElementById('protocolDuration').textContent = protocol.duration || 'N/A';
  document.getElementById('protocolBudget').textContent = protocol.estimated_budget || 'N/A';
  document.getElementById('statisticalPowerText').textContent = protocol.statistical_power || 'Sufficient power for alpha=0.01';

  // Decisive Outcomes Tree
  const outcomesContainer = document.getElementById('decisiveOutcomesList');
  outcomesContainer.innerHTML = '';
  (protocol.decisive_outcomes || []).forEach((item, idx) => {
    const isPro = idx === 0;
    const cardClass = isPro ? 'decision-card-pro' : 'decision-card-con';
    const tagColor = isPro ? 'text-emerald-400' : 'text-rose-400';
    const div = document.createElement('div');
    div.className = `p-3 rounded-lg border border-slate-800 ${cardClass} space-y-1`;
    div.innerHTML = `
      <div class="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
        <span class="${tagColor} font-mono font-bold">BRANCH ${idx + 1}:</span>
        <span>${escapeHtml(item.condition)}</span>
      </div>
      <div class="text-xs text-slate-300 italic pl-3 border-l border-slate-700/60">
        ➔ <strong>Verdict:</strong> ${escapeHtml(item.verdict)}
      </div>
    `;
    outcomesContainer.appendChild(div);
  });

  // Step-by-Step SOP
  const stepsList = document.getElementById('protocolStepsList');
  stepsList.innerHTML = '';
  (protocol.protocol_steps || []).forEach((step) => {
    const li = document.createElement('li');
    li.className = 'leading-relaxed text-slate-300 pl-1';
    li.textContent = step;
    stepsList.appendChild(li);
  });

  // Variables
  const indList = document.getElementById('independentVarsList');
  indList.innerHTML = '';
  (protocol.independent_variables || []).forEach((v) => {
    const li = document.createElement('li');
    li.textContent = v;
    indList.appendChild(li);
  });

  const depList = document.getElementById('dependentVarsList');
  depList.innerHTML = '';
  (protocol.dependent_variables || []).forEach((v) => {
    const li = document.createElement('li');
    li.textContent = v;
    depList.appendChild(li);
  });

  // Controls
  const ctrlList = document.getElementById('controlsList');
  ctrlList.innerHTML = '';
  (protocol.controls || []).forEach((c) => {
    const li = document.createElement('li');
    li.textContent = c;
    ctrlList.appendChild(li);
  });
}

function setupModals() {
  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  document.getElementById('btnSettings').addEventListener('click', () => {
    loadSettings();
    settingsModal.classList.remove('hidden');
  });
  document.getElementById('btnCloseSettings').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  document.getElementById('btnSaveSettings').addEventListener('click', async () => {
    const grokKey = document.getElementById('inputGrokKey').value.trim();
    const openaiKey = document.getElementById('inputOpenAIKey').value.trim();
    const anthropicKey = document.getElementById('inputAnthropicKey').value.trim();
    const model = document.getElementById('selectModel').value;

    const payload = { model: model };
    if (grokKey) payload.grok_key = grokKey;
    if (openaiKey) payload.openai_key = openaiKey;
    if (anthropicKey) payload.anthropic_key = anthropicKey;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Settings saved successfully!');
        // Clear secret inputs for safety
        document.getElementById('inputGrokKey').value = '';
        document.getElementById('inputOpenAIKey').value = '';
        document.getElementById('inputAnthropicKey').value = '';
        loadSettings();
        settingsModal.classList.add('hidden');
      }
    } catch (err) {
      alert('Failed to update settings.');
    }
  });

  // Load initial settings status
  loadSettings();

  // Export Modal
  const exportModal = document.getElementById('exportModal');
  const exportPreviewArea = document.getElementById('exportPreviewArea');
  let currentExportContent = '';
  let currentExportMime = 'text/markdown';
  let currentExportFilename = 'report.md';

  document.getElementById('btnExport').addEventListener('click', async () => {
    if (!currentData) return;
    exportModal.classList.remove('hidden');
    loadExportFormat('markdown');
  });

  document.getElementById('btnCloseExport').addEventListener('click', () => {
    exportModal.classList.add('hidden');
  });

  document.getElementById('btnExportMarkdown').addEventListener('click', () => loadExportFormat('markdown'));
  document.getElementById('btnExportLatex').addEventListener('click', () => loadExportFormat('latex'));

  async function loadExportFormat(fmt) {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: fmt, data: currentData })
      });
      const data = await res.json();
      if (data.success) {
        currentExportContent = data.content;
        currentExportMime = data.mime;
        currentExportFilename = data.filename;
        exportPreviewArea.value = data.content;
      }
    } catch (err) {
      console.error('Export generation failed:', err);
    }
  }

  // Copy Export
  document.getElementById('btnCopyExport').addEventListener('click', () => {
    if (exportPreviewArea.value) {
      navigator.clipboard.writeText(exportPreviewArea.value);
      alert('Report copied to clipboard!');
    }
  });

  // Download Export
  document.getElementById('btnDownloadExport').addEventListener('click', () => {
    if (!currentExportContent) return;
    const blob = new Blob([currentExportContent], { type: currentExportMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentExportFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success) {
      updateBadge('badgeGrokStatus', data.has_grok);
      updateBadge('badgeOpenAIStatus', data.has_openai);
      updateBadge('badgeAnthropicStatus', data.has_anthropic);

      if (data.model) {
        const select = document.getElementById('selectModel');
        if (select) select.value = data.model;
      }

      const statusBadge = document.getElementById('engineStatusBadge');
      if (statusBadge) {
        if (data.has_grok && data.model && data.model.includes('grok')) {
          statusBadge.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse mr-1"></span> xAI Grok Active (${data.model})`;
        } else if (data.has_openai && data.model && data.model.includes('gpt')) {
          statusBadge.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1"></span> OpenAI Active (${data.model})`;
        } else if (data.has_anthropic && data.model && data.model.includes('claude')) {
          statusBadge.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse mr-1"></span> Anthropic Active (${data.model})`;
        } else if (data.has_grok) {
          statusBadge.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse mr-1"></span> xAI Grok Ready`;
        } else {
          statusBadge.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1"></span> Dialectical Engine Active`;
        }
      }
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function updateBadge(elementId, isActive) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (isActive) {
    el.textContent = 'Active';
    el.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold';
  } else {
    el.textContent = 'Not set';
    el.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
