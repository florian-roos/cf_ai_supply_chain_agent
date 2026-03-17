# cf_ai_supply_chain: AI-Powered Supply Chain Simulator

**Live Demo:** [https://cf-ai-supply-chain.florian-roos19.workers.dev/](https://cf-ai-supply-chain.florian-roos19.workers.dev/)

## Overview

This project is a real-time, AI-orchestrated supply chain simulator built entirely on Cloudflare's edge infrastructure using the Agents SDK. This agent actively interacts with a simulated global network of warehouses. You can ask it about the current state of the supply chain, simulate natural disasters to knock warehouses disrupted, and route stock around the world.

The project uses LLMs for intent parsing, deterministic algorithms for pathfinding, and Durable Objects for state management.

## Architecture

The architecture is splited into four core pieces:

### 1. State Management (Durable Objects & SQLite)

The entire supply chain state lives in a single Cloudflare Durable Object. I used its embedded SQLite database to keep track of a static graph of 7 global hubs (like New York, London, Singapore, etc.). Each node tracks its current inventory and its operational status (whether it's `operational` or `disrupted`). Using a Durable Object ensures that stock updates are strictly consistent.

### 2. AI & Human-in-the-Loop (Workers AI)

The agent uses a LLM as the brain of the operation. It turns unstructured chat into schema-validated JSON tool calls. The system enforces a "Human-in-the-Loop" behavior for critical operations on the supply chain.
For example when asking the AI to mark a warehouse as disrupted or to transfer stock, the AI prepares the plan but pause execution and ask the user to click "Approve" before any database changes actually happen.

### 3. Pathfinding Algorithm (Dijkstra)

When you ask to transfer stock, the AI first calls a `planTransferRoute` tool. This runs a deterministic Dijkstra shortest-path algorithm across our network graph, avoiding any node that is currently marked as `disrupted`. It then returns the optimal path and exact transit time back to the AI to present to you.

### 4. Transit Simulation (Cloudflare Scheduled Tasks)

Once you approve a stock transfer, the Durable Object acts on it in two steps to simulate real-world transit:

1. It immediately deducts the inventory from the source warehouse.
2. It dynamically registers a Cloudflare Scheduled Task with a delay equal to the calculated transit schedule.
   Once the delay is up, the alarm wakes the Durable Object, which then deposits the inventory at the destination and broadcasts a WebSocket event to update the React client in real time.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm
- Wrangler CLI (logged into your Cloudflare account)

### Running Locally

To test this out on your local machine, run the following commands:

```bash
npm install
npm run dev
```

### Try it out

Once you are on the deployed link (or localhost), try some of these prompts:

- **Check state:** "What is the status of the Singapore warehouse?"
- **Simulate a disaster:** "Simulate a natural disaster in Paris."
- **Transfer stock:** "Route 15 units of stock from New York to Sydney."

## Project Structure

```text
src/
  agent/
    tools/                 # Zod schemas and tool business logic (transferStock, planTransferRoute, etc.)
    SupplyChain.ts         # The Durable Object class, SQLite setup, and WebSocket logic
  algorithms/
    calculateOptimalRoute.ts # The Dijkstra pathfinding algorithm
  config/
    topology.ts            # The adjacency matrix (shipping times) for our global hubs
  types/
    graph.ts               # TypeScript interfaces
  app.tsx                  # React frontend: Chat UI, approval blocks, and WebSocket listeners
  server.ts                # Cloudflare Worker entry point
```

_(Note: The AI prompts utilized during the creation of this project are documented in `PROMPTS.md` as requested in the assignment instructions)._
