import { Gauge } from "prom-client";

export const K_CACTUS_FABRIC_TOTAL_TX_COUNT = "cactus_fabric_total_tx_count";

export const K_CACTUS_FABRIC_TX_LATENCY = "cactus_fabric_tx_latency";

export const totalTxCount = new Gauge({
  name: K_CACTUS_FABRIC_TOTAL_TX_COUNT,
  help: "Total transactions executed",
  labelNames: ["type"],
});

export const txLatency = new Gauge({
  name: K_CACTUS_FABRIC_TX_LATENCY,
  help: "Transaction latency",
  labelNames: ["type"],
});
