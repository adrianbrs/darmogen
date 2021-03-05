import glob from "glob";
import path from "path";
import fs from "fs";
import ts from "typescript";
import {
  ClassMember,
  EntityClass,
  EntityModel,
  ImportedSource,
  ParserOptions,
  TypeORMEntity,
} from "./types";
import EventEmitter from "events";

enum TypeORMDecorators {
  EXCLUDE = "Exclude",
}

export class NestEntityParser extends EventEmitter {
  private total = 0;
  private loaded = 0;

  importedSources: Map<string, ImportedSource> = new Map();

  constructor(public options: ParserOptions) {
    super();
    this.resolveAliases();
  }

  parse() {
    const source = this.options;

    const files = glob.sync(`**/*${source.ext}`, {
      cwd: source.cwd,
    });

    // Update total
    this.total = files.length;
    this.init(files);

    return Promise.all(
      files.map((filepath) => {
        return new Promise<TypeORMEntity[]>((resolve, reject) => {
          const fullpath = path.join(source.cwd, filepath);
          const importedSource = this.importSource(fullpath);

          if (!importedSource) return reject("File not found: " + fullpath);

          const models = this.extractModels(importedSource);

          return resolve(
            models.map((model) => ({
              path: filepath,
              name: model.name,
              model,
            }))
          );
        }).then((models) => {
          this.onModelsLoaded(models);
          return models;
        });
      })
    ).then((models) => models.flat());
  }

  private init(files?: string[]) {
    this.emit("init", this.total, files);
  }

  private onModelsLoaded(models: TypeORMEntity[]) {
    this.emit("load", models);
  }

  private onProgress(name: string) {
    this.emit("progress", this.loaded, name);
  }

  private resolveAliases() {
    const { aliases } = this.options;

    for (const name in aliases) {
      let val = aliases[name];
      val = val.replace(/\{([^{}]+)\}/gi, (_, path) => {
        return this.dotGet(this.options, path) ?? "";
      });
      aliases[name] = val;
    }
  }

  private dotGet(obj: any, path: string) {
    const parts = path.split(".");
    while (parts.length && obj) obj = obj[parts.shift() as string];
    return obj;
  }

  private extractModels(importedSource: ImportedSource) {
    const { elements } = importedSource;

    const models = Object.values(elements).map((entity) => {
      const properties = this.extractProperties(entity);

      return {
        name: entity.name,
        properties,
      } as EntityModel;
    });

    // Update loaded
    this.loaded++;
    this.onProgress(
      Object.values(importedSource.elements)
        .map((el) => el.name)
        .join(", ")
    );

    return models;
  }

  private extractEntities(src: ts.SourceFile) {
    // Extract classes
    let classes: ts.Node[] = [];
    src.forEachChild((child) => {
      if (child.kind === ts.SyntaxKind.ClassDeclaration) {
        classes.push(child);
      }
    });

    // Filter entity classes
    const entityClasses = classes.map((classNode: any) => {
      return {
        name: classNode.name.escapedText,
        isEntity: this.isEntity(classNode),
        parent: null as unknown,
        node: classNode as ts.Node,
      } as EntityClass;
    });

    return entityClasses;
  }

  private isEntity(classNode: any) {
    const { identifier } = this.options;

    // Filter by decorator
    if (identifier.decorator) {
      const decorators = classNode.decorators;
      return (
        decorators?.some(
          (decorator: any) =>
            decorator.expression.expression.escapedText === identifier.decorator
        ) ?? false
      );
    }
    // Filter by extends
    else if (identifier.extends) {
    }
    // Filter by implements
    else if (identifier.implements) {
    } else {
      throw new Error("No source entity identifier specified");
    }
  }

  private extractProperties(entityClass: EntityClass) {
    const extending = this.extractExtended(entityClass);

    const parsedMembers = [entityClass].concat(extending).flatMap((entity) => {
      const node: any = entity.node;
      const members: any[] = node.members;

      return members
        .filter((member) => member.kind === ts.SyntaxKind.PropertyDeclaration)
        .map((member) => {
          if (!this.visibleColumn(member)) {
            return null;
          }

          const name = member.name.escapedText as string;
          const type = member.type;
          let memberType = type;

          // Multiple types, exclude null and get last type
          if (type.types) {
            memberType = type.types.filter(
              (t: any) =>
                t.kind !== ts.SyntaxKind.LiteralType ||
                t.literal.kind !== ts.SyntaxKind.NullKeyword
            )[0];
          } else if (this.isLiteral(type)) {
            memberType = type.literal;
          }

          const typeName =
            memberType.typeName?.escapedText ??
            ts.SyntaxKind[memberType.kind].replace("Keyword", "");

          const importFile = entity.parent.imports[typeName];

          return {
            name,
            type: {
              name: typeName,
              node: memberType,
              kind: type.kind,
              importFile,
              relativePath: importFile
                ? path.relative(this.options.cwd, importFile)
                : null,
            },
            node: member,
          } as ClassMember;
        })
        .filter((m) => m);
    });

    return parsedMembers;
  }

  private extractImports(src: ts.SourceFile, basePath: string) {
    const imports: any[] = [];
    src.forEachChild((child) => {
      if (ts.SyntaxKind[child.kind] === "ImportDeclaration") {
        imports.push(child);
      }
    });

    const res: Record<string, string> = {};
    imports.forEach((imp: any) => {
      const filepath = this.parseAlias(
        imp.moduleSpecifier.text + ".ts",
        basePath
      );
      const elements: any[] = imp.importClause.namedBindings.elements;

      elements.forEach((el: any) => {
        res[el.name.escapedText] = filepath;
      });
    });

    return res;
  }

  private extractExtended(entityClass: EntityClass) {
    const heritageClauses: any[] = (entityClass.node as any).heritageClauses;

    if (heritageClauses) {
      const { parent } = entityClass;

      const parsedClauses = heritageClauses
        .filter((clause: any) => clause.kind === ts.SyntaxKind.HeritageClause)
        .flatMap((clause: any) => {
          const types: any[] = clause.types;

          return types.flatMap((type: any) => {
            const name: string = type.expression.escapedText;
            const filepath = parent.imports[name] ?? parent.filepath;

            if (!filepath) return null;

            const importedSource = this.importSource(filepath);
            const elements = importedSource?.elements ?? {};

            const extending = this.extractExtended(elements[name]);

            return extending && extending.length
              ? [elements[name]].concat(extending)
              : elements[name];
          });
        })
        .filter((c) => c) as EntityClass[];

      return parsedClauses;
    }

    return [];
  }

  private parseAlias(filepath: string, basePath?: string) {
    const { cwd, root, aliases } = this.options;

    // Custom aliases resolver
    let hasAlias = false;
    for (const alias in aliases) {
      const aliasPath = aliases[alias];
      const aliasRegex = new RegExp(`^${alias}`);

      if (!hasAlias && aliasRegex.test(filepath)) {
        hasAlias = true;
      }

      filepath = filepath.replace(aliasRegex, aliasPath);
    }

    // Node modules resolver
    if (!filepath.startsWith(".") && !filepath.startsWith("/") && !hasAlias) {
      filepath = path.resolve(cwd, root, "/node_modules/", filepath);
    } else if (filepath.startsWith(".")) {
      filepath = path.resolve(basePath ?? cwd, filepath);
    }

    return filepath;
  }

  private visibleColumn(member: any) {
    const { decorators } = member;
    if (!decorators) return false;

    const isExcluded = decorators.some(
      (dec: any) =>
        dec.expression.expression.escapedText === TypeORMDecorators.EXCLUDE
    );

    return !isExcluded;
  }

  private isLiteral(entity: any) {
    return entity?.kind === ts.SyntaxKind.LiteralType;
  }

  private importSource(filepath: string) {
    if (!this.importedSources.has(filepath)) {
      const content = fs.readFileSync(filepath, { encoding: "utf-8" });

      if (content) {
        const src = ts.createSourceFile(
          filepath,
          content,
          ts.ScriptTarget.Latest
        );

        // Get source entities
        const elements = this.extractEntities(src).reduce((obj, entity) => {
          obj[entity.name] = entity;
          return obj;
        }, {} as Record<string, EntityClass>);

        const importedSource = {
          filepath,
          elements,
          imports: this.extractImports(src, path.dirname(filepath)),
          src,
        } as ImportedSource;

        // Set elements parent
        for (const name in elements) {
          elements[name].parent = importedSource;
        }

        // Save imported resource
        this.importedSources.set(filepath, importedSource);
      }
    }

    return this.importedSources.get(filepath);
  }
}
