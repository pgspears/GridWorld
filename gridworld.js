class GridWorldEnv {
    constructor(width = 5, height = 5) {
        this.width = width;
        this.height = height;
        this.actionDim = 4; // 0: up, 1: down, 2: left, 3: right

        // State representation: one-hot encoding of agent's position
        // Example: for a 5x5 grid, stateDim is 25.
        this.stateDim = this.width * this.height;

        this.agentPos = { x: 0, y: 0 };
        this.startPos = { x: 0, y: 0 };
        this.goalPos = { x: this.width - 1, y: this.height - 1 };
        
        // Define walls: array of {x, y} objects
        // Example: this.walls = [{x: 1, y: 1}, {x: 1, y: 2}, {x: 3, y: 3}];
        this.walls = this.generateRandomWalls(Math.floor(this.width * this.height * 0.1)); // ~10% walls

        this.reset();
    }

    generateRandomWalls(numWalls) {
        const walls = [];
        for (let i = 0; i < numWalls; i++) {
            let wallX, wallY;
            do {
                wallX = Math.floor(Math.random() * this.width);
                wallY = Math.floor(Math.random() * this.height);
            } while (
                (wallX === this.startPos.x && wallY === this.startPos.y) ||
                (wallX === this.goalPos.x && wallY === this.goalPos.y) ||
                walls.some(w => w.x === wallX && w.y === wallY)
            );
            walls.push({ x: wallX, y: wallY });
        }
        return walls;
    }

    isWall(x, y) {
        return this.walls.some(wall => wall.x === x && wall.y === y);
    }

    reset() {
        this.agentPos = { ...this.startPos };
        this.currentStep = 0;
        return this.getState();
    }

    getState() {
        // One-hot encode the agent's position
        const state = new Array(this.stateDim).fill(0);
        const agentIndex = this.agentPos.y * this.width + this.agentPos.x;
        if (agentIndex >= 0 && agentIndex < this.stateDim) {
            state[agentIndex] = 1;
        }
        return state;
    }

    step(action) {
        let newX = this.agentPos.x;
        let newY = this.agentPos.y;

        if (action === 0) newY -= 1; // Up
        else if (action === 1) newY += 1; // Down
        else if (action === 2) newX -= 1; // Left
        else if (action === 3) newX += 1; // Right

        let reward = -0.05; // Small penalty for each step to encourage efficiency
        let done = false;

        // Check boundaries and walls
        if (newX < 0 || newX >= this.width || newY < 0 || newY >= this.height || this.isWall(newX, newY)) {
            reward = -0.75; // Penalty for hitting a wall or boundary
            // Agent stays in the current position if move is invalid
        } else {
            this.agentPos.x = newX;
            this.agentPos.y = newY;
        }

        // Check if goal reached
        if (this.agentPos.x === this.goalPos.x && this.agentPos.y === this.goalPos.y) {
            reward = 10; // Large reward for reaching the goal
            done = true;
        }

        this.currentStep++;
        // maxStepsPerEpisode will be handled in main.js
        // if (this.currentStep >= maxStepsPerEpisode) { 
        //     done = true;
        // }

        return {
            next_state: this.getState(),
            reward: reward,
            done: done
        };
    }

    render(ctx) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        const cellSizeWidth = canvasWidth / this.width;
        const cellSizeHeight = canvasHeight / this.height;
        const cellSize = Math.min(cellSizeWidth, cellSizeHeight); // Use the smaller to fit

        const offsetX = (canvasWidth - this.width * cellSize) / 2; // Center grid
        const offsetY = (canvasHeight - this.height * cellSize) / 2;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.strokeStyle = '#ccc'; // Grid lines

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cellX = offsetX + x * cellSize;
                const cellY = offsetY + y * cellSize;

                // Cell background
                ctx.fillStyle = '#fff'; // Default empty
                if (this.isWall(x,y)) {
                    ctx.fillStyle = '#555'; // Wall
                } else if (x === this.goalPos.x && y === this.goalPos.y) {
                    ctx.fillStyle = 'green'; // Goal
                } else if (x === this.startPos.x && y === this.startPos.y) {
                    ctx.fillStyle = '#add8e6'; // Light blue for start
                }
                ctx.fillRect(cellX, cellY, cellSize, cellSize);
                ctx.strokeRect(cellX, cellY, cellSize, cellSize); // Draw grid lines
            }
        }

        // Draw agent
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(
            offsetX + this.agentPos.x * cellSize + cellSize / 2,
            offsetY + this.agentPos.y * cellSize + cellSize / 2,
            cellSize * 0.3, // Agent radius
            0, 2 * Math.PI
        );
        ctx.fill();
    }
}