import options from "./config";
import { DartModelGenerator, GeneratorOptions } from "./generator";
import { NestEntityParser, ParserOptions } from "./parser";

export interface Options {
  parser: ParserOptions;
  generator: GeneratorOptions;
}

async function run(options: Options) {
  // Parse Nest entities
  const parser = new NestEntityParser(options.parser);
  const entities = await parser.parse();

  // Generate Dart models
  const generator = new DartModelGenerator(options.generator);
  const models = await generator.generate(entities);

  return models;
}

run(options).then((models) => {
  // console.log(`Generated ${models.length} models!`);
});
