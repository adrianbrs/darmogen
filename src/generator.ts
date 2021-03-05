import { TypeORMEntity } from "./parser";
import path from "path";
import * as utils from "./utils";
import { DartModel } from "./dart-model";

export interface GeneratorOptions {
  out: string;
  headers?: string[];
  imports?: string[];
  formatters: {
    name?: Formatter;
    filename?: Formatter;
  };
}

export interface DartEntity extends TypeORMEntity {
  targetFile: string;
  lazyImports: Set<DartEntity>;
}

export type Formatter = (val: string) => string;

export class DartModelGenerator {
  private dartModel!: DartModel;

  constructor(public options: GeneratorOptions) {}

  async generate(entities: TypeORMEntity[]) {
    const dartEntities = entities.map((entity) => {
      const targetFileName = this.getFileName(entity.name);

      const output = path.resolve(
        this.options.out,
        path.dirname(entity.path),
        targetFileName
      );

      return {
        ...entity,
        targetFile: output,
        lazyImports: new Set(),
      } as DartEntity;
    });

    this.dartModel = new DartModel({
      nameFormatter: this.options.formatters.name ?? this.defaultNameFormatter,
      outDir: this.options.out,
      imports: this.options.imports,
      headers: this.options.headers,
      entities: dartEntities,
    });

    return Promise.all(dartEntities.map((entity) => this.writeEntity(entity)));
  }

  private writeEntity(entity: DartEntity) {
    return new Promise<TypeORMEntity>((resolve, reject) => {
      const content = this.dartModel.parse(entity);
      utils.writeFile(entity.targetFile, content);

      return resolve(entity);
    });
  }

  private defaultFilenameFormatter(name: string) {
    return `${utils.kebab(name).toLowerCase()}.dart`;
  }

  private defaultNameFormatter(name: string) {
    return utils.camel(name);
  }

  private getFileName(name: string) {
    const filenameFormatter =
      this.options.formatters.filename ?? this.defaultFilenameFormatter;
    return filenameFormatter(name);
  }
}
