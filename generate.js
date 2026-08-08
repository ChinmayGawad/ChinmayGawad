const fs = require('fs');

const COLS = 52;
const ROWS = 7;
const CELL_SIZE = 12;
const GAP = 4;
const COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

// This creates a random "sweep" line to simulate the wash effect
const sweepX = Math.floor(Math.random() * COLS);

let svgContent = `<svg width="${COLS * (CELL_SIZE + GAP)}" height="${ROWS * (CELL_SIZE + GAP)}" xmlns="http://www.w3.org/2000/svg">`;

for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
        // Simulate the "wash" logic: 
        // If col is left of sweepX, it's "erased" (Color index 0)
        const isErased = c < sweepX;
        const level = isErased ? 0 : Math.floor(Math.random() * 5);
        const color = COLORS[level];

        const x = c * (CELL_SIZE + GAP);
        const y = r * (CELL_SIZE + GAP);

        svgContent += `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${color}" />`;
    }
}

svgContent += `</svg>`;
fs.writeFileSync('contribution_wash.svg', svgContent);
console.log("SVG Generated!");