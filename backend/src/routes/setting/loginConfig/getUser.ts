import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
const router = express.Router();

export default router.get("/", async (req, res) => {
  // 只回 id 与账号名：password 现在是哈希，但没有任何界面需要它，回传纯属多余暴露
  const data = await u.db("o_user").select("id", "name").first();
  res.status(200).send(success(data));
});
