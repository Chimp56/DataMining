# IUU Fishing Detection Frontend

A modern React application for detecting and analyzing illegal, unreported, and unregulated (IUU) fishing activities using advanced data mining techniques.

## Features

- **Interactive Dashboard**: Real-time overview of vessel monitoring and risk assessments
- **Vessel Map**: Interactive map showing vessel positions, AIS disabling events, and risk hotspots
- **Vessel Search**: Comprehensive search and analysis of vessel information
- **IUU Predictions**: AI-powered predictions of illegal fishing activities
- **Analytics**: Detailed analytics and reporting on vessel behavior patterns

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **Tailwind CSS** for styling
- **React Leaflet** for interactive maps
- **Recharts** for data visualization
- **Heroicons** for icons

## Getting Started

### Prerequisites

- Node.js 16+ (Node.js 20+ recommended, Node.js 24 LTS supported) 
- npm or yarn
- Backend API running (see backend documentation)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure environment variables:
Create a `.env` file in the root directory:
```env
VITE_API_URL=http://localhost:8000
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

4. Start development server:
```bash
npm run dev
# or
npm start
```

The application will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Page components
├── services/           # API service layer
├── hooks/              # Custom React hooks
├── utils/              # Utility functions and constants
├── types/              # TypeScript type definitions
└── styles/             # Global styles and CSS

```

## Key Components

### Dashboard
- Real-time statistics and metrics
- Risk distribution charts
- Recent activity feed
- Quick action buttons

### Vessel Map
- Interactive map with vessel positions
- AIS disabling event visualization
- Risk hotspot identification
- Layer controls and filtering

### Vessel Search
- Multi-criteria vessel search (MMSI, name, IMO)
- Detailed vessel information display
- Risk assessment visualization
- Historical data access

### Predictions
- AI-powered IUU fishing predictions
- Risk scoring and confidence levels
- Prediction status tracking
- Model performance metrics

### Analytics
- Comprehensive data visualization
- Trend analysis and reporting
- Export capabilities
- Performance metrics

## API Integration

The frontend communicates with the backend through a RESTful API. Key endpoints include:

- `/api/dashboard/stats` - Dashboard statistics
- `/api/vessels/search` - Vessel search
- `/api/map/vessels` - Vessel positions
- `/api/predictions` - IUU predictions
- `/api/analytics` - Analytics data

## Styling

The application uses Tailwind CSS for styling with a custom design system:

- **Primary Colors**: Blue-based palette for ocean theme
- **Risk Colors**: Green (low), Yellow (medium), Orange (high), Red (critical)
- **Components**: Reusable card, button, and form components
- **Responsive**: Mobile-first responsive design

## State Management

- Local component state for UI interactions
- Custom hooks for API data fetching
- Context API for global state (if needed)

## Performance Optimization

- Code splitting with React.lazy()
- Memoization with React.memo()
- Virtual scrolling for large datasets
- Image optimization and lazy loading

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Deployment

The application can be deployed to any static hosting service:

1. Build the application: `npm run build`
2. Deploy the `build` folder to your hosting service
3. Configure environment variables for production
4. Set up API proxy if needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
