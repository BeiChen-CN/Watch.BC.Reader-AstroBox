# BcReader AstroBox Plugin

将电子书传输到小米手环的 AstroBox 插件。

## 功能特性

- 支持 TXT 格式电子书
- 自动章节分割
- 分块传输（10KB/块）
- 实时传输进度显示
- 与手环快应用 `Watch.BC.Reader` 通信

## 构建

```bash
pnpm install
pnpm build
```

## 安装

1. 构建插件生成 `dist/entry.js`
2. 将 `manifest.json` 和 `dist/entry.js` 打包
3. 在 AstroBox 中安装插件

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
