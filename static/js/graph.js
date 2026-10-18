/**
 * Contradictome Interactive Dialectical Graph Visualizer
 * Dual-Engine: Cytoscape.js with Built-in Interactive SVG Fallback
 */

class DialecticalGraph {
  constructor(containerId, onNodeSelectCallback) {
    this.container = document.getElementById(containerId);
    this.onNodeSelect = onNodeSelectCallback;
    this.cy = null;
    this.currentFilter = 'all';
    this.graphData = null;
    this.engine = 'cytoscape'; // 'cytoscape' or 'svg'

    // Check if cytoscape is available on window
    if (typeof cytoscape !== 'undefined') {
      try {
        this.initCytoscape();
      } catch (err) {
        console.warn('Cytoscape initialization failed, falling back to SVG engine:', err);
        this.engine = 'svg';
        this.initSvgEngine();
      }
    } else {
      console.warn('Cytoscape CDN not detected, using built-in SVG graph visualizer.');
      this.engine = 'svg';
      this.initSvgEngine();
    }
  }

  // ==========================================
  // CYTOSCAPE ENGINE
  // ==========================================
  initCytoscape() {
    this.cy = cytoscape({
      container: this.container,
      boxSelectionEnabled: false,
      autounselectify: false,
      wheelSensitivity: 0.2,
      style: [
        // Central Hypothesis Node
        {
          selector: 'node[type="hypothesis"]',
          style: {
            'shape': 'round-rectangle',
            'background-color': '#0284c7',
            'border-width': 3,
            'border-color': '#38bdf8',
            'label': 'data(label)',
            'color': '#ffffff',
            'font-family': 'Inter, sans-serif',
            'font-size': '12px',
            'font-weight': 'bold',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '140px',
            'width': '160px',
            'height': '60px',
            'padding': '10px',
            'shadow-blur': 25,
            'shadow-color': '#0284c7',
            'shadow-opacity': 0.6
          }
        },

        // Pro Study Node
        {
          selector: 'node[type="paper"][stance="PRO"]',
          style: {
            'shape': 'ellipse',
            'background-color': '#064e3b',
            'border-width': 2.5,
            'border-color': '#10b981',
            'label': 'data(label)',
            'color': '#ecfdf5',
            'font-family': 'Inter, sans-serif',
            'font-size': '11px',
            'font-weight': '600',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': '52px',
            'height': '52px',
            'shadow-blur': 15,
            'shadow-color': '#10b981',
            'shadow-opacity': 0.4
          }
        },

        // Con (Refuting/Null) Study Node
        {
          selector: 'node[type="paper"][stance="CON"]',
          style: {
            'shape': 'ellipse',
            'background-color': '#881337',
            'border-width': 2.5,
            'border-color': '#f43f5e',
            'label': 'data(label)',
            'color': '#fff1f2',
            'font-family': 'Inter, sans-serif',
            'font-size': '11px',
            'font-weight': '600',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': '52px',
            'height': '52px',
            'shadow-blur': 15,
            'shadow-color': '#f43f5e',
            'shadow-opacity': 0.4
          }
        },

        // Boundary Study Node
        {
          selector: 'node[type="paper"][stance="BOUNDARY"]',
          style: {
            'shape': 'hexagon',
            'background-color': '#78350f',
            'border-width': 2.5,
            'border-color': '#f59e0b',
            'label': 'data(label)',
            'color': '#fef3c7',
            'font-family': 'Inter, sans-serif',
            'font-size': '11px',
            'font-weight': '600',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': '52px',
            'height': '52px',
            'shadow-blur': 15,
            'shadow-color': '#f59e0b',
            'shadow-opacity': 0.4
          }
        },

        // Active/Selected Node
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#ffffff',
            'shadow-blur': 30,
            'shadow-color': '#ffffff',
            'shadow-opacity': 0.8
          }
        },

        // Directed Stance Edges
        {
          selector: 'edge[stance="PRO"]',
          style: {
            'width': 2,
            'line-color': '#10b981',
            'target-arrow-color': '#10b981',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.75,
            'label': 'data(label)',
            'font-size': '9px',
            'color': '#6ee7b7',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.85,
            'text-background-color': '#030712',
            'text-background-padding': '3px'
          }
        },
        {
          selector: 'edge[stance="CON"]',
          style: {
            'width': 2,
            'line-color': '#f43f5e',
            'target-arrow-color': '#f43f5e',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.75,
            'label': 'data(label)',
            'font-size': '9px',
            'color': '#fda4af',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.85,
            'text-background-color': '#030712',
            'text-background-padding': '3px'
          }
        },
        {
          selector: 'edge[stance="BOUNDARY"]',
          style: {
            'width': 2,
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.75,
            'label': 'data(label)',
            'font-size': '9px',
            'color': '#fcd34d',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.85,
            'text-background-color': '#030712',
            'text-background-padding': '3px'
          }
        },

        // Contradiction Clash Edges
        {
          selector: 'edge[type="contradiction"]',
          style: {
            'width': 2,
            'line-style': 'dashed',
            'line-color': '#fb7185',
            'curve-style': 'unbundled-bezier',
            'opacity': 0.65,
            'label': 'data(label)',
            'font-size': '9px',
            'color': '#f43f5e',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.85,
            'text-background-color': '#030712',
            'text-background-padding': '3px'
          }
        }
      ]
    });

    this.cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      if (this.onNodeSelect) {
        this.onNodeSelect(node.data());
      }
    });

    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        this.cy.nodes().unselect();
      }
    });
  }

  // ==========================================
  // UNIFIED LOAD GRAPH
  // ==========================================
  loadGraph(graphData) {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      console.warn('loadGraph received empty graphData');
      return;
    }

    this.graphData = graphData;

    if (this.engine === 'cytoscape' && this.cy) {
      try {
        this.loadCytoscapeGraph(graphData);
      } catch (err) {
        console.error('Cytoscape rendering error, switching to SVG engine:', err);
        this.engine = 'svg';
        this.initSvgEngine();
        this.renderSvgGraph(graphData);
      }
    } else {
      this.renderSvgGraph(graphData);
    }
  }

  loadCytoscapeGraph(graphData) {
    this.cy.elements().remove();

    // Calculate guaranteed non-zero pre-computed positions
    const containerW = this.container.clientWidth || 700;
    const containerH = this.container.clientHeight || 560;
    const cx = containerW / 2;
    const cy = containerH / 2;
    const radius = Math.min(containerW, containerH) * 0.38;

    const paperNodes = graphData.nodes.filter(n => n.data.type !== 'hypothesis');
    const paperCount = paperNodes.length || 1;

    const elements = [];

    // Add nodes with group and non-zero positions
    graphData.nodes.forEach((n) => {
      let x = cx;
      let y = cy;

      if (n.data.type !== 'hypothesis') {
        const idx = paperNodes.indexOf(n);
        const angle = (2 * Math.PI * idx) / paperCount - Math.PI / 2;
        x = cx + radius * Math.cos(angle);
        y = cy + radius * Math.sin(angle);
      }

      elements.push({
        group: 'nodes',
        data: n.data,
        position: { x, y }
      });
    });

    // Add edges
    (graphData.edges || []).forEach((e) => {
      elements.push({
        group: 'edges',
        data: e.data
      });
    });

    this.cy.add(elements);
    this.cy.resize();

    // Run safe layout with animation disabled to prevent initial (0,0) NaN zoom bug
    const layout = this.cy.layout({
      name: 'concentric',
      fit: true,
      padding: 60,
      animate: false,
      concentric: (node) => (node.data('type') === 'hypothesis' ? 2 : 1),
      levelWidth: () => 1,
      minNodeSpacing: 50
    });

    layout.run();

    // Force a clean fit after layout
    setTimeout(() => {
      if (this.cy) {
        this.cy.resize();
        this.cy.fit(null, 60);
      }
    }, 50);
  }

  // ==========================================
  // PURE INTERACTIVE SVG ENGINE (Zero-Dependency)
  // ==========================================
  initSvgEngine() {
    this.container.innerHTML = `
      <div id="svgGraphWrapper" class="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing">
        <svg id="svgGraphCanvas" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="glowHypo" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glowPro" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glowCon" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <!-- Arrow markers -->
            <marker id="arrowPro" markerWidth="8" markerHeight="8" refX="22" refY="4" orient="auto">
              <polygon points="0 1, 8 4, 0 7" fill="#10b981" />
            </marker>
            <marker id="arrowCon" markerWidth="8" markerHeight="8" refX="22" refY="4" orient="auto">
              <polygon points="0 1, 8 4, 0 7" fill="#f43f5e" />
            </marker>
            <marker id="arrowBoundary" markerWidth="8" markerHeight="8" refX="22" refY="4" orient="auto">
              <polygon points="0 1, 8 4, 0 7" fill="#f59e0b" />
            </marker>
          </defs>
          <g id="svgViewport">
            <g id="svgEdgesLayer"></g>
            <g id="svgNodesLayer"></g>
          </g>
        </svg>
      </div>
    `;

    this.setupSvgInteractions();
  }

  setupSvgInteractions() {
    const wrapper = document.getElementById('svgGraphWrapper');
    const viewport = document.getElementById('svgViewport');
    if (!wrapper || !viewport) return;

    this.svgTransform = { x: 0, y: 0, scale: 1 };
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    // Pan with mouse drag on background
    wrapper.addEventListener('mousedown', (e) => {
      if (e.target.closest('.svg-node')) return; // handled by node drag
      isPanning = true;
      startX = e.clientX - this.svgTransform.x;
      startY = e.clientY - this.svgTransform.y;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      this.svgTransform.x = e.clientX - startX;
      this.svgTransform.y = e.clientY - startY;
      this.applySvgTransform();
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
    });

    // Zoom with mouse wheel
    wrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(Math.max(this.svgTransform.scale * zoomFactor, 0.4), 3.0);
      
      const rect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.svgTransform.x = mouseX - (mouseX - this.svgTransform.x) * (newScale / this.svgTransform.scale);
      this.svgTransform.y = mouseY - (mouseY - this.svgTransform.y) * (newScale / this.svgTransform.scale);
      this.svgTransform.scale = newScale;

      this.applySvgTransform();
    }, { passive: false });
  }

  applySvgTransform() {
    const viewport = document.getElementById('svgViewport');
    if (viewport) {
      viewport.setAttribute('transform', `translate(${this.svgTransform.x}, ${this.svgTransform.y}) scale(${this.svgTransform.scale})`);
    }
  }

  renderSvgGraph(graphData) {
    const edgesLayer = document.getElementById('svgEdgesLayer');
    const nodesLayer = document.getElementById('svgNodesLayer');
    if (!edgesLayer || !nodesLayer) return;

    edgesLayer.innerHTML = '';
    nodesLayer.innerHTML = '';

    const containerW = this.container.clientWidth || 700;
    const containerH = this.container.clientHeight || 560;
    const cx = containerW / 2;
    const cy = containerH / 2;
    const radius = Math.min(containerW, containerH) * 0.36;

    const paperNodes = graphData.nodes.filter(n => n.data.type !== 'hypothesis');
    const paperCount = paperNodes.length || 1;

    // Node position map
    this.nodePositions = {};

    graphData.nodes.forEach((n) => {
      if (n.data.type === 'hypothesis') {
        this.nodePositions[n.data.id] = { x: cx, y: cy, data: n.data };
      } else {
        const idx = paperNodes.indexOf(n);
        const angle = (2 * Math.PI * idx) / paperCount - Math.PI / 2;
        this.nodePositions[n.data.id] = {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          data: n.data
        };
      }
    });

    // Render Edges
    (graphData.edges || []).forEach((e) => {
      const source = this.nodePositions[e.data.source];
      const target = this.nodePositions[e.data.target];
      if (!source || !target) return;

      const isClash = e.data.type === 'contradiction';
      const stance = e.data.stance || 'PRO';

      let strokeColor = '#10b981';
      let markerUrl = 'url(#arrowPro)';
      if (stance === 'CON') {
        strokeColor = '#f43f5e';
        markerUrl = 'url(#arrowCon)';
      } else if (stance === 'BOUNDARY') {
        strokeColor = '#f59e0b';
        markerUrl = 'url(#arrowBoundary)';
      }

      if (isClash) {
        strokeColor = '#fb7185';
        markerUrl = '';
      }

      const gEdge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gEdge.setAttribute('class', `svg-edge ${isClash ? 'svg-clash-edge' : ''}`);
      gEdge.setAttribute('data-source', e.data.source);
      gEdge.setAttribute('data-target', e.data.target);
      gEdge.setAttribute('data-stance', stance);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
      path.setAttribute('d', d);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', isClash ? '2' : '2');
      path.setAttribute('stroke-opacity', isClash ? '0.6' : '0.75');
      if (isClash) {
        path.setAttribute('stroke-dasharray', '5,5');
      } else {
        path.setAttribute('marker-end', markerUrl);
      }

      // Edge label
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX);
      text.setAttribute('y', midY - 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', strokeColor);
      text.setAttribute('font-size', '9px');
      text.setAttribute('font-family', 'Inter, sans-serif');
      text.setAttribute('font-weight', '500');
      text.setAttribute('paint-order', 'stroke');
      text.setAttribute('stroke', '#030712');
      text.setAttribute('stroke-width', '4px');
      text.setAttribute('stroke-linecap', 'round');
      text.setAttribute('stroke-linejoin', 'round');
      text.textContent = e.data.label || '';

      gEdge.appendChild(path);
      gEdge.appendChild(text);
      edgesLayer.appendChild(gEdge);
    });

    // Render Nodes
    Object.keys(this.nodePositions).forEach((nodeId) => {
      const node = this.nodePositions[nodeId];
      const data = node.data;
      const isHypo = data.type === 'hypothesis';
      const stance = (data.stance || 'PRO').toUpperCase();

      const gNode = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gNode.setAttribute('class', 'svg-node cursor-pointer transition-transform duration-150');
      gNode.setAttribute('data-id', nodeId);
      gNode.setAttribute('data-type', data.type);
      gNode.setAttribute('data-stance', stance);
      gNode.setAttribute('transform', `translate(${node.x}, ${node.y})`);

      if (isHypo) {
        // Central Hypothesis Card
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -90);
        rect.setAttribute('y', -32);
        rect.setAttribute('width', 180);
        rect.setAttribute('height', 64);
        rect.setAttribute('rx', 12);
        rect.setAttribute('fill', '#0284c7');
        rect.setAttribute('stroke', '#38bdf8');
        rect.setAttribute('stroke-width', '3');
        rect.setAttribute('filter', 'url(#glowHypo)');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('font-size', '11px');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-family', 'Inter, sans-serif');
        text.textContent = data.label.length > 24 ? data.label.substring(0, 24) + '...' : data.label;

        gNode.appendChild(rect);
        gNode.appendChild(text);
      } else {
        // Paper Study Circle
        let fillColor = '#064e3b';
        let strokeColor = '#10b981';
        let glowId = 'url(#glowPro)';

        if (stance === 'CON') {
          fillColor = '#881337';
          strokeColor = '#f43f5e';
          glowId = 'url(#glowCon)';
        } else if (stance === 'BOUNDARY') {
          fillColor = '#78350f';
          strokeColor = '#f59e0b';
          glowId = '';
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', 26);
        circle.setAttribute('fill', fillColor);
        circle.setAttribute('stroke', strokeColor);
        circle.setAttribute('stroke-width', '2.5');
        if (glowId) circle.setAttribute('filter', glowId);

        // Icon or Stance text inside node
        const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        badge.setAttribute('x', 0);
        badge.setAttribute('y', 4);
        badge.setAttribute('text-anchor', 'middle');
        badge.setAttribute('fill', '#ffffff');
        badge.setAttribute('font-size', '10px');
        badge.setAttribute('font-weight', 'bold');
        badge.setAttribute('font-family', 'JetBrains Mono, monospace');
        badge.textContent = stance;

        // Label below node
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', 0);
        label.setAttribute('y', 42);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', '#e2e8f0');
        label.setAttribute('font-size', '11px');
        label.setAttribute('font-weight', '600');
        label.setAttribute('font-family', 'Inter, sans-serif');
        label.setAttribute('paint-order', 'stroke');
        label.setAttribute('stroke', '#030712');
        label.setAttribute('stroke-width', '4px');
        label.setAttribute('stroke-linecap', 'round');
        label.setAttribute('stroke-linejoin', 'round');
        label.textContent = data.label || '';

        gNode.appendChild(circle);
        gNode.appendChild(badge);
        gNode.appendChild(label);
      }

      // Click listener for inspection drawer
      gNode.addEventListener('click', (e) => {
        e.stopPropagation();
        // Remove active ring from other nodes
        document.querySelectorAll('.svg-node').forEach(el => el.classList.remove('selected-svg-node'));
        gNode.classList.add('selected-svg-node');

        if (this.onNodeSelect) {
          this.onNodeSelect(data);
        }
      });

      nodesLayer.appendChild(gNode);
    });

    // Reset transform to fit
    this.fit();
  }

  // ==========================================
  // UNIFIED FILTERING & VIEW CONTROLS
  // ==========================================
  filterStance(stance) {
    this.currentFilter = stance;

    if (this.engine === 'cytoscape' && this.cy) {
      if (stance === 'all') {
        this.cy.nodes().show();
        this.cy.edges().show();
      } else {
        this.cy.nodes().forEach((node) => {
          if (node.data('type') === 'hypothesis') {
            node.show();
          } else if (node.data('stance') === stance) {
            node.show();
          } else {
            node.hide();
          }
        });
        this.cy.edges().forEach((edge) => {
          if (edge.source().visible() && edge.target().visible()) {
            edge.show();
          } else {
            edge.hide();
          }
        });
      }
    } else {
      // SVG Engine Filter
      const nodes = document.querySelectorAll('.svg-node');
      const edges = document.querySelectorAll('.svg-edge');

      nodes.forEach((n) => {
        const type = n.getAttribute('data-type');
        const st = n.getAttribute('data-stance');
        if (type === 'hypothesis' || stance === 'all' || st === stance) {
          n.style.display = 'block';
        } else {
          n.style.display = 'none';
        }
      });

      edges.forEach((e) => {
        const st = e.getAttribute('data-stance');
        if (stance === 'all' || st === stance) {
          e.style.display = 'block';
        } else {
          e.style.display = 'none';
        }
      });
    }
  }

  fit() {
    if (this.engine === 'cytoscape' && this.cy) {
      this.cy.resize();
      this.cy.fit(null, 50);
    } else {
      // Reset SVG pan & zoom
      this.svgTransform = { x: 0, y: 0, scale: 1 };
      this.applySvgTransform();
    }
  }
}

window.DialecticalGraph = DialecticalGraph;
