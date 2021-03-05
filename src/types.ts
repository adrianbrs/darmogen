/******************************
 * Global
 ******************************/

import ts from "typescript";

export interface DarmogenOptions {
  parser: ParserOptions;
  generator: GeneratorOptions;
}

/******************************
 * Parser
 ******************************/

export interface EntityIdentifier {
  decorator?: string;
  extends?: string;
  implements?: string;
}

export interface MemberType {
  name: string;
  importFile: string;
  relativePath: string;
  node: ts.Node & Record<string, any>;
  [k: string]: any;
}

export interface ClassMember {
  name: string;
  type: MemberType;
  node: ts.Node;
}

export interface EntityClass {
  name: string;
  parent: ImportedSource;
  node: ts.Node;
}

export interface ImportedSource {
  filepath: string;
  elements: Record<string, EntityClass>;
  src: ts.SourceFile;
  imports: Record<string, string>;
}

export interface ParserOptions {
  aliases: Record<string, string>;
  cwd: string;
  ext: string;
  root: string;
  identifier: EntityIdentifier;
}

export interface EntityModel {
  name: string;
  properties: ClassMember[];
}

export interface TypeORMEntity {
  path: string;
  name: string;
  model: EntityModel;
}

export interface ImportElement {
  name: string;
  node: ts.Node;
}

export interface ImportClause {
  filepath: string;
  elements: ImportElement[];
}

/******************************
 * Generator
 ******************************/

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
