import promClient, { Registry } from "prom-client";
import { Transactions } from "./response.type";
import { collectMetrics } from "./data-fetcher";
import { totalTxCount } from "./metrics";

export interface IPrometheusExporterOptions {
  pollingIntervalInMin?: number;
}

export class PrometheusExporter {
  public readonly metricsPollingIntervalInMin: number;
  public readonly transactions: Transactions = { counter: 0 };
  public readonly registry: Registry;

  constructor(
    public readonly prometheusExporterOptions: IPrometheusExporterOptions,
  ) {
    this.metricsPollingIntervalInMin =
      prometheusExporterOptions.pollingIntervalInMin || 1;
    this.registry = new Registry();
  }

  public addCurrentTransaction(): void {
    collectMetrics(this.transactions);
  }

  public async getPrometheusMetrics(): Promise<promClient.metric[]> {
    //TODO for generic
    const result = await this.registry.getMetricsAsJSON();
    return result;
  }

  public startMetricsCollection(): void {
    this.registry.registerMetric(totalTxCount);
    promClient.collectDefaultMetrics({ register: this.registry });
  }
}
