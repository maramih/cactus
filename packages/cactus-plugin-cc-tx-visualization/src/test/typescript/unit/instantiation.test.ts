/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { PluginRegistry } from "@hyperledger/cactus-core";
import test, { Test } from "tape-promise/tape";
import { v4 as uuidv4 } from "uuid";
import {
  IPluginCcTxVisualizationOptions,
  PluginCcTxVisualization,
} from "../../../main/typescript/plugin-cc-tx-visualization";
import { Configuration, ICactusPlugin } from "@hyperledger/cactus-core-api";
import { IListenOptions, Servers } from "@hyperledger/cactus-common";
import bodyParser from "body-parser";
import express from "express";
import { DiscoveryOptions } from "fabric-network";
import { LogLevelDesc } from "loglevel";
import { AddressInfo } from "net";
import {
  Containers,
  FabricTestLedgerV1,
  pruneDockerAllIfGithubAction,
} from "@hyperledger/cactus-test-tooling";
import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";
import {
  PluginLedgerConnectorFabric,
  DefaultApi as FabricApi,
  DefaultEventHandlerStrategy,
  FabricSigningCredential,
  IPluginLedgerConnectorFabricOptions,
  FabricContractInvocationType,
  RunTransactionRequest,
} from "@hyperledger/cactus-plugin-ledger-connector-fabric";
import http from "http";
import { K_CACTUS_FABRIC_TOTAL_TX_COUNT } from "@hyperledger/cactus-plugin-ledger-connector-fabric/src/main/typescript/prometheus-exporter/metrics";




test("Basic Instantiation", (t: Test) => {
  const options: IPluginCcTxVisualizationOptions = {
    instanceId: uuidv4(),
    connectorRegistry: new PluginRegistry(),
  };

  const pluginCcTxVisualization: PluginCcTxVisualization = new PluginCcTxVisualization(
    options,
  );

  t.ok(pluginCcTxVisualization, "Instantiated");
  t.end();
});

test("Dummy Connector Instantiaton", (t: Test) => {
    class DummyPlugin implements ICactusPlugin{
    private readonly instanceId: string;

    constructor(){
      this.instanceId = "CCTX_DUMMY_" + uuidv4();
    }
    public getInstanceId(): string {
      return this.instanceId;
    }
    public getPackageName(): string {
      return "DummyPlugin";
    }
    public async onPluginInit(): Promise<unknown> {
      return;
    }

  }


  //add connector reference to the registry
  const connectorRegistryTest = new PluginRegistry();
  connectorRegistryTest.add(new DummyPlugin());

  const options: IPluginCcTxVisualizationOptions = {
    instanceId: uuidv4(),
    connectorRegistry: connectorRegistryTest,
  };

  const pluginCcTxVisualization: PluginCcTxVisualization = new PluginCcTxVisualization(
    options,
  );

  t.ok(pluginCcTxVisualization, "Instantiated with a dummy connector");
  t.end();
});

const logLevel: LogLevelDesc = "TRACE";
test("BEFORE " , async (t: Test) => {
  const pruning = pruneDockerAllIfGithubAction({ logLevel });
  await t.doesNotReject(pruning, "Pruning didn't throw OK");
  t.end();
});

test("Connector Instantiaton with Fabric and Besu", async (t: Test) => {
//FABRIC
const logLevel: LogLevelDesc = "TRACE";

  test.onFailure(async () => {
    await Containers.logDiagnostics({ logLevel });
  });

  const ledger = new FabricTestLedgerV1({
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
  t.ok(ledger, "ledger (FabricTestLedgerV1) truthy OK");

  const tearDownLedger = async () => {
    await ledger.stop();
    await ledger.destroy();
    await pruneDockerAllIfGithubAction({ logLevel });
  };

  test.onFinish(tearDownLedger);

  await ledger.start();

  const enrollAdminOut = await ledger.enrollAdmin();
  const adminWallet = enrollAdminOut[1];
  const [userIdentity] = await ledger.enrollUser(adminWallet);

  const connectionProfile = await ledger.getConnectionProfileOrg1();

  const sshConfig = await ledger.getSshConfig();

  const keychainInstanceId = uuidv4();
  const keychainId = uuidv4();
  const keychainEntryKey = "user2";
  const keychainEntryValue = JSON.stringify(userIdentity);

  const keychainPlugin = new PluginKeychainMemory({
    instanceId: keychainInstanceId,
    keychainId,
    logLevel,
    backend: new Map([
      [keychainEntryKey, keychainEntryValue],
      ["some-other-entry-key", "some-other-entry-value"],
    ]),
  });

  const pluginRegistry = new PluginRegistry({ plugins: [keychainPlugin] });

  const discoveryOptions: DiscoveryOptions = {
    enabled: true,
    asLocalhost: true,
  };

  const pluginOptions: IPluginLedgerConnectorFabricOptions = {
    instanceId: uuidv4(),
    pluginRegistry,
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
  };
  const fabricConnector = new PluginLedgerConnectorFabric(pluginOptions);

  const expressApp = express();
  expressApp.use(bodyParser.json({ limit: "250mb" }));
  const server = http.createServer(expressApp);
  const listenOptions: IListenOptions = {
    hostname: "localhost",
    port: 0,
    server,
  };
  const addressInfo = (await Servers.listen(listenOptions)) as AddressInfo;
  test.onFinish(async () => await Servers.shutdown(server));
  const { address, port } = addressInfo;
  const apiHost = `http://${address}:${port}`;
  t.comment(
    `Metrics URL: ${apiHost}/api/v1/plugins/@hyperledger/cactus-plugin-ledger-connector-fabric/get-prometheus-exporter-metrics`,
  );

  const apiConfig = new Configuration({ basePath: apiHost });
  const apiClient = new FabricApi(apiConfig);

  await fabricConnector.getOrCreateWebServices();
  await fabricConnector.registerWebServices(expressApp);

  // const assetId = "asset277";
  // const assetOwner = uuidv4();

  const channelName = "mychannel";
  const contractName = "basic";
  const signingCredential: FabricSigningCredential = {
    keychainId,
    keychainRef: keychainEntryKey,
  };
  {
    const res = await apiClient.runTransactionV1({
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
    const res = await apiClient.getPrometheusMetricsV1();
    const promMetricsOutput =
      "# HELP " +
      K_CACTUS_FABRIC_TOTAL_TX_COUNT +
      " Total transactions executed\n" +
      "# TYPE " +
      K_CACTUS_FABRIC_TOTAL_TX_COUNT +
      " gauge\n" +
      K_CACTUS_FABRIC_TOTAL_TX_COUNT +
      '{type="' +
      K_CACTUS_FABRIC_TOTAL_TX_COUNT +
      '"} 1';
    t.ok(res);
    t.ok(res.data);
    t.equal(res.status, 200);
    t.true(
      res.data.includes(promMetricsOutput),
      "Total Transaction Count of 3 recorded as expected. RESULT OK",
    );
  }





//BESU






//add connector reference to the registry
const connectorRegistryTest = new PluginRegistry();
connectorRegistryTest.add(fabricConnector);
//connectorRegistryTest.add();

const options: IPluginCcTxVisualizationOptions = {
  instanceId: uuidv4(),
  connectorRegistry: connectorRegistryTest,
};

const pluginCcTxVisualization: PluginCcTxVisualization = new PluginCcTxVisualization(
  options,
);

t.ok(pluginCcTxVisualization, "Instantiated with Fabric and Besu");
t.end();
});