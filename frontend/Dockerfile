# dev 镜像：只负责装依赖，源码由 compose bind mount 挂载（见根目录 docker-compose.yml）
FROM node:22-alpine

WORKDIR /app

# 配置国内镜像源加速下载
ENV npm_config_registry=https://registry.npmmirror.com

# 固定与本仓库 lockfile（lockfileVersion 9.0）匹配的 pnpm 版本
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# 配置 pnpm 使用国内镜像源
RUN pnpm config set registry https://registry.npmmirror.com

# 只拷贝依赖清单 —— 源码变更无需重建镜像，依赖变更才需要
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]
