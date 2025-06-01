# 🧠 Grid World Reinforcement Learning (REINFORCE + TensorFlow.js)

This interactive browser-based simulation trains an AI agent to navigate a grid world using the **REINFORCE policy gradient algorithm** implemented with **TensorFlow.js**.

---

## 🚀 Features

- **Fully interactive UI** – adjust canvas size, control training, and view rewards live.
- **Agent visualization** – watch the agent learn over time as it navigates to a goal.
- **REINFORCE algorithm** – classic policy-gradient method with stochastic action selection.
- **One-hot encoded states** – agent's position represented as input to a small neural network.
- **Canvas-based reward plotting** – track agent progress over episodes.
- **Save/load agent** – use `localStorage` to persist training state across browser sessions.

---

## 🗂 File Overview

| File            | Description |
|-----------------|-------------|
| `index.html`    | Main HTML structure, includes UI and embedded controls. |
| `style.css`     | Styling for the interface, layout, and responsive design. |
| `main.js`       | Manages UI interaction, training loop, reward plotting, and control logic. |
| `agent.js`      | Implements the REINFORCE agent using TensorFlow.js. |
| `gridworld.js`  | Defines the environment (grid world) and rendering logic. |

---

## 🧠 How It Works

- The **environment** is a 2D grid with a start cell, goal cell, and random walls.
- The **agent** receives a one-hot encoded vector representing its current position.
- Each **episode** consists of moving through the grid with the goal of reaching the target.
- Rewards:
  - **+10** for reaching the goal  
  - **-0.75** for hitting a wall or boundary  
  - **-0.05** per step to encourage efficiency
- After each episode, the **policy network is updated** to reinforce actions that led to high total reward.

---

## 📦 Dependencies

- [TensorFlow.js](https://www.tensorflow.org/js): Machine learning in the browser
- HTML5 Canvas API
- No build tools required — works entirely in the browser!

---

## 🧑‍💻 Developed by

**Patrick Spears**  
© 2025 | Built with ❤️ using JavaScript and TensorFlow.js  
Project includes detailed educational explanations embedded in the UI.

---

## 📘 Learn More

- Sutton & Barto's *Reinforcement Learning: An Introduction*
- [David Silver’s RL Course (UCL)](https://www.davidsilver.uk/teaching/)
- [Spinning Up in Deep RL by OpenAI](https://spinningup.openai.com/)

---
