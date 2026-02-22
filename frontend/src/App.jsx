import { useEffect, useState, useMemo, useRef } from "react";
import icon from "./assets/icon.png";
import ReactMarkdown from "react-markdown";
import { getLayoutedElements } from "./layout";
import ReactFlow, {
  Handle,
  Position,
  Background,
  Controls
} from "reactflow";
import "reactflow/dist/style.css";



/* =====================
   SCENE NODE
===================== */
const SceneNode = ({ data }) => {

  const glow = data.isSelected
    ? "0 0 0 3px rgb(253, 169, 169, 0.5), 0 8px 24px rgba(99,102,241,0.25)"
    : "0 4px 12px rgba(0,0,0,0.06)";

  const borderColor = data.isSelected
    ? "#ff9100"
    : "#e5e7eb";

  return (
    <div style={{
      borderRadius: 18,
      minWidth: 320,
      maxWidth: 600,
      background: "#ffffff",
      boxShadow: glow,
      border: `1px solid ${borderColor}`,
      fontFamily: "Inter, sans-serif",
      transition: "all 0.2s ease"
    }}>
      <div style={{
        background: "#6366f1",
        padding: "10px 14px",
        color: "white",
        fontWeight: 600,
        fontSize: 14
      }}>
        {data.title}
      </div>

      <div style={{
        padding: "12px 14px",
        fontSize: 13,
        color: "#4b5563"
      }}>
        {data.description}
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};


/* =====================
   BLOCK NODE
===================== */
const BlockNode = ({ data }) => {

  const glow = data.isSelected
    ? "0 0 0 4px rgba(253, 169, 169, 0.5)"
    : "none";

  return (
    <div style={{
      width: 1050,
      height: data.height,
      borderRadius: 24,
      position: "relative",
      fontFamily: "Inter, sans-serif",
      boxShadow: glow,
      transition: "all 0.2s ease"
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: 24,
        background: "#f8f9ff00",
        border: "1px solid #dbe2ff",
        zIndex: -1
      }} />

      <div style={{
        background: "#7c83ff",
        padding: "14px 20px",
        fontWeight: 600,
        color: "white",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24
      }}>
        {data.title}
      </div>

      <div style={{
        padding: "18px 20px",
        fontSize: 13,
        color: "#6b7280"
      }}>
        {data.description}
      </div>
    </div>
  );
};




/* =====================
   APP
===================== */
function App() {
  const [project, setProject] = useState(null);
  const [activeBlock, setActiveBlock] = useState(null);
  const [activeScene, setActiveScene] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [chatInput, setChatInput] = useState("");
const [messages, setMessages] = useState([]);
const [history, setHistory] = useState([]);
const generationMessageIndex = useRef(null);

  const nodeTypes = {
    scene: SceneNode,
    block: BlockNode
  };

  

  useEffect(() => {
  if (project) {
    setTimeout(() => {
      setLoading(false);
    }, 200);
  }
}, [project]);

const sendChat = async () => {
  if (!chatInput) return;

  const userMessage = { role: "user", content: chatInput };
  setMessages(prev => [...prev, userMessage]);

 



  const response = await fetch("http://127.0.0.1:8000/chat-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      project,
      message: chatInput,
      selected_node_id: selectedNode?.id ?? null,
      selected_node_type: selectedNode?.type ?? null
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });

  // On split par lignes (chaque yield backend finit par \n)
  const lines = buffer.split("\n");
  buffer = lines.pop(); // garde fragment incomplet

  for (const line of lines) {
    if (!line || line === "[DONE]") continue;

    try {
      const parsed = JSON.parse(line);

      // 🔹 STREAM TOKEN PAR TOKEN
      if (parsed.delta) {
        setMessages(prev => {
           const withoutThinking = prev.filter(msg => msg.type !== "thinking");

  // Si le dernier message est assistant normal → on append
  if (
    withoutThinking.length > 0 &&
    withoutThinking[withoutThinking.length - 1].role === "assistant" &&
    !withoutThinking[withoutThinking.length - 1].type
  ) {
    const updated = [...withoutThinking];
    updated[updated.length - 1] = {
      ...updated[updated.length - 1],
      content:
        (updated[updated.length - 1].content || "") + parsed.delta
    };
    return updated;
  }

  // Sinon on crée un nouveau message assistant
  return [
    ...withoutThinking,
    { role: "assistant", content: parsed.delta }
  ];
});
      }

      if (parsed.status === "thinking") {
  setMessages(prev => [
    ...prev,
    { role: "assistant", content: "💡​ Je réfléchis...", type: "thinking" }
  ]);
}

      // 🔹 STATUS INTERMÉDIAIRE
     if (parsed.status === "generating") {
  setLoading(true);
  setMessages(prev => {
    const newMessages = [
      ...prev,
      { role: "assistant", content: "✨​ Génération du graph...", type: "generating" }
    ];

    // on stocke l’index du message de génération
    generationMessageIndex.current = newMessages.length - 1;

    return newMessages;
  });
}

      // // 🔹 PROJET FINAL
      // if (parsed.project) {
      //   setHistory(prev => [
      //     ...prev,
      //     JSON.parse(JSON.stringify(project))
      //   ]);
      //   setProject(parsed.project);
      // }

    
   if (parsed.status === "done") {

  if (parsed.project) {
    setProject(parsed.project);
  }

  setLoading(false);

  setMessages(prev => {
    // 🔥 On supprime le message generating
    const cleaned = prev.filter(msg => msg.type !== "generating");

    // 🔥 On ajoute la conclusion comme nouveau message
    return [
      ...cleaned,
      {
        role: "assistant",
        content: parsed.assistant_message || "✅ Graph généré."
      }
    ];
  });
}

    } catch (err) {
      console.error("Stream parse error:", err);
    }
  }
  }

  

  setLoading(false);
  setChatInput("");
};

const undoLast = () => {
  if (history.length === 0) return;

  const previous = history[history.length - 1];
  setProject(previous);
  setHistory(prev => prev.slice(0, -1));
};

  /* =====================
     EDGES
  ===================== */
 

const { nodes, edges } = useMemo(() => {
  if (!project) return { nodes: [], edges: [] };

  const layout = getLayoutedElements(project);

  const styledNodes = layout.nodes.map(node => {

    const isSelected = selectedNode?.id === node.id;

    let opacity = 1;

    // Focus scene logic
    if (activeScene && node.type === "scene") {
      const isLinked =
        node.id === activeScene ||
        project.scenes.some(s =>
          s.id === activeScene &&
          s.transitions.some(t => t.target === node.id)
        ) ||
        project.scenes
          .find(s => s.id === node.id)
          ?.transitions.some(t => t.target === activeScene);

      opacity = isLinked ? 1 : 0.1;
    }

    // Focus block logic
    if (activeBlock && node.type === "scene") {
      if (node.data.block_id !== activeBlock) {
        opacity = 0.1;
      }
    }

    if (activeBlock && node.type === "block") {
      opacity = node.id === activeBlock ? 1 : 0.15;
    }

    return {
      ...node,
      data: {
        ...node.data,
        isSelected
      },
      style: {
        ...node.style,
        opacity,
        transition: "opacity 0.2s ease"
      }
    };
  });

  const styledEdges = layout.edges.map(edge => {
    let opacity = 1;

    if (activeScene) {
      const isLinked =
        edge.source === activeScene ||
        edge.target === activeScene;

      opacity = isLinked ? 1 : 0.1;
    }

    if (activeBlock) {
      const sourceScene = project.scenes.find(s => s.id === edge.source);
      const targetScene = project.scenes.find(s => s.id === edge.target);

      if (
        sourceScene?.block_id !== activeBlock &&
        targetScene?.block_id !== activeBlock
      ) {
        opacity = 0.1;
      }
    }

    return {
      ...edge,
      style: {
        ...edge.style,
        opacity,
        strokeWidth: 2,
        transition: "opacity 0.2s ease"
      }
    };
  });

  return {
    nodes: styledNodes,
    edges: styledEdges
  };

}, [project, activeBlock, activeScene, selectedNode]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      width: "100vw",
      height: "100vh",
      background: "#f6f7fb"
    }}>

      {/* HEADER */}
      <div style={{
        height: 64,
        background: "linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #9333ea 100%)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        color: "white",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        fontFamily: "Inter, sans-serif"
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#ffffff"
        }}>
          [ P L O T / P A R T N E R ] 
        </div>

        <div style={{
          fontSize: 13,
          color: "#e7e7e7"
        }}>
          Narrative Graph Builder
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display: "flex", flex: 1 }}>

        {/* LEFT PROMPT PANEL */}
        {isPanelOpen && (
          <div style={{
            color: "#2e2f31",
            width: "400px",
            background: "#ffffff",
            borderRight: "1px solid #e5e7eb",
            padding: 5,
            fontFamily: "Inter, sans-serif",
            margin:0,
            overflowY: "auto"
          }}>
            <h2 style={{ marginTop: 0 }}>Plot Partner</h2>
<div
  style={{
    height:"55vh",
    width: "100%",
    scrollbarColor: "#cbd5e1 #f7f7f7",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }}
>
{messages.map((msg, index) => (
  <div
    key={index}
    className={
      msg.type === "thinking" || msg.type === "generating"
        ? "status-message"
        : ""
    }
    style={{
      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
      background: msg.role === "user"
        ? "linear-gradient(-90deg, #3b82f6 0%, #5392f7 100%)"
        : "#e5e7eb",
      color: msg.role === "user" ? "white" : "#111",
      padding: "8px 12px",
      borderRadius: 12,
      maxWidth: "80%",
      fontSize: 13
    }}
  >
{msg.type === "thinking" || msg.type === "generating" ? (
  <>
    <span className="animated-emoji">
      {msg.type === "thinking" ? "💡" : "✨"}
    </span>
    {" "}
    <em>{msg.content.replace("💡", "").replace("✨", "")}</em>
  </>
) : (
  <ReactMarkdown>
    {msg.content}
  </ReactMarkdown>
)}
</div>))}
</div>
 <textarea
              placeholder="Parlons de vos histoires..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              style={{
                marginTop: 10,
                width: "92%",
                height: "15%",
                display:"flex",
                background: "#f7f7f7",
                color: "#333",
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                scrollbarColor: "#cbd5e1 #f7f7f7",
                border: "1px solid #ddd"
              }}
            />

<button
  onClick={sendChat}
  style={{
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: "#3b82f6",
    color: "white",
    marginRight: 8,
    cursor: "pointer"
  }}
>
  Send
</button>

<button
  onClick={undoLast}
  style={{
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: "#6b7280",
    color: "white",
    cursor: "pointer"
  }}
>
  Undo
</button>
          </div>
          
        )}


        {/* GRAPH */}
        <div style={{ flex: 1, position: "relative" }}>
          <ReactFlow
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{ type: "bezier" }}
            onNodeClick={(e, node) => {
              setSelectedNode(node);

              if (node.type === "block") {
                setActiveBlock(activeBlock === node.id ? null : node.id);
                setActiveScene(null);
              }

              if (node.type === "scene") {
                setActiveScene(node.id);
                setActiveBlock(null);
              }
            }}
            onPaneClick={() => {
              setActiveBlock(null);
              setActiveScene(null);
              setSelectedNode(null);
            }}
            fitView
          >
            <Background gap={28} size={1} color="#e5e7eb" />
            <Controls />
          </ReactFlow>
{loading && (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.6)",
      zIndex: 20
    }}
  >
    <div
      style={{
        width: 60,
        height: 60,
        border: "6px solid #e0e7ff",
        borderTop: "6px solid #9333ea",
        borderRadius: "50%",
        animation: "spin 1s linear infinite"
      }}
    />
  </div>
)}
    <img
  src={icon}
  alt="Toggle Assistant"
  onClick={() => setIsPanelOpen(!isPanelOpen)}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  style={{
    position: "absolute",
    bottom: 20,
    left: 60,
    width: 60,
    height: 60,
    borderRadius: 12,
    cursor: "pointer",
    boxShadow: isHovered
      ? "0 6px 18px rgba(0,0,0,0.2)"
      : "0 4px 12px rgba(0,0,0,0.15)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    transform: `
      scaleX(${isPanelOpen ? 1 : -1})
      scale(${isHovered ? 1.08 : 1})
    `,
    transformOrigin: "center",
    zIndex: 10
  }}
/>


        </div>

        {/* SIDE PANEL */}
        {selectedNode && (
          <div style={{
            width: 340,
            background: "#ffffff",
            color: "#2e2f31",
            borderLeft: "1px solid #e5e7eb",
            padding: 24,
            fontFamily: "Inter, sans-serif",
            overflowY: "auto"
          }}>
            <h2 style={{ marginTop: 0 }}>
              {selectedNode.data.title}
            </h2>

            <p style={{ color: "#6b7280" }}>
              {selectedNode.data.description}
            </p>

            {selectedNode.type === "scene" && (
              <>
                {selectedNode.data.characters?.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 24 }}>Personnages</h4>
                    <ul>
                      {selectedNode.data.characters.map(charId => {
                        const char = project.characters?.find(c => c.id === charId);
                        return <li key={charId}>{char ? char.name : charId}</li>;
                      })}
                    </ul>
                  </>
                )}

                {selectedNode.data.objects?.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 24 }}>Objets</h4>
                    <ul>
                      {selectedNode.data.objects.map(objId => {
                        const obj = project.objects?.find(o => o.id === objId);
                        return <li key={objId}>{obj ? obj.name : objId}</li>;
                      })}
                    </ul>
                  </>
                )}

                <h4 style={{ marginTop: 24 }}>Block</h4>
<ul>
  {(() => {
    const block = project.blocks.find(
      bl => bl.id === selectedNode.data.block_id
    );
    return (
      <li>
        {block ? block.title : selectedNode.data.block_id}
      </li>
    );
  })()}
</ul>
              </>
            )}

            <button
              onClick={() => {
                setSelectedNode(null);
                setActiveBlock(null);
                setActiveScene(null);
              }}
              style={{
                marginTop: 30,
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: "#6366f1",
                color: "white",
                cursor: "pointer"
              }}
            >
              Fermer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
