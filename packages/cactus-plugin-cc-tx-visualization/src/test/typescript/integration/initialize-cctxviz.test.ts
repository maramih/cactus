import test, { Test } from "tape-promise/tape";
import { LogLevelDesc } from "@hyperledger/cactus-common";
import { RabbitMQTestServer } from "@hyperledger/cactus-test-tooling";
import { pruneDockerAllIfGithubAction } from "@hyperledger/cactus-test-tooling";
import { IPluginCcTxVisualizationOptions } from "@hyperledger/cactus-plugin-cc-tx-visualization/src/main/typescript";
import {
  CcTxVisualization,
  IChannelOptions,
} from "@hyperledger/cactus-plugin-cc-tx-visualization/src/main/typescript/plugin-cc-tx-visualization";
import { randomUUID } from "crypto";
import * as amqp from "amqp-ts";
//import { LedgerType } from "@hyperledger/cactus-core-api/src/main/typescript/public-api";

const testCase = "Instantiate plugin";
const logLevel: LogLevelDesc = "TRACE";
const queueName = "cc-tx-log-entry-test";
const firstMessage = "[1] Hello Nexus-6";
const anotherMessage = "[2] Would you please take the VK test?";
test("BEFORE " + testCase, async (t: Test) => {
  const pruning = pruneDockerAllIfGithubAction({ logLevel });
  await t.doesNotReject(pruning, "Pruning didn't throw OK");
  t.end();
});

test(testCase, async (t: Test) => {
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

  const cctxvizOptions: IPluginCcTxVisualizationOptions = {
    instanceId: randomUUID(),
    logLevel: logLevel,
    eventProvider: "amqp://localhost",
    channelOptions: channelOptions,
  };

  const testServer = new RabbitMQTestServer(options);
  const tearDown = async () => {
    // Connections to the RabbitMQ server need to be closed
    await cctxViz.closeConnection();
    await connection.close();
    await testServer.stop();
    await pruneDockerAllIfGithubAction({ logLevel });
  };

  test.onFinish(tearDown);

  await testServer.start();
  t.ok(testServer);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Simulates a Cactus Ledger Connector plugin
  const connection = new amqp.Connection();
  const queue = connection.declareQueue(queueName, { durable: false });
  const message = new amqp.Message(firstMessage);
  queue.send(message);
  t.comment("First message sent!");

  // Initialize our plugin
  const cctxViz = new CcTxVisualization(cctxvizOptions);
  t.ok(cctxViz);
  t.comment("cctxviz plugin is ok");

  // Poll messages - the first should be received right away
  await cctxViz.pollTxReceipts();
  const message2 = new amqp.Message(anotherMessage);
  queue.send(message2);
  t.comment("Second message sent!");

  const message3 = new amqp.Message({
    success: true,
    message: "The VK test was taken",
  });
  queue.send(message3);
  t.comment("Third message sent!");

  // Give some time for the second and third messages to be processed
  await new Promise((resolve) => setTimeout(resolve, 1000));
  t.assert(cctxViz.messages.length === 3);
  await cctxViz.txReceiptToCrossChainEventLogEntry();
  const message4 = new amqp.Message({
    success: true,
    message: "And you passed!",
  });
  queue.send(message4);
  t.comment("Fourth message sent!");
  t.comment("Processing last message");
  await cctxViz.txReceiptToCrossChainEventLogEntry();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  t.end();
});
