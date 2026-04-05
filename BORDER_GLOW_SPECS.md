# BorderGlow Design Specifications from reactbits.dev

## Key Features
- **Interaction**: Glow follows cursor when hovering near card edges
- **Theme**: Dark theme (#060010 background)
- **Pointer-driven**: Glow appears only when cursor is close to edges

## Default Props
- `edgeSensitivity`: 30 (how close pointer must be to edge for glow, 0-100)
- `glowColor`: "40 80 80" (HSL format: Hue Saturation Lightness)
- `backgroundColor`: "#060010" (very dark purple/black)
- `borderRadius`: 28 (pixels)
- `glowRadius`: 40 (how far glow extends beyond card)
- `glowIntensity`: 1.0 (opacity multiplier, 0.1-3.0)
- `coneSpread`: 25 (directional cone width as %, 5-45)
- `animated`: false (intro sweep animation)
- `colors`: Array of 3 hex colors for mesh gradient border
  - Example: ["#c084fc", "#f472b6", "#38bdf8"] (purple, pink, cyan)

## Color Scheme (from demo)
- Background: #060010
- Glow Color 1: #c084fc (purple)
- Glow Color 2: #f472b6 (pink)
- Glow Color 3: #38bdf8 (cyan)

## Implementation Notes
- Uses pointer event tracking (mousemove)
- Directional cone mask based on cursor position
- Mesh gradient for multi-color glow effect
- Dark theme by default
