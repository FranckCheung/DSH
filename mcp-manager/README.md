# dsh-mcp-manager

[English](#english) | [中文](#中文)

<a id="english"></a>

## English

A plugin for [DSH (DeepSeek Harness)](https://www.deepseek.com) that manages the MCP (Model Context Protocol) servers configured in the current profile, and lets each task choose which installed MCPs it may use.

### Features

- **Inventory** — lists every MCP server configured in the profile, regardless of where it was installed from, with live status and its tools (skills).
- **Install** — add an MCP server by name and transport (stdio or streamable-http) with command, arguments, environment, URL, and headers; the server is registered in the profile immediately.
- **Enable / disable** — one switch per server, applied live to new tasks.
- **Edit / delete** — edit a server's configuration in a dialog, or remove it completely from the device. External rows installed by other bundles are only removed through their owning bundle, so nothing is deleted behind the user's back.
- **Task-level MCP selection** — a compact "MCP" button beside the conversation input opens a picker where you choose which MCP servers the current task may use; the selection is enforced on tool calls.

### Install

From a DSH plugin index (Discover tab), or manually: download this repository and tell your DSH agent to install the bundle from the package directory (`plugin_manager install_bundle <path-to-dsh-mcp-manager>`).

### Notes

- The plugin stores no connection data: each device's MCP server list lives in its own profile.
- Environment and header values are never listed in the inventory; full values are only read when you open the edit dialog.
- Session selections are in memory and reset on restart (a task then allows all installed servers).

## 中文

<a id="中文"></a>

DSH（DeepSeek Harness）插件：管理当前 profile 配置的 MCP（Model Context Protocol）服务器，并可在任务中选择允许使用的 MCP。

### 功能

- **总览**：列出 profile 中全部 MCP 服务器（无论从哪里安装），显示运行状态与所提供的工具（skills）。
- **安装**：按名称与传输方式（stdio 或 streamable-http）添加 MCP 服务器，支持命令、参数、环境变量、URL、请求头，立即注册进 profile。
- **启用 / 禁用**：每个服务器一个开关，对新任务即时生效。
- **编辑 / 删除**：弹窗编辑服务器配置，或从设备彻底移除。由其他 bundle 安装的外部条目只通过其属主 bundle 移除，绝不在用户不知情时删除。
- **任务级 MCP 选择**：输入框旁的「MCP」按钮打开选择器，指定当前任务允许使用哪些 MCP 服务器，工具调用时强制执行。

### 安装

从 DSH 插件市场（Discover 页）安装；或手动：下载本仓库，让 DSH 的 agent 从包目录安装 bundle（`plugin_manager install_bundle <dsh-mcp-manager 目录>`）。

### 说明

- 插件本身不含连接数据：各设备的 MCP 服务器列表保存在各自 profile 中。
- 总览不显示环境变量与请求头的值；完整值只在打开编辑弹窗时读取。
- 会话内的选择仅存内存，重启后重置（任务默认允许全部已安装服务器）。

## License

[MIT](LICENSE)
