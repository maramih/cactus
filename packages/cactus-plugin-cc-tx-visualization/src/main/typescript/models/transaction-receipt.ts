import { LedgerType } from "@hyperledger/cactus-core-api";
import { Web3SigningCredential } from "@hyperledger/cactus-plugin-ledger-connector-besu/src/main/typescript/public-api";

export interface TransactionReceipt {
  caseID: string;
  blockchainID: LedgerType;
  invocationType: string;
  methodName: string;
  parameters: string[];
  timestamp: Date;
}

export interface IsVisualizable {
  // list of transaction receipts, that will be sent to cc-tx-viz
  transactionReceipts: any[];
  collectTransactionReceipts: boolean;
}

// TODO define Tx Receipt for Fabric
export interface FabricV2TxReceipt extends TransactionReceipt {
  channel: string;
}
export interface BesuV2TxReceipt extends TransactionReceipt {
  status: boolean;
  transactionHash: string;
  transactionIndex: number;
  blockNumber: number;
  blockHash: string;
  contractName: string;
  contractAddress?: string;
  contractAbi?: string[];
  value?: number | string;
  gas?: number | string;
  gasPrice?: number | string;
  gasUsed?: number | string;
  cumulativeGasUsed?: number | string;
  from: string;
  to: string;
  signingCredentials?: Web3SigningCredential;
  keychainID?: string;
  privateTransactionConfig?: string[];
  timeoutMs?: number | string;
}
