document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const simulationCanvas = document.getElementById('gridworld-canvas');
    const rewardPlotCanvas = document.getElementById('reward-plot-canvas');
    const simCtx = simulationCanvas.getContext('2d');
    const plotCtx = rewardPlotCanvas.getContext('2d');

    // Canvas control elements
    const simHeightSlider = document.getElementById('simHeightSlider');
    const simHeightValue = document.getElementById('simHeightValue');
    const plotHeightSlider = document.getElementById('plotHeightSlider');
    const plotHeightValue = document.getElementById('plotHeightValue');
    const copyPlotButton = document.getElementById('copyPlotButton');

    // Other UI elements (same as before)
    const episodeCounterEl = document.getElementById('episode-counter');
    // ... (all other UI element consts)
    const totalRewardEl = document.getElementById('total-reward');
    const avgRewardEl = document.getElementById('avg-reward');
    const lossValueEl = document.getElementById('loss-value');
    const statusMessageEl = document.getElementById('status-message');
    const totalRewardPEl = document.getElementById('metric-total-reward');
    const avgRewardPEl = document.getElementById('metric-avg-reward');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const runTrainedButton = document.getElementById('runTrainedButton');
    const saveAgentButton = document.getElementById('saveAgentButton');
    const loadAgentButton = document.getElementById('loadAgentButton');
    const fastTrainingCheckbox = document.getElementById('fastTrainingCheckbox');


    // Environment and Agent Setup (same as GridWorld version)
    const GRID_WIDTH = 7; 
    const GRID_HEIGHT = 7;
    let env = new GridWorldEnv(GRID_WIDTH, GRID_HEIGHT); 
    let agent; 

    let isTraining = false;
    let trainingTimeoutId = null;

    const maxEpisodes = 2000; 
    const maxStepsPerEpisode = 100; 
    let currentEpisode = 0;
    let episodeRewardsHistory = [];
    const rewardHistoryForAvg = 100;
    const MODEL_STORAGE_KEY = 'localstorage://gridworld-rl-agent-v2'; // Incremented version

    // --- Event Listeners for Canvas Size Sliders ---
    simHeightSlider.addEventListener('input', (e) => {
        const newHeight = parseInt(e.target.value);
        simulationCanvas.height = newHeight;
        simHeightValue.textContent = newHeight;
        if (env && typeof env.render === 'function') { // Re-render if env exists
            env.render(simCtx);
        }
    });

    plotHeightSlider.addEventListener('input', (e) => {
        const newHeight = parseInt(e.target.value);
        rewardPlotCanvas.height = newHeight;
        plotHeightValue.textContent = newHeight;
        if (episodeRewardsHistory.length > 0 || currentEpisode === 0) { // Re-plot if data exists or at start
            plotRewards();
        }
    });

    // --- Event Listener for Copy Plot Button ---
    copyPlotButton.addEventListener('click', async () => {
        try {
            // Create a temporary canvas to draw with a white background (optional)
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = rewardPlotCanvas.width;
            tempCanvas.height = rewardPlotCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw a white background on the temp canvas
            tempCtx.fillStyle = '#FFFFFF'; // White
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw the current plot onto the temp canvas
            // This assumes plotRewards() draws to the main plotCtx
            // To ensure it's the *current* visual:
            // 1. Temporarily assign plotCtx to tempCtx (might be messy)
            // 2. OR, re-run the drawing logic with tempCtx.
            // For simplicity, let's draw the visible canvas content.
            tempCtx.drawImage(rewardPlotCanvas, 0, 0);

            const dataUrl = tempCanvas.toDataURL('image/png');
            const blob = await (await fetch(dataUrl)).blob(); // Convert data URL to blob for Clipboard API
            
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            statusMessageEl.textContent = 'Reward plot copied to clipboard!';
            setTimeout(() => { statusMessageEl.textContent = "Ready."; }, 2000); // Reset status
        } catch (err) {
            console.error('Failed to copy plot: ', err);
            statusMessageEl.textContent = 'Error copying plot. See console.';
            // Fallback for older browsers or if user denies permission (very basic)
            if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
                const textarea = document.createElement('textarea');
                textarea.value = "Image copy failed, please screenshot. URL (if useful): " + rewardPlotCanvas.toDataURL('image/png').substring(0,100) + "...";
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    statusMessageEl.textContent = 'Plot copy failed (used fallback text copy).';
                } catch (errFallback) {
                    console.error('Fallback copy also failed', errFallback);
                }
                document.body.removeChild(textarea);
            }
        }
    });


    // --- Helper function for metric colors (same as before) ---
    function getRewardColor(reward, maxAchievableReward = 10) { /* ... */ 
        if (reward === null || reward === undefined || isNaN(reward)) return '#ecf0f1';
        let percentage = 50; 
        if (reward > 0) percentage = 50 + (reward / maxAchievableReward) * 50; 
        else if (reward < 0) percentage = 50 - (Math.abs(reward) / 5) * 50; 
        percentage = Math.max(0, Math.min(100, percentage)); 

        if (percentage < 25) return '#e74c3c'; 
        if (percentage < 50) return '#f39c12'; 
        if (percentage < 75) return '#f1c40f'; 
        if (percentage < 90) return '#2ecc71'; 
        return '#1abc9c'; 
    }
    function getTextColorForBackground(hexColor) { /* ... */ 
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 125 ? '#2c3e50' : '#ffffff';
    }
    function updateMetricsDisplay(episode, reward, avgReward, loss) { /* ... */ 
        episodeCounterEl.textContent = episode;
        totalRewardEl.textContent = reward !== null ? reward.toFixed(2) : '-'; 
        avgRewardEl.textContent = avgReward !== null ? avgReward.toFixed(2) : '-';
        lossValueEl.textContent = loss !== null ? loss.toFixed(4) : '-';

        if (totalRewardPEl) {
            const totalRewardColor = getRewardColor(reward);
            totalRewardPEl.style.backgroundColor = totalRewardColor;
            totalRewardPEl.style.color = getTextColorForBackground(totalRewardColor);
        }
        if (avgRewardPEl) {
            const avgRewardColor = getRewardColor(avgReward);
            avgRewardPEl.style.backgroundColor = avgRewardColor;
            avgRewardPEl.style.color = getTextColorForBackground(avgRewardColor);
        }
    }
    
    // --- Plotting (same logic as before, will adapt to new canvas height) ---
    function plotRewards() { /* ... same as the last complete version ... */ 
        const canvasWidth = rewardPlotCanvas.width; // Width is fixed by HTML attribute
        const canvasHeight = rewardPlotCanvas.height; // Height is now dynamic
        plotCtx.clearRect(0, 0, canvasWidth, canvasHeight);

        if (episodeRewardsHistory.length === 0) {
            drawPlotAxesAndLabels(-maxStepsPerEpisode * 0.05 -1, env.goalPos.x !== undefined ? 10 : 0, 0); 
            return;
        }
        const data = episodeRewardsHistory;
        let plotMinY = - (maxStepsPerEpisode * 0.05 + 5); 
        let plotMaxY = 12; 

        drawPlotAxesAndLabels(plotMinY, plotMaxY, data.length);

        const padding = { top: 20, right: 30, bottom: 50, left: 60 };
        const chartWidth = canvasWidth - padding.left - padding.right;
        const chartHeight = canvasHeight - padding.top - padding.bottom;

        if (chartHeight <=0) return; // Avoid drawing if canvas is too small

        plotCtx.beginPath();
        plotCtx.strokeStyle = '#007bff';
        plotCtx.lineWidth = 2;
        for (let i = 0; i < data.length; i++) {
            const x = padding.left + (i / Math.max(1, data.length -1)) * chartWidth;
            const yValue = Math.max(plotMinY, Math.min(data[i], plotMaxY));
            const yRange = Math.max(1, plotMaxY - plotMinY);
            const y = padding.top + chartHeight - ((yValue - plotMinY) / yRange) * chartHeight;
            if (i === 0) plotCtx.moveTo(x, y); else plotCtx.lineTo(x, y);
        }
        plotCtx.stroke();
    }
    function drawPlotAxesAndLabels(minY, maxY, numEpisodesActual) { /* ... same as the last complete version ... */ 
        const canvasWidth = rewardPlotCanvas.width;
        const canvasHeight = rewardPlotCanvas.height; // Will use new dynamic height
        const padding = { top: 20, right: 30, bottom: 50, left: 60 }; 
        const chartWidth = canvasWidth - padding.left - padding.right;
        const chartHeight = canvasHeight - padding.top - padding.bottom;

        if (chartHeight <=0) return; // Don't draw if no space

        plotCtx.fillStyle = '#333'; plotCtx.strokeStyle = '#ccc'; plotCtx.font = '12px Roboto'; plotCtx.lineWidth = 1;
        plotCtx.beginPath(); plotCtx.moveTo(padding.left, padding.top); plotCtx.lineTo(padding.left, padding.top + chartHeight); plotCtx.stroke();
        plotCtx.beginPath(); plotCtx.moveTo(padding.left, padding.top + chartHeight); plotCtx.lineTo(padding.left + chartWidth, padding.top + chartHeight); plotCtx.stroke();

        const numYTicks = Math.max(2, Math.min(5, Math.floor(chartHeight / 40) ) ); // Dynamic Y ticks based on height
        const yRange = Math.max(1, maxY - minY);
        for (let i = 0; i <= numYTicks; i++) {
            const value = minY + (yRange / numYTicks) * i;
            const yPos = padding.top + chartHeight - ((value - minY) / yRange) * chartHeight;
            plotCtx.textAlign = 'right'; plotCtx.textBaseline = 'middle'; 
            plotCtx.fillText(value.toFixed(1), padding.left - 10, yPos);
            plotCtx.beginPath(); plotCtx.moveTo(padding.left - 5, yPos); plotCtx.lineTo(padding.left + chartWidth, yPos); plotCtx.strokeStyle = '#e0e0e0'; plotCtx.stroke(); plotCtx.strokeStyle = '#ccc';
        }

        const numXTicksToShow = Math.min(numEpisodesActual > 0 ? numEpisodesActual : 1, Math.floor(chartWidth / 60)); // Dynamic X ticks
        if (numEpisodesActual > 0 && chartWidth > 50) {
            for (let i = 0; i <= numXTicksToShow; i++) {
                let epLabel; let xPos;
                if (numXTicksToShow <= 1 && numEpisodesActual === 1) { epLabel = 1; xPos = padding.left; } 
                else if (i === numXTicksToShow && numEpisodesActual > 1) { epLabel = numEpisodesActual; xPos = padding.left + chartWidth; } 
                else if (numEpisodesActual === 1) { epLabel = 1; xPos = padding.left; }
                else { epLabel = Math.round((i / numXTicksToShow) * (numEpisodesActual -1)) + 1; xPos = padding.left + ((epLabel -1) / Math.max(1, numEpisodesActual - 1)) * chartWidth; }
                plotCtx.textAlign = 'center'; plotCtx.textBaseline = 'top';
                plotCtx.fillText(epLabel, xPos, padding.top + chartHeight + 10);
            }
        } else if (chartWidth > 50) { 
             plotCtx.textAlign = 'center'; plotCtx.textBaseline = 'top';
             plotCtx.fillText("0", padding.left, padding.top + chartHeight + 10);
        }

        plotCtx.save();
        plotCtx.textAlign = 'center'; plotCtx.fillStyle = '#555'; plotCtx.font = 'bold 14px Roboto';
        if (chartHeight > 30) plotCtx.fillText('Episode Number', padding.left + chartWidth / 2, canvasHeight - padding.bottom + 35);
        if (chartWidth > 30) {
            plotCtx.translate(padding.left - 45, padding.top + chartHeight / 2); 
            plotCtx.rotate(-Math.PI / 2);
            plotCtx.fillText('Total Reward', 0, 0);
        }
        plotCtx.restore();
    }

    // --- runEpisode, trainingLoop, calculateAverageReward, updateButtonStates, ---
    // --- updateButtonStatesForDemo, demonstrateTrainedAgent, saveAgent, loadAgent ---
    // --- Event Listeners and Initial Setup ---
    // (These functions remain largely the same as the previous 'robust' version.)
    // Ensure to copy the full, robust versions of these functions from your previous main.js
    // The key is that plotRewards() and env.render() will now use the dynamically sized canvases.
    
    // Ensure the initial render and plot use the default slider values
    function initializeCanvases() {
        simulationCanvas.height = parseInt(simHeightSlider.value);
        simHeightValue.textContent = simHeightSlider.value;
        rewardPlotCanvas.height = parseInt(plotHeightSlider.value);
        plotHeightValue.textContent = plotHeightSlider.value;
        if (env && typeof env.render === 'function') env.render(simCtx);
        plotRewards();
    }
    
    // ... (ensure all other functions like startButton listener, etc., are present) ...
    async function runEpisode(isDemonstration = false) {
        let state = env.reset();
        let totalReward = 0;
        let done = false;
        let steps = 0; 

        const isFastVisualizationChecked = fastTrainingCheckbox.checked;
        const stepDelay = isDemonstration ? 80 : (isTraining && isFastVisualizationChecked ? 0 : 20); 

        while (!done && steps < maxStepsPerEpisode) {
            if (!agent || !agent.model) {
                console.error("Agent/model not initialized in runEpisode.");
                statusMessageEl.textContent = "Error: Agent not ready. Training stopped.";
                if(isTraining) { isTraining = false; clearTimeout(trainingTimeoutId); updateButtonStates(); }
                return { totalReward: 0, steps: 0 }; 
            }
            const { action } = agent.chooseAction(state);
            const result = env.step(action);
            
            if (!isDemonstration && isTraining) { 
                agent.record(state, action, result.reward);
            }

            state = result.next_state;
            totalReward += result.reward;
            done = result.done;
            steps++;
            
            if (stepDelay > 0) { 
                env.render(simCtx); 
                await new Promise(resolve => setTimeout(resolve, stepDelay));
            } else if (isTraining && isFastVisualizationChecked && (steps % 5 === 0 || done)) { 
                env.render(simCtx);
            } else if (!isDemonstration && !isFastVisualizationChecked && isTraining) { 
                 env.render(simCtx);
            }
        }
        if ((isTraining && isFastVisualizationChecked) || isDemonstration || !isTraining) {
            env.render(simCtx);
        }
        return { totalReward, steps }; 
    }

    async function trainingLoop() {
        if (!isTraining || currentEpisode >= maxEpisodes) { 
            isTraining = false; 
            statusMessageEl.textContent = currentEpisode >= maxEpisodes ? "Training Complete." : "Training Stopped.";
            updateButtonStates();
            return;
        }

        statusMessageEl.textContent = `Training... Ep. ${currentEpisode + 1}/${maxEpisodes}`;
        const { totalReward: reward, steps } = await runEpisode(); 

        if (!isTraining) { 
            console.log("Training loop interrupted."); updateButtonStates(); return;
        }

        episodeRewardsHistory.push(reward);
        
        if (agent && agent.model) { 
            const loss = agent.train();
            updateMetricsDisplay(currentEpisode + 1, reward, calculateAverageReward(), loss);
        } else {
             updateMetricsDisplay(currentEpisode + 1, reward, calculateAverageReward(), null);
        }
        
        plotRewards();
        currentEpisode++;

        const avgReward = calculateAverageReward();
        if (currentEpisode > rewardHistoryForAvg && avgReward > (10 - (maxStepsPerEpisode/2 * 0.05)) ) { 
             statusMessageEl.textContent = `Consistently performing well around Ep. ${currentEpisode}! Avg Reward: ${avgReward.toFixed(2)}`;
        }

        if (isTraining) {
            trainingTimeoutId = setTimeout(trainingLoop, 0); 
        } else { 
            updateButtonStates();
        }
    }
    
    function calculateAverageReward() { 
        const lastRewards = episodeRewardsHistory.slice(-rewardHistoryForAvg);
        return lastRewards.length > 0 ? lastRewards.reduce((sum, r) => sum + r, 0) / lastRewards.length : 0;
    }

    function updateButtonStates() { 
        const agentExistsAndReady = agent && agent.model;
        startButton.disabled = isTraining; stopButton.disabled = !isTraining;
        saveAgentButton.disabled = isTraining || !agentExistsAndReady || episodeRewardsHistory.length === 0;
        loadAgentButton.disabled = isTraining; runTrainedButton.disabled = isTraining || !agentExistsAndReady;
        fastTrainingCheckbox.disabled = false; 
    }

    function updateButtonStatesForDemo(isDemoRunning) { 
        startButton.disabled = isDemoRunning; stopButton.disabled = isDemoRunning; 
        saveAgentButton.disabled = isDemoRunning; loadAgentButton.disabled = isDemoRunning;
        runTrainedButton.disabled = isDemoRunning; fastTrainingCheckbox.disabled = isDemoRunning;
    }

    async function demonstrateTrainedAgent() { 
        if (!agent || !agent.model) { statusMessageEl.textContent = "No agent. Train or load first."; return; }
        if (isTraining) { isTraining = false; clearTimeout(trainingTimeoutId); }
        updateButtonStatesForDemo(true); 
        statusMessageEl.textContent = "Running trained agent (Grid World)...";

        for (let i=0; i<3; i++) {
            updateMetricsDisplay(currentEpisode, null, calculateAverageReward(), null); 
            const { totalReward: demoReward, steps } = await runEpisode(true); 
            const finalStatus = `Demo ${i+1} - Final Reward: ${demoReward.toFixed(2)} in ${steps} steps.`;
            totalRewardEl.textContent = demoReward.toFixed(2); 
            statusMessageEl.textContent = finalStatus; 
            await new Promise(resolve => setTimeout(resolve, 500)); 
        }
        statusMessageEl.textContent = "Demonstration finished.";
        updateButtonStatesForDemo(false); updateButtonStates(); 
    }

    async function saveAgent() { 
        if (!agent || !agent.model) { statusMessageEl.textContent = "No agent to save."; return; }
        try { await agent.model.save(MODEL_STORAGE_KEY); statusMessageEl.textContent = `Agent saved (${MODEL_STORAGE_KEY}).`; }
        catch (error) { statusMessageEl.textContent = "Error saving agent."; console.error("Error saving agent:", error); }
    }

    async function loadAgent() { 
        if (isTraining) { statusMessageEl.textContent = "Cannot load while training."; return; }
        try {
            const loadedModel = await tf.loadLayersModel(MODEL_STORAGE_KEY);
            agent = new PolicyAgent(env.stateDim, env.actionDim, 0.002, 0.99); 
            agent.model = loadedModel; 
            statusMessageEl.textContent = `Agent loaded (${MODEL_STORAGE_KEY}).`;
            currentEpisode = 0; episodeRewardsHistory = []; 
            updateMetricsDisplay(0, null, null, null); plotRewards(); updateButtonStates();
        } catch (error) {
            statusMessageEl.textContent = "Error loading. No saved agent or model mismatch.";
            console.error("Error loading agent:", error); agent = null; updateButtonStates(); 
        }
    }
    
    startButton.addEventListener('click', () => {
        if (isTraining) return;
        isTraining = true;
        if (!agent || !agent.model) { 
            agent = new PolicyAgent(env.stateDim, env.actionDim, 0.002, 0.99); 
            console.log("New GridWorld agent created.");
        } else {
            if(agent.stateDim !== env.stateDim || agent.actionDim !== env.actionDim) {
                console.warn("Agent dimensions mismatch environment. Recreating agent.");
                agent = new PolicyAgent(env.stateDim, env.actionDim, 0.002, 0.99);
            } else {
                console.log("Continuing training with existing GridWorld agent.");
            }
        }
        currentEpisode = 0; 
        episodeRewardsHistory = [];
        statusMessageEl.textContent = "Starting GridWorld training...";
        updateMetricsDisplay(0, null, null, null); 
        plotRewards(); updateButtonStates(); 
        clearTimeout(trainingTimeoutId); trainingLoop();
    });

    stopButton.addEventListener('click', () => { 
        isTraining = false; clearTimeout(trainingTimeoutId);
        statusMessageEl.textContent = "Training stopped by user."; updateButtonStates();
    });
    runTrainedButton.addEventListener('click', demonstrateTrainedAgent);
    saveAgentButton.addEventListener('click', saveAgent);
    loadAgentButton.addEventListener('click', loadAgent);

    // --- Initial Setup ---
    initializeCanvases(); // Call to set initial canvas sizes from sliders
    statusMessageEl.textContent = "Ready for Grid World. Train or load agent.";
    updateMetricsDisplay(null, null, null, null); 
    updateButtonStates(); 
});