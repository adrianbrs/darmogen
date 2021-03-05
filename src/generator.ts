import path from "path";
import * as utils from "./utils";
import { DartModel } from "./dart-model";
import { DartEntity, GeneratorOptions, TypeORMEntity } from "./types";
import EventEmitter from "events";

export class DartModelGenerator extends EventEmitter {
  private total = 0;
  private loaded = 0;

  private dartModel!: DartModel;

  constructor(public options: GeneratorOptions) {
    super();
  }

  async generate(entities: TypeORMEntity[]) {
    // Update total
    this.total = entities.length;
    this.updateTotal();

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

  private updateTotal() {
    this.emit("update", this.total);
  }

  private onProgress(name: string) {
    this.emit("progress", this.loaded, name);
  }

  private writeEntity(entity: DartEntity) {
    return new Promise<DartEntity>((resolve, reject) => {
      const content = this.dartModel.parse(entity);
      utils.writeFile(entity.targetFile, content);

      // Update loaded
      this.loaded++;
      this.onProgress(entity.name);

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
