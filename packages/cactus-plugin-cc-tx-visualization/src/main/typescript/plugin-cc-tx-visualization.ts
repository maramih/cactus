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
  LedgerType,
} from "@hyperledger/cactus-core-api";

import { PluginRegistry } from "@hyperledger/cactus-core";

import {
  Checks,
  Logger,
  LoggerProvider,
  LogLevelDesc,
} from "@hyperledger/cactus-common";

import { PrometheusExporter } from "./prometheus-exporter/prometheus-exporter";
import { MetricModel } from "@hyperledger/cactus-plugin-cc-tx-visualization/src/main/typescript/models/metric-model";
import { CrossChainEvent, CrossChainEventLog } from "./models/cross-chain-event";

export interface IWebAppOptions {
  port: number;
  hostname: string;
}
import * as Amqp from "amqp-ts";
import { CrossChainModel } from "@hyperledger/cactus-plugin-cc-tx-visualization/src/main/typescript/models/crosschain-model";


export type APIConfig = {
  type:LedgerType, 
  basePath: string
}

export interface IChannelOptions {
  queueId: string,
  dltTechnology: LedgerType | null,
  persistMessages: boolean
}

export interface IPluginCcTxVisualizationOptions extends ICactusPluginOptions {
  prometheusExporter?: PrometheusExporter;
  connectorRegistry?: PluginRegistry;
  logLevel?: LogLevelDesc;
  webAppOptions?: IWebAppOptions;
  configApiClients?: APIConfig[];
  eventProvider: string;
  channelOptions: IChannelOptions;
  instanceId: string;
}

// TODO - for extensability, modularity, and flexibility,
// this plugin could have a list of connections and list of queues

export class CcTxVisualization
  implements ICactusPlugin, IPluginWebService {
  [x: string]: any;
  public prometheusExporter: PrometheusExporter;
  private readonly log: Logger;
  private readonly instanceId: string;
  private endpoints: IWebServiceEndpoint[] | undefined;
  private httpServer: Server | SecureServer | null = null;
  private apiClients: any[] = [] ;
  // TODO in the future logs (or a serialization of logs) could be given as an option
  private crossChainLogs: CrossChainEventLog[] = [];
    private readonly eventProvider: string;
    private amqpConnection: Amqp.Connection;
    private amqpQueue: Amqp.Queue;
    private amqpExchange: Amqp.Exchange;
    public readonly className = "plugin-cc-tx-visualization";
    private readonly queueId: string;
    private txReceipts: any[];
    private readonly persistMessages: boolean;
  constructor(public readonly options: IPluginCcTxVisualizationOptions) {
    const fnTag = `PluginCcTxVisualization#constructor()`;
    if (!options) {
      throw new Error(`${fnTag} options falsy.`);
    }
    //TODO check other mandatory options
    Checks.truthy(options.instanceId, `${fnTag} options.instanceId`);
    const level = this.options.logLevel || "INFO";
    const label = this.className;
    this.queueId = options.channelOptions.queueId || "cc-tx-viz-queue";
    this.log = LoggerProvider.getOrCreate({
      label:  label,
      level: level,
    });
    this.prometheusExporter =
      options.prometheusExporter ||
    new PrometheusExporter({ pollingIntervalInMin: 1 });
    this.instanceId = this.options.instanceId;
    this.txReceipts = [];
    this.persistMessages = options.channelOptions.persistMessages || false;
    this.eventProvider = options.eventProvider;
    this.log.debug("Initializing connection to RabbitMQ");
    this.amqpConnection = new Amqp.Connection(this.eventProvider);
    this.log.info("Connection to RabbitMQ server initialized");
    this.amqpExchange = this.amqpConnection.declareExchange(`cc-tx-viz-exchange`, "direct", {durable: this.persistMessages});
    this.amqpQueue = this.amqpConnection.declareQueue(this.queueId, {durable: this.persistMessages});
    this.amqpQueue.bind(this.amqpExchange);
  
  } 
  getOpenApiSpec(): unknown {
    throw new Error("Method not implemented.");
  }



  get messages(): any[] {
    return this.txReceipts;
  }

  public closeConnection(): Promise<void>  {
    this.log.info("Closing Amqp connection");
    return this.amqpConnection.close();
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


  // Receives raw transaction receipts from RabbitMQ
  public pollTxReceipts(): Promise<void>  {
    const fnTag = `${this.className}#pollTxReceipts()`;
    this.log.debug(fnTag);
    return this.amqpQueue.activateConsumer( (message) => {
      const messageContent = message.getContent();
      this.log.debug(`Received message from ${this.queueId}: ${messageContent}`);
      this.txReceipts.push(messageContent);
      message.ack();
    }, { noAck: false });
  }

  // convert data into CrossChainEven
  // returns a list of CrossChainEvent
  public async txReceiptToCrossChainEventLogEntry(): Promise<CrossChainEvent|void> {
    const fnTag = `${this.className}#pollTxReceipts()`;
    this.log.debug(fnTag);
    try {
      
      this.txReceipts.forEach(receipt => {
        switch(receipt) {
          // TODO case receipt.type === Fabric2X
          // type should be a ledger type as defined in cactus core
          default:
            this.log.info("Tx Receipt is not supported");
        }
        
      });
      // Clear receipt array
      this.txReceipts = [];
    return;
    } catch (error) {
      this.log.error(error);
    }

  }

  // takes CrossChainEvent list and feeds a crosschain event log
  public async updateCrossChainLog(): Promise<CrossChainEventLog|void>  {
    return;
  }

  // Calculates e2e latency, e2e throughput, e2e cost
  public async processCrossChainEventLog(): Promise<void> {
    return;
    //Pause the connection for all the channels
    //creates log
    //clears arrays
    //resumes connections
  }

  public async createCrossChainModel(): Promise<CrossChainModel|void>  {
    return;
  }
  
  // TODO endpoint calling this function
  public async getCrossChainModel(): Promise<CrossChainModel|void> {
    return;
  }

  // TODO endpoints for e2e latency, e2e throughput, e2e cost


  public async getE2ELatencyAverage(): Promise<number|void> {
    return;
  }
}
