import { Server } from "http";
import { Server as SecureServer } from "https";
import { Optional } from "typescript-optional";
import { promisify } from "util";
import express, { Express } from "express";
import bodyParser from "body-parser";

import {
  IPluginWebService,
  IWebServiceEndpoint,
  ICactusPlugin,
  ICactusPluginOptions,
} from "@hyperledger/cactus-core-api";

import { PluginRegistry } from "@hyperledger/cactus-core";

import {
  Checks,
  Logger,
  LoggerProvider,
  LogLevelDesc,
} from "@hyperledger/cactus-common";

import { PrometheusExporter } from "./prometheus-exporter/prometheus-exporter";

export interface IWebAppOptions {
  port: number;
  hostname: string;
}

export interface IPluginCcTxVisualizationOptions extends ICactusPluginOptions {
  prometheusExporter?: PrometheusExporter;
  connectorRegistry: PluginRegistry;
  logLevel?: LogLevelDesc;
  webAppOptions?: IWebAppOptions;
}

export class PluginCcTxVisualization
  implements ICactusPlugin, IPluginWebService {
  public prometheusExporter: PrometheusExporter;
  private readonly log: Logger;
  private readonly instanceId: string;
  private endpoints: IWebServiceEndpoint[] | undefined;
  private httpServer: Server | SecureServer | null = null;
  private connectorRegistry: PluginRegistry;

  constructor(public readonly options: IPluginCcTxVisualizationOptions) {
    const fnTag = `PluginCcTxVisualization#constructor()`;
    if (!options) {
      throw new Error(`${fnTag} options falsy.`);
    }
    Checks.truthy(options.instanceId, `${fnTag} options.instanceId`);
    this.log = LoggerProvider.getOrCreate({
      label: "plugin-cc-tx-visualization",
    });
    this.instanceId = this.options.instanceId;
    this.prometheusExporter =
      options.prometheusExporter ||
      new PrometheusExporter({ pollingIntervalInMin: 1 });
    Checks.truthy(
      this.prometheusExporter,
      `${fnTag} options.prometheusExporter`,
    );
    Checks.truthy(
      options.connectorRegistry,
      `${fnTag} options.connectorRegistry`,
    );
    this.connectorRegistry = options.connectorRegistry;
    // this.prometheusExporter.setNodeCount(this.getNodeCount());
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  public async onPluginInit(): Promise<unknown> {
    return;
  }

  public getPrometheusExporter(): PrometheusExporter {
    return this.prometheusExporter;
  }

  public async getPrometheusExporterMetrics(): Promise<string> {
    const res: string = await this.prometheusExporter.getPrometheusMetrics();
    this.log.debug(`getPrometheusExporterMetrics() response: %o`, res);
    return res;
  }

  // public getNodeCount(): number {
  //   const consortiumDatabase: ConsortiumDatabase = this.options
  //     .consortiumDatabase;
  //   const consortiumRepo: ConsortiumRepository = new ConsortiumRepository({
  //     db: consortiumDatabase,
  //   });
  //   return consortiumRepo.allNodes.length;
  // }

  /**
   * Updates the Node count Prometheus metric of the plugin.
   * Note: This does not change the underlying consortium database at all,
   * only affects **the metrics**.
   */
  // public updateMetricNodeCount(): void {
  //   const consortiumDatabase: ConsortiumDatabase = this.options
  //     .consortiumDatabase;
  //   const consortiumRepo: ConsortiumRepository = new ConsortiumRepository({
  //     db: consortiumDatabase,
  //   });
  //   this.prometheusExporter.setNodeCount(consortiumRepo.allNodes.length);
  // }

  public async shutdown(): Promise<void> {
    this.log.info(`Shutting down...`);
    const serverMaybe = this.getHttpServer();
    if (serverMaybe.isPresent()) {
      this.log.info(`Awaiting server.close() ...`);
      const server = serverMaybe.get();
      await promisify(server.close.bind(server))();
      this.log.info(`server.close() OK`);
    } else {
      this.log.info(`No HTTP server found, skipping...`);
    }
  }

  public async registerWebServices(
    app: Express,
  ): Promise<IWebServiceEndpoint[]> {
    const webApp: Express = this.options.webAppOptions ? express() : app;

    if (this.options.webAppOptions) {
      this.log.info(`Creating dedicated HTTP server...`);
      const { port, hostname } = this.options.webAppOptions;

      webApp.use(bodyParser.json({ limit: "50mb" }));

      const address = await new Promise((resolve, reject) => {
        const httpServer = webApp.listen(port, hostname, (err?: any) => {
          if (err) {
            reject(err);
            this.log.error(`Failed to create dedicated HTTP server`, err);
          } else {
            this.httpServer = httpServer;
            const theAddress = this.httpServer.address();
            resolve(theAddress);
          }
        });
      });
      this.log.info(`Creation of HTTP server OK`, { address });
    }

    const webServices = await this.getOrCreateWebServices();
    webServices.forEach((ws) => ws.registerExpress(webApp));
    return webServices;
  }

  public async getOrCreateWebServices(): Promise<IWebServiceEndpoint[]> {
    const { log } = this;
    const pkgName = this.getPackageName();

    if (this.endpoints) {
      return this.endpoints;
    }
    // log.info(`Creating web services for plugin ${pkgName}...`);
    // // presence of webAppOptions implies that caller wants the plugin to configure it's own express instance on a custom
    // // host/port to listen on

    // const { consortiumDatabase, keyPairPem } = this.options;
    // const consortiumRepo = new ConsortiumRepository({
    //   db: consortiumDatabase,
    // });

    const endpoints: IWebServiceEndpoint[] = [];
    // {
    //   const options = { keyPairPem, consortiumRepo, plugin: this };
    //   const endpoint = new GetConsortiumEndpointV1(options);
    //   endpoints.push(endpoint);
    //   const path = endpoint.getPath();
    //   this.log.info(`Instantiated GetConsortiumEndpointV1 at ${path}`);
    // }
    // {
    //   const options = { keyPairPem, consortiumRepo, plugin: this };
    //   const endpoint = new GetNodeJwsEndpoint(options);
    //   const path = endpoint.getPath();
    //   endpoints.push(endpoint);
    //   this.log.info(`Instantiated GetNodeJwsEndpoint at ${path}`);
    // }
    // {
    //   const opts: IGetPrometheusExporterMetricsEndpointV1Options = {
    //     plugin: this,
    //     logLevel: this.options.logLevel,
    //   };
    //   const endpoint = new GetPrometheusExporterMetricsEndpointV1(opts);
    //   const path = endpoint.getPath();
    //   endpoints.push(endpoint);
    //   this.log.info(`Instantiated GetNodeJwsEndpoint at ${path}`);
    // }
    this.endpoints = endpoints;

    log.info(`Instantiated web svcs for plugin ${pkgName} OK`, { endpoints });
    return this.endpoints;
  }

  public getHttpServer(): Optional<Server | SecureServer> {
    return Optional.ofNullable(this.httpServer);
  }

  public getPackageName(): string {
    return `@hyperledger/cactus-plugin-cc-tx-visualization`;
  }
}
