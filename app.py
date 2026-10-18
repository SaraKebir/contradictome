import json
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import config
from literature_client import LiteratureClient
from dialectic_engine import DialecticEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="static")
CORS(app)

literature_client = LiteratureClient()
dialectic_engine = DialecticEngine()

@app.route("/")
def index():
    return send_from_directory(config.STATIC_DIR, "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(config.STATIC_DIR, path)

@app.route("/api/benchmarks", methods=["GET"])
def get_benchmarks():
    """Returns curated landmark scientific controversies."""
    try:
        benchmarks = literature_client._get_benchmarks()
        # Return summary version for selector
        summaries = [
            {
                "id": b["id"],
                "title": b["title"],
                "domain": b["domain"],
                "hypothesis": b["hypothesis"],
                "consensus_label": b["consensus_label"],
                "consensus_score": b["consensus_score"],
                "pro_count": b["pro_count"],
                "con_count": b["con_count"],
                "boundary_count": b["boundary_count"]
            }
            for b in benchmarks
        ]
        return jsonify({"success": True, "benchmarks": summaries})
    except Exception as e:
        logger.error(f"Error fetching benchmarks: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/benchmark/<benchmark_id>", methods=["GET"])
def get_benchmark_detail(benchmark_id):
    """Returns full data for a specific benchmark controversy."""
    try:
        data = literature_client.find_benchmark_by_id(benchmark_id)
        if not data:
            return jsonify({"success": False, "error": "Benchmark not found"}), 404
        
        # Format graph nodes and edges
        graph_data = build_graph_representation(data)
        data_with_graph = dict(data)
        data_with_graph["graph"] = graph_data
        
        return jsonify({"success": True, "data": data_with_graph})
    except Exception as e:
        logger.error(f"Error fetching benchmark {benchmark_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/analyze", methods=["POST"])
def analyze_hypothesis():
    """
    Main analysis endpoint:
    Searches literature, performs dialectical extraction, maps boundary factors,
    and synthesizes a tie-breaker experiment.
    """
    try:
        payload = request.get_json() or {}
        hypothesis = payload.get("hypothesis", "").strip()
        benchmark_id = payload.get("benchmark_id")

        if not hypothesis and not benchmark_id:
            return jsonify({"success": False, "error": "Hypothesis or benchmark_id is required"}), 400

        # If specific benchmark requested directly
        if benchmark_id:
            benchmark = literature_client.find_benchmark_by_id(benchmark_id)
            if benchmark:
                graph_data = build_graph_representation(benchmark)
                res = dict(benchmark)
                res["graph"] = graph_data
                return jsonify({"success": True, "data": res, "source": "benchmark"})

        # Search literature (OpenAlex or benchmark match)
        lit_result = literature_client.search_literature(hypothesis)
        if lit_result["source"] == "benchmark":
            data = lit_result["data"]
            graph_data = build_graph_representation(data)
            data_with_graph = dict(data)
            data_with_graph["graph"] = graph_data
            return jsonify({"success": True, "data": data_with_graph, "source": "benchmark"})

        papers = lit_result.get("papers", [])
        
        # Run GenAI Dialectical Engine
        audit_result = dialectic_engine.analyze_hypothesis(hypothesis, papers)
        
        # Build graph representation for Cytoscape.js
        graph_data = build_graph_representation(audit_result)
        audit_result["graph"] = graph_data

        return jsonify({"success": True, "data": audit_result, "source": lit_result["source"]})
    except Exception as e:
        logger.exception("Error in /api/analyze")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/settings", methods=["GET", "POST"])
def handle_settings():
    """Get or update API keys and active LLM model."""
    if request.method == "POST":
        try:
            payload = request.get_json() or {}
            grok_key = payload.get("grok_key") or payload.get("xai_key")
            openai_key = payload.get("openai_key")
            anthropic_key = payload.get("anthropic_key")
            model = payload.get("model")

            dialectic_engine.update_keys(
                grok_key=grok_key,
                openai_key=openai_key,
                anthropic_key=anthropic_key,
                model=model
            )
            return jsonify({
                "success": True,
                "message": "Settings updated successfully",
                "has_grok": bool(dialectic_engine.xai_key),
                "has_openai": bool(dialectic_engine.openai_key),
                "has_anthropic": bool(dialectic_engine.anthropic_key),
                "model": dialectic_engine.model_name
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # GET method: return active provider availability and selected model
    return jsonify({
        "success": True,
        "has_grok": bool(dialectic_engine.xai_key),
        "has_openai": bool(dialectic_engine.openai_key),
        "has_anthropic": bool(dialectic_engine.anthropic_key),
        "model": dialectic_engine.model_name
    })

@app.route("/api/export", methods=["POST"])
def export_report():
    """Exports the dialectical audit as Markdown or LaTeX."""
    try:
        payload = request.get_json() or {}
        format_type = payload.get("format", "markdown")
        data = payload.get("data", {})

        if format_type == "latex":
            content = generate_latex_report(data)
            mime = "text/x-tex"
            ext = "tex"
        else:
            content = generate_markdown_report(data)
            mime = "text/markdown"
            ext = "md"

        return jsonify({
            "success": True,
            "filename": f"contradictome_report_{data.get('id', 'export')}.{ext}",
            "content": content,
            "mime": mime
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

def build_graph_representation(data: dict) -> dict:
    """Builds nodes and edges for Cytoscape.js visualization."""
    nodes = []
    edges = []

    # Central Hypothesis Node
    hypo_id = "node_hypo"
    nodes.append({
        "data": {
            "id": hypo_id,
            "label": data.get("title") or "Central Hypothesis",
            "type": "hypothesis",
            "full_text": data.get("hypothesis", ""),
            "score": data.get("consensus_score", 50)
        }
    })

    # Paper nodes
    for p in data.get("papers", []):
        node_id = f"node_{p['id']}"
        stance = p.get("stance", "PRO").upper()
        nodes.append({
            "data": {
                "id": node_id,
                "label": f"{p['authors'].split(',')[0]} ({p['year']})",
                "type": "paper",
                "stance": stance,
                "title": p.get("title", ""),
                "journal": p.get("journal", ""),
                "doi": p.get("doi", ""),
                "citations": p.get("citations", 0),
                "claim": p.get("claim", ""),
                "strength": p.get("strength", "Moderate"),
                "factors": p.get("factors", {}),
                "quote": p.get("evidence_quote", "")
            }
        })

        # Connect paper to hypothesis
        edge_label = "Corroborates" if stance == "PRO" else ("Refutes" if stance == "CON" else "Conditions")
        edges.append({
            "data": {
                "id": f"edge_{node_id}_{hypo_id}",
                "source": node_id,
                "target": hypo_id,
                "stance": stance,
                "label": edge_label
            }
        })

    # Connect conflicting papers directly to each other to highlight contradiction axes
    papers = data.get("papers", [])
    pro_papers = [p for p in papers if p.get("stance") == "PRO"]
    con_papers = [p for p in papers if p.get("stance") == "CON"]

    if pro_papers and con_papers:
        for i in range(min(len(pro_papers), len(con_papers))):
            p1 = pro_papers[i]
            p2 = con_papers[i]
            edges.append({
                "data": {
                    "id": f"clash_{p1['id']}_{p2['id']}",
                    "source": f"node_{p1['id']}",
                    "target": f"node_{p2['id']}",
                    "type": "contradiction",
                    "label": "Direct Discrepancy"
                }
            })

    return {"nodes": nodes, "edges": edges}

def generate_markdown_report(data: dict) -> str:
    tb = data.get("tie_breaker_experiment", {})
    md = f"""# Contradictome Dialectical Scientific Audit
**Hypothesis:** {data.get('hypothesis', '')}  
**Domain:** {data.get('domain', 'Interdisciplinary Science')}  
**Consensus Status:** {data.get('consensus_label', 'Active Controversy')} (Index: {data.get('consensus_score', 50)}/100)  
**Distribution:** {data.get('pro_count', 0)} Pro | {data.get('con_count', 0)} Con | {data.get('boundary_count', 0)} Boundary  

---

## 1. Executive Summary & Root Contradiction
{data.get('summary', '')}

**Mechanistic Root Cause of Discrepancy:**
> {data.get('root_contradiction', '')}

---

## 2. Boundary Condition Factorization Matrix
| Study | Stance | Model System | Intervention / Setup | Key Finding | Primary Confounder |
|---|---|---|---|---|---|
"""
    for row in data.get("factor_matrix", {}).get("rows", []):
        md += f"| {' | '.join(str(cell) for cell in row)} |\n"

    md += f"""
---

## 3. Resolving Tie-Breaker Experimental Protocol
### **{tb.get('title', 'Proposed Resolving Experiment')}**
* **Design Type:** {tb.get('design_type', '2x2 Factorial Invariance Study')}
* **Scientific Rationale:** {tb.get('rationale', '')}
* **Estimated Timeline:** {tb.get('duration', 'N/A')}
* **Estimated Budget:** {tb.get('estimated_budget', 'N/A')}
* **Statistical Power:** {tb.get('statistical_power', 'N/A')}

### Variables & Controls
* **Independent Variables:**
{chr(10).join(['  - ' + v for v in tb.get('independent_variables', [])])}
* **Dependent Variables / Readouts:**
{chr(10).join(['  - ' + v for v in tb.get('dependent_variables', [])])}
* **Controls:**
{chr(10).join(['  - ' + v for v in tb.get('controls', [])])}

### Step-by-Step SOP Protocol
{chr(10).join([f"{i+1}. {step}" for i, step in enumerate(tb.get('protocol_steps', []))])}

### Decisive Decision Tree
"""
    for out in tb.get("decisive_outcomes", []):
        md += f"- **Outcome:** {out.get('condition')}\n  - **Verdict:** *{out.get('verdict')}*\n"

    md += "\n---\n*Report generated by Contradictome — The Dialectical AI Research Assistant.*"
    return md

def generate_latex_report(data: dict) -> str:
    tb = data.get("tie_breaker_experiment", {})
    indep_items = "\n".join([r"\item " + v for v in tb.get("independent_variables", [])])
    dep_items = "\n".join([r"\item " + v for v in tb.get("dependent_variables", [])])
    title = data.get('title', 'Scientific Controversy Report')
    hypo = data.get('hypothesis', '')
    consensus_label = data.get('consensus_label', 'Controversy')
    score = data.get('consensus_score', 50)
    summary = data.get('summary', '')
    root_contra = data.get('root_contradiction', '')
    tb_title = tb.get('title', 'Tie-Breaker Experiment')
    design_type = tb.get('design_type', '')
    rationale = tb.get('rationale', '')
    budget = tb.get('estimated_budget', '')
    duration = tb.get('duration', '')

    return f"""\\documentclass{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage{{amsmath,amssymb}}
\\usepackage{{booktabs}}
\\usepackage{{geometry}}
\\geometry{{a4paper, margin=1in}}

\\title{{\\textbf{{Contradictome Dialectical Audit: {title}}}}}
\\author{{Generated by Contradictome AI Assistant}}
\\date{{\\today}}

\\begin{{document}}
\\maketitle

\\begin{{abstract}}
\\noindent \\textbf{{Hypothesis:}} {hypo} \\\\
\\textbf{{Consensus Metric:}} {consensus_label} ({score}/100). \\\\
{summary}
\\end{{abstract}}

\\section{{Root Contradiction Diagnosis}}
{root_contra}

\\section{{Proposed Resolving Protocol: {tb_title}}}
\\noindent \\textbf{{Design Type:}} {design_type} \\\\
\\textbf{{Rationale:}} {rationale} \\\\
\\textbf{{Estimated Budget:}} {budget} \\\\
\\textbf{{Duration:}} {duration}

\\subsection*{{Independent Variables}}
\\begin{{itemize}}
{indep_items}
\\end{{itemize}}

\\subsection*{{Dependent Variables}}
\\begin{{itemize}}
{dep_items}
\\end{{itemize}}

\\end{{document}}
"""

if __name__ == "__main__":
    import socket
    selected_port = config.PORT
    for p in range(selected_port, selected_port + 10):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((config.HOST, p))
                selected_port = p
                break
            except OSError:
                continue

    print(f"Starting Contradictome server on http://{config.HOST}:{selected_port}")
    app.run(host=config.HOST, port=selected_port, debug=config.DEBUG)
