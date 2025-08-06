# Golf Trip Games Dashboard

A comprehensive Next.js application for tracking and managing golf trip games including Skins, Closest to Pin, and Scramble competitions.

## Features

### 🏌️ Skins Game
- **Player Management**: Add players with groups (A/B/C/D) and handicaps
- **18-Hole Scorecard**: Input scores with automatic net score calculation
- **Pot Management**: Configurable pot per hole
- **Skins Calculation**: Automatic winner determination and payout tracking
- **Winnings Summary**: Real-time player earnings display

### 🎯 Closest to Pin
- **Par 3 Tracking**: Monitor all par 3 holes for closest-to-pin contests
- **Winner Selection**: Easy winner assignment with distance tracking
- **Prize Pool Management**: Configurable total prize pool with automatic distribution
- **Player Winnings**: Track individual player closest-to-pin earnings

### 🏆 Scramble Competition
- **Team Management**: Create teams with multiple players
- **Team Scorecard**: Input team scores for each hole
- **Live Leaderboard**: Real-time rankings and score tracking
- **Performance Analysis**: Detailed team performance breakdown

## Technology Stack

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React Hooks** for state management

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd golf-project
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Demo Data
The application comes pre-loaded with demo data including:
- 8 sample players across groups A-D
- Sample scores for the first 9 holes
- Pre-configured closest-to-pin contests
- 4 scramble teams with sample scores

### Navigation
- **Skins Tab** (Default): Manage individual player competition
- **Closest to Pin Tab**: Track par 3 accuracy contests  
- **Scramble Tab**: Monitor team-based competition

### Key Features

#### Skins Game
1. **Player Setup**: Review and modify player information and handicaps
2. **Score Entry**: Input gross scores for each hole
3. **Net Calculation**: Automatic handicap-adjusted scoring
4. **Skins Tracking**: Visual indication of hole winners and ties
5. **Payout Summary**: Real-time winnings calculation

#### Closest to Pin
1. **Prize Configuration**: Set total prize pool
2. **Winner Selection**: Click player buttons to assign winners
3. **Distance Tracking**: Record actual distances to pin
4. **Prize Distribution**: Automatic prize allocation

#### Scramble Format
1. **Team Scores**: Input best ball scores for each team
2. **Live Rankings**: Automatic leaderboard updates
3. **Performance Metrics**: Team statistics and analysis

## Customization

### Adding Players
Modify `src/data/demoData.ts` to add/remove players:
```typescript
export const demoPlayers: Player[] = [
  { id: '1', name: 'Player Name', group: 'A', handicap: 12 },
  // Add more players...
];
```

### Course Configuration
Update hole information in `demoCourse`:
```typescript
export const demoCourse: Course = {
  holes: [
    { number: 1, par: 4 },
    // Configure all 18 holes...
  ],
};
```

### Styling
The application uses Tailwind CSS with a green/blue gradient theme. Modify colors in the component files or extend the Tailwind configuration.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── Dashboard.tsx    # Main dashboard with tab navigation
│   └── tabs/           # Individual tab components
├── data/               # Demo data and configurations
├── types/              # TypeScript type definitions
└── styles/             # Global styles
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Future Enhancements

- [ ] 18-hole completion for all games
- [ ] Data persistence (localStorage/database)
- [ ] Export/import functionality
- [ ] Mobile app version
- [ ] Additional game formats (Nassau, Wolf, etc.)
- [ ] Player statistics and history
- [ ] Tournament bracket support