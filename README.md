# Bounty Idle 🎯

A sophisticated incremental/idle game where you run a bounty hunting office, hire crew members, and complete contracts to earn credits.

## 🎮 About

Bounty Idle is a browser-based incremental game that combines strategic resource management with idle gameplay mechanics. Start as a solo bounty hunter and gradually build your crew, upgrade your capabilities, and take on increasingly challenging contracts.

## ✨ Features

### Core Gameplay

- **Bounty Hunting**: Click to hunt petty bounties and earn credits
- **Crew Management**: Hire and manage different types of crew members
- **Upgrade System**: Purchase upgrades to improve your hunting efficiency
- **Contract System**: Take on long-term contracts for substantial rewards
- **Progressive Unlocking**: New features unlock as you progress

### Crew Types

- **Novice Hunter**: Basic crew member that provides passive income
- **Snitch (Autoclicker)**: Advanced crew member that automatically clicks for you

### Upgrade System

- **Reduce Cooldown**: Decrease button click cooldowns by 5% per purchase (max 20)
- **Double Click Power**: Multiply your click power by 2 per purchase

### Game Mechanics

- **Cooldown System**: Strategic timing for optimal gameplay
- **Passive Income**: Crew members generate credits automatically
- **Contract Progress**: Long-term goals with substantial rewards
- **Auto-save**: Automatic game saving every 30 seconds
- **Mobile Responsive**: Optimized for both desktop and mobile devices

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- No additional software installation required

### Installation

1. Clone or download this repository
2. Start a local web server in the project directory:
   - Python: `python3 -m http.server`
   - Node: `npx http-server .`
3. Open the shown URL (usually `http://localhost:8000`)
4. Start playing!

> **Note**: Due to the use of modern ES Modules, opening `index.html` directly (file protocol) will not work. You must use a local server.

### Deployment

The game is automatically deployed to multiple platforms:

- **GitHub Pages**: Available at the repository's GitHub Pages URL
- **Deploy2NekoWeb**: Automatically deployed to [bountyidle.nekoweb.org](https://bountyidle.nekoweb.org)
- **Custom Domain**: Also accessible at [game.korikosmos.dev](https://game.korikosmos.dev)

A future port to [korikosmos.dev](https://korikosmos.dev) is planned, alongside a modern Astro-based implementation to complement the portfolio site. Additional ports to [galaxy.click](https://galaxy.click) and [itch.io](https://itch.io) are also in development.

### How to Play

1. **Start Hunting**: Click the "Hunt petty bounty" button to earn your first credits
2. **Hire Crew**: Once you have enough credits, hire Novice Hunters for passive income
3. **Purchase Upgrades**: Buy upgrades to improve your hunting efficiency
4. **Unlock Contracts**: Hire 10 crew members to unlock the contract system
5. **Complete Contracts**: Take on contracts for substantial rewards
6. **Expand**: Continue building your bounty hunting empire!

## 🎯 Game Progression

### Early Game

- Focus on manual hunting to build initial credits
- Hire your first Novice Hunter when you can afford it
- Purchase basic upgrades to improve efficiency

### Mid Game

- Build a crew of hunters for passive income
- Unlock the contract system
- Take on your first contract for major rewards

### Late Game

- Maximize upgrade efficiency
- Complete multiple contracts
- Build the ultimate bounty hunting operation

## ⚡ Engineering Highlights

### Architecture & Design

- **Event-Driven Architecture**: Decoupled Game Logic and UI layers using the Observer pattern for maintainable, testable code.
- **Modern ES Modules**: Built using standard ES6 Modules (`import`/`export`) for native browser support without heavy bundlers.
- **Data-Driven Core**: Game content (units, upgrades, contracts) is defined in distinct data structures, allowing for rapid balancing and content expansion without touching core logic.

### Performance

- **Optimized Rendering**: DOM updates are batched and scoped to minimize reflows.
- **Efficient Loop**: Lightweight tick processing ensures consistent performance even on mobile devices.

> 🛠️ **Deep Dive**: Check out [ARCHITECTURE.md](.dev/ARCHITECTURE.md) for a detailed breakdown of the codebase structure and development guide.

## � Customization

- **Retro Mode**: Toggle CRT shader effects and pixel fonts for a nostalgic terminal vibe.
- **Dev Tools**: Hidden developer menu (Ctrl+Shift+D) for testing and state manipulation.

## 🤝 Contributing

Contributions are welcome! Whether it's balancing tweaks, new crew types, or UI polish.

1.  **Fork** the repository.
2.  **Clone** your fork.
3.  **Branch** off `main`.
4.  **Commit** your changes.
5.  **Push** and open a **Pull Request**.

## 🗺️ Roadmap

- **Content**: New Crew types and Contracts.
- **Features**: Cloud Saves and Achievements.
- **Combat**: Simple combat system for high-level contracts.

## 🤝 Contact & Support

Built by **Kori Kosmos**.

- **Twitter/X**: [@korikosmos](https://twitter.com/korikosmos)
- **Email**: [kori@korikosmos.dev](mailto:kori@korikosmos.dev)
- **Portfolio**: [korikosmos.dev](https://korikosmos.dev)

---

**Enjoy building your bounty hunting empire!** 🎯💰
