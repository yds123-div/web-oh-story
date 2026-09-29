import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    type: z.enum(["text", "image", "video", "all"]),
  }),
  async (req, res) => {
    const { type } = req.body;
    const dataList = await u.db("o_vendorConfig").select("id").where("enable", 1);
    if (!dataList || dataList.length === 0) {
      return res.status(404).send({ error: "模型未找到" });
    }
    const modelList = await Promise.all(dataList.map((i) => u.vendor.getModelList(i.id!)));
    const result = await Promise.all(
      dataList.map(async (data, index) => {
        const vendorData = await u.vendor.getVendor(data.id!);
        const models = modelList[index];
        const filtered =
          type === "all"
            ? models.filter((item: { type: string }) => item.type !== "video")
            : models.filter((item: { type: string }) => item.type === type);
        return filtered.map((item: { name: string; modelName: string; type: string; mode?: string[] }) => {
          const mode = Array.isArray(item.mode) ? item.mode : [];
          // 把模型能力透出给前端：厂商声明里 mode 含 text = 支持纯文生图；
          // 含 singleImage / multiReference = 支持参考图（图生图）。不含 text 的图像模型必须带参考图。
          // 视频模型（mode 用 singleImage/startFrameOptional 等描述帧），三个标记一律回 null，避免前端误判。
          const isImage = item.type === "image";
          return {
            id: data.id,
            label: item.name,
            value: item.modelName,
            type: item.type,
            name: vendorData.name,
            mode,
            textToImage: isImage ? mode.includes("text") : null,
            supportsReference: isImage ? mode.includes("singleImage") || mode.includes("multiReference") : null,
            requiresReference: isImage ? !mode.includes("text") : null,
          };
        });
      }),
    );
    res.status(200).send(success(result.flat()));
  },
);
