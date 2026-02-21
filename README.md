# Thesis Tracker

Find mispriced prediction markets through cognitive bias analysis.

## Philosophy

```
I find facts. YOU develop the thesis.

Facts don't make things happen - you interpret what they mean.
The bet is yours. The thesis is yours. The risk is yours.
```

This is not an arbitrage bot. It surfaces cognitive biases, news sentiment, and market anomalies. You develop the thesis about what those signals mean.

## What's Inside

```
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

## Prerequisites

- [Bun](https://bun.sh) runtime
- [Claude Code](https://claude.ai/code) with skills support
- A Polymarket wallet address

## Installation

```bash
# Clone
git clone https://github.com/markcial/thesis-tracker.git
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

## Quick Start

1. **Initialize** (first time):
   ```bash
   cd ~/.claude/thesis-tracker-tools && bun run mentor --init
   ```

2. **Start peekers**:
   ```bash
   cd ~/.claude/polymarket-news && ./polymarket-news-daemon &
   cd ~/.claude/polymarket-edges && ./polymarket-edges-daemon &
   ```

3. **Use the skill**:
   ```
   /polymarket-edge-scanner
   ```

## Tools

From `~/.claude/thesis-tracker-tools`:

| Command | What it does |
|---------|--------------|
| `bun run mentor` | Check your stage, get guidance |
| `bun run drift` | Detect thesis drift |
| `bun run kpi` | Record/view Fear & Greed + BTC |

All support `--json` for structured output.

### Personal Tools

Add your own tools to `tools/personal/` - they won't be committed to git.

## Stages

1. **Setup** - Config and daemons
2. **Learning** - Find first edge together
3. **Active** - Skin in the game
4. **Reflection** - Review resolved positions

## Traffic Lights

- **GREEN** - Edge found, take position
- **YELLOW** - Watch, wait for confirmation
- **RED** - No edge or thesis drifted

## Contributing

See `skill/SKILL.md` section "Developer Intern: Maintaining Tools" for tool development guidelines.

## License

MIT
