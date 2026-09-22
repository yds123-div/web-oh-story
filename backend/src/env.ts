// Web 环境：默认使用 dev
const env = process.env.NODE_ENV;
if (!env) {
  process.env.NODE_ENV = "dev";
  console.log(`[环境变量：${process.env.NODE_ENV}]`);
}
