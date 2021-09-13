export class MetricModel {
  name: string;
  value: number;

  constructor(input: any) {
    if ("name" in input) this.name = input.name;
    else this.name = "";

    if ("values" in input && input.values.length > 0)
      this.value = input.values[0].value;
    else this.value = 0;

    if (null === input || undefined === input) {
      this.name = "";
      this.value = 0;
    }
  }
}
