/* eslint-disable prettier/prettier */
import { PluginRegistry } from "@hyperledger/cactus-core";
import test, { Test } from "tape";
import { v4 as uuidv4 } from "uuid";
import {
  IPluginCcTxVisualizationOptions,
  PluginCcTxVisualization,
} from "../../../main/typescript/plugin-cc-tx-visualization";
import { ICactusPlugin } from "@hyperledger/cactus-core-api";

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
