import path from "path";
import fs from "fs";

export function getWords(val: string) {
  return val
    .replace(/(?<!\-)([A-Z]+)|(\-|\_)+/g, (val, g1, g2) => {
      return `-${g1 ?? ""}`;
    })
    .split("-")
    .filter((w) => w);
}

export function camel(val: string) {
  return getWords(val)
    .map((w) => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase())
    .join("");
}

export function pascal(val: string) {
  const res = camel(val);
  return res.charAt(0).toLowerCase() + res.substr(1);
}

export function kebab(val: string) {
  return getWords(val).join("-");
}

export function ensureFolder(filepath: string) {
  const folders = path.dirname(filepath).split("/");

  let verifiedPath = "";
  for (const folder of folders) {
    verifiedPath = path.join(verifiedPath, "/", folder);
    if (!fs.existsSync(verifiedPath)) {
      fs.mkdirSync(verifiedPath);
    }
  }
}

export function writeFile(filepath: string, data: any) {
  if (!filepath || !filepath.length) {
    throw new Error("Filepath cannot be empty");
  }
  ensureFolder(filepath);

  return fs.writeFileSync(filepath, data, { encoding: "utf-8" });
}
