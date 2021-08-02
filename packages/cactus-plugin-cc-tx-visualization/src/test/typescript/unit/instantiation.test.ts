import test, { Test } from "tape";
import { v4 as uuidv4 } from "uuid";
import {
  IPluginCcTxVisualizationOptions,
  PluginCcTxVisualization,
} from "../../../main/typescript/plugin-cc-tx-visualization";

test("Instantiation", (t: Test) => {
  const options: IPluginCcTxVisualizationOptions = {
    instanceId: uuidv4(),
  };

  const pluginCcTxVisualization: PluginCcTxVisualization = new PluginCcTxVisualization(
    options,
  );

  t.ok(pluginCcTxVisualization, "Instantiated");
});
