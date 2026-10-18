# etsy-brain

One shared SQLite database (`brain.db`, created on first run — not committed to git)
and three thin agents that read/write it:

- `jarvis_agent.py` — the knowledge base. Store and recall facts.
- `etsy_agent.py` — Etsy listings: SKU, price, cost, niche, margin.
- `strategist_agent.py` — pulls facts + listings into one context blob for an LLM
  (Claude Code, OpenCode, whatever) to reason over and write recommendations back.

## Get this onto your PC

```
git clone <this repo's URL>
cd etsy-brain
```

No dependencies beyond Python 3 (sqlite3 is built in).

## Usage

```bash
# Feed Jarvis a fact
python jarvis_agent.py add pricing "Competitor X sells similar mugs at $18-22"

# Recall facts
python jarvis_agent.py recall pricing

# Add an Etsy listing
python -c "from etsy_agent import add_listing; add_listing('MUG-001','Funny Dog Mug','...',19.99,6.50,'pets')"

# See margins
python etsy_agent.py margins

# Get the full context to hand to an LLM
python strategist_agent.py context

# Save a recommendation
python strategist_agent.py add "Raise mug price" "Competitors are at $18-22, we're underpriced at $14.99"
```

## How this plugs into Claude Code / OpenCode

Point your local agent at this folder. Instead of re-explaining your business
every session, run `python strategist_agent.py context` and feed the JSON output
into the prompt — that's your "big brain" showing up as real data instead of you
retyping it.

## Next steps

- Wire your existing `jarvis.py`/`jarvis_server.py` to call into `jarvis_agent.py`
  instead of wherever it stores things now.
- Add real listings as you build them.
- Have your Etsy design/listing pipeline write directly into `etsy_listings`
  instead of a spreadsheet.
