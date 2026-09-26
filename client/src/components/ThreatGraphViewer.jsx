"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";

// ─── Node color palette (keyed to node type from patternRegistry) ─
const NODE_COLORS = {
  artifact:       "#34b27b",
  sender:         "#e54b4f",
  recipient:      "#6aa9ff",
  claimed_brand:  "#ff9f6b",
  organization:   "#8c5cff",
  url:            "#e54b4f",
  domain:         "#ff7043",
  attachment:     "#ab47bc",
  file_hash:      "#ef5350",
  phone:          "#26c6da",
  email:          "#42a5f5",
  wallet:         "#ffa726",
  social_account: "#66bb6a",
  platform:       "#78909c",
  campaign:       "#ffd700",
  evidence:       "#94a3b8",
  claim:          "#b0bec5",
  ip:             "#ff5722",
  // AML compat
  person:         "#6aa9ff",
  company:        "#8c5cff",
  bank_account:   "#ffa726",
  transaction:    "#34b27b",
  shell:          "#94a3b8",
  default:        "#64748b",
};

const NODE_ICON = {
  artifact:       "◈",
  sender:         "▶",
  recipient:      "◀",
  claimed_brand:  "™",
  url:            "⬡",
  domain:         "◉",
  email:          "✉",
  phone:          "☎",
  wallet:         "₿",
  file_hash:      "#",
  attachment:     "📎",
  campaign:       "◆",
  social_account: "@",
  platform:       "⊕",
  evidence:       "◎",
  claim:          "!",
  ip:             "⬢",
  person:         "●",
  company:        "▣",
  bank_account:   "⊞",
  transaction:    "⇄",
};

const EDGE_COLOR = {
  IMPERSONATES:       "#e54b4f",
  TARGETS:            "#ff7043",
  SENT:               "#42a5f5",
  LINKS_TO:           "#ffa726",
  HOSTED_ON:          "#78909c",
  ATTACHED:           "#ab47bc",
  RELATED_TO:         "#94a3b8",
  PART_OF_CAMPAIGN:   "#ffd700",
  EXTRACTED_FROM:     "#66bb6a",
  MENTIONS:           "#64748b",
  USES:               "#78909c",
  TRANSFERS_TO:       "#ffa726",
  CONTAINS:           "#64748b",
  REDIRECTS_TO:       "#e54b4f",
  CLAIMS_TO_BE:       "#ff9f6b",
  default:            "#475569",
};

const SEVERITY_RING = {
  critical: "#e54b4f",
  high:     "#ff7043",
  medium:   "#ffa726",
  low:      "#34b27b",
};

export default function ThreatGraphViewer({
  graphData,
  height = 560,
  onNodeSelect,
  className = "",
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const simRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [dims, setDims] = useState({ w: 900, h: height });

  // Track container width
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width || 900;
      setDims(d => ({ ...d, w }));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const nodes = useMemo(() => (graphData?.nodes || []).map(n => ({ ...n })), [graphData]);
  const edges = useMemo(() => (graphData?.edges || []).map(e => ({ ...e })), [graphData]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    if (onNodeSelect) onNodeSelect(node);
  }, [onNodeSelect]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const { w, h } = dims;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    // Arrow marker
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#475569");

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Simulation
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(edges)
        .id(d => d.id)
        .distance(d => {
          // Campaign nodes spread wider
          if (d.source.type === "campaign" || d.target.type === "campaign") return 140;
          if (d.source.type === "artifact") return 100;
          return 70;
        })
        .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collision", d3.forceCollide().radius(d => (d.size || 10) + 12));

    simRef.current = sim;

    // Edges
    const link = g.append("g").attr("class", "links")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", d => EDGE_COLOR[d.type] || EDGE_COLOR.default)
      .attr("stroke-width", d => d.type === "PART_OF_CAMPAIGN" ? 2.5 : 1.2)
      .attr("stroke-opacity", d => d.type === "PART_OF_CAMPAIGN" ? 0.9 : 0.55)
      .attr("stroke-dasharray", d =>
        ["RELATED_TO", "MENTIONS", "EXTRACTED_FROM"].includes(d.type) ? "4,3" : null
      )
      .attr("marker-end", "url(#arrow)");

    // Edge labels (only for important edges)
    const LABELED_EDGES = new Set(["IMPERSONATES", "TRANSFERS_TO", "PART_OF_CAMPAIGN", "TARGETS", "REDIRECTS_TO"]);
    const linkLabel = g.append("g").attr("class", "link-labels")
      .selectAll("text")
      .data(edges.filter(e => LABELED_EDGES.has(e.type)))
      .join("text")
      .attr("font-size", 8)
      .attr("fill", d => EDGE_COLOR[d.type] || "#94a3b8")
      .attr("text-anchor", "middle")
      .attr("dy", -3)
      .text(d => d.type.replace(/_/g, " "));

    // Node groups
    const nodeGroup = g.append("g").attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        handleNodeClick(d);
      })
      .on("mouseenter", (event, d) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d });
      })
      .on("mouseleave", () => setTooltip(null));

    // Outer ring for severity (artifact node only)
    nodeGroup.filter(d => d.type === "artifact" || d.type === "campaign")
      .append("circle")
      .attr("r", d => (d.size || 10) + 5)
      .attr("fill", "none")
      .attr("stroke", d => {
        const sev = d.properties?.severity || "medium";
        return SEVERITY_RING[sev] || "#64748b";
      })
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,2")
      .attr("opacity", 0.7);

    // Node circles
    nodeGroup.append("circle")
      .attr("r", d => d.size || 10)
      .attr("fill", d => NODE_COLORS[d.type] || NODE_COLORS.default)
      .attr("fill-opacity", 0.85)
      .attr("stroke", d => NODE_COLORS[d.type] || NODE_COLORS.default)
      .attr("stroke-width", 1.5);

    // Node icons
    nodeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", d => Math.max(6, (d.size || 10) * 0.7))
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .text(d => NODE_ICON[d.type] || "·");

    // Node labels below
    nodeGroup.append("text")
      .attr("dy", d => (d.size || 10) + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("fill", "#cbd5e1")
      .attr("pointer-events", "none")
      .text(d => {
        const lbl = String(d.label || d.type).slice(0, 24);
        return lbl.length < (d.label || "").length ? lbl + "…" : lbl;
      });

    // Dim unselected on click on SVG background
    svg.on("click", () => setSelectedNode(null));

    // Tick
    sim.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      linkLabel
        .attr("x", d => (d.source.x + d.target.x) / 2)
        .attr("y", d => (d.source.y + d.target.y) / 2);

      nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [nodes, edges, dims, handleNodeClick]);

  const meta = graphData?.metadata || {};

  return (
    <div ref={wrapRef} className={`relative overflow-hidden rounded-xl border border-border bg-card ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Threat Investigation Graph</span>
          {meta.severity && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold uppercase"
              style={{
                background: (SEVERITY_RING[meta.severity] || "#64748b") + "22",
                color: SEVERITY_RING[meta.severity] || "#64748b",
                border: `1px solid ${SEVERITY_RING[meta.severity] || "#64748b"}44`
              }}
            >
              {meta.severity}
            </span>
          )}
          {meta.threat_family && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase text-primary">
              {meta.threat_family.replace(/_/g, " ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{meta.node_count || nodes.length} nodes</span>
          <span>{meta.edge_count || edges.length} edges</span>
          {meta.risk_score != null && (
            <span
              className="font-bold"
              style={{ color: meta.risk_score >= 70 ? "#e54b4f" : meta.risk_score >= 50 ? "#ff7043" : "#34b27b" }}
            >
              Risk: {meta.risk_score}
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <Legend />

      {/* SVG */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        style={{ display: "block", background: "transparent" }}
      />

      {/* Tooltip */}
      {tooltip && (
        <NodeTooltip tooltip={tooltip} />
      )}

      {/* Selected node panel */}
      {selectedNode && (
        <NodePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          No graph data. Run an analysis first.
        </div>
      )}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────
const LEGEND_ITEMS = [
  { type: "artifact", label: "Artifact" },
  { type: "campaign", label: "Campaign" },
  { type: "claimed_brand", label: "Brand Target" },
  { type: "sender", label: "Sender" },
  { type: "domain", label: "Domain" },
  { type: "url", label: "URL" },
  { type: "email", label: "Email" },
  { type: "wallet", label: "Wallet" },
  { type: "claim", label: "Claim" },
  { type: "evidence", label: "Evidence" },
];

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute top-12 left-3 z-10">
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? "Hide Legend" : "Legend"}
      </button>
      {open && (
        <div className="mt-1 rounded border border-border bg-card/95 p-2 shadow-lg">
          {LEGEND_ITEMS.map(item => (
            <div key={item.type} className="flex items-center gap-1.5 py-0.5">
              <span
                className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                style={{ background: NODE_COLORS[item.type] || NODE_COLORS.default }}
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Floating tooltip ─────────────────────────────────────────────
function NodeTooltip({ tooltip }) {
  const { x, y, node } = tooltip;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
      style={{ left: x + 12, top: y - 10, maxWidth: 220 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: NODE_COLORS[node.type] || NODE_COLORS.default }}
        />
        <span className="text-xs font-semibold uppercase text-muted-foreground">{node.type}</span>
      </div>
      <p className="break-all text-sm font-medium text-foreground">{node.label}</p>
      {node.properties?.confidence != null && (
        <p className="mt-1 text-xs text-muted-foreground">
          Confidence: {Math.round(node.properties.confidence * 100)}%
        </p>
      )}
    </div>
  );
}

// ─── Selected node side panel ─────────────────────────────────────
function NodePanel({ node, onClose }) {
  const props = node.properties || {};
  const propEntries = Object.entries(props).filter(([, v]) => v != null && v !== "");

  return (
    <div className="absolute bottom-0 right-0 w-64 rounded-tl-xl border-l border-t border-border bg-card/95 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: NODE_COLORS[node.type] || NODE_COLORS.default }}
          />
          <span className="text-xs font-bold uppercase text-muted-foreground">{node.type}</span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <p className="mb-3 break-all text-sm font-semibold text-foreground">{node.label}</p>
      {propEntries.length > 0 && (
        <div className="space-y-1.5">
          {propEntries.slice(0, 8).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2">
              <span className="min-w-0 flex-shrink-0 text-xs text-muted-foreground capitalize">
                {k.replace(/_/g, " ")}:
              </span>
              <span className="truncate text-xs text-foreground">
                {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
