interface IMetricModel {
  name: string;
  values: StrangeValue[];
}

type StrangeValue = {
  value: number;
};

export class MetricModel {
  name = "";
  value: number;

  constructor(input: IMetricModel) {
    this.name = input.name;
    if (input.values.length === 0) {
      this.value = 0;
    } else {
      this.value = input.values[0].value;
    }
  }
}

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
  private eventLogList: CrossChainEvent[];
  private creationDate: Date;
  private lastUpdateDate: Date;
  private logName: string;

  constructor(options: ICrossChainEventLog) {
    this.creationDate = new Date();
    this.logName = options.name;
  }

  //todo add crosschain event

  // purge logs - so memory exceptions wont happen, should be persisted first

  // persist on IPFS/mysql

  // todo getter creation date, last update data
}

export class CrossChainModel {
  // TODO cross chain model builds from an event log
  // provides serialization capabilities to being sent to the frontend
  // capabilities for auto update
}
