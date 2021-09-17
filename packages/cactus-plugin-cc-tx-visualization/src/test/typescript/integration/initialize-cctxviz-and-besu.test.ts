import test, { Test } from "tape-promise/tape";
import { LogLevelDesc } from "@hyperledger/cactus-common";
import { RabbitMQTestServer } from "@hyperledger/cactus-test-tooling";
import { pruneDockerAllIfGithubAction } from "@hyperledger/cactus-test-tooling";
import { IPluginCcTxVisualizationOptions } from "@hyperledger/cactus-plugin-cc-tx-visualization/src/main/typescript";
import {
    APIConfig,
  CcTxVisualization,
  IChannelOptions,
} from "@hyperledger/cactus-plugin-cc-tx-visualization/src/main/typescript/plugin-cc-tx-visualization";
import { randomUUID } from "crypto";
import * as amqp from "amqp-ts";
import { PluginRegistry } from "@hyperledger/cactus-core";
import { Server as SocketIoServer } from "socket.io";
import { Constants, LedgerType, PluginImportType } from "@hyperledger/cactus-core-api";
import { v4 as uuidv4 } from "uuid";
import { IListenOptions, Servers } from "@hyperledger/cactus-common";
import bodyParser from "body-parser";
import express from "express";
import { AddressInfo } from "net";
import {
  BesuTestLedger,
} from "@hyperledger/cactus-test-tooling";
import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";
import http from "http";
import {
  EthContractInvocationType,
  Web3SigningCredentialType,
  PluginLedgerConnectorBesu,
  PluginFactoryLedgerConnector,
  Web3SigningCredentialCactusKeychainRef,
  ReceiptType,
  BesuApiClient,
  WatchBlocksV1Progress,
  Web3BlockHeader,
  BesuApiClientOptions,
} from "@hyperledger/cactus-plugin-ledger-connector-besu/src/main/typescript/public-api";
import Web3 from "web3";
import HelloWorldContractJson from "@hyperledger/cactus-plugin-ledger-connector-besu/src/test/solidity/hello-world-contract/HelloWorld.json";


const testCase = "Instantiate plugin";
const logLevel: LogLevelDesc = "TRACE";
const queueName = "cc-tx-viz-exchange";
const firstMessage = "[1] Hello Nexus-6";
const anotherMessage = "[2] Would you please take the VK test?";
test("BEFORE " + testCase, async (t: Test) => {
  const pruning = pruneDockerAllIfGithubAction({ logLevel });
  await t.doesNotReject(pruning, "Pruning didn't throw OK");
  t.end();
});

test(testCase, async (t: Test) => {
  //initialize rabbitmq
  const options = {
    publishAllPorts: true,
    port: 5672,
    logLevel: logLevel,
    imageName: "rabbitmq",
    imageTag: "3.9-management",
    emitContainerLogs: true,
    envVars: new Map([["AnyNecessaryEnvVar", "Can be set here"]]),
  };
  const channelOptions: IChannelOptions = {
    queueId: queueName,
    dltTechnology: null,
    persistMessages: false,
  };

//BESU
const besuTestLedger = new BesuTestLedger();
await besuTestLedger.start();

test.onFinish(async () => {
  await besuTestLedger.stop();
  await besuTestLedger.destroy();
  await pruneDockerAllIfGithubAction({ logLevel });
});

const rpcApiHttpHost = await besuTestLedger.getRpcApiHttpHost();
const rpcApiWsHost = await besuTestLedger.getRpcApiWsHost();

const firstHighNetWorthAccount = besuTestLedger.getGenesisAccountPubKey();
const besuKeyPair = {
  privateKey: besuTestLedger.getGenesisAccountPrivKey(),
};

const web3 = new Web3(rpcApiHttpHost);
const testEthAccount = web3.eth.accounts.create(uuidv4());

const keychainEntryKeyBesu = uuidv4();
const keychainEntryValueBesu = testEthAccount.privateKey;
const keychainPluginBesu = new PluginKeychainMemory({
  instanceId: uuidv4(),
  keychainId: uuidv4(),
  // pre-provision keychain with mock backend holding the private key of the
  // test account that we'll reference while sending requests with the
  // signing credential pointing to this keychain entry.
  backend: new Map([[keychainEntryKeyBesu, keychainEntryValueBesu]]),
  logLevel,
});
keychainPluginBesu.set(
  HelloWorldContractJson.contractName,
  JSON.stringify(HelloWorldContractJson),
);
const factory = new PluginFactoryLedgerConnector({
  pluginImportType: PluginImportType.Local,
});

const besuConnector: PluginLedgerConnectorBesu = await factory.create({
  rpcApiHttpHost,
  rpcApiWsHost,
  logLevel,
  instanceId: uuidv4(),
  pluginRegistry: new PluginRegistry({ plugins: [keychainPluginBesu] }),
  collectTransactionReceipts: true,
  queueId: queueName
});

const expressAppBesu = express();
expressAppBesu.use(bodyParser.json({ limit: "250mb" }));
const serverBesu = http.createServer(expressAppBesu);

const wsApi = new SocketIoServer(serverBesu, {
  path: Constants.SocketIoConnectionPathV1,
});

const listenOptionsBesu: IListenOptions = {
  hostname: "localhost",
  port: 0,
  server: serverBesu,
};
const addressInfoBesu = (await Servers.listen(listenOptionsBesu)) as AddressInfo;
test.onFinish(async () => await Servers.shutdown(serverBesu));
const addressBesu:string = addressInfoBesu.address;
const portBesu:number = addressInfoBesu.port;
const apiHostBesu = `http://${addressBesu}:${portBesu}`;
t.comment(
  `Metrics URL: ${apiHostBesu}/api/v1/plugins/@hyperledger/cactus-plugin-ledger-connector-besu/get-prometheus-exporter-metrics`,
);

const wsBasePath = apiHostBesu + Constants.SocketIoConnectionPathV1;
t.comment("WS base path: " + wsBasePath);
const besuApiClientOptions = new BesuApiClientOptions({ basePath: apiHostBesu });
const besuApiClient = new BesuApiClient(besuApiClientOptions);

await besuConnector.getOrCreateWebServices();
await besuConnector.registerWebServices(expressAppBesu, wsApi);

// apis' config
// const testApiConfig: APIConfig[] = [];
// testApiConfig.push({type: LedgerType.Besu2X, basePath:apiHostBesu});

//add connector reference to the registry
const testConnectorRegistry = new PluginRegistry();
testConnectorRegistry.add(besuConnector);


//cctxviz options
  const cctxvizOptions: IPluginCcTxVisualizationOptions = {
    instanceId: randomUUID(),
    logLevel: logLevel,
    eventProvider: "amqp://localhost",
    channelOptions: channelOptions,
    configApiClients: [{type: LedgerType.Besu2X, basePath:apiHostBesu}],
    connectorRegistry: testConnectorRegistry,
  };

  const testServer = new RabbitMQTestServer(options);
  const tearDown = async () => {
    // Connections to the RabbitMQ server need to be closed
    await cctxViz.closeConnection();
    await besuConnector.closeConnection();
    await testServer.stop();
    await pruneDockerAllIfGithubAction({ logLevel });
  };

  test.onFinish(tearDown);

  await testServer.start();
  t.ok(testServer);

  await new Promise((resolve) => setTimeout(resolve, 3000));


// BESU transactions
await besuConnector.transact({
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      secret: besuKeyPair.privateKey,
      type: Web3SigningCredentialType.PrivateKeyHex,
    },
    transactionConfig: {
      from: firstHighNetWorthAccount,
      to: testEthAccount.address,
      value: 10e9,
      gas: 1000000,
    },
    consistencyStrategy: {
      blockConfirmations: 0,
      receiptType: ReceiptType.NodeTxPoolAck,
      timeoutMs: 60000,
    },
  });

  const blocks = await besuApiClient.watchBlocksV1();

  const aBlockHeader = await new Promise<Web3BlockHeader>((resolve, reject) => {
    let done = false;
    const timerId = setTimeout(() => {
      if (!done) {
        reject("Waiting for block header notification to arrive timed out");
      }
    }, 10000);
    const subscription = blocks.subscribe((res: WatchBlocksV1Progress) => {
      subscription.unsubscribe();
      done = true;
      clearTimeout(timerId);
      resolve(res.blockHeader);
    });
  });
  t.ok(aBlockHeader, "Web3BlockHeader truthy OK");

  const balance = await web3.eth.getBalance(testEthAccount.address);
  t.ok(balance, "Retrieved balance of test account OK");
  t.equals(parseInt(balance, 10), 10e9, "Balance of test account is OK");

  let contractAddress: string;

  //deploy
  const deployOut = await besuConnector.deployContract({
    keychainId: keychainPluginBesu.getKeychainId(),
    contractName: HelloWorldContractJson.contractName,
    contractAbi: HelloWorldContractJson.abi,
    constructorArgs: [],
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      secret: besuKeyPair.privateKey,
      type: Web3SigningCredentialType.PrivateKeyHex,
    },
    bytecode: HelloWorldContractJson.bytecode,
    gas: 1000000,
  });
  t.ok(deployOut, "deployContract() output is truthy OK");
  t.ok(
    deployOut.transactionReceipt,
    "deployContract() output.transactionReceipt is truthy OK",
  );
  t.ok(
    deployOut.transactionReceipt.contractAddress,
    "deployContract() output.transactionReceipt.contractAddress is truthy OK",
  );

  contractAddress = deployOut.transactionReceipt.contractAddress as string;
  t.ok(
    typeof contractAddress === "string",
    "contractAddress typeof string OK",
  );

  const { callOutput: helloMsg } = await besuConnector.invokeContract({
    keychainId: keychainPluginBesu.getKeychainId(),      
    contractName: HelloWorldContractJson.contractName,
    contractAbi: HelloWorldContractJson.abi,
    contractAddress,
    invocationType: EthContractInvocationType.Call,
    methodName: "sayHello",
    params: [],
    signingCredential: {
      ethAccount: firstHighNetWorthAccount,
      secret: besuKeyPair.privateKey,
      type: Web3SigningCredentialType.PrivateKeyHex,
    }
  });
  t.ok(helloMsg, "sayHello() output is truthy");
  t.true(
    typeof helloMsg === "string",
    "sayHello() output is type of string",
  );


  const response = await besuConnector.invokeContract({
    contractName: HelloWorldContractJson.contractName,
    contractAbi: HelloWorldContractJson.abi,
    contractAddress,
    invocationType: EthContractInvocationType.Send,
    methodName: "deposit",
    params: [],
    gas: 1000000,
    signingCredential: {
      ethAccount: testEthAccount.address,
      secret: testEthAccount.privateKey,
      type: Web3SigningCredentialType.PrivateKeyHex,
    },
    value: 10,
  });
  t.ok(response, "deposit() payable invocation output is truthy OK");

  const response2 = await besuConnector.invokeContract({
    contractName: HelloWorldContractJson.contractName,
    contractAbi: HelloWorldContractJson.abi,
    contractAddress,
    invocationType: EthContractInvocationType.Send,
    methodName: "deposit",
    params: [],
    gas: 1000000,
    signingCredential: {
      ethAccount: testEthAccount.address,
      secret: testEthAccount.privateKey,
      type: Web3SigningCredentialType.PrivateKeyHex,
    },
    value: 10,
  });
  t.ok(response2, "deposit() payable invocation output is truthy OK");

// Initialize our plugin
  const cctxViz = new CcTxVisualization(cctxvizOptions);
  t.ok(cctxViz);
  t.comment("cctxviz plugin is ok");

  // Poll messages - the first should be received right away
  await cctxViz.pollTxReceipts();

  
  // Give some time for the second and third messages to be processed
  await new Promise((resolve) => setTimeout(resolve, 1000));
  t.comment(cctxViz.messages.length.toString());

  await cctxViz.txReceiptToCrossChainEventLogEntry();


  t.end();
});
