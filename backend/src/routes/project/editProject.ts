import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 新增项目
export default router.post(
  "/",
  validateFields({
    id: z.number(),
    name: z.string(),
    intro: z.string(),
    type: z.string(),
    artStyle: z.string(),
    directorManual: z.string(),
    videoRatio: z.string(),
    imageModel: z.string(),
    videoModel: z.string(),
    projectType: z.string(),
    imageQuality: z.string(),
    mode: z.string(),
    // 分镜图 / 衍生资产图 可用独立模型，留空或空串则回退 imageModel
    storyboardImageModel: z.string().optional(),
    deriveAssetsModel: z.string().optional(),
  }),
  async (req, res) => {
    const { id, name, intro, type, artStyle, videoRatio, directorManual, imageModel, videoModel, imageQuality, projectType, mode, storyboardImageModel, deriveAssetsModel } = req.body;

    const updateData: Record<string, any> = {
      name,
      intro,
      type,
      artStyle,
      videoRatio,
      directorManual,
      imageModel,
      videoModel,
      imageQuality,
      projectType,
      mode,
    };
    // 只在显式传入时才动这两个字段，避免旧版前端编辑项目时把它们清空
    if (storyboardImageModel !== undefined) updateData.storyboardImageModel = storyboardImageModel;
    if (deriveAssetsModel !== undefined) updateData.deriveAssetsModel = deriveAssetsModel;

    await u.db("o_project").where("id", id).update(updateData);

    res.status(200).send(success({ message: "编辑项目成功" }));
  },
);
