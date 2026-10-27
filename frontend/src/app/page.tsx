"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Search,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  Zap,
  Layers,
  Terminal,
  RotateCcw
} from "lucide-react";

// Types matching the backend schemas
interface NodeStatus {
  status: "idle" | "running" | "completed" | "error" | "looping";
  message?: string;
  data?: any;
}

interface ContradictionResolved {
  claim: string;
  reality: string;
  resolution: string;
}

interface FinalVerdict {
  product_name: string;
  alternative_product?: string;
  verdict: "RECOMMENDED" | "AVOID" | "CONDITIONAL_PASS" | string;
  one_line_summary: string;
  confidence_score: number;
  price_estimate: string;
  marketing_claims: string[];
  reddit_reality: string[];
  contradictions_resolved: ContradictionResolved[];
  buyer_beware_flags: string[];
  verdict_justification: string;
  sources: { title: string; href: string; source?: string }[];
}

const PRESET_QUERIES = [
  {
    label: "🎧 Headset: Big head + multipoint under $150",
    query: "I want a noise-canceling headset under $150 for a big head with multipoint Bluetooth",
    category: "Audio / Headphone"
  },
  {
    label: "🪑 Office Chair: Lumbar support under $180",
    query: "Best ergonomic office chair under $180 with durable lumbar support for 8+ hour workdays",
    category: "Ergonomics / Desk"
  },
  {
    label: "🤖 Robot Vacuum: Long pet hair under $300",
    query: "Robot vacuum under $300 that doesn't get jammed with long pet hair",
    category: "Smart Home"
  }
];

export default function TrueVerdictPage() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [showArchModal, setShowArchModal] = useState(false);
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [copied, setCopied] = useState(false);

  // Live node tracker state
  const [nodes, setNodes] = useState<Record<string, NodeStatus>>({
    planner_node: { status: "idle" },
    harvester_node: { status: "idle" },
    auditor_node: { status: "idle" },
    tie_breaker_node: { status: "idle" },
    synthesizer_node: { status: "idle" }
  });

  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [activeLoopCount, setActiveLoopCount] = useState<number>(0);
  const [finalVerdict, setFinalVerdict] = useState<FinalVerdict | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  // Health check on mount
  useEffect(() => {
    fetch(`${backendUrl}/api/health`)
      .then((res) => {
        if (res.ok) setBackendOnline(true);
        else setBackendOnline(false);
      })
      .catch(() => {
        fetch("/api/health")
          .then((res) => setBackendOnline(res.ok))
          .catch(() => setBackendOnline(false));
      });
  }, [backendUrl]);

  // Auto-scroll logs
  useEffect(() => {
    if (showRawLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamLogs, showRawLogs]);

  const addLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setStreamLogs((prev) => [...prev, `[${timestamp}] ${text}`]);
  };

  const resetInvestigationState = () => {
    setFinalVerdict(null);
    setActiveLoopCount(0);
    setStreamLogs([]);
    setNodes({
      planner_node: { status: "idle" },
      harvester_node: { status: "idle" },
      auditor_node: { status: "idle" },
      tie_breaker_node: { status: "idle" },
      synthesizer_node: { status: "idle" }
    });
  };

  const handleInvestigate = async (searchPrompt?: string) => {
    const targetQuery = (searchPrompt || query).trim();
    if (!targetQuery || isLoading) return;

    resetInvestigationState();
    setIsLoading(true);
    setQuery(targetQuery);
    addLog(`Initiating adversarial investigation for: "${targetQuery}"`);

    // Mark planner as running
    setNodes((prev) => ({
      ...prev,
      planner_node: { status: "running", message: "Extracting constraints and building dual queries..." }
    }));

    try {
      let response: Response;
      try {
        response = await fetch(`${backendUrl}/api/investigate?query=${encodeURIComponent(targetQuery)}`);
      } catch (err) {
        response = await fetch(`/api/investigate?query=${encodeURIComponent(targetQuery)}`);
      }
      
      if (!response.ok || !response.body) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventType = "message";
          let dataStr = "";

          const eventMatch = block.match(/^event:\s*(.+)$/m);
          if (eventMatch) eventType = eventMatch[1].trim();

          const dataMatch = block.match(/^data:\s*(.+)$/m);
          if (dataMatch) dataStr = dataMatch[1].trim();

          if (!dataStr) continue;

          try {
            const parsedData = JSON.parse(dataStr);

            if (eventType === "pipeline_start") {
              addLog(`Adversarial StateGraph connected. State initialized.`);
            } else if (eventType === "node_update") {
              const { node, status, title, message, data } = parsedData;

              addLog(`${title || node}: ${message || "Step processed"}`);

              setNodes((prev) => {
                const next = { ...prev };
                next[node] = {
                  status: status || "completed",
                  message,
                  data
                };

                // Node transitions
                if (node === "planner_node") {
                  next.harvester_node = { status: "running", message: "Fetching specs & Reddit threads in parallel..." };
                } else if (node === "harvester_node") {
                  next.auditor_node = { status: "running", message: "Cross-examining marketing claims against Reddit complaints..." };
                } else if (node === "auditor_node") {
                  if (data?.contradiction_found) {
                    next.tie_breaker_node = { status: "running", message: "Contradiction detected! Running targeted tie-breaker..." };
                  } else {
                    next.synthesizer_node = { status: "running", message: "Synthesizing final anti-SEO verdict..." };
                  }
                } else if (node === "tie_breaker_node") {
                  setActiveLoopCount((c) => c + 1);
                  next.auditor_node = { status: "running", message: "Re-evaluating audit with tie-breaker evidence..." };
                }

                return next;
              });
            } else if (eventType === "verdict") {
              setFinalVerdict(parsedData);
              addLog(`Final Verdict synthesized for ${parsedData.product_name}`);
              
              // Dynamic confetti for recommended verdict
              if (typeof window !== "undefined" && (parsedData.verdict === "RECOMMENDED" || parsedData.verdict === "CONDITIONAL_PASS")) {
                import("canvas-confetti").then((confetti) => {
                  confetti.default({
                    particleCount: 60,
                    spread: 70,
                    origin: { y: 0.6 }
                  });
                });
              }
            } else if (eventType === "done") {
              addLog(`Investigation pipeline completed successfully.`);
              setIsLoading(false);
            } else if (eventType === "error") {
              addLog(`ERROR: ${parsedData.error}`);
              setIsLoading(false);
            }
          } catch (e) {
            console.error("Error parsing SSE chunk:", e, block);
          }
        }
      }
    } catch (err: any) {
      console.warn("Direct SSE connection failed, attempting fallback...", err);
      addLog(`Backend stream error: ${err.message}. Checking offline mode.`);
      setIsLoading(false);
    }
  };

  const copyVerdictToClipboard = () => {
    if (!finalVerdict) return;
    const text = `TRUEVERDICT REPORT: ${finalVerdict.product_name}
Verdict: ${finalVerdict.verdict} (${finalVerdict.confidence_score}% Confidence)
Price: ${finalVerdict.price_estimate}
Summary: ${finalVerdict.one_line_summary}

Dealbreakers & Flaws:
${finalVerdict.buyer_beware_flags.map((f) => `- ${f}`).join("\n")}

Why This Beats Generic AI:
${finalVerdict.verdict_justification}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "RECOMMENDED":
        return {
          bg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          label: "VERIFIED BUY"
        };
      case "AVOID":
        return {
          bg: "bg-rose-500/15 border-rose-500/40 text-rose-300",
          icon: <XCircle className="w-5 h-5 text-rose-400" />,
          label: "DO NOT BUY"
        };
      case "CONDITIONAL_PASS":
      default:
        return {
          bg: "bg-amber-500/15 border-amber-500/40 text-amber-300",
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          label: "CONDITIONAL BUY"
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[300px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[600px] h-[300px] bg-emerald-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                TrueVerdict
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Anti-SEO Agent
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setShowArchModal(true)}
              className="text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 hover:border-slate-600 bg-slate-900/50 transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>How It Works</span>
            </button>

            {/* Backend connectivity indicator */}
            <div className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full border border-slate-800 bg-slate-900/40">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline === true
                    ? "bg-emerald-400 shadow-[0_0_8px_#10b981]"
                    : backendOnline === false
                    ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                    : "bg-slate-500"
                }`}
              />
              <span className="text-slate-400 hidden sm:inline">
                {backendOnline === true ? "FastAPI Online" : backendOnline === false ? "Local Fallback" : "Connecting..."}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 text-xs font-medium"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Adversarial Multi-Agent Source Verification</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            Unmask Fake Reviews &{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              Affiliate SEO Blogs
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-sm sm:text-base leading-relaxed"
          >
            ChatGPT regurgitates top-ranking sponsored articles. TrueVerdict extracts your strict constraints,
            harvests 6-month Reddit failure modes, and runs a cyclical LangGraph auditor to resolve hidden dealbreakers.
          </motion.p>
        </div>

        {/* Search & Quick Filter Pills */}
        <div className="max-w-3xl mx-auto space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInvestigate();
            }}
            className="relative"
          >
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., I want a noise-canceling headset under $150 for a big head with multipoint Bluetooth"
                className="w-full pl-12 pr-36 py-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-xl shadow-black/40"
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="absolute right-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Auditing...</span>
                  </>
                ) : (
                  <>
                    <span>Investigate</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Preset 1-Click Test Queries */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Instant Test Scenarios:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleInvestigate(preset.query)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all text-left flex items-center gap-1.5"
                >
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cyclical LangGraph StateGraph Live Node Tracker */}
        <section className="glass-panel rounded-2xl p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="font-semibold text-white text-base">Cyclical LangGraph Agent Pipeline</h3>
                <p className="text-xs text-slate-400">Live visualization of node execution & tie-breaker loops</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeLoopCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Tie-Breaker Loop Active (Cycle {activeLoopCount})</span>
                </div>
              )}
              <button
                onClick={() => setShowRawLogs(!showRawLogs)}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/50 border border-slate-700/60"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{showRawLogs ? "Hide Logs" : "Show Stream Logs"}</span>
                {showRawLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 5-Node Interactive Visual Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
            {/* Node 1: Planner */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                nodes.planner_node.status === "running"
                  ? "border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-500/10"
                  : nodes.planner_node.status === "completed"
                  ? "border-slate-700 bg-slate-900/60"
                  : "border-slate-800/60 bg-slate-950/40 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-cyan-400 font-semibold">1. planner_node</span>
                {nodes.planner_node.status === "running" && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
                {nodes.planner_node.status === "completed" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-medium text-slate-200">Constraint Planner</div>
              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {nodes.planner_node.message || "Parses raw prompt into price limits, must-haves & pain points."}
              </div>
            </div>

            {/* Node 2: Harvester */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                nodes.harvester_node.status === "running"
                  ? "border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-500/10"
                  : nodes.harvester_node.status === "completed"
                  ? "border-slate-700 bg-slate-900/60"
                  : "border-slate-800/60 bg-slate-950/40 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-cyan-400 font-semibold">2. harvester_node</span>
                {nodes.harvester_node.status === "running" && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
                {nodes.harvester_node.status === "completed" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-medium text-slate-200">Parallel Harvester</div>
              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {nodes.harvester_node.message || "Query A (Specs/Blogs) vs Query B (Reddit Complaints)."}
              </div>
            </div>

            {/* Node 3: Auditor */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                nodes.auditor_node.status === "running"
                  ? "border-amber-500 bg-amber-950/20 shadow-lg shadow-amber-500/10"
                  : nodes.auditor_node.status === "completed"
                  ? "border-slate-700 bg-slate-900/60"
                  : "border-slate-800/60 bg-slate-950/40 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-amber-400 font-semibold">3. auditor_node</span>
                {nodes.auditor_node.status === "running" && <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
                {nodes.auditor_node.status === "completed" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-medium text-slate-200">Adversarial Auditor</div>
              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {nodes.auditor_node.message || "Cross-examines claims and detects unverified marketing hype."}
              </div>
            </div>

            {/* Node 4: Tie-Breaker */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                nodes.tie_breaker_node.status === "running"
                  ? "border-amber-400 bg-amber-950/30 shadow-lg shadow-amber-400/20 ring-1 ring-amber-400"
                  : nodes.tie_breaker_node.status === "completed"
                  ? "border-slate-700 bg-slate-900/60"
                  : "border-slate-800/60 bg-slate-950/40 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-amber-300 font-semibold">4. tie_breaker_node</span>
                {nodes.tie_breaker_node.status === "running" && <RotateCcw className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
                {nodes.tie_breaker_node.status === "completed" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-medium text-slate-200 flex items-center gap-1">
                <span>Tie-Breaker Loop</span>
                <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">Loop Edge</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {nodes.tie_breaker_node.message || "Targeted search on detected contradictions; loops back to Auditor."}
              </div>
            </div>

            {/* Node 5: Synthesizer */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                nodes.synthesizer_node.status === "running"
                  ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10"
                  : nodes.synthesizer_node.status === "completed"
                  ? "border-slate-700 bg-slate-900/60"
                  : "border-slate-800/60 bg-slate-950/40 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">5. synthesizer_node</span>
                {nodes.synthesizer_node.status === "running" && <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
                {nodes.synthesizer_node.status === "completed" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-medium text-slate-200">Verdict Synthesizer</div>
              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {nodes.synthesizer_node.message || "Compiles final clean JSON with resolved contradictions and bottom line."}
              </div>
            </div>
          </div>

          {/* Raw Streaming Terminal Drawer */}
          <AnimatePresence>
            {showRawLogs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-xl bg-black/80 border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5 max-h-56 overflow-y-auto">
                  {streamLogs.length === 0 ? (
                    <div className="text-slate-500 italic">No logs yet. Submit a query to inspect live SSE streaming.</div>
                  ) : (
                    streamLogs.map((log, i) => (
                      <div key={i} className="leading-relaxed">
                        <span className="text-cyan-400">❯</span> {log}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Final Verdict Dashboard */}
        <AnimatePresence>
          {finalVerdict && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Verdict Hero Card */}
              <div className="glass-panel-elevated rounded-2xl p-6 sm:p-8 space-y-6 border border-slate-700/80">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {(() => {
                        const badge = getVerdictBadge(finalVerdict.verdict);
                        return (
                          <div
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </div>
                        );
                      })()}

                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {finalVerdict.price_estimate}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {finalVerdict.product_name}
                    </h2>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl">
                      {finalVerdict.one_line_summary}
                    </p>
                  </div>

                  {/* Confidence Score Gauge */}
                  <div className="sm:self-center flex sm:flex-col items-center gap-2 sm:gap-1 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 min-w-[130px] justify-center">
                    <div className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                      {finalVerdict.confidence_score}%
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                      Confidence Score
                    </div>
                  </div>
                </div>

                {/* Alternative Product Runner-up */}
                {finalVerdict.alternative_product && (
                  <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                        Top Anti-SEO Alternative
                      </div>
                      <div className="text-sm text-slate-200 mt-0.5 font-medium">
                        {finalVerdict.alternative_product}
                      </div>
                    </div>
                  </div>
                )}

                {/* Marketing Claims vs Reddit Reality (Adversarial Matrix) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Marketing / Affiliate Claims */}
                  <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                      <ExternalLink className="w-4 h-4 text-sky-400" />
                      <span>Marketing & Tech Blog Claims</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {finalVerdict.marketing_claims.map((claim, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-sky-400 font-bold">✓</span>
                          <span>{claim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Right: Reddit & Real Owner Reality */}
                  <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>Reddit & Long-Term Owner Reality</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {finalVerdict.reddit_reality.map((reality, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">⚠</span>
                          <span>{reality}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Contradictions Resolved Table */}
                {finalVerdict.contradictions_resolved && finalVerdict.contradictions_resolved.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <RotateCcw className="w-4 h-4 text-cyan-400" />
                      <span>Contradictions Resolved by Tie-Breaker Agent</span>
                    </div>

                    <div className="space-y-3">
                      {finalVerdict.contradictions_resolved.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/90 space-y-2"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="bg-sky-950/20 p-2.5 rounded-lg border border-sky-500/20">
                              <span className="font-semibold text-sky-300">Claim: </span>
                              <span className="text-slate-300">{item.claim}</span>
                            </div>
                            <div className="bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/20">
                              <span className="font-semibold text-rose-300">Reality: </span>
                              <span className="text-slate-300">{item.reality}</span>
                            </div>
                          </div>
                          <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20 text-xs">
                            <span className="font-semibold text-emerald-300">Resolution / Community Workaround: </span>
                            <span className="text-slate-200">{item.resolution}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buyer Beware Flags */}
                {finalVerdict.buyer_beware_flags && finalVerdict.buyer_beware_flags.length > 0 && (
                  <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Buyer Beware Dealbreakers (What Affiliate Links Omit)</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {finalVerdict.buyer_beware_flags.map((flag, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-400">•</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Why This Beats ChatGPT */}
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span>Why TrueVerdict Beats ChatGPT</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {finalVerdict.verdict_justification}
                  </p>
                </div>

                {/* Sources & Citations */}
                {finalVerdict.sources && finalVerdict.sources.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Verified Data Sources:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {finalVerdict.sources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-cyan-300 text-xs transition-colors"
                        >
                          <span>{src.title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <div className="text-xs text-slate-500">
                    Adversarial audit completed via LangGraph StateGraph.
                  </div>
                  <button
                    onClick={copyVerdictToClipboard}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied Verdict" : "Copy Verdict Summary"}</span>
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Architecture & "Why This Beats ChatGPT" Modal */}
      <AnimatePresence>
        {showArchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel-elevated max-w-2xl w-full rounded-2xl p-6 sm:p-8 space-y-6 relative border border-slate-700"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-lg text-white">How TrueVerdict Beats ChatGPT</h3>
                </div>
                <button
                  onClick={() => setShowArchModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <div className="space-y-1">
                  <h4 className="font-semibold text-cyan-300">1. The Problem with Standard AI Search:</h4>
                  <p className="text-slate-400">
                    When you ask ChatGPT for product recommendations, it browses Google and summarizes the top 3
                    affiliate blog articles (Wirecutter, TechRadar, Forbes Vetted). These sites make billions from affiliate
                    commissions and bury long-term flaws.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-semibold text-cyan-300">2. The TrueVerdict Solution (Cyclical LangGraph):</h4>
                  <p className="text-slate-400">
                    TrueVerdict creates two adversarial search streams:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400">
                    <li><strong className="text-slate-200">Query A (Marketing & Specs):</strong> Extracts manufacturer specs, claimed battery life, and MSRP.</li>
                    <li><strong className="text-slate-200">Query B (Reddit Reality):</strong> Queries Reddit, dedicated forums, and teardowns for specific failure modes after 6+ months of real-world use.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <h4 className="font-semibold text-cyan-300">3. The Circular Tie-Breaker Edge:</h4>
                  <p className="text-slate-400">
                    If the <code className="text-amber-300 bg-amber-950/40 px-1 py-0.5 rounded">auditor_node</code> finds a discrepancy between marketing and Reddit complaints, it triggers a conditional loop into <code className="text-amber-300 bg-amber-950/40 px-1 py-0.5 rounded">tie_breaker_node</code> with a hyper-targeted query to find the community consensus workaround before synthesizing the final verdict.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowArchModal(false)}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>TrueVerdict • Anti-SEO Product Scout powered by LangGraph & FastAPI</div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>FastAPI Backend</span>
            <span>•</span>
            <span>Next.js 16</span>
            <span>•</span>
            <span>DuckDuckGo Search</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
