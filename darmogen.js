const utils = require("./src/utils")

module.exports = {
  parser: {
    aliases: {
      src: "{cwd}",
    },
    identifier: {
      decorator: "Entity",
    },
    cwd: "/home/adrian/Projetos/Pubby/pubby_backend/src",
    root: "../",
    ext: ".entity.ts",
  },
  generator: {
    out: "./models",
    imports: ["./rest.dart"],
    formatters: {
      name: (name) => utils.camel(name),
      filename: (name) => utils.kebab(name).toLowerCase() + ".model.dart",
    },
  },
};
