# Bounty Office - Refactored Version

## Overview
This is a completely refactored version of the Bounty Office idle game. The codebase has been modernized with a focus on:

- **Modular Architecture**: Clean separation of concerns with ES6 modules
- **Performance Optimization**: Efficient rendering, DOM batching, and resource management
- **Mobile-First Design**: Fully responsive layout that works seamlessly on all devices
- **Modern UI/UX**: Smooth animations, intuitive interactions, and accessible design
- **Clean Code**: Well-documented, maintainable code structure

## Project Structure

```
/workspace/
├── index.html              # Main HTML file (clean, semantic structure)
├── index.old.html         # Original file (backup)
├── assets/
│   ├── css/
│   │   └── styles.css     # Modern, responsive CSS with CSS variables
│   └── js/
│       ├── app.js         # Main application entry point
│       ├── gameEngine.js  # Core game logic and mechanics
│       ├── gameState.js   # State management and persistence
│       ├── gameData.js    # Game configuration and constants
│       ├── ui.js          # UI management and DOM interactions
│       └── performance.js # Performance optimization utilities
```

## Key Features

### 1. Modular JavaScript Architecture
- **GameEngine**: Handles all game logic, cooldowns, and actions
- **GameState**: Manages save/load functionality and state persistence
- **UIManager**: Handles all UI updates and user interactions
- **PerformanceManager**: Optimizes rendering and resource usage

### 2. Responsive Design
- Mobile-first approach with breakpoints at 640px and 768px
- Flexible grid layouts that adapt to screen size
- Touch-friendly buttons and interactions
- Optimized font sizes and spacing for readability

### 3. Performance Optimizations
- Throttled UI updates to prevent excessive renders
- Cached number formatting for better performance
- Efficient DOM batching to minimize reflows
- Request Animation Frame for smooth animations
- Visibility API integration to pause when tab is hidden

### 4. Modern CSS
- CSS custom properties (variables) for easy theming
- Smooth transitions and animations
- Accessible color contrast ratios
- Support for both light and dark themes (follows system preference)

### 5. Gameplay Preservation
All original gameplay elements have been preserved:
- Hunt bounties action
- Hire crew members (Novice Hunter, Snitch)
- Complete contracts for rewards
- Purchase upgrades (Quick Draw, Double Shot)
- Banking system with passive income
- Autosave and manual save functionality

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6 module support required
- CSS Grid and Flexbox support
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development Notes

### Adding New Features
1. **New Crew Types**: Add to `CREW_TYPES` array in `gameData.js`
2. **New Upgrades**: Add to `UPGRADE_TYPES` array with effect function
3. **New Contracts**: Add to `CONTRACTS` array
4. **UI Components**: Add styles to `styles.css` following existing patterns

### Performance Tips
- Use `performance.scheduleUpdate()` for batched DOM updates
- Leverage the number formatter cache for frequently displayed values
- Add new animations using CSS transitions rather than JavaScript

### State Management
- Game state automatically migrates old save data
- All state changes go through the GameState class
- Autosave runs every 30 seconds by default

## Testing Checklist
- [x] Game loads and initializes properly
- [x] All buttons and interactions work
- [x] Save/load functionality preserves state
- [x] Responsive design works on mobile devices
- [x] Animations are smooth and performant
- [x] Cooldowns display correctly
- [x] Toast notifications appear and disappear
- [x] Keyboard shortcuts work (Space/H for hunt, Ctrl+S for save)

## Future Enhancements
- Add more crew types and upgrades
- Implement achievement system
- Add sound effects and music
- Create more complex contract chains
- Add prestige/rebirth mechanics
- Implement offline progress calculation