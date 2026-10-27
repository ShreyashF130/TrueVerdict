"""
Pydantic schemas and State definitions for the TrueVerdict multi-agent graph.
"""
from typing import List, Optional, Dict, Any, TypedDict
from pydantic import BaseModel, Field


class UserConstraints(BaseModel):
    product_category: str = Field(description="Category of the product (e.g. Wireless Headphones, Robot Vacuum)")
    max_price: Optional[float] = Field(default=None, description="Maximum budget if specified")
    must_have_features: List[str] = Field(default_factory=list, description="Explicit features required by user")
    pain_points_to_avoid: List[str] = Field(default_factory=list, description="Issues user wants to avoid")
    target_persona: Optional[str] = Field(default=None, description="Who this is for (e.g. big head, glasses wearer, gamer)")
    query_a_marketing: str = Field(description="Query targeted at official specs and affiliate reviews")
    query_b_reddit: str = Field(description="Query targeted at Reddit, forum complaints, and failure modes")


class AuditResult(BaseModel):
    confidence_score: int = Field(ge=0, le=100, description="Overall confidence score from 0 to 100")
    contradiction_found: bool = Field(description="True if marketing claims conflict with real owner experience")
    contradiction_detail: Optional[str] = Field(default=None, description="Specific claim vs reality conflict")
    followup_query: Optional[str] = Field(default=None, description="Targeted query to resolve the contradiction")
    specs_adherence: Dict[str, bool] = Field(default_factory=dict, description="Whether each user constraint is met")
    price_compliance: bool = Field(default=True, description="Whether product stays within user budget")


class FinalVerdict(BaseModel):
    product_name: str = Field(description="Primary recommended or analyzed product")
    alternative_product: Optional[str] = Field(default=None, description="Alternative runner-up if primary has flaws")
    verdict: str = Field(description="VERDICT: 'RECOMMENDED', 'AVOID', or 'CONDITIONAL_PASS'")
    one_line_summary: str = Field(description="Punchy, unfiltered bottom line summary")
    confidence_score: int = Field(ge=0, le=100, description="Confidence score")
    price_estimate: str = Field(description="Current street price estimate")
    marketing_claims: List[str] = Field(description="Top marketing promises highlighted by blogs")
    reddit_reality: List[str] = Field(description="Real-world consensus and long-term owner findings")
    contradictions_resolved: List[Dict[str, str]] = Field(
        default_factory=list,
        description="List of { 'claim': ..., 'reality': ..., 'resolution': ... }"
    )
    buyer_beware_flags: List[str] = Field(
        default_factory=list,
        description="Hidden dealbreakers or warning flags"
    )
    verdict_justification: str = Field(description="Why this anti-SEO verdict beats generic AI/affiliate summaries")
    sources: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Key sources with title and url or forum name"
    )


# Graph State representation
class GraphState(TypedDict, total=False):
    user_prompt: str
    constraints: Dict[str, Any]
    specs_data: List[Dict[str, str]]
    reddit_data: List[Dict[str, str]]
    tie_breaker_data: List[Dict[str, str]]
    audit: Dict[str, Any]
    loop_count: int
    final_verdict: Dict[str, Any]
    logs: List[Dict[str, Any]]
