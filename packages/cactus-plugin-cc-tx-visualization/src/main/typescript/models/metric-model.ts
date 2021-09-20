interface IMetricModel {
  name: string;
  values?: MetricAttributesValue[];
}

type MetricAttributesValue = {
  value: number;
};

export class MetricModel {
  name = "";
  value: number;

  constructor(input: IMetricModel) {
    this.name = input.name;
    if (undefined !== input.values && input.values.length > 0) {
      this.value = input.values[0].value;
    } else {
      this.value = 0;
    }
  }
}
