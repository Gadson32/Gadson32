"""Strategist: pulls context from facts + listings for the LLM to reason over.
This script does not think - it fetches. The thinking happens in Claude/OpenCode,
which you hand this context to as a prompt."""
import sys
import json
from database import init_db, query, execute


def add_recommendation(title, recommendation, based_on=None):
    return execute(
        "INSERT INTO strategy_notes (title, recommendation, based_on) VALUES (?, ?, ?)",
        (title, recommendation, based_on),
    )


def context_for_llm(limit_facts=10, limit_listings=10):
    facts = query(
        "SELECT topic, content FROM facts ORDER BY created_at DESC LIMIT ?", (limit_facts,)
    )
    listings = query(
        "SELECT sku, title, price, cost, niche FROM etsy_listings ORDER BY created_at DESC LIMIT ?",
        (limit_listings,),
    )
    open_notes = query("SELECT title, recommendation FROM strategy_notes WHERE status = 'open'")
    return {"facts": facts, "listings": listings, "open_notes": open_notes}


if __name__ == "__main__":
    init_db()
    if len(sys.argv) < 2 or sys.argv[1] == "context":
        print(json.dumps(context_for_llm(), indent=2))
    elif sys.argv[1] == "add":
        title = sys.argv[2]
        rec = " ".join(sys.argv[3:])
        add_recommendation(title, rec)
        print(f"Saved recommendation: {title}")
