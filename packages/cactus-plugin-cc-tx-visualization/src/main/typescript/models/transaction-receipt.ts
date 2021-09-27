import { LedgerType } from "@hyperledger/cactus-core-api";

export interface TransactionReceipt {
  caseID: string;
  blockchainId: LedgerType;
  [key: string]: unknown;
}

export interface IsVisualizable {
  // list of transaction receipts, that will be sent to cc-tx-viz
  transactionReceipts: any[];
  collectTransactionReceipts: boolean;
}

// TODO define Tx Receipt for Fabric and Besu
export interface FabricV2TxReceipt extends TransactionReceipt {
  channel: string;
}
export interface BesuV2TxReceipt extends TransactionReceipt {
  gas: string;
}
