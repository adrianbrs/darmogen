import path from "path";
import ts from "typescript";
import {
  ClassMember,
  DartEntity,
  EntityModel,
  Formatter,
  MemberType,
} from "./types";
import * as utils from "./utils";

export interface DartModelOptions {
  nameFormatter: Formatter;
  outDir: string;
  headers?: string[];
  imports?: string[];
  entities: DartEntity[];
}

export class DartModel {
  constructor(private options: DartModelOptions) {}

  parse(entity: DartEntity) {
    const { model } = entity;

    let res = `
class ${this.formatName(model.name)} extends Model {
\t${this.getProperties(entity)}

\t${this.getConstructor(model)}

\t${this.getToJson(entity)}

\t${this.getFactory(entity)}
}
`;

    return `${this.getHeaders(entity)}\n` + res;
  }

  private getProperties(entity: DartEntity) {
    const { model } = entity;
    const { properties } = model;

    const lines = [];
    for (const prop of properties) {
      const dartType = this.getDartType(entity, prop.type);
      lines.push(`${lines.length ? "\t" : ""}${dartType} ${prop.name};`);
    }

    return lines.join("\n");
  }

  private getConstructor(model: EntityModel) {
    const { properties, name } = model;

    let txt = `${this.formatName(name)}(\n\t\t{String id,\n`;
    const propsCopy = properties.slice().filter((prop) => prop.name !== "id");
    while (propsCopy.length) {
      const prop = propsCopy.shift() as ClassMember;
      txt += `\t\tthis.${prop.name}` + (!propsCopy.length ? "})" : ",") + "\n";
    }
    txt += "\t\t: super(id);";

    return txt;
  }

  private getToJson(entity: DartEntity) {
    const { model } = entity;
    const { properties } = model;

    const lines = ["@override", "\tMap<String, dynamic> toJson() => {"];
    for (const prop of properties) {
      lines.push(
        `\t\t'${prop.name}': ${this.getPropToJson(
          prop.name,
          prop.type,
          entity
        )},`
      );
    }
    lines.push("\t};");

    return lines.join("\n");
  }

  private getFactory(entity: DartEntity) {
    const { model } = entity;
    const { properties, name } = model;

    let txt = `factory ${this.formatName(
      name
    )}.fromJson(Map<String, dynamic> json) {\n`;
    txt += `\t\tif (json == null) return null;\n`;
    txt += `\t\treturn ${this.formatName(name)}(\n`;

    const propsCopy = properties.slice();
    while (propsCopy.length) {
      const prop = propsCopy.shift() as ClassMember;
      txt +=
        `\t\t\t${prop.name}: ${this.getPropFromJson(
          `json['${prop.name}']`,
          prop.type,
          entity
        )}` +
        (!propsCopy.length ? ");" : ",") +
        "\n";
    }
    txt += `\t}`;

    return txt;
  }

  private getDartType(entity: DartEntity, type: MemberType): string {
    const { name } = type;
    // Date
    if (name === "Date") return "DateTime";

    // Number
    if (name === "Number") return "int";

    // List
    if (name === "ArrayType") {
      const { elementType } = type.node;
      const escapedText = elementType?.typeName?.escapedText;

      let typeName =
        ts.SyntaxKind[elementType?.kind]?.replace("Keyword", "") ?? "dynamic";

      // List of relation
      if (escapedText) {
        typeName = this.getDartType(entity, {
          ...type,
          name: escapedText,
          node: elementType,
        });
      }

      return "List<" + typeName + ">";
    }

    // Enum
    if (name === "IndexedAccessType") {
      const { indexType } = type.node;
      return this.getDartType(entity, {
        ...type,
        name: ts.SyntaxKind[indexType.kind].replace("Keyword", ""),
        node: indexType,
      });
    }

    // Relation
    const relation = this.getEntityByName(name);
    if (relation) {
      // Add lazy entity relation
      entity.lazyImports.add(relation);
      return relation.name;
    }

    // References "unknown" type, return dynamic
    if (type.node.kind === ts.SyntaxKind.TypeReference) {
      return "dynamic";
    }

    return name;
  }

  private formatName(name: string) {
    return this.options.nameFormatter(name);
  }

  private getPropToJson(name: string, type: MemberType, entity: DartEntity) {
    if (type.name === "Date") {
      return `${name}?.toIso8601String()`;
    }
    if (type.name === "ArrayType") {
      const { elementType } = type.node;

      if (elementType && elementType.typeName) {
        const { escapedText } = elementType.typeName;
        const relation = this.getEntityByName(escapedText);

        // Entity inside list, map to json
        if (relation) {
          const itemName = utils.pascal(escapedText);
          return `${name}?.map((${itemName}) => ${itemName}.toJson())?.toList()`;
        }
      }
    }

    const relation = this.getEntityByName(type.name);
    if (relation) {
      // Add lazy entity
      entity.lazyImports.add(relation);
      return `${name}?.toJson()`;
    }
    return name;
  }

  private getPropFromJson(exp: string, type: MemberType, entity: DartEntity) {
    if (type.name === "Date") {
      return `DateTime.tryParse(${exp} ?? '')`;
    }
    if (type.name === "ArrayType") {
      const { elementType } = type.node;

      // Need to validate entity relation
      if (elementType.kind === ts.SyntaxKind.TypeReference) {
        const { escapedText } = elementType.typeName;
        const relation = this.getEntityByName(escapedText);

        // Relation found, import and map from JSON
        if (relation) {
          entity.lazyImports.add(relation);
          return `(${exp} as List<dynamic>)?.map((data) => ${relation.name}.fromJson(data))`;
        }
      }

      // Literal or unknown, get Dart type
      let typeName =
        ts.SyntaxKind[elementType?.kind]?.replace("Keyword", "") ?? "dynamic";
      typeName = this.getDartType(entity, {
        ...type,
        name: typeName,
        node: elementType,
      });

      // Cast to type
      return `(${exp} as List<dynamic>)?.cast<${typeName}>()`;
    }

    const relation = this.getEntityByName(type.name);
    if (relation) {
      // Add lazy entity
      entity.lazyImports.add(relation);
      return `${relation.name}.fromJson(${exp})`;
    }
    return exp;
  }

  private getEntityByPath(path: string) {
    return this.options.entities.find((entity) => entity.path === path);
  }

  private getEntityByName(name: string) {
    return this.options.entities.find((entity) => entity.name === name);
  }

  private getHeaders(entity: DartEntity) {
    const { properties } = entity.model;
    let headers = this.options.headers?.slice() ?? [];

    // Manual imports
    if (this.options.imports) {
      for (const imp of this.options.imports) {
        const targetPath = path.resolve(this.options.outDir, imp);
        headers.push(this.genImport(entity, targetPath));
      }
    }

    // Properties import headers
    for (const prop of properties) {
      const { relativePath } = prop.type;
      if (!relativePath) continue;

      const relation = this.getEntityByPath(relativePath);

      if (relation) {
        if (entity.targetFile === relation.targetFile) continue;
        headers.push(this.genImport(entity, relation.targetFile));
      }
    }

    // Entity lazy headers
    for (const lazyEntity of entity.lazyImports) {
      if (lazyEntity.targetFile === entity.targetFile) continue;
      headers.push(this.genImport(entity, lazyEntity.targetFile));
    }

    return [...new Set(headers)].join("\n") ?? "";
  }

  private genImport(entity: DartEntity, targetPath: string) {
    const relativeTarget = path.relative(
      path.dirname(entity.targetFile),
      targetPath
    );
    return `import '${relativeTarget}';`;
  }
}
