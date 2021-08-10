import promClient, { Registry } from "prom-client";
import { Transactions } from "./response.type";
import {
  totalTxCount,
  K_CACTUS_FABRIC_TOTAL_TX_COUNT,
  K_CACTUS_FABRIC_TX_LATENCY,
  txLatency,
} from "./metrics";

export interface IPrometheusExporterOptions {
  pollingIntervalInMin?: number;
}

export class PrometheusExporter {
  public readonly metricsPollingIntervalInMin: number;
  public readonly transactions: Transactions = {
    counter: 0,
    totalTime: 0,
    avgTime: 0,
  };
  public readonly registry: Registry;

  constructor(
    public readonly prometheusExporterOptions: IPrometheusExporterOptions,
  ) {
    this.metricsPollingIntervalInMin =
      prometheusExporterOptions.pollingIntervalInMin || 1;
    this.registry = new Registry();
  }

  public addCurrentTransaction(): void {
    this.transactions.counter++;
    totalTxCount
      .labels(K_CACTUS_FABRIC_TOTAL_TX_COUNT)
      .set(this.transactions.counter);
  }

  public addTimerOfCurrentTransaction(txTimer: number): void {
    this.addCurrentTransaction();
    this.transactions.totalTime = +txTimer;
    this.transactions.avgTime =
      this.transactions.totalTime / this.transactions.counter;
    txLatency.labels(K_CACTUS_FABRIC_TX_LATENCY).set(this.transactions.avgTime);
  }

  public async getPrometheusMetrics(): Promise<string> {
    const result = await this.registry.getSingleMetricAsString(
      K_CACTUS_FABRIC_TOTAL_TX_COUNT,
    );
    return result;
  }

  public startMetricsCollection(): void {
    this.registry.registerMetric(totalTxCount);
    promClient.collectDefaultMetrics({ register: this.registry });
  }
}
