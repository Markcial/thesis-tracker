<div align="center">

# 🔮 Thesis Tracker

**Find mispriced prediction markets through cognitive bias analysis.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Claude Code skill](https://img.shields.io/badge/Claude%20Code-skill-D97757?logo=claude&logoColor=white)
![Polymarket](https://img.shields.io/badge/Polymarket-Gamma%20API-2E5CFF)
<!-- TODO(Marc): the README says MIT but the repo has no LICENSE file. Add one, then add:
[![License](https://img.shields.io/github/license/Markcial/thesis-tracker)](LICENSE) -->

</div>

## 🧠 Philosophy

```text
I find facts. YOU develop the thesis.

Facts don't make things happen - you interpret what they mean.
The bet is yours. The thesis is yours. The risk is yours.
```

This is not an arbitrage bot. It surfaces cognitive biases, news sentiment, and market anomalies. You develop the thesis about what those signals mean.

> [!WARNING]
> Nothing here is financial advice. Prediction markets involve real money and real risk, and every decision is yours.
<!-- TODO(Marc): suggested disclaimer, not in the original README. Keep, reword or delete. -->

## ✨ What it does

- 🎯 **Mispriced bets**: markets where cognitive biases create clear mispricings.
- 🎟️ **Cheap lottery tickets**: longshots where current reality suggests better odds than priced.
- 💼 **Portfolio tracking**: monitor positions and P&L, and get hedge/exit advice. Holdings come from the Data API; the CLOB API is for placing trades.
- 📰 **Peekers**: two background daemons that collect market data and news headlines locally, checked before any external API.
- 🧭 **Mentor**: detects your stage and guides you from setup through reflection.
- 🚦 **Traffic lights**: every signal ends as GREEN, YELLOW or RED.

## 📦 What's inside

```text
thesis-tracker/
├── skill/                    # Claude Code skill
│   ├── SKILL.md              # Main skill documentation
│   └── MENTOR.md             # Onboarding guidance
│
├── peekers/                  # Background daemons
│   ├── edges/                # Market data daemon
│   └── news/                 # Headlines daemon
│
└── tools/                    # CLI tools
    ├── lib/                  # Shared utilities
    ├── drift.ts              # Thesis drift detection
    ├── kpi.ts                # Fear & Greed + BTC tracking
    ├── mentor.ts             # Stage detection
    └── personal/             # Your tools (gitignored)
```

## 🧰 Prerequisites

- 🥟 [Bun](https://bun.sh) runtime
- 🤖 [Claude Code](https://claude.ai/code) with skills support
- 👛 A Polymarket wallet address

## ⚙️ Installation

```bash
# Clone
git clone https://github.com/Markcial/thesis-tracker.git
cd thesis-tracker

# Install the skill
cp -r skill ~/.claude/skills/polymarket-edge-scanner

# Set up peekers
cp -r peekers/edges ~/.claude/polymarket-edges
cp -r peekers/news ~/.claude/polymarket-news

# Set up tools
cp -r tools ~/.claude/thesis-tracker-tools

# Install dependencies
cd ~/.claude/polymarket-edges && bun install
cd ~/.claude/polymarket-news && bun install
cd ~/.claude/thesis-tracker-tools && bun install

# Build daemons
cd ~/.claude/polymarket-edges && bun run build
cd ~/.claude/polymarket-news && bun run build
```

## 🚀 Quick Start

1. **Initialize** (first time):
   ```bash
   cd ~/.claude/thesis-tracker-tools && bun run mentor --init
   ```

2. **Start peekers**:
   ```bash
   cd ~/.claude/polymarket-news && ./polymarket-news-daemon &
   cd ~/.claude/polymarket-edges && ./polymarket-edges-daemon &
   ```

3. **Use the skill** in Claude Code:
   ```text
   /polymarket-edge-scanner
   ```

## 🛠️ Tools

From `~/.claude/thesis-tracker-tools`:

| Command | What it does |
|---------|--------------|
| `bun run mentor` | Check your stage, get guidance |
| `bun run drift` | Detect thesis drift |
| `bun run kpi` | Record/view Fear & Greed + BTC |

All support `--json` for structured output.

### 🧩 Personal Tools

Add your own tools to `tools/personal/` - they won't be committed to git.

## 🗺️ Stages

| | Stage | What happens |
|---|---|---|
| 1️⃣ | **Setup** | Config and daemons |
| 2️⃣ | **Learning** | Find first edge together |
| 3️⃣ | **Active** | Skin in the game |
| 4️⃣ | **Reflection** | Review resolved positions |

## 🚦 Traffic Lights

| Light | Meaning |
|---|---|
| 🟢 **GREEN** | Edge found, take position |
| 🟡 **YELLOW** | Watch, wait for confirmation |
| 🔴 **RED** | No edge, pass |

## 🤝 Contributing

See `skill/SKILL.md` section "Developer Intern: Maintaining Tools" for tool development guidelines.

## 📄 License

MIT
<!-- TODO(Marc): add the LICENSE file so GitHub detects it. -->

---

<div align="center">

Made by **Marc Garcia** · [marcgarcia.dev](https://marcgarcia.dev) · [@_marc_garcia on X](https://x.com/_marc_garcia) · [GitHub](https://github.com/Markcial)

</div>
