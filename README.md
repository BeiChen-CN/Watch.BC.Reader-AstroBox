# BcReader AstroBox Plugin

将电子书传输到小米手环的 AstroBox 插件。

## 使用

1. 在 AstroBox 插件设置中打开 BcReader
2. 点击"选择电子书"按钮
3. 选择 TXT 文件
4. 等待传输完成

## 通信协议

插件通过 Interconnect API 与快应用 `Watch.BC.Reader` 通信，使用与 BcReader Android 应用相同的协议。

## 项目结构

```
src/
  ├── entry.ts           # 主入口
  ├── types.ts           # 类型定义
  ├── interconnect.ts    # Interconnect 通信
  ├── fileHandler.ts     # 文件处理
  ├── transferManager.ts # 传输管理
  └── ui.ts              # UI 管理
```
=======
# Rspack project

## Setup

Install the dependencies:

```bash
npm install
```

## Get started

Start the dev server, and the app will be available at [http://localhost:8080](http://localhost:8080).

```bash
npm run dev
```

Build the app for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Learn more

To learn more about Rspack, check out the following resources:

- [Rspack documentation](https://rspack.dev) - explore Rspack features and APIs.
- [Rspack GitHub repository](https://github.com/web-infra-dev/rspack) - your feedback and contributions are welcome!
>>>>>>> 13c5b78b3f69faeea6119872264bc7b6b55ee482
