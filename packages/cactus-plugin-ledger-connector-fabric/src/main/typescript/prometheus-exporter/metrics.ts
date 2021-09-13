import { Gauge } from "prom-client";

export const K_CACTUS_FABRIC_TOTAL_TX_COUNT = "cactus_fabric_total_tx_count";

export const K_CACTUS_FABRIC_TX_LATENCY = "cactus_fabric_tx_latency";

export const K_CACTUS_FABRIC_TX_THROUGHPUT = "cactus_fabric_tx_throughput";

export const K_CACTUS_FABRIC_UPTIME = "cactus_fabric_uptime";

export const totalTxCount = new Gauge({
  registers: [],
  name: K_CACTUS_FABRIC_TOTAL_TX_COUNT,
  help: "Total transactions executed",
  labelNames: ["type"],
});

export const txLatency = new Gauge({
  registers: [],
  name: K_CACTUS_FABRIC_TX_LATENCY,
  help: "Transaction latency",
  labelNames: ["type"],
});

export const txThroughput = new Gauge({
  registers: [],
  name: K_CACTUS_FABRIC_TX_THROUGHPUT,
  help: "Transactions throughput",
  labelNames: ["type"],
});

export const upTime = new Gauge({
  registers: [],
  name: K_CACTUS_FABRIC_UPTIME,
  help: "Up time",
  labelNames: ["type"],
});
