import express from "express";
import neo4j from "neo4j-driver";

const router = express.Router();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
);

// ── Helper: safely convert Neo4j Integer / number / null ─────────────────
function toNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  // Neo4j driver Integer object
  if (val && typeof val.toNumber === "function") return val.toNumber();
  return Number(val);
}

// ── Fetch nodes (optionally filtered by search term) ─────────────────────
async function fetchNodes(searchTerm = null) {
  const session = driver.session();
  try {
    let query,
      params = {};

    if (searchTerm) {
      query = `
        MATCH (n)
        WHERE toLower(n.name) CONTAINS toLower($searchTerm)
        RETURN elementId(n) AS id,
               labels(n)[0]  AS group,
               n.name        AS label,
               n.size        AS size
        LIMIT 10000000
      `;
      params = { searchTerm };
    } else {
      query = `
        MATCH (n)
        RETURN elementId(n) AS id,
               labels(n)[0]  AS group,
               n.name        AS label,
               n.size        AS size
        LIMIT 1000000
      `;
    }

    const result = await session.run(query, params);
    return result.records.map((r) => ({
      id: r.get("id"),
      label: r.get("label") || r.get("id"),
      // FIX 1: lowercase group so it matches the GC colour map in the frontend
      group: (r.get("group") || "default").toLowerCase(),
      // FIX 2: Neo4j Integer → JS number
      size: toNumber(r.get("size")) || 18,
    }));
  } finally {
    await session.close();
  }
}

// ── Fetch relationships between a specific set of node IDs ───────────────
// FIX 3: always require nodeIds; use AND so both endpoints are in the set
async function fetchRelationships(nodeIds) {
  if (!nodeIds || nodeIds.length === 0) return [];

  const session = driver.session();
  try {
    // AND ensures both source AND target exist in the returned node list,
    // so D3's validLinks filter never discards them.
    const query = `
      MATCH (a)-[r]->(b)
      WHERE elementId(a) IN $nodeIds
        AND elementId(b) IN $nodeIds
      RETURN elementId(a)  AS source,
             elementId(b)  AS target,
             type(r)        AS label,
             r.strength     AS strength
      LIMIT 50000000
    `;
    const result = await session.run(query, { nodeIds });
    return result.records.map((r) => ({
      source: r.get("source"),
      target: r.get("target"),
      label: r.get("label"),
      // FIX 4: Neo4j Integer → JS number
      strength: toNumber(r.get("strength")) ?? 0.5,
    }));
  } finally {
    await session.close();
  }
}

// ── GET /api/graph — full graph ───────────────────────────────────────────
router.get("/graph", async (req, res) => {
  try {
    const nodes = await fetchNodes();
    // FIX 5: pass node IDs so only relationships between returned nodes come back
    // console.log('node',nodes[0].id)
    const nodeIds = nodes.map((n) => n.id);
    const links = await fetchRelationships(nodeIds);

    console.log(`Graph: ${nodes.length} nodes, ${links.length} links`);
    console.log(nodes[0],'oihfeoiwh')
    console.log(links[0],'links')
    res.json({ nodes, links });
  } catch (err) {
    console.error("Graph fetch error:", err);
    res.status(500).json({ error: "Failed to load graph data" });
  }
});

// ── POST /api/graph/search — search + 1-hop neighbours ───────────────────
router.post("/graph/search", async (req, res) => {
  try {
    const { term } = req.body;

    // Empty search → return full graph
    if (!term || !term.trim()) {
      const nodes = await fetchNodes();
      const nodeIds = nodes.map((n) => n.id);
      const links = await fetchRelationships(nodeIds);
      return res.json({ nodes, links });
    }

    // 1. Find nodes whose name matches the search term
    const matchedNodes = await fetchNodes(term);
    if (matchedNodes.length === 0) {
      return res.json({ nodes: [], links: [] });
    }

    const matchedIds = matchedNodes.map((n) => n.id);
    const matchedSet = new Set(matchedIds);

    // 2. Walk 1 hop from matched nodes; collect neighbours + edges
    const session = driver.session();
    const neighbourMap = new Map(); // id → node object
    const linkMap = new Map(); // "src-tgt-type" → link object

    try {
      // FIX 6: use elementId(startNode(r)) / elementId(endNode(r)) in Cypher
      //        instead of fetching the startNode object and calling .elementId in JS
      const result = await session.run(
        `
        MATCH (n)-[r]-(m)
        WHERE elementId(n) IN $ids
        RETURN elementId(startNode(r)) AS source,
               elementId(endNode(r))   AS target,
               type(r)                  AS relType,
               r.strength               AS strength,
               elementId(m)             AS neighbourId,
               labels(m)[0]             AS neighbourGroup,
               m.name                   AS neighbourLabel,
               m.size                   AS neighbourSize
        LIMIT 300
        `,
        { ids: matchedIds },
      );

      result.records.forEach((r) => {
        const neighbourId = r.get("neighbourId");

        // Collect neighbour node (if not already a matched node)
        if (!matchedSet.has(neighbourId) && !neighbourMap.has(neighbourId)) {
          neighbourMap.set(neighbourId, {
            id: neighbourId,
            label: r.get("neighbourLabel") || neighbourId,
            group: (r.get("neighbourGroup") || "default").toLowerCase(),
            size: toNumber(r.get("neighbourSize")) || 18,
          });
        }

        // Deduplicate edges by src-tgt-type key
        const src = r.get("source");
        const tgt = r.get("target");
        const type = r.get("relType");
        const key = `${src}||${tgt}||${type}`;

        if (!linkMap.has(key)) {
          linkMap.set(key, {
            source: src,
            target: tgt,
            label: type,
            strength: toNumber(r.get("strength")) ?? 0.5,
          });
        }
      });
    } finally {
      await session.close();
    }

    const allNodes = [...matchedNodes, ...neighbourMap.values()];
    const allLinks = [...linkMap.values()];

    console.log(
      `Search "${term}": ${matchedNodes.length} matched, ` +
        `${neighbourMap.size} neighbours, ${allLinks.length} links`,
    );

    res.json({ nodes: allNodes, links: allLinks });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// ── GET /api/graph/stream — SSE streaming ────────────────────────────────
router.get("/graph/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");

  const sendData = async () => {
    try {
      res.write(`event: status\ndata: "🔍 Querying Neo4j..."\n\n`);

      const nodes = await fetchNodes();
      res.write(`event: status\ndata: "📦 Found ${nodes.length} nodes"\n\n`);
      await new Promise((r) => setTimeout(r, 300));

      res.write(`event: status\ndata: "🔗 Fetching relationships..."\n\n`);
      const nodeIds = nodes.map((n) => n.id);
      const links = await fetchRelationships(nodeIds);
      res.write(
        `event: status\ndata: "✅ Built ${links.length} relationships"\n\n`,
      );
      await new Promise((r) => setTimeout(r, 300));

      res.write(
        `data: ${JSON.stringify({ timestamp: Date.now(), nodes, links })}\n\n`,
      );
    } catch (err) {
      res.write(`event: error\ndata: "${err.message}"\n\n`);
    }
  };

  sendData();
});

export default router;
