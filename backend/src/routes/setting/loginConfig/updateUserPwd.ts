import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { hashPassword } from "@/lib/password";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    name: z.string(),
    password: z.string(),
    id: z.number(),
  }),
  async (req, res) => {
    const { name, password, id } = req.body;
    // 落库前哈希（此前是明文）；传空串表示「只改名、不改密码」
    const next: Record<string, string> = { name };
    if (password) next.password = hashPassword(password);
    await u.db("o_user").where("id", id).update(next);
    res.status(200).send(success("保存设置成功"));
  },
);
