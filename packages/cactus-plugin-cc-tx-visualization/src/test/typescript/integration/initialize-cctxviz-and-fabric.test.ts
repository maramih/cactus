import { LogLevelDesc } from "@hyperledger/cactus-common";
import { RabbitMQTestServer } from "@hyperledger/cactus-test-tooling";
import {
  // APIConfig,
  IChannelOptions,
} from "@hyperledger/cactus-plugin-cc-tx-visualization/src/main/typescript/plugin-cc-tx-visualization";
import { PluginRegistry } from "@hyperledger/cactus-core";
//import { Server as SocketIoServer } from "socket.io";
import { LedgerType } from "@hyperledger/cactus-core-api";
import test, { Test } from "tape-promise/tape";
import { v4 as uuidv4 } from "uuid";
import {
  IPluginCcTxVisualizationOptions,
  CcTxVisualization,
} from "../../../main/typescript/plugin-cc-tx-visualization";
import { Configuration } from "@hyperledger/cactus-core-api";
import { IListenOptions, Servers } from "@hyperledger/cactus-common";
import bodyParser from "body-parser";
import express from "express";
import { DiscoveryOptions } from "fabric-network";
import { AddressInfo } from "net";
import {
  Containers,
  FabricTestLedgerV1,
  pruneDockerAllIfGithubAction,
} from "@hyperledger/cactus-test-tooling";
import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";
import {
  PluginLedgerConnectorFabric,
  DefaultApi,
  DefaultEventHandlerStrategy,
  FabricSigningCredential,
  IPluginLedgerConnectorFabricOptions,
  FabricContractInvocationType,
  RunTransactionRequest,
} from "@hyperledger/cactus-plugin-ledger-connector-fabric";
import http from "http";
import { randomUUID } from "crypto";

const testCase = "Instantiate plugin with FABRIC";
const logLevel: LogLevelDesc = "TRACE";
const queueName = "cc-tx-viz-exchange";

test("BEFORE " + testCase, async (t: Test) => {
  const pruning = pruneDockerAllIfGithubAction({ logLevel });
  await t.doesNotReject(pruning, "Pruning didn't throw OK");
  t.end();
});

test("Connector Instantiaton with Fabric", async (t: Test) => {
  //initialize rabbitmq
  const options = {
    publishAllPorts: true,
    port: 5672,
    imageName: "rabbitmq",
    imageTag: "3.9-management",
    emitContainerLogs: true,
    envVars: new Map([["AnyNecessaryEnvVar", "Can be set here"]]),
    logLevel: logLevel,
  };
  const channelOptions: IChannelOptions = {
    queueId: queueName,
    dltTechnology: null,
    persistMessages: false,
  };

  //initialize FABRIC
  test.onFailure(async () => {
    await Containers.logDiagnostics({ logLevel });
  });

  const FabricTestLedger = new FabricTestLedgerV1({
    emitContainerLogs: true,
    publishAllPorts: true,
    logLevel,
    imageName: "ghcr.io/hyperledger/cactus-fabric2-all-in-one",
    imageVersion: "2021-04-20-nodejs",
    envVars: new Map([
      ["FABRIC_VERSION", "2.2.0"],
      ["CA_VERSION", "1.4.9"],
    ]),
  });
  t.ok(FabricTestLedger, "ledger (FabricTestLedgerV1) truthy OK");

  const tearDownLedger = async () => {
    await FabricTestLedger.stop();
    await FabricTestLedger.destroy();
    await pruneDockerAllIfGithubAction({ logLevel });
  };

  test.onFinish(tearDownLedger);

  await FabricTestLedger.start();

  const enrollAdminOut = await FabricTestLedger.enrollAdmin();
  const adminWallet = enrollAdminOut[1];
  const [userIdentity] = await FabricTestLedger.enrollUser(adminWallet);

  const connectionProfile = await FabricTestLedger.getConnectionProfileOrg1();

  const sshConfig = await FabricTestLedger.getSshConfig();

  const keychainInstanceIdFabric = uuidv4();
  const keychainIdFabric = uuidv4();
  const keychainEntryKeyFabric = "user2";
  const keychainEntryValueFabric = JSON.stringify(userIdentity);

  const keychainPluginFabric = new PluginKeychainMemory({
    instanceId: keychainInstanceIdFabric,
    keychainId: keychainIdFabric,
    logLevel,
    backend: new Map([
      [keychainEntryKeyFabric, keychainEntryValueFabric],
      ["some-other-entry-key", "some-other-entry-value"],
    ]),
  });

  const FabricPluginRegistry = new PluginRegistry({
    plugins: [keychainPluginFabric],
  });

  const discoveryOptions: DiscoveryOptions = {
    enabled: true,
    asLocalhost: true,
  };

  const FabricPluginOptions: IPluginLedgerConnectorFabricOptions = {
    instanceId: uuidv4(),
    pluginRegistry: FabricPluginRegistry,
    sshConfig,
    cliContainerEnv: {},
    peerBinary: "/fabric-samples/bin/peer",
    logLevel,
    connectionProfile,
    discoveryOptions,
    eventHandlerOptions: {
      strategy: DefaultEventHandlerStrategy.NetworkScopeAllfortx,
      commitTimeout: 300,
    },
    collectTransactionReceipts: true,
    queueId: queueName,
  };
  const fabricConnector = new PluginLedgerConnectorFabric(FabricPluginOptions);

  const expressAppFabric = express();
  expressAppFabric.use(bodyParser.json({ limit: "250mb" }));
  const serverFabric = http.createServer(expressAppFabric);
  const listenOptionsFabric: IListenOptions = {
    hostname: "localhost",
    port: 0,
    server: serverFabric,
  };
  const addressInfoFabric = (await Servers.listen(
    listenOptionsFabric,
  )) as AddressInfo;
  test.onFinish(async () => await Servers.shutdown(serverFabric));
  const { address, port } = addressInfoFabric;
  const apiHostFabric = `http://${address}:${port}`;
  t.comment(
    `Metrics URL: ${apiHostFabric}/api/v1/plugins/@hyperledger/cactus-plugin-ledger-connector-fabric/get-prometheus-exporter-metrics`,
  );

  const FabricApiConfig = new Configuration({ basePath: apiHostFabric });

  await fabricConnector.getOrCreateWebServices();
  await fabricConnector.registerWebServices(expressAppFabric);

  const channelName = "mychannel";
  const contractName = "basic";
  const signingCredential: FabricSigningCredential = {
    keychainId: keychainIdFabric,
    keychainRef: keychainEntryKeyFabric,
  };

  //test Fabric transactions purposes
  // const assetId = "asset277";
  const assetOwner = uuidv4();

  //apiClients
  const apiClientFabric = new DefaultApi(FabricApiConfig);

  //add connector reference to the registry
  const testConnectorRegistry = new PluginRegistry();
  testConnectorRegistry.add(fabricConnector);

  //cctxviz options
  const cctxvizOptions: IPluginCcTxVisualizationOptions = {
    instanceId: randomUUID(),
    logLevel: logLevel,
    eventProvider: "amqp://localhost",
    channelOptions: channelOptions,
    configApiClients: [{ type: LedgerType.Fabric2, basePath: apiHostFabric }],
    connectorRegistry: testConnectorRegistry,
  };

  const testServer = new RabbitMQTestServer(options);
  const tearDown = async () => {
    // Connections to the RabbitMQ server need to be closed
    await cctxViz.closeConnection();
    await fabricConnector.closeConnection();
    await testServer.stop();
    await pruneDockerAllIfGithubAction({ logLevel });
  };

  test.onFinish(tearDown);

  await testServer.start();
  t.ok(testServer);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // FABRIC transactions
  {
    const res = await apiClientFabric.runTransactionV1({
      signingCredential,
      channelName,
      contractName,
      invocationType: FabricContractInvocationType.Call,
      methodName: "GetAllAssets",
      params: [],
    } as RunTransactionRequest);
    t.ok(res);
    t.ok(res.data);
    t.equal(res.status, 200);
    t.doesNotThrow(() => JSON.parse(res.data.functionOutput));
  }

  {
    const req: RunTransactionRequest = {
      caseID: "FABRIC_CASE_ID_TBD",
      signingCredential,
      gatewayOptions: {
        identity: keychainEntryKeyFabric,
        wallet: {
          json: keychainEntryValueFabric,
        },
      },
      channelName,
      invocationType: FabricContractInvocationType.Send,
      contractName,
      methodName: "CreateAsset",
      params: ["asset388", "green", "111", assetOwner, "299"],
      endorsingPeers: ["org1.example.com", "Org2MSP"],
    };

    const res = await apiClientFabric.runTransactionV1(req);
    t.ok(res, "Create green asset response truthy OK");
    t.ok(res.data, "Create green asset response.data truthy OK");
    t.equal(res.status, 200, "Create green asset response.status=200 OK");
  }

  //

  // Initialize our plugin
  const cctxViz = new CcTxVisualization(cctxvizOptions);
  t.ok(cctxViz);
  t.comment("cctxviz plugin is ok");

  // Poll messages
  await cctxViz.pollTxReceipts();

  t.comment(
    `Number of TxReceipts Received:${cctxViz.messages.length.toString()}`,
  );

  await cctxViz.txReceiptToCrossChainEventLogEntry();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  t.end();
});
