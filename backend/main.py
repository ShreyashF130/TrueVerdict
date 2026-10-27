"""
TrueVerdict Backend API Server
FastAPI server featuring Server-Sent Events (SSE) streaming for real-time LangGraph multi-agent tracking.
"""
import json
import asyncio
import logging
from typing import AsyncGenerator
from fastapi import FastAPI, Query, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.graph import graph_app

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("trueverdict.api")

app = FastAPI(
    title="TrueVerdict API",
    description="Anti-SEO Product Scout & Adversarial Contradiction Resolver powered by LangGraph",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows localhost:3000, 127.0.0.1:3000 etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InvestigateRequest(BaseModel):
    query: str


def format_sse(event: str, data: dict) -> str:
    """Formats an event and dictionary into standard SSE format."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream_investigation(user_query: str) -> AsyncGenerator[str, None]:
    """
    Streams multi-agent state updates as Server-Sent Events.
    Yields detailed live node transitions:
      - planner_node
      - harvester_node
      - auditor_node
      - tie_breaker_node (if contradiction detected)
      - auditor_node (re-evaluation)
      - synthesizer_node (final verdict payload)
    """
    try:
        # Initial handshake
        yield format_sse("pipeline_start", {
            "message": f"Investigating: '{user_query}'",
            "prompt": user_query
        })
        await asyncio.sleep(0.1)

        initial_state = {
            "user_prompt": user_query,
            "loop_count": 0
        }

        final_verdict = None

        # Stream updates from the LangGraph cyclical StateGraph
        # stream_mode="updates" yields { node_name: updated_state_slice }
        for step in graph_app.stream(initial_state, stream_mode="updates"):
            for node_name, node_output in step.items():
                logger.info(f"LangGraph step completed: {node_name}")

                if node_name == "planner_node":
                    constraints = node_output.get("constraints", {})
                    yield format_sse("node_update", {
                        "node": "planner_node",
                        "status": "completed",
                        "title": "Constraint Extraction",
                        "message": f"Category: {constraints.get('product_category')} | Budget: ${constraints.get('max_price', 'Flexible')}",
                        "data": constraints
                    })

                elif node_name == "harvester_node":
                    specs = node_output.get("specs_data", [])
                    reddit = node_output.get("reddit_data", [])
                    yield format_sse("node_update", {
                        "node": "harvester_node",
                        "status": "completed",
                        "title": "Dual Parallel Harvester",
                        "message": f"Ingested {len(specs)} official/affiliate specs and {len(reddit)} Reddit owner threads",
                        "data": {
                            "specs_count": len(specs),
                            "reddit_count": len(reddit),
                            "specs_sample": specs[:2],
                            "reddit_sample": reddit[:2]
                        }
                    })

                elif node_name == "auditor_node":
                    audit = node_output.get("audit", {})
                    has_conflict = audit.get("contradiction_found", False)
                    yield format_sse("node_update", {
                        "node": "auditor_node",
                        "status": "completed",
                        "title": "Adversarial Auditor",
                        "message": "Contradiction detected! Routing to tie-breaker..." if has_conflict else "Cross-examination resolved cleanly.",
                        "data": audit
                    })

                elif node_name == "tie_breaker_node":
                    tie_data = node_output.get("tie_breaker_data", [])
                    loop_count = node_output.get("loop_count", 1)
                    yield format_sse("node_update", {
                        "node": "tie_breaker_node",
                        "status": "completed",
                        "title": "Tie-Breaker Loop",
                        "message": f"Investigated deep community consensus ({len(tie_data)} sources). Looping back to auditor...",
                        "data": {
                            "loop_count": loop_count,
                            "tie_breaker_results": tie_data
                        }
                    })

                elif node_name == "synthesizer_node":
                    final_verdict = node_output.get("final_verdict", {})
                    yield format_sse("node_update", {
                        "node": "synthesizer_node",
                        "status": "completed",
                        "title": "Final Synthesizer",
                        "message": f"Generated final Anti-SEO verdict for {final_verdict.get('product_name')}",
                        "data": {
                            "product_name": final_verdict.get("product_name"),
                            "verdict": final_verdict.get("verdict"),
                            "confidence_score": final_verdict.get("confidence_score")
                        }
                    })

                # Yield control back to event loop for smooth real-time streaming
                await asyncio.sleep(0.3)

        # Emit the complete final verdict payload
        if final_verdict:
            yield format_sse("verdict", final_verdict)
        
        yield format_sse("done", {"status": "complete"})

    except Exception as e:
        logger.error(f"Error during investigation stream: {e}", exc_info=True)
        yield format_sse("error", {"error": str(e)})


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "TrueVerdict Multi-Agent Backend",
        "engine": "LangGraph Cyclical StateGraph"
    }


@app.get("/api/investigate")
async def investigate_get(query: str = Query(..., description="User search query")):
    """
    SSE streaming endpoint for GET requests (EventSource compatible).
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return StreamingResponse(
        stream_investigation(query.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/investigate")
async def investigate_post(req: InvestigateRequest):
    """
    SSE streaming endpoint for POST requests (fetch with ReadableStream).
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return StreamingResponse(
        stream_investigation(req.query.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/investigate-sync")
def investigate_sync(req: InvestigateRequest):
    """
    Synchronous fallback endpoint returning the full GraphState directly.
    """
    result = graph_app.invoke({"user_prompt": req.query.strip(), "loop_count": 0})
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
