#!/usr/bin/env node

import path from "path";
import { DartModelGenerator } from "./generator";
import { NestEntityParser } from "./parser";
import { DarmogenOptions } from "./types";
import cp from "cli-progress";
import fs from "fs";

const OPTIONS_FILENAME = "darmogen.js";
const HEADER_PATH = path.resolve(__dirname, "./headers");
const PROGRESS_OPTIONS: cp.Options = {
  format:
    "├ {title} |{bar}| {percentage}% | {value}/{total} {loaded} | ({name})",
  autopadding: true,
  barCompleteChar: "=",
  barIncompleteChar: "-",
};

function getVersion() {
  return "1.0.0";
}

function getOptions(): DarmogenOptions {
  const optionsFile = path.resolve(process.cwd(), OPTIONS_FILENAME);

  if (!fs.existsSync(optionsFile)) {
    throw new Error(`Could not find "${OPTIONS_FILENAME}" options file.`);
  }

  const options = require(optionsFile);

  // Update source
  options.parser.cwd = path.resolve(process.cwd(), options.parser.cwd);
  options.parser.root = path.resolve(process.cwd(), options.parser.root);

  // Update output
  options.generator.out = path.resolve(process.cwd(), options.generator.out);

  return options;
}

function showHeader(options: DarmogenOptions) {
  const titleFile = path.resolve(HEADER_PATH, "header.txt");
  const title = fs.readFileSync(titleFile, { encoding: "utf-8" });
  console.log(title.replace("{version}", "v" + getVersion()) + "\n");

  console.log(`■ Source: "${options.parser.cwd}"`);
  console.log(`× Target: "${options.generator.out}"\n`);
}

async function run(options: DarmogenOptions) {
  showHeader(options);

  // Check input and output
  if (!fs.existsSync(options.parser.cwd)) {
    console.error(
      `Error: Parser "cwd" folder doesn't exists: ${options.parser.cwd}`
    );
    process.exit(1);
  }

  // Parser progress
  const pgBar = new cp.SingleBar(PROGRESS_OPTIONS, cp.Presets.shades_classic);
  let models = null;

  try {
    // Parse Nest entities
    const parser = new NestEntityParser(options.parser);

    parser.on("init", (total, files) => {
      console.log(`┌ Found ${files.length} files:`);

      pgBar.start(total, 0, {
        title: "Parsing   ",
        loaded: "parsed files",
        name: "",
      });
    });
    parser.on("progress", (loaded, name) => {
      pgBar.update(loaded, { name });
    });

    const entities = await parser.parse();
    pgBar.stop();

    // Generate Dart models
    const generator = new DartModelGenerator(options.generator);

    // Parser progress
    pgBar.start(0, 0, {
      title: "Generating",
      loaded: "generated files",
      name: "",
    });
    generator.on("update", (total) => pgBar.setTotal(total));
    generator.on("progress", (loaded, name) => {
      pgBar.update(loaded, { name });
    });

    models = await generator.generate(entities);
    pgBar.stop();

    console.log("│");
  } catch (err) {
    pgBar.stop();

    // Print error
    console.error("Error: Could not generate Dart models.");
    throw err;
  }

  return models;
}

function padText(text: string, c: string, n: number) {
  return text + c.repeat(n - text.length);
}

const options = getOptions();
run(options).then((models) => {
  if (!models) return;

  let width = 20;
  models = models.map((model) => {
    const targetFile = path.relative(process.cwd(), model.targetFile);

    if (targetFile.length + model.name.length > width) {
      width = targetFile.length + model.name.length;
    }

    return {
      ...model,
      targetFile,
    };
  });

  const offset = 10;

  if (!models.length) {
    width =
      Math.max(options.parser.cwd.length, options.parser.ext.length) + offset;
  }

  width += offset;

  console.log(`│${padText("", "─", width)}┐`);

  // No entities found
  if (!models.length) {
    console.log(
      `│${padText(
        ` No entities found, check parser "cwd" and "ext".`,
        " ",
        width
      )}│`
    );
    console.log(`├${padText(` » cwd: ${options.parser.cwd})`, " ", width)}│`);
    console.log(`├${padText(` » ext: ${options.parser.ext})`, " ", width)}│`);
  }

  // Generated models
  else {
    console.log(
      `│${padText(` Generated ${models.length} models:`, " ", width)}│`
    );
    console.log(`├${padText("", "─", width)}┤`);

    for (const model of models) {
      console.log(
        `├${padText(` » ${model.name} (${model.targetFile})`, " ", width)}│`
      );
    }
  }

  console.log(`└${padText("", "─", width)}┘`);
});
