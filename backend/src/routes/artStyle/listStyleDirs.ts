import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { readdirSync, statSync } from "fs";
const router = express.Router();

/**
 * 列出可用的视频风格（`artStyle` 的合法取值）。
 *
 * **为什么不是 `getArtStyle`**：`o_artStyle` 表存的是用户在"新建画风"里输入的自由文本
 * （`addArtStyle` 把入参 `name` 原样写入并把 `label` 也设成 `name`），它不是
 * `data/skills/art_skills/<value>` 的目录名。而 `artStyle` 字段的硬约束是目录名——
 * 后端 `u.getArtPrompt(project.artStyle, "art_skills", ...)` 拿它去拼路径，塞进自由文本
 * 会得到"视觉手册未定义"。两者不是同一个概念，不能混用。
 *
 * 真相源就是这个目录：加一个风格 = 放进一个目录，前端无需改代码。
 */
export default router.post("/", async (_req, res) => {
  const root = u.getPath(["skills", "art_skills"]);
  let value: string[] = [];
  try {
    value = readdirSync(root).filter((name) => {
      if (name.startsWith(".")) return false;
      try {
        return statSync(`${root}/${name}`).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    // 目录不存在时返回空数组，前端会回退到内置清单
    value = [];
  }
  res.status(200).send(success(value.sort((a, b) => a.localeCompare(b))));
});