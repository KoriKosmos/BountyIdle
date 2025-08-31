# Bounty Office - Idle Game

A modern, responsive idle clicking game where you hunt bounties, hire crew members, and complete contracts to build your bounty hunting empire.

## 🎮 Features

- **Click-based gameplay** - Hunt bounties to earn credits
- **Crew management** - Hire hunters and snitches to automate income
- **Upgrade system** - Improve your hunting efficiency and speed
- **Contract system** - Take on challenging contracts for big rewards
- **Autoclicker mechanics** - Snitches automatically hunt for you
- **Save/Load system** - Progress is automatically saved
- **Developer menu** - Debug tools accessible via "kori" key sequence

## 🏗️ Architecture

The game has been completely refactored with modern web technologies:

### File Structure
```
├── index.html          # Clean, semantic HTML5 structure
├── styles.css          # Modern CSS with responsive design
├── game.js            # Modular ES6+ JavaScript
└── README.md          # This file
```

### Key Improvements
- **Separated concerns** - HTML, CSS, and JS in separate files
- **Modern CSS** - CSS Grid, Flexbox, custom properties, mobile-first design
- **ES6+ JavaScript** - Classes, modules, Map/Set collections, async/await
- **Performance optimized** - Throttled UI updates, efficient DOM manipulation
- **Accessibility** - ARIA labels, keyboard navigation, screen reader support
- **Responsive design** - Works seamlessly on desktop, tablet, and mobile
- **Progressive enhancement** - Graceful degradation for older browsers

## 🎯 Gameplay

1. **Start hunting** - Click "Hunt Bounty" to earn credits
2. **Hire crew** - Use credits to hire Novice Hunters for passive income
3. **Buy upgrades** - Reduce cooldowns and increase click power
4. **Unlock contracts** - Hire 10+ crew members to access contracts
5. **Automate** - Max out cooldown reduction to unlock Snitches (autoclickers)

## 🛠️ Development

### Running Locally
```bash
# Serve the files (any HTTP server works)
python3 -m http.server 8000
# or
npx serve .
# or
php -S localhost:8000
```

### Developer Menu
Type "kori" anywhere in the game to open the developer menu with:
- Credit manipulation
- Crew count adjustment  
- Upgrade level modification
- Game state controls
- Save/load management

### Browser Compatibility
- **Modern browsers** - Full feature support
- **Legacy browsers** - Graceful degradation with core functionality
- **Mobile browsers** - Optimized touch interface

## 📱 Mobile Optimization

- **Touch-friendly** - 44px minimum touch targets
- **Responsive layout** - Adapts to any screen size
- **Performance** - Optimized for mobile CPUs
- **Accessibility** - Works with screen readers and assistive technology

## 🎨 Design System

The game uses a consistent design system with:
- **Dark theme** - Easy on the eyes for long play sessions
- **Color palette** - Carefully chosen for accessibility and aesthetics
- **Typography** - Inter font for optimal readability
- **Spacing** - Consistent spacing scale using CSS custom properties
- **Components** - Reusable UI components with hover states and animations

## 🔧 Technical Features

- **Class-based architecture** - Organized, maintainable code
- **Event delegation** - Efficient event handling for dynamic content
- **Memory management** - Proper cleanup and garbage collection
- **Error handling** - Comprehensive error catching and user feedback
- **Save migration** - Automatic migration from older save formats
- **Performance monitoring** - Built-in performance tracking (development mode)

## 📊 Game Balance

- **Crew scaling** - Exponential cost increases prevent trivial progression
- **Upgrade limits** - Some upgrades have maximum levels to maintain balance
- **Contract difficulty** - Long-term goals that require strategic planning
- **Income progression** - Smooth difficulty curve from manual to automated play

---

*Built with modern web technologies for optimal performance and user experience.*