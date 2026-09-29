import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
const router = express.Router();

/**
 * 全部项目的概览统计（一次拿全）。
 *
 * 背景：`generalStatistics` 的 zod 强制要求单个 projectId，首页只能对每个项目各发一次，
 * 项目一多就是 N+1 次请求。这个接口用分组聚合把同样的四个计数一次算完。
 *
 * 归类口径与 `generalStatistics` 保持一致：
 * - 角色 / 分镜都落在 `o_assets` 上，按 `type` 区分；
 * - 视频落在 `o_video`，分镜落在 `o_assets`，两者都只带 `scriptId`，
 *   所以要先经 `o_script` 把 scriptId 折算成 projectId 才能按项目汇总。
 */
export default router.post("/", async (_req, res) => {
  // scriptId → projectId 映射（分镜/视频归属项目全靠它）
  const scripts = await u.db("o_script").select("id", "projectId");
  const projectOfScript = new Map<number, number>();
  for (const s of scripts as Array<{ id: number; projectId: number | null }>) {
    if (s.projectId != null) projectOfScript.set(s.id, s.projectId);
  }

  const stats = new Map<number, { projectId: number; roleCount: number; scriptCount: number; videoCount: number; storyboardCount: number }>();
  const bucket = (projectId: number) => {
    let entry = stats.get(projectId);
    if (!entry) {
      entry = { projectId, roleCount: 0, scriptCount: 0, videoCount: 0, storyboardCount: 0 };
      stats.set(projectId, entry);
    }
    return entry;
  };

  // 角色数（按项目分组）
  const roleRows = (await u.db("o_assets")
    .where("type", "角色")
    .whereNotNull("projectId")
    .groupBy("projectId")
    .select("projectId")
    .count("* as total")) as Array<{ projectId: number; total: number }>;
  for (const row of roleRows) bucket(row.projectId).roleCount = Number(row.total) || 0;

  // 剧本数（按项目分组）
  const scriptRows = (await u.db("o_script")
    .whereNotNull("projectId")
    .groupBy("projectId")
    .select("projectId")
    .count("* as total")) as Array<{ projectId: number; total: number }>;
  for (const row of scriptRows) bucket(row.projectId).scriptCount = Number(row.total) || 0;

  // 分镜数：按 scriptId 分组后折算到项目
  const boardRows = (await u.db("o_assets")
    .where("type", "分镜")
    .whereNotNull("scriptId")
    .groupBy("scriptId")
    .select("scriptId")
    .count("* as total")) as Array<{ scriptId: number; total: number }>;
  for (const row of boardRows) {
    const projectId = projectOfScript.get(row.scriptId);
    if (projectId != null) bucket(projectId).storyboardCount += Number(row.total) || 0;
  }

  // 视频数：同样按 scriptId 分组后折算到项目
  const videoRows = (await u.db("o_video")
    .whereNotNull("scriptId")
    .groupBy("scriptId")
    .select("scriptId")
    .count("* as total")) as Array<{ scriptId: number; total: number }>;
  for (const row of videoRows) {
    const projectId = projectOfScript.get(row.scriptId);
    if (projectId != null) bucket(projectId).videoCount += Number(row.total) || 0;
  }

  res.status(200).send(success(Array.from(stats.values())));
});