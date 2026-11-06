/**
 * MCP manager — browser half.
 *
 * Registers an "MCP" tab on the Plugins page (list, skills, install, edit,
 * enable/disable, delete) and an "MCP" control in the composer's left slot
 * that selects which installed servers the current task may use.
 *
 * All colors, radii and elevations come from the host's --dsw-* tokens, so
 * every surface follows the active light/dark theme; the theme subscription
 * additionally sets `color-scheme` for native controls.
 */
window.__ModuleLoader__.load({
  id: '@local/mcp-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback } = React
    const { createPortal } = require('react-dom')

    /** Locale namespace for this plugin's dictionaries. */
    const NS = 'mcpManager'
    /** Host route of this plugin; the leading slash anchors it to the origin. */
    const API_URL = '/api/mcp-manager'

    let clientCtx

    // ------------------------------------------------------------- dictionary

    const DICTS = {
      en: {
        'tab.label': 'MCP',
        'page.title': 'MCP servers',
        'page.subtitle': 'Servers installed into this profile; each row is one entry of the managed list or another bundle.',
        'page.refresh': 'Refresh',
        'page.loading': 'Loading…',
        'page.empty': 'No MCP servers installed yet.',
        'page.emptyHint': 'Install a server below, then pick it for a task from the composer.',
        'page.error': 'Failed to load: {error}',
        'page.retry': 'Retry',
        'page.install': 'Install MCP server',
        'page.installing': 'Installing…',
        'page.installed': 'Installed server “{name}”. It connects in the background.',
        'page.installFailed': 'Installation failed: {error}',
        'page.toggled': 'Saved.',
        'page.toggleFailed': 'Could not save: {error}',
        'page.updated': 'Configuration saved.',
        'page.updateFailed': 'Could not save the configuration: {error}',
        'page.deleted': 'Removed server “{name}”.',
        'page.deletedBundle': 'Removed bundle “{name}” from this profile.',
        'page.deleteFailed': 'Could not remove: {error}',
        'row.enable': 'Enable this server',
        'row.disable': 'Disable this server',
        'row.disabled': 'Disabled',
        'row.external': 'External',
        'row.phase': 'Status: {phase}',
        'row.noEndpoint': 'no endpoint configured',
        'row.envKeys': 'env keys: {keys}',
        'row.headerKeys': 'header keys: {keys}',
        'row.edit': 'Edit',
        'row.delete': 'Delete',
        'row.deleteConfirm': 'Confirm delete',
        'skills.label': 'Skills',
        'skills.showAll': 'Show all {n}',
        'skills.collapse': 'Collapse',
        'skills.offline': 'No tools yet — the server connects in the background.',
        'skills.disabledNote': 'Disabled, so it currently offers no tools.',
        'form.title': 'New server',
        'form.editTitle': 'Edit server',
        'form.serverName': 'Server name',
        'form.serverNameHint': 'A–Z, a–z, 0–9, “_” and “-”, up to 32 characters. Tools appear as mcp__<name>__<tool>.',
        'form.transport': 'Transport',
        'form.stdio': 'stdio (local command)',
        'form.http': 'Streamable HTTP',
        'form.command': 'Command',
        'form.args': 'Arguments',
        'form.argsHint': 'Space-separated, for example: -y @modelcontextprotocol/server-everything',
        'form.cwd': 'Working directory (optional)',
        'form.env': 'Environment (optional)',
        'form.envHint': 'One KEY=VALUE per line.',
        'form.url': 'Endpoint URL',
        'form.headers': 'Headers (optional)',
        'form.headersHint': 'One Name: Value per line.',
        'form.failOnStartup': 'Fail startup when the first connection fails',
        'form.install': 'Install',
        'form.save': 'Save',
        'form.cancel': 'Cancel',
        'form.missing': 'Fill in the required fields first.',
        'form.loading': 'Reading the configuration…',
        'picker.button': 'MCP',
        'picker.title': 'MCP servers for this task',
        'picker.allOption': 'All installed servers',
        'picker.empty': 'No MCP servers installed.',
        'picker.hint': 'Unselected servers are hidden from this task and their calls are refused.',
        'picker.error': 'Failed: {error}',
        'picker.open': 'Choose which MCP servers this task may use',
      },
      zh: {
        'tab.label': 'MCP',
        'page.title': 'MCP 服务器',
        'page.subtitle': '已安装到当前配置的服务器；每行来自受管列表或其他插件包。',
        'page.refresh': '刷新',
        'page.loading': '加载中…',
        'page.empty': '还没有安装任何 MCP 服务器。',
        'page.emptyHint': '在下方安装服务器，然后可在输入框为任务选择它。',
        'page.error': '加载失败：{error}',
        'page.retry': '重试',
        'page.install': '安装 MCP 服务器',
        'page.installing': '安装中…',
        'page.installed': '已安装服务器“{name}”，正在后台建立连接。',
        'page.installFailed': '安装失败：{error}',
        'page.toggled': '已保存。',
        'page.toggleFailed': '保存失败：{error}',
        'page.updated': '配置已保存。',
        'page.updateFailed': '配置保存失败：{error}',
        'page.deleted': '已删除服务器“{name}”。',
        'page.deletedBundle': '已从配置中移除插件包“{name}”。',
        'page.deleteFailed': '删除失败：{error}',
        'row.enable': '启用该服务器',
        'row.disable': '禁用该服务器',
        'row.disabled': '已禁用',
        'row.external': '外部',
        'row.phase': '状态：{phase}',
        'row.noEndpoint': '未配置连接地址',
        'row.envKeys': '环境变量：{keys}',
        'row.headerKeys': '请求头：{keys}',
        'row.edit': '编辑',
        'row.delete': '删除',
        'row.deleteConfirm': '确认删除',
        'skills.label': '技能',
        'skills.showAll': '显示全部 {n} 个',
        'skills.collapse': '收起',
        'skills.offline': '暂无工具 —— 服务器正在后台连接。',
        'skills.disabledNote': '已禁用，当前不提供任何工具。',
        'form.title': '新服务器',
        'form.editTitle': '编辑服务器',
        'form.serverName': '服务器名称',
        'form.serverNameHint': '仅限 A–Z、a–z、0–9、“_”与“-”，最多 32 个字符；工具名形如 mcp__<名称>__<工具>。',
        'form.transport': '传输方式',
        'form.stdio': 'stdio（本地命令）',
        'form.http': 'Streamable HTTP',
        'form.command': '命令',
        'form.args': '参数',
        'form.argsHint': '以空格分隔，例如：-y @modelcontextprotocol/server-everything',
        'form.cwd': '工作目录（可选）',
        'form.env': '环境变量（可选）',
        'form.envHint': '每行一个 KEY=VALUE。',
        'form.url': '接口地址',
        'form.headers': '请求头（可选）',
        'form.headersHint': '每行一个“名称: 值”。',
        'form.failOnStartup': '首次连接失败时启动失败',
        'form.install': '安装',
        'form.save': '保存',
        'form.cancel': '取消',
        'form.missing': '请先填写必填项。',
        'form.loading': '正在读取配置…',
        'picker.button': 'MCP',
        'picker.title': '本任务可用的 MCP 服务器',
        'picker.allOption': '全部已安装服务器',
        'picker.empty': '还没有安装 MCP 服务器。',
        'picker.hint': '未选择的服务器不会出现在本任务中，其调用会被拒绝。',
        'picker.error': '出错：{error}',
        'picker.open': '选择本任务可使用的 MCP 服务器',
      },
    }

    function fill(text, params) {
      return String(text).replace(/\{(\w+)\}/gu, (whole, key) =>
        Object.prototype.hasOwnProperty.call(params ?? {}, key) ? String(params[key]) : whole,
      )
    }

    function translate(props, key, params) {
      const t = props && typeof props.t === 'function' ? props.t : undefined
      let text
      if (t) text = t(key)
      else if (clientCtx) text = clientCtx.locale.bind(NS)(key)
      if (text === undefined || text === key || text === '') {
        const locale = clientCtx ? clientCtx.locale.getLocale().locale : 'en'
        const dict = String(locale).startsWith('zh') ? DICTS.zh : DICTS.en
        text = dict[key] ?? DICTS.en[key] ?? key
      }
      return params ? fill(text, params) : text
    }

    /** Re-render on locale changes; returns a translate function. */
    function useT(props) {
      const [, bump] = useState(0)
      useEffect(() => {
        if (!clientCtx) return undefined
        return clientCtx.locale.subscribe(() => bump((value) => value + 1))
      }, [])
      return useCallback((key, params) => translate(props, key, params), [props])
    }

    /** The active theme id ('dark' / 'light' / …) so native controls can follow. */
    function schemeOf(snapshot) {
      const id = String(snapshot?.id ?? snapshot?.themeId ?? snapshot?.theme ?? snapshot?.preference ?? '')
      return /dark/iu.test(id) ? 'dark' : 'light'
    }

    function useColorScheme() {
      const [scheme, setScheme] = useState(() => schemeOf(clientCtx?.theme?.getTheme?.()))
      useEffect(() => {
        if (!clientCtx) return undefined
        setScheme(schemeOf(clientCtx.theme.getTheme()))
        return clientCtx.on('theme/change', (snapshot) => setScheme(schemeOf(snapshot)))
      }, [])
      return scheme
    }

    // -------------------------------------------------------------------- api

    async function call(action, params) {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(params ?? {}) }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (!data.ok) throw new Error(data.error || 'request failed')
      return data.value
    }

    // ----------------------------------------------------------------- styles

    const STYLE = `
.mcpm-page { display: flex; flex-direction: column; gap: 14px; color: var(--dsw-alias-label-primary); }
.mcpm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mcpm-title { font-size: 16px; line-height: 24px; font-weight: 500; margin: 0; color: var(--dsw-alias-label-primary); }
.mcpm-sub { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); margin: 4px 0 0; max-width: 72ch; }
.mcpm-actions { display: flex; gap: 8px; flex-shrink: 0; }
.mcpm-btn { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 28px; padding: 0 10px; border: none; border-radius: var(--dsw-radius-sm); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary); background: transparent; cursor: pointer; }
.mcpm-btn:disabled { cursor: not-allowed; opacity: 0.4; }
.mcpm-btn.mcpm-hover:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.mcpm-btn.mcpm-outline { border: 0.5px solid transparent; box-shadow: inset 0 0 0 var(--dsh-hairline-width, 0.5px) var(--dsh-button-outline-color, var(--dsw-alias-border-l3)); }
.mcpm-btn.mcpm-primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.mcpm-btn.mcpm-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.mcpm-btn.mcpm-danger { color: var(--dsw-alias-state-error-primary); }
.mcpm-error { font-size: 13px; line-height: 20px; color: var(--dsw-alias-state-error-primary); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.mcpm-notice { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.mcpm-list { display: flex; flex-direction: column; gap: 8px; }
.mcpm-row { display: flex; align-items: center; gap: 12px; padding: 12px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); }
.mcpm-row.mcpm-off { opacity: 0.72; }
.mcpm-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--dsw-alias-state-idle-primary); }
.mcpm-dot.mcpm-ok { background: var(--dsw-alias-state-success-primary); }
.mcpm-dot.mcpm-bad { background: var(--dsw-alias-state-error-primary); }
.mcpm-dot.mcpm-busy { background: var(--dsw-alias-state-warn-primary); }
.mcpm-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.mcpm-name { font-size: 14px; line-height: 22px; font-weight: 500; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.mcpm-badge { font-size: 11px; line-height: 16px; font-weight: 500; padding: 0 7px; border-radius: var(--dsw-radius-sm); border: 0.5px solid var(--dsw-alias-border-l4); color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
.mcpm-badge.mcpm-warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.mcpm-meta { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mcpm-skills { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mcpm-skills-label { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-dimmed); }
.mcpm-chip { font-size: 11.5px; line-height: 18px; padding: 0 8px; border-radius: 999px; border: 0.5px solid var(--dsw-alias-border-l4); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: default; }
.mcpm-chip:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.mcpm-more { font: inherit; font-size: 11.5px; line-height: 18px; padding: 0 6px; border: none; background: transparent; color: var(--dsw-alias-brand-primary); cursor: pointer; border-radius: var(--dsw-radius-sm); }
.mcpm-more:hover { background: var(--dsw-alias-interactive-bg-hover); }
.mcpm-skills-note { font-size: 11.5px; line-height: 18px; color: var(--dsw-alias-label-dimmed); }
.mcpm-ops { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.mcpm-switch { position: relative; box-sizing: border-box; flex: 0 0 auto; width: 36px; height: 20px; padding: 2px; border: 0; border-radius: 999px; background: var(--dsw-alias-border-l3); cursor: pointer; }
.mcpm-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary); }
.mcpm-switch:disabled { cursor: default; opacity: 0.5; }
.mcpm-switch:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.mcpm-switch .mcpm-thumb { display: block; width: 16px; height: 16px; border-radius: 50%; background: var(--dsw-alias-switch-thumb); transition: transform 120ms ease; }
.mcpm-switch[aria-checked='true'] .mcpm-thumb { background: var(--dsw-alias-label-primary-foreground); transform: translateX(16px); }
.mcpm-empty { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); border: 0.5px dashed var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); padding: 20px; text-align: center; display: flex; flex-direction: column; gap: 4px; }
.mcpm-form { border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.mcpm-form-title { font-size: 14px; line-height: 22px; font-weight: 500; }
.mcpm-field { display: flex; flex-direction: column; gap: 5px; }
.mcpm-field label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.mcpm-field .mcpm-hint { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-dimmed); }
.mcpm-input, .mcpm-select, .mcpm-textarea { box-sizing: border-box; font-family: inherit; font-size: 14px; line-height: 22px; padding: 4px 8px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); width: 100%; outline: none; }
.mcpm-input:focus, .mcpm-select:focus, .mcpm-textarea:focus { border-color: var(--dsw-alias-state-business-primary); }
.mcpm-input::placeholder, .mcpm-textarea::placeholder { color: var(--dsw-alias-label-dimmed); }
.mcpm-select { appearance: auto; }
.mcpm-textarea { min-height: 72px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 19px; }
.mcpm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.mcpm-check { display: flex; gap: 8px; align-items: center; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); cursor: pointer; }
.mcpm-check input { flex: 0 0 auto; width: 16px; height: 16px; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: inherit; }
.mcpm-form-actions { display: flex; justify-content: flex-end; gap: 8px; }
.mcpm-trigger { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; min-width: 0; max-width: 220px; height: 28px; padding: 0 4px 0 8px; gap: 4px; border: none; outline: none; border-radius: var(--dsw-radius-sm); background: transparent; color: var(--dsw-alias-label-secondary); font-size: 13px; font-weight: 500; line-height: 20px; cursor: pointer; }
@media (hover: hover) { .mcpm-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); } }
.mcpm-trigger:focus-visible { box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); }
.mcpm-trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-active); }
.mcpm-pop { position: fixed; z-index: 1000; width: 300px; overflow: auto; box-sizing: border-box; background: var(--dsw-alias-bg-layer-2); border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-panel); box-shadow: var(--dsw-elevation-prominent); padding: 12px; display: flex; flex-direction: column; gap: 10px; color: var(--dsw-alias-label-primary); }
.mcpm-pop-title { font-size: 13px; line-height: 20px; font-weight: 500; }
.mcpm-pop-list { display: flex; flex-direction: column; gap: 2px; }
.mcpm-option { display: flex; gap: 9px; align-items: center; padding: 7px 8px; border-radius: var(--dsw-radius-sm); cursor: pointer; font-size: 13px; line-height: 20px; }
.mcpm-option:hover { background: var(--dsw-alias-interactive-bg-hover); }
.mcpm-option.mcpm-option-off { opacity: 0.55; cursor: default; }
.mcpm-option input { flex: 0 0 auto; width: 16px; height: 16px; margin: 0; accent-color: var(--dsw-alias-brand-primary); }
.mcpm-option .mcpm-option-meta { font-size: 11.5px; color: var(--dsw-alias-label-secondary); margin-left: auto; }
.mcpm-pop-hint { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-secondary); border-top: 0.5px solid var(--dsw-alias-border-l1); padding-top: 8px; }
.mcpm-skeleton { display: flex; flex-direction: column; gap: 8px; }
.mcpm-skeleton > div { height: 48px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-2); animation: mcpm-pulse 1.4s ease-in-out infinite; }
@keyframes mcpm-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
.mcpm-modal-root { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: max(24px, var(--dsh-frame-overlay-top, 24px)) 24px; }
.mcpm-modal-mask { position: absolute; inset: 0; background: var(--dsw-alias-bg-mask-1); backdrop-filter: var(--dsw-mask-blur); }
.mcpm-modal { position: relative; z-index: 1; box-sizing: border-box; display: flex; flex-direction: column; width: min(560px, 100%); max-height: 100%; overflow: auto; border-radius: var(--dsw-radius-panel); background: var(--dsw-alias-bg-layer-2); box-shadow: var(--dsw-elevation-prominent); }
.mcpm-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 22px 14px 12px 24px; }
.mcpm-modal-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.mcpm-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--dsw-radius-sm); background: transparent; cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 16px; }
.mcpm-modal-close:hover { background: var(--dsw-alias-interactive-bg-hover); }
.mcpm-modal-body { display: flex; flex-direction: column; gap: 12px; padding: 8px 24px 0; min-width: 0; }
.mcpm-modal-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 16px 24px 24px; }
`

    const PHASE_TONE = {
      active: 'mcpm-ok',
      failed: 'mcpm-bad',
      pending: 'mcpm-busy',
      loading: 'mcpm-busy',
      unloading: 'mcpm-busy',
      disabled: '',
    }

    const EMPTY_FORM = {
      serverName: '',
      transport: 'stdio',
      command: '',
      args: '',
      cwd: '',
      env: '',
      url: '',
      headers: '',
      failOnStartupError: false,
    }

    /** Round-trip between a raw row config and the editable form fields. */
    function formFromConfig(config) {
      const stdio = config.transport !== 'streamable-http'
      const lines = (map, separator) =>
        Object.entries(map && typeof map === 'object' ? map : {})
          .map(([key, value]) => `${key}${separator}${value}`)
          .join('\n')
      return {
        serverName: typeof config.serverName === 'string' ? config.serverName : '',
        transport: stdio ? 'stdio' : 'streamable-http',
        command: typeof config.command === 'string' ? config.command : '',
        args: Array.isArray(config.args) ? config.args.join(' ') : '',
        cwd: typeof config.cwd === 'string' ? config.cwd : '',
        env: lines(config.env, '='),
        url: typeof config.url === 'string' ? config.url : '',
        headers: lines(config.headers, ': '),
        failOnStartupError: config.failOnStartupError === true,
      }
    }

    // ------------------------------------------------------------------- form

    function McpForm(props) {
      const { t, initial, busy, error, submitLabel, onSubmit, onCancel } = props
      const [form, setForm] = useState(initial)
      const [localError, setLocalError] = useState('')
      const set = (key) => (event) =>
        setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))
      const stdio = form.transport === 'stdio'
      const submit = () => {
        if (!form.serverName.trim() || (stdio ? !form.command.trim() : !form.url.trim())) {
          setLocalError(t('form.missing'))
          return
        }
        setLocalError('')
        onSubmit(form)
      }
      const shownError = localError || error
      return h(
        'div',
        { className: 'mcpm-form' },
        h(
          'div',
          { className: 'mcpm-grid' },
          h(
            'div',
            { className: 'mcpm-field' },
            h('label', null, t('form.serverName')),
            h('input', { className: 'mcpm-input', value: form.serverName, onChange: set('serverName'), placeholder: 'github' }),
            h('span', { className: 'mcpm-hint' }, t('form.serverNameHint')),
          ),
          h(
            'div',
            { className: 'mcpm-field' },
            h('label', null, t('form.transport')),
            h(
              'select',
              { className: 'mcpm-select', value: form.transport, onChange: set('transport') },
              h('option', { value: 'stdio' }, t('form.stdio')),
              h('option', { value: 'streamable-http' }, t('form.http')),
            ),
          ),
        ),
        stdio
          ? h(
              'div',
              { className: 'mcpm-grid' },
              h(
                'div',
                { className: 'mcpm-field' },
                h('label', null, t('form.command')),
                h('input', { className: 'mcpm-input', value: form.command, onChange: set('command'), placeholder: 'npx' }),
              ),
              h(
                'div',
                { className: 'mcpm-field' },
                h('label', null, t('form.args')),
                h('input', { className: 'mcpm-input', value: form.args, onChange: set('args') }),
                h('span', { className: 'mcpm-hint' }, t('form.argsHint')),
              ),
              h(
                'div',
                { className: 'mcpm-field' },
                h('label', null, t('form.cwd')),
                h('input', { className: 'mcpm-input', value: form.cwd, onChange: set('cwd') }),
              ),
              h(
                'div',
                { className: 'mcpm-field' },
                h('label', null, t('form.env')),
                h('textarea', { className: 'mcpm-textarea', value: form.env, onChange: set('env') }),
                h('span', { className: 'mcpm-hint' }, t('form.envHint')),
              ),
            )
          : h(
              'div',
              { className: 'mcpm-grid' },
              h(
                'div',
                { className: 'mcpm-field' },
                h('label', null, t('form.url')),
                h('input', { className: 'mcpm-input', value: form.url, onChange: set('url'), placeholder: 'http://127.0.0.1:3000/mcp' }),
              ),
              h(
                'div',
                { className: 'mcpm-field' },
                h('label', null, t('form.headers')),
                h('textarea', { className: 'mcpm-textarea', value: form.headers, onChange: set('headers') }),
                h('span', { className: 'mcpm-hint' }, t('form.headersHint')),
              ),
            ),
        h(
          'label',
          { className: 'mcpm-check' },
          h('input', { type: 'checkbox', checked: form.failOnStartupError, onChange: set('failOnStartupError') }),
          h('span', null, t('form.failOnStartup')),
        ),
        shownError ? h('div', { className: 'mcpm-error', role: 'alert' }, shownError) : null,
        h(
          'div',
          { className: 'mcpm-form-actions' },
          h(
            'button',
            { type: 'button', className: 'mcpm-btn mcpm-outline mcpm-hover', onClick: onCancel, disabled: busy },
            t('form.cancel'),
          ),
          h(
            'button',
            { type: 'button', className: 'mcpm-btn mcpm-primary', onClick: submit, disabled: busy },
            busy ? t('page.installing') : submitLabel,
          ),
        ),
      )
    }

    // -------------------------------------------------------------- list page

    function McpPage() {
      const t = useT({})
      const scheme = useColorScheme()
      const [rows, setRows] = useState(null)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [busyId, setBusyId] = useState('')
      const [showCreate, setShowCreate] = useState(false)
      const [createBusy, setCreateBusy] = useState(false)
      const [createError, setCreateError] = useState('')
      const [editing, setEditing] = useState(null)
      const [editForm, setEditForm] = useState(null)
      const [editError, setEditError] = useState('')
      const [editBusy, setEditBusy] = useState(false)
      const [confirmId, setConfirmId] = useState('')
      const [expanded, setExpanded] = useState('')

      const load = useCallback(async () => {
        setError('')
        try {
          const value = await call('list')
          setRows(value.rows)
        } catch (loadError) {
          setError(loadError.message)
        }
      }, [])

      useEffect(() => {
        load()
      }, [load])

      // The delete confirmation resets on its own so a stray click cannot
      // delete later without a fresh intent.
      useEffect(() => {
        if (!confirmId) return undefined
        const timer = window.setTimeout(() => setConfirmId(''), 4000)
        return () => window.clearTimeout(timer)
      }, [confirmId])

      // The edit dialog closes on Escape while it is open.
      useEffect(() => {
        if (!editing) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setEditing(null)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [editing])

      const openEdit = async (row) => {
        setEditing(row)
        setEditForm(null)
        setEditError('')
        try {
          const value = await call('getConfig', { id: row.id })
          setEditForm(formFromConfig(value.config))
        } catch (loadError) {
          setEditError(loadError.message)
        }
      }

      const toggle = async (row) => {
        setBusyId(row.id)
        setNotice('')
        setError('')
        try {
          const value = await call('setEnabled', { id: row.id, enabled: row.disabled })
          const result = value.result ?? {}
          const extra =
            result.nextStep ??
            (typeof result.application === 'string' && result.application !== 'applied' ? result.application : '')
          setNotice(extra ? `${t('page.toggled')} ${extra}` : t('page.toggled'))
          await load()
        } catch (toggleError) {
          setError(t('page.toggleFailed', { error: toggleError.message }))
        } finally {
          setBusyId('')
        }
      }

      const create = async (form) => {
        setCreateBusy(true)
        setCreateError('')
        try {
          await call('install', form)
          setNotice(t('page.installed', { name: form.serverName.trim() }))
          setShowCreate(false)
          window.setTimeout(() => load(), 1200)
        } catch (installError) {
          setCreateError(t('page.installFailed', { error: installError.message }))
        } finally {
          setCreateBusy(false)
        }
      }

      const saveEdit = async (form) => {
        setEditBusy(true)
        setEditError('')
        try {
          await call('update', { id: editing.id, ...form })
          setNotice(t('page.updated'))
          setEditing(null)
          await load()
        } catch (saveError) {
          setEditError(t('page.updateFailed', { error: saveError.message }))
        } finally {
          setEditBusy(false)
        }
      }

      const remove = async (row) => {
        if (confirmId !== row.id) {
          setConfirmId(row.id)
          return
        }
        setBusyId(row.id)
        setNotice('')
        setError('')
        try {
          const value = await call('remove', { id: row.id })
          setConfirmId('')
          setNotice(value.removed === 'bundle' ? t('page.deletedBundle', { name: value.bundle }) : t('page.deleted', { name: row.serverName ?? row.id }))
          await load()
        } catch (removeError) {
          setConfirmId('')
          setError(t('page.deleteFailed', { error: removeError.message }))
        } finally {
          setBusyId('')
        }
      }

      const total = rows ? rows.length : 0
      return h(
        'div',
        { className: 'mcpm-page', style: { colorScheme: scheme } },
        h('style', null, STYLE),
        h(
          'div',
          { className: 'mcpm-head' },
          h(
            'div',
            null,
            h('h3', { className: 'mcpm-title' }, t('page.title')),
            h('p', { className: 'mcpm-sub' }, t('page.subtitle')),
          ),
          h(
            'div',
            { className: 'mcpm-actions' },
            h(
              'button',
              { type: 'button', className: 'mcpm-btn mcpm-outline mcpm-hover', onClick: () => load(), disabled: rows === null },
              t('page.refresh'),
            ),
            h(
              'button',
              { type: 'button', className: 'mcpm-btn mcpm-outline mcpm-hover', onClick: () => setShowCreate((value) => !value) },
              t('page.install'),
            ),
          ),
        ),
        error
          ? h(
              'div',
              { className: 'mcpm-error', role: 'alert' },
              fill(t('page.error'), { error }),
              h('button', { type: 'button', className: 'mcpm-btn mcpm-hover', onClick: () => load() }, t('page.retry')),
            )
          : null,
        notice ? h('div', { className: 'mcpm-notice', role: 'status' }, notice) : null,
        showCreate
          ? h(McpForm, {
              t,
              initial: EMPTY_FORM,
              busy: createBusy,
              error: createError,
              submitLabel: t('form.install'),
              onSubmit: create,
              onCancel: () => {
                setShowCreate(false)
                setCreateError('')
              },
            })
          : null,
        rows === null
          ? h('div', { className: 'mcpm-skeleton', 'aria-label': t('page.loading') }, h('div', null), h('div', null), h('div', null))
          : total === 0
            ? h('div', { className: 'mcpm-empty' }, h('span', null, t('page.empty')), h('span', null, t('page.emptyHint')))
            : h('div', { className: 'mcpm-list' }, rows.map((row) => renderRow(row))),
        editing ? renderEditModal() : null,
      )

      function renderSkills(row) {
        const tools = Array.isArray(row.tools) ? row.tools : []
        if (row.disabled) return h('div', { className: 'mcpm-skills' }, h('span', { className: 'mcpm-skills-note' }, t('skills.disabledNote')))
        if (tools.length === 0) return h('div', { className: 'mcpm-skills' }, h('span', { className: 'mcpm-skills-note' }, t('skills.offline')))
        const open = expanded === row.id
        const shown = open ? tools : tools.slice(0, 8)
        return h(
          'div',
          { className: 'mcpm-skills' },
          h('span', { className: 'mcpm-skills-label' }, t('skills.label')),
          shown.map((tool) => {
            const prefix = `mcp__${row.serverName ?? ''}__`
            const short = row.serverName && tool.name.startsWith(prefix) ? tool.name.slice(prefix.length) : tool.name
            return h('span', { key: tool.name, className: 'mcpm-chip', title: tool.description || tool.name }, short)
          }),
          tools.length > 8
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mcpm-more',
                  onClick: () => setExpanded(open ? '' : row.id),
                },
                open ? t('skills.collapse') : fill(t('skills.showAll'), { n: tools.length }),
              )
            : null,
        )
      }

      function renderRow(row) {
        const busy = busyId === row.id
        const tone = PHASE_TONE[row.phase] ?? ''
        const confirming = confirmId === row.id
        return h(
          'div',
          { key: row.id, className: `mcpm-row${row.disabled ? ' mcpm-off' : ''}` },
          h('span', { className: `mcpm-dot ${row.disabled ? '' : tone}`, 'aria-hidden': 'true' }),
          h(
            'div',
            { className: 'mcpm-main' },
            h(
              'div',
              { className: 'mcpm-name' },
              h('span', null, row.serverName ?? row.id),
              row.transport ? h('span', { className: 'mcpm-badge' }, row.transport) : null,
              row.managed === false ? h('span', { className: 'mcpm-badge' }, t('row.external')) : null,
              row.disabled ? h('span', { className: 'mcpm-badge mcpm-warn' }, t('row.disabled')) : null,
              row.phase && !row.disabled ? h('span', { className: 'mcpm-badge' }, row.phase) : null,
            ),
            h('div', { className: 'mcpm-meta', title: row.endpoint ?? '' }, row.endpoint || t('row.noEndpoint')),
            row.envKeys.length || row.headerKeys.length
              ? h(
                  'div',
                  { className: 'mcpm-meta' },
                  [
                    row.envKeys.length ? fill(t('row.envKeys'), { keys: row.envKeys.join(', ') }) : '',
                    row.headerKeys.length ? fill(t('row.headerKeys'), { keys: row.headerKeys.join(', ') }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · '),
                )
              : null,
            renderSkills(row),
          ),
          h(
            'div',
            { className: 'mcpm-ops' },
            h(
              'button',
              {
                type: 'button',
                className: 'mcpm-btn mcpm-hover',
                disabled: busy,
                onClick: () => openEdit(row),
              },
              t('row.edit'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mcpm-btn mcpm-hover mcpm-danger',
                disabled: busy,
                onClick: () => remove(row),
              },
              confirming ? t('row.deleteConfirm') : t('row.delete'),
            ),
            h(
              'button',
              {
                type: 'button',
                role: 'switch',
                'aria-checked': String(!row.disabled),
                'aria-label': row.disabled ? t('row.enable') : t('row.disable'),
                className: 'mcpm-switch',
                disabled: busy,
                onClick: () => toggle(row),
              },
              h('span', { className: 'mcpm-thumb', 'aria-hidden': 'true' }),
            ),
          ),
        )
      }

      function renderEditModal() {
        const row = editing
        return createPortal(
          h(
            'div',
            { className: 'mcpm-modal-root', style: { colorScheme: scheme } },
            h('style', null, STYLE),
            h('div', { className: 'mcpm-modal-mask', onMouseDown: () => setEditing(null) }),
            h(
              'div',
              { className: 'mcpm-modal', role: 'dialog', 'aria-modal': 'true' },
              h(
                'div',
                { className: 'mcpm-modal-head' },
                h('h3', { className: 'mcpm-modal-title' }, `${t('form.editTitle')} · ${row.serverName ?? row.id}`),
                h(
                  'button',
                  { type: 'button', className: 'mcpm-modal-close', 'aria-label': t('form.cancel'), onClick: () => setEditing(null) },
                  '×',
                ),
              ),
              h(
                'div',
                { className: 'mcpm-modal-body' },
                editForm === null
                  ? h('div', { className: 'mcpm-notice' }, editError || t('form.loading'))
                  : h(McpForm, {
                      t,
                      initial: editForm,
                      busy: editBusy,
                      error: editError,
                      submitLabel: t('form.save'),
                      onSubmit: saveEdit,
                      onCancel: () => setEditing(null),
                    }),
              ),
            ),
          ),
          document.body,
        )
      }
    }

    // ------------------------------------------------------------ task picker

    function McpPicker(props) {
      const t = useT(props)
      const scheme = useColorScheme()
      const sessionId = props && props.sessionId
      const [open, setOpen] = useState(false)
      const [rows, setRows] = useState([])
      const [selection, setSelection] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const [position, setPosition] = useState({ left: 0, top: 0, up: false, maxHeight: 240 })
      const triggerRef = useRef(null)
      const popRef = useRef(null)

      const openPicker = useCallback(async () => {
        setOpen(true)
        setError('')
        const anchor = triggerRef.current
        if (anchor) {
          const rect = anchor.getBoundingClientRect()
          const width = 300
          const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
          const below = window.innerHeight - rect.bottom - 12
          const above = rect.top - 12
          // The composer sits at the frame bottom, so the list usually opens
          // upward; either way the panel must fit in the space that exists.
          const up = below < 260 && above > below
          const maxHeight = Math.max(160, (up ? above : below) - 8)
          setPosition({ left, up, maxHeight, top: rect.bottom + 6, bottom: window.innerHeight - rect.top + 6 })
        }
        try {
          const [installed, current] = await Promise.all([
            call('list'),
            sessionId ? call('getSelection', { sessionId }) : Promise.resolve({ servers: null }),
          ])
          setRows(installed.rows)
          setSelection(current.servers)
        } catch (loadError) {
          setError(loadError.message)
        }
      }, [sessionId])

      useEffect(() => {
        if (!open) return undefined
        const onOutside = (event) => {
          if (popRef.current && popRef.current.contains(event.target)) return
          if (triggerRef.current && triggerRef.current.contains(event.target)) return
          setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        const onMove = () => setOpen(false)
        document.addEventListener('mousedown', onOutside)
        document.addEventListener('keydown', onKey)
        window.addEventListener('resize', onMove)
        window.addEventListener('scroll', onMove, true)
        return () => {
          document.removeEventListener('mousedown', onOutside)
          document.removeEventListener('keydown', onKey)
          window.removeEventListener('resize', onMove)
          window.removeEventListener('scroll', onMove, true)
        }
      }, [open])

      const enabledRows = rows.filter((row) => !row.disabled)
      const servers = enabledRows.map((row) => row.serverName).filter(Boolean)
      const effective =
        selection === null || selection === undefined ? servers.slice() : selection.filter((name) => servers.includes(name))

      const commit = async (next) => {
        if (!sessionId || busy) return
        setBusy(true)
        setError('')
        try {
          const value = await call('setSelection', { sessionId, servers: next })
          setSelection(value.servers)
        } catch (commitError) {
          setError(commitError.message)
        } finally {
          setBusy(false)
        }
      }

      return h(
        React.Fragment,
        null,
        h('style', null, STYLE),
        h(
          'button',
          {
            type: 'button',
            ref: triggerRef,
            className: 'mcpm-trigger',
            'aria-haspopup': 'true',
            'aria-expanded': String(open),
            title: t('picker.open'),
            onClick: () => (open ? setOpen(false) : openPicker()),
          },
          h('span', null, t('picker.button')),
        ),
        open
          ? createPortal(
              h(
                'div',
                {
                  ref: popRef,
                  className: 'mcpm-pop',
                  style: {
                    colorScheme: scheme,
                    left: `${position.left}px`,
                    maxHeight: `${position.maxHeight}px`,
                    ...(position.up ? { bottom: `${position.bottom}px` } : { top: `${position.top}px` }),
                  },
                  role: 'group',
                  'aria-label': t('picker.title'),
                },
                h('div', { className: 'mcpm-pop-title' }, t('picker.title')),
                error ? h('div', { className: 'mcpm-error', role: 'alert' }, fill(t('picker.error'), { error })) : null,
                rows.length === 0
                  ? h('div', { className: 'mcpm-notice' }, t('picker.empty'))
                  : h(
                      'div',
                      { className: 'mcpm-pop-list' },
                      h(
                        'label',
                        { className: 'mcpm-option' },
                        h('input', {
                          type: 'checkbox',
                          checked: servers.length > 0 && effective.length >= servers.length,
                          disabled: busy || servers.length === 0,
                          onChange: () => commit(null),
                        }),
                        h('span', null, t('picker.allOption')),
                      ),
                      rows.map((row) => {
                        const server = row.serverName ?? row.id
                        const checked = !row.disabled && effective.includes(server)
                        return h(
                          'label',
                          { key: row.id, className: `mcpm-option${row.disabled ? ' mcpm-option-off' : ''}` },
                          h('input', {
                            type: 'checkbox',
                            checked,
                            disabled: busy || row.disabled,
                            onChange: () => commit(checked ? effective.filter((name) => name !== server) : [...effective, server]),
                          }),
                          h('span', null, server),
                          row.disabled
                            ? h('span', { className: 'mcpm-option-meta' }, t('row.disabled'))
                            : row.transport
                              ? h('span', { className: 'mcpm-option-meta' }, row.transport)
                              : null,
                        )
                      }),
                    ),
                h('div', { className: 'mcpm-pop-hint' }, t('picker.hint')),
              ),
              document.body,
            )
          : null,
      )
    }

    // ------------------------------------------------------------------- wiring

    return {
      inject: ['slots', 'locale', 'theme'],
      apply(ctx) {
        clientCtx = ctx
        ctx.effect(
          () => {
            const disposeEn = ctx.locale.register('mcpManager', 'en', DICTS.en)
            const disposeZh = ctx.locale.register('mcpManager', 'zh', DICTS.zh)
            return () => {
              try {
                disposeEn()
              } catch {}
              try {
                disposeZh()
              } catch {}
            }
          },
          'mcp-manager: dictionaries',
        )
        ctx.effect(
          () =>
            ctx.slots.inject('plugins.tab', () =>
              ctx.slots.register(
                { name: 'plugins.tab', id: 'mcp-manager', order: 60, label: () => translate(undefined, 'tab.label') },
                McpPage,
              ),
            ),
          'mcp-manager: plugins tab',
        )
        ctx.effect(
          () =>
            ctx.slots.inject('conversation.input.left', () =>
              ctx.slots.register({ name: 'conversation.input.left', id: 'mcp-selector', order: 50 }, McpPicker),
            ),
          'mcp-manager: composer picker',
        )
      },
    }
  },
})
