/* eslint-disable prettier/prettier */
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
  Configuration,
} from "@hyperledger/cactus-core-api";
import { BesuApiClient} from "@hyperledger/cactus-plugin-ledger-connector-besu/src/main/typescript/public-api";

import { PluginRegistry } from "@hyperledger/cactus-core";

import {
  Checks,
  Logger,
  LoggerProvider,
  LogLevelDesc,
} from "@hyperledger/cactus-common";

import { PrometheusExporter } from "./prometheus-exporter/prometheus-exporter";
import { DefaultApi as FabricApiClient} from "@hyperledger/cactus-plugin-ledger-connector-fabric/dist/lib/main/typescript/public-api";
import { MetricModel } from "@hyperledger/cactus-plugin-cc-tx-visualization/src/main/typescript/models/metric-model";
export interface IWebAppOptions {
  port: number;
  hostname: string;
}

export enum LedgerType {
  FABRIC,
  BESU,
}

export type APIConfig = {
  type:LedgerType, 
  basePath: string
}

export interface IPluginCcTxVisualizationOptions extends ICactusPluginOptions {
  prometheusExporter?: PrometheusExporter;
  connectorRegistry: PluginRegistry;
  logLevel?: LogLevelDesc;
  webAppOptions?: IWebAppOptions;
  configApiClients?: APIConfig[];
}

export class PluginCcTxVisualization
  implements ICactusPlugin, IPluginWebService {
  public prometheusExporter: PrometheusExporter;
  private readonly log: Logger;
  private readonly instanceId: string;
  private endpoints: IWebServiceEndpoint[] | undefined;
  private httpServer: Server | SecureServer | null = null;
  private connectorRegistry: PluginRegistry;
  private apiClients: any[] = [] ;
  private configApiClients: APIConfig[];
  private res: string[] = [];

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
    this.connectorRegistry =
      this.options.connectorRegistry || new PluginRegistry();
    
    this.configApiClients = this.options.configApiClients|| [];
    Checks.truthy(this.configApiClients, `${fnTag} this.configApiClients`);

    if(this.configApiClients.length>0)
    {
      this.configApiClients.forEach((config)=>{
        switch(config.type){
          case LedgerType.FABRIC:
            this.apiClients.push(new FabricApiClient(new Configuration({basePath:config.basePath})) );
            break;
          case LedgerType.BESU:
            this.apiClients.push(new BesuApiClient(new Configuration({basePath:config.basePath})) );
            break;
          default:
            break;
        }
      });
    }

     Checks.truthy(this.apiClients, `${fnTag} this.apiClients`);
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
    
    const endpoints: IWebServiceEndpoint[] = [];
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

  public async getAllPrometheusMetrics():Promise<MetricModel[]>{
    const results: MetricModel[]=[];
    for (let index =0; index<this.apiClients.length;index++){
      const res = await this.apiClients[index].getPrometheusMetricsV1();
      results.push(...res.data);
    }

    return results;
  }
}
