import dagre from "dagre";

const sceneWidth = 320;
const sceneHeight = 110;

const blockWidth = 650;
const blockHeaderHeight = 90;
const blockPaddingTop = 30;
const blockPaddingBottom = 60;

const intraBlockSpacing = 60;
const interBlockSpacing = 180;

export function getLayoutedElements(project) {
    if (!project || !project.scenes || !project.blocks) {
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];

  let currentY = 0;
  const centerX = 600;

  project.blocks.forEach((block) => {

    const scenesInBlock = project.scenes.filter(
      s => s.block_id === block.id
    );

    // ===== Layout interne des scènes =====

    const internalGraph = new dagre.graphlib.Graph();
    internalGraph.setDefaultEdgeLabel(() => ({}));
    internalGraph.setGraph({
      rankdir: "TB",
      nodesep: intraBlockSpacing,
      ranksep: intraBlockSpacing
    });

    scenesInBlock.forEach(scene => {
      internalGraph.setNode(scene.id, {
        width: sceneWidth,
        height: sceneHeight
      });
    });

    scenesInBlock.forEach(scene => {
      scene.transitions.forEach(t => {
        if (scenesInBlock.find(s => s.id === t.target)) {
          internalGraph.setEdge(scene.id, t.target);
        }
      });
    });

    dagre.layout(internalGraph);

    let maxInternalY = 0;

    scenesInBlock.forEach(scene => {
      const pos = internalGraph.node(scene.id);
      if (pos && pos.y > maxInternalY) maxInternalY = pos.y;
    });

    const blockHeight =
      blockHeaderHeight +
      blockPaddingTop +
      maxInternalY +
      blockPaddingBottom;

    const blockX = centerX - blockWidth / 2;
    const blockY = currentY;

    // ===== PUSH BLOCK =====

    nodes.push({
      id: block.id,
      type: "block",
      position: { x: blockX, y: blockY },
      data: {
        ...block,
        width: blockWidth,
        height: blockHeight
      }
    });

    // ===== PUSH SCENES =====

    scenesInBlock.forEach(scene => {
      const pos = internalGraph.node(scene.id);

      nodes.push({
        id: scene.id,
        type: "scene",
        position: {
          x: (blockWidth - sceneWidth) / 2,
          y:
            blockHeaderHeight +
            blockPaddingTop +
            pos.y -
            sceneHeight / 2
        },
        data: scene,
        parentNode: block.id,
        extent: "parent"
      });

      scene.transitions.forEach((t, i) => {
        edges.push({
          id: `${scene.id}-${t.target}-${i}`,
          source: scene.id,
          target: t.target,
          type: "smoothstep",
          markerEnd: { type: "arrowclosed" }
        });
      });
    });

    currentY += blockHeight + interBlockSpacing;
  });

  return { nodes, edges };
}