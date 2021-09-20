type CrossChainEvent = {
  caseID: string;
  timestamp: Date;
  blockchainID: string;
  activity: string;
  parameters: string[];
};

interface ICrossChainEventLog {
  name: string;
}

export class CrossChainEventLog {
  private eventLogList: CrossChainEvent[] = [];
  private creationDate: Date;
  private lastUpdateDate: Date;
  public readonly logName: string;

  constructor(options: ICrossChainEventLog) {
    this.creationDate = new Date();
    this.lastUpdateDate = new Date();
    this.logName = options.name;
  }

  // todo getter creation date, last update data
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
