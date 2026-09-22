import path from "path";
import isPathInside from "is-path-inside";

export default (fileName?: string[] | string) => {
  let basePath: string;
  // Web 环境：使用相对路径
  basePath = path.join(process.cwd(), "data");
  
  if (fileName) {
    let dbPath: string;
    if (Array.isArray(fileName)) {
      dbPath = path.resolve(basePath, ...fileName);
    } else {
      dbPath = path.resolve(basePath, fileName);
    }
    if (!isPathInside(dbPath, basePath) && dbPath !== basePath) {
      throw new Error("路径逃逸错误，路径必须在数据目录内");
    }
    return dbPath;
  }
  return basePath;
};

export function isEletron() {
  return false;
}
