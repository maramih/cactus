//import { randomUUID } from "crypto";
//import { BesuV2TxReceipt } from "./transaction-receipt";
//import { v4 as uuidv4 } from "uuid";

export type CrossChainEvent = {
  caseID: string;
  timestamp: Date;
  blockchainID: string;
  invocationType: string;
  methodName: string;
  parameters: string[];
};

export interface ICrossChainEventLog {
  name: string;
}

export class CrossChainEventLog {
  private eventLogList: CrossChainEvent[] = [];
  private creationDate: Date;
  private lastUpdateDate: Date;
  public readonly logName: string;
  //TODO: add a pause boolean?

  constructor(options: ICrossChainEventLog) {
    this.creationDate = new Date();
    this.lastUpdateDate = new Date();
    this.logName = options.name;
  }

  public getCreationDate(): Date {
    return this.creationDate;
  }

  public getLastUpdateDate(): Date {
    return this.lastUpdateDate;
  }

  //todo add crosschain event
  // purge logs - so memory exceptions wont happen, should be persisted first
  // persist on IPFS/mysql

  public addCrossChainEvent(event: CrossChainEvent): void {
    this.eventLogList.push(event);
    this.lastUpdateDate = new Date();
  }
}
