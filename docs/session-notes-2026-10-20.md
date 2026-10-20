# Session Notes — Oct 20, 2026

## Phone-as-server plan (new today)
Goal: use an old LG Velvet (model LM-G910EMW, Android 12) as a dedicated, always-on, low-power server instead of leaving the main PC running.

Plan agreed:
1. **Factory reset the phone** — Settings → System → Reset options → Erase all data. Wipes it clean.
2. **Install F-Droid** (f-droid.org) — needed because Google Play's Termux build is abandoned/broken on Android 10+.
3. **Install Termux via F-Droid** — gives a real Linux terminal on the phone.
4. **Inside Termux:**
   ```bash
   pkg update && pkg upgrade
   pkg install python nodejs git openssh
   ```
5. **Keep it alive:** permanent charger, exclude Termux from battery optimization.
6. **Make it reachable:** run `sshd` in Termux, SSH into it from the PC over the home WiFi.
7. Still open: confirm exactly what runs on it — likely candidate is the `etsy-brain` agents (Jarvis/etsy/strategist scripts), to be confirmed.

Status: plan agreed, execution not yet started — phone has not been wiped yet.

## VM sandbox (continued from yesterday)
Still open from yesterday: finish the VirtualBox `REA-box` VM — confirm Ubuntu ISO install completed, take the clean snapshot, then install `rea-agents` inside it only. Not finished today.

## Dashboards (named today, no other context yet)
Two dashboards flagged to finish tomorrow:
- **API key dashboard**
- **"Spiky" dashboard** (name as stated — meaning not yet clarified; confirm tomorrow what this actually refers to)

## Tomorrow's plan — 4 things, target: done before 3pm
1. Finish setting up the phone as a server (wipe → F-Droid → Termux → reachable over SSH).
2. Finish the VirtualBox VM sandbox (Ubuntu install confirmed, snapshot taken, REA installed inside it).
3. Finish the API key dashboard.
4. Finish the "spiky" dashboard.

Reminder scheduled for ~10am (Langen, Germany time) to start these with enough runway to finish all four before 3pm.
