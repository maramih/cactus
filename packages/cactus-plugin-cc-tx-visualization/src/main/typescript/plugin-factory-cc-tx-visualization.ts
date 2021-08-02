import {
  IPluginFactoryOptions,
  PluginFactory,
} from "@hyperledger/cactus-core-api";
import {
  IPluginCcTxVisualizationOptions,
  PluginCcTxVisualization,
} from "./plugin-cc-tx-visualization";

export class PluginFactoryWebService extends PluginFactory<
  PluginCcTxVisualization,
  IPluginCcTxVisualizationOptions,
  IPluginFactoryOptions
> {
  async create(
    pluginOptions: IPluginCcTxVisualizationOptions,
  ): Promise<PluginCcTxVisualization> {
    return new PluginCcTxVisualization(pluginOptions);
  }
}
