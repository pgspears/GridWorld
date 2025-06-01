class PolicyAgent {
    constructor(stateDim, actionDim, learningRate = 0.001, gamma = 0.99) { // Pass these in
        this.stateDim = stateDim;   // Will be gridWidth * gridHeight for one-hot state
        this.actionDim = actionDim; // Will be 4 for Grid World
        this.learningRate = learningRate;
        this.gamma = gamma; 

        this.model = this.createModel();
        this.optimizer = tf.train.adam(this.learningRate);

        this.episodeStates = [];
        this.episodeActions = [];
        this.episodeRewards = [];
    }

    createModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({
            units: 64, // Might need more units for a larger state space like one-hot grid
            activation: 'relu',
            inputShape: [this.stateDim] // Key change based on GridWorld's state
        }));
        // Optional: Add another hidden layer for more complex state spaces
        model.add(tf.layers.dense({ 
            units: 32,
            activation: 'relu'
        }));
        model.add(tf.layers.dense({
            units: this.actionDim, // Key change: 4 actions for GridWorld
            activation: 'softmax'
        }));
        // model.compile({optimizer: this.optimizer, loss: 'categoricalCrossentropy'}); // Not needed if using optimizer.minimize
        return model;
    }

    // chooseAction, record, and train methods remain IDENTICAL to the CartPole version
    // as they are generic to the REINFORCE algorithm structure.

    chooseAction(state) { 
        return tf.tidy(() => {
            const stateTensor = tf.tensor2d([state]); 
            const actionProbsTensor = this.model.predict(stateTensor);
            const actionTensor = tf.multinomial(actionProbsTensor, 1, undefined, true);
            const action = actionTensor.dataSync()[0];
            return { action }; 
        });
    }

    record(state, action, reward) { 
        this.episodeStates.push(state);
        this.episodeActions.push(action);
        this.episodeRewards.push(reward);
    }

    train() {
        if (this.episodeStates.length === 0) {
            return null;
        }

        let discountedRewards = [];
        let currentDiscountedReward = 0;
        for (let t = this.episodeRewards.length - 1; t >= 0; t--) {
            currentDiscountedReward = this.episodeRewards[t] + this.gamma * currentDiscountedReward;
            discountedRewards.unshift(currentDiscountedReward);
        }
        
        const meanReward = tf.mean(discountedRewards).dataSync()[0];
        const stdReward = tf.sqrt(tf.moments(discountedRewards).variance).dataSync()[0];
        const normalizedRewards = discountedRewards.map(r => (r - meanReward) / (stdReward + 1e-8));

        const lossValue = tf.tidy(() => {
            const loss = this.optimizer.minimize(() => {
                const statesTensor = tf.tensor2d(this.episodeStates); 
                const allActionProbsTensor = this.model.predict(statesTensor); 

                const actionsTensor = tf.tensor1d(this.episodeActions, 'int32'); 
                const oneHotActions = tf.oneHot(actionsTensor, this.actionDim);   

                const takenActionProbs = tf.sum(allActionProbsTensor.mul(oneHotActions), 1); 
                
                const logProbs = tf.log(takenActionProbs.add(1e-8)); 
                const G = tf.tensor1d(normalizedRewards); // Use normalized rewards
                
                return tf.sum(logProbs.mul(G)).mul(-1); 
            }, true /* returnCost */); 
            return loss.dataSync()[0];
        });

        this.episodeStates = [];
        this.episodeActions = [];
        this.episodeRewards = [];

        return lossValue;
    }
}