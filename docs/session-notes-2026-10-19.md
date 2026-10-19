# Session Notes — Oct 18-19, 2026

## 1. Monetization strategy
- Current state check: no revenue mechanism exists yet (just agent plumbing — OmniRoute, Jarvis, omni-bots — with no paying customer).
- Fastest path to cash identified: Upwork/Fiverr freelance gigs (web scraping, AI chatbot/agent setup, data cleaning) using the existing multi-agent stack as the speed advantage.
- 7-day plan to $500+: optimize profiles, send 10-15 targeted proposals/day on fresh fixed-price jobs, deliver fast, collect reviews, raise prices after 3+ five-star reviews.

## 2. Etsy store automation
- Reality check: Etsy automation is a slower (weeks, not days) parallel track, not a fast-cash lane — keep freelance work as the primary 7-day engine.
- Real pieces needed: Etsy Open API v3 (OAuth) for listings, Printify/Printful for fulfillment, an image model (DALL-E/Gemini) for designs, an SEO/copy generator for titles/tags/descriptions.
- Found a real starting repo: `semihbugrasezer/etsy-seo-mcp` (MIT licensed) for listing copy generation.

## 3. `etsy-brain` — shared database + agents (built and pushed)
- Pushed to `Gadson32/Gadson32`, branch `claude/jolly-brown-835t9s`, folder `etsy-brain/`.
- One shared SQLite database (`brain.db`, gitignored) with three thin scripts:
  - `jarvis_agent.py` — facts/knowledge store ("the big brain")
  - `etsy_agent.py` — listings, prices, costs, margins
  - `strategist_agent.py` — pulls facts + listings into one context blob for an LLM to reason over and write recommendations back
- To get it locally: `git clone` the repo, checkout the branch, `cd etsy-brain`.

## 4. Local Claude Code / OmniRoute / Remote Control debugging
- Root issue: local Claude Code was wired through OmniRoute → DeepSeek, and DeepSeek's balance is $0.00 — meaning local Claude Code had no working "brain," separate from any file-access issue.
- Fix identified: use **Remote Control** (`claude auth login` then `claude remote-control` in the project folder) instead of paying for a separate API key — it authenticates with the existing Claude account/subscription (same one powering this cloud session), bypassing OmniRoute/DeepSeek entirely for Claude Code specifically. OmniRoute stays in place for Gemini/ChatGPT/Grok-backed tools (Jarvis, omni-bots, OpenCode).
- Hunted down a `claude remote-control` failure ("ANTHROPIC_BASE_URL is set and does not point at api.anthropic.com") by searching Windows env vars, WSL env vars, and config files — found the offending line only inside `docs/omniroute-setup-summary.md` (a past note, not an active setting). Confirmed nothing currently overrides it; next step is simply re-running `claude remote-control`.

## 5. REA (`morluto/rea`) — reviewed before install
- What it is: an MIT-licensed, actively maintained reverse-engineering toolkit/MCP server (npm: `rea-agents`) that lets an AI agent analyze compiled software (binaries, Electron/.NET apps, APKs, firmware) via Ghidra/IDA/Hopper.
- Verified directly from source (cloned `github.com/morluto/rea`, HEAD `255d906e`): real engineering (full test suite, mutation testing, CI architecture guards), a defensive `install.sh`, and a benign `prepare.mjs` npm lifecycle script (no network calls, no credential access). Confirmed it's the real project, not the known fake/typosquatted copy.
- Its own `DISCLAIMER.md` explicitly prohibits DRM circumvention, unauthorized access, and copying proprietary software — lawful/authorized use only, same constraint flagged independently beforehand.
- Safety guidance given: only point it at your own code or explicitly authorized targets; run it inside an isolated VM with a snapshot taken before first use, reverted after each session.

## 6. VirtualBox VM setup (in progress)
- Installed VirtualBox 7.2.20.
- Cleared out an old broken "FireboxV" VM registration (leftover, unrelated).
- Created new VM `REA-box`: Other Linux (64-bit) type (Ubuntu wasn't in the visible dropdown list, generic type works fine), 4096 MB RAM, 40.99 GB VDI disk.
- Currently downloading Ubuntu 26.04.1 LTS Desktop ISO (amd64, 5.9GB) from ubuntu.com to attach as the boot disk.

### Next steps
1. Confirm the Ubuntu ISO finished downloading in the Downloads folder.
2. Finish the `REA-box` VM wizard, boot it from the ISO, install Ubuntu.
3. Take a clean snapshot immediately after install, before installing REA or anything else.
4. Install `rea-agents` inside the VM only; do analysis work there; revert to the snapshot after each session.
5. Separately: re-run `claude remote-control` on the local machine now that no active OmniRoute override was found.
