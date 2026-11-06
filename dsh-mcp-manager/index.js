/**
 * MCP manager — Host half.
 *
 * Provides the /api/mcp-manager endpoint for the browser half, manages the
 * managed entry list (`mcp-servers.json` through the nested `cordis:include`),
 * enables and disables rows through the plugin manager, and enforces the
 * per-task MCP selection with both a `tools/pre-execute` gate and per-agent
 * tool restrictions.
 */
const MCP_PACKAGE = '@deepseek-ai/dsh-mcp-client'
const INCLUDE_ID = 'local-mcp-servers'
/** The profile root Include owns every composed row, so ids address through it. */
const ROOT_INCLUDE_ID = 'include'
const API_PATH = '/api/mcp-manager'
const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/
const MCP_TOOL_PREFIX = 'mcp__'

/** Fields copied from a request into a server's row config. */
const STDIO_KEYS = ['command', 'args', 'cwd']
const HTTP_KEYS = ['url']

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/** Read a multi-line `KEY=VALUE` / `KEY: VALUE` block (or an object) into a string map. */
function normalizeKeyValue(input, separator) {
  const result = {}
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input)) {
      if (String(key).trim() !== '' && value !== null && value !== undefined) result[String(key).trim()] = String(value)
    }
    return result
  }
  if (typeof input !== 'string') return result
  for (const line of input.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    const at = text.indexOf(separator)
    if (at <= 0) continue
    const key = text.slice(0, at).trim()
    const value = text.slice(at + 1).trim()
    if (key) result[key] = value
  }
  return result
}

/** The server name a configured row publishes, when it has one. */
function serverOfConfig(config) {
  return typeof config?.serverName === 'string' && config.serverName ? config.serverName : undefined
}

/**
 * The server a model-facing MCP tool name belongs to: the longest installed
 * server name whose `mcp__<server>__` prefix matches, then the name's own
 * namespace as a fallback for tools whose row just disappeared.
 */
function serverOfToolName(name, servers) {
  if (typeof name !== 'string' || !name.startsWith(MCP_TOOL_PREFIX)) return undefined
  const rest = name.slice(MCP_TOOL_PREFIX.length)
  let best
  for (const server of servers) {
    if (rest.startsWith(`${server}__`) && (best === undefined || server.length > best.length)) best = server
  }
  if (best !== undefined) return best
  const at = rest.indexOf('__')
  return at <= 0 ? undefined : rest.slice(0, at)
}

export const inject = ['connection', 'pluginManager', 'tools', 'agents']

export function apply(ctx) {
  /** sessionId -> selected server names, or `null` for every installed server. */
  const selections = new Map()
  /** Live agent -> the bookkeeping that lifts its restriction. */
  const restrictions = new Map()
  let refreshing = false
  let disposed = false

  /**
   * The managed include tree: the `local-mcp-servers` row lives inside the
   * profile root Include, so its global id addresses through that tree. The
   * id scan covers deployments whose root Include carries another id.
   */
  function includeEntry() {
    try {
      return ctx.loader.resolve(`${ROOT_INCLUDE_ID}:${INCLUDE_ID}`)
    } catch {
      for (const candidate of ctx.loader.entries()) {
        if (candidate.options.id === INCLUDE_ID) return candidate
      }
      throw new Error('the managed MCP entry list is not ready yet; retry shortly')
    }
  }

  /** The managed include tree; throws until its entry has activated. */
  function includeTree() {
    const tree = includeEntry().subtree
    if (!tree) throw new Error('the managed MCP entry list is not ready yet; retry shortly')
    return tree
  }

  /**
   * Every installed MCP row in the whole Loader tree, whatever layer put it
   * there: the managed list, another bundle's patch, or a profile patch.
   * `managed` marks the rows this plugin owns in `mcp-servers.json`.
   */
  function rows() {
    const managedPrefix = `${ROOT_INCLUDE_ID}:${INCLUDE_ID}:`
    const result = []
    for (const entry of ctx.loader.entries()) {
      if (entry.options.name !== MCP_PACKAGE) continue
      const config = entry.options.config ?? {}
      result.push({
        entry,
        id: entry.id,
        localId: entry.options.id,
        managed: entry.id.startsWith(managedPrefix),
        // The effective state also covers a disabled parent row.
        disabled: entry.disabled,
        serverName: serverOfConfig(config),
        config,
      })
    }
    return result
  }

  /** Installed server names, used for tool-name and selection validation. */
  function installedServers() {
    return rows().map((row) => row.serverName).filter((name) => name !== undefined)
  }

  function selectionOf(sessionId) {
    return typeof sessionId === 'string' && selections.has(sessionId) ? selections.get(sessionId) : null
  }

  // ---------------------------------------------------------------- actions

  async function list() {
    const installed = new Map(rows().map((row) => [row.id, row]))
    // Tools already registered by every installed server, grouped by server:
    // this is the "skills" list a card shows.
    const servers = [...installed.values()].map((row) => row.serverName).filter((name) => name !== undefined)
    const byServer = new Map()
    for (const definition of ctx.tools.definitions()) {
      if (!definition.name.startsWith(MCP_TOOL_PREFIX)) continue
      const server = serverOfToolName(definition.name, servers)
      if (server === undefined) continue
      if (!byServer.has(server)) byServer.set(server, [])
      const description = typeof definition.description === 'string' ? definition.description.slice(0, 300) : ''
      byServer.get(server).push({ name: definition.name, description })
    }
    for (const tools of byServer.values()) tools.sort((a, b) => a.name.localeCompare(b.name))
    let plugins = []
    try {
      plugins = await ctx.get('pluginManager').listPlugins()
    } catch (error) {
      ctx.logger.warn('[mcp-manager] listPlugins failed: %s', messageOf(error))
    }
    const phases = new Map()
    for (const plugin of plugins) {
      const key = plugin.entryId ?? plugin.id
      const phase = plugin.fiberPhase ?? plugin.phase
      if (typeof key === 'string' && typeof phase === 'string') phases.set(key, phase)
    }
    return {
      rows: [...installed.values()].map((row) => {
        const config = row.config
        const endpoint = row.disabled
          ? undefined
          : config.transport === 'streamable-http'
            ? typeof config.url === 'string'
              ? config.url
              : undefined
            : typeof config.command === 'string'
              ? [config.command, ...(Array.isArray(config.args) ? config.args : [])].join(' ')
              : undefined
        return {
          id: row.id,
          localId: row.localId,
          managed: row.managed,
          serverName: row.serverName ?? null,
          transport: typeof config.transport === 'string' ? config.transport : null,
          endpoint: endpoint ?? null,
          cwd: typeof config.cwd === 'string' && config.cwd ? config.cwd : null,
          envKeys: config.env && typeof config.env === 'object' ? Object.keys(config.env) : [],
          headerKeys: config.headers && typeof config.headers === 'object' ? Object.keys(config.headers) : [],
          failOnStartupError: config.failOnStartupError === true,
          disabled: row.disabled,
          phase: phases.get(row.id) ?? null,
          tools: (row.serverName !== undefined ? byServer.get(row.serverName) : undefined) ?? [],
        }
      }),
    }
  }

  async function install(body) {
    const config = buildConfig(body)
    const existing = rows()
    if (existing.some((row) => row.serverName === config.serverName)) {
      throw new Error(`server "${config.serverName}" is already installed`)
    }
    const tree = includeTree()
    // The row id stays stable and readable; the include assigns it inside the
    // managed file, and its activation starts the connection.
    const id = `mcp-${config.serverName}`
    const entryId = await tree.create({ id, name: MCP_PACKAGE, config }, null)
    return { id: entryId, serverName: config.serverName }
  }

  function buildConfig(body) {
    const serverName = String(body?.serverName ?? '').trim()
    if (!SERVER_NAME_RE.test(serverName)) {
      throw new Error('serverName must be 1-32 characters of A-Z, a-z, 0-9, "_" or "-"')
    }
    const transport = body?.transport
    if (transport !== 'stdio' && transport !== 'streamable-http') {
      throw new Error('transport must be "stdio" or "streamable-http"')
    }
    const config = { serverName, transport }
    if (body?.failOnStartupError === true) config.failOnStartupError = true
    if (transport === 'stdio') {
      const command = String(body?.command ?? '').trim()
      if (!command) throw new Error('command is required for the stdio transport')
      config.command = command
      const args = Array.isArray(body?.args)
        ? body.args.map((value) => String(value))
        : String(body?.args ?? '')
            .split(/\s+/)
            .filter(Boolean)
      if (args.length) config.args = args
      for (const key of STDIO_KEYS) {
        if (key === 'command' || key === 'args') continue
        const value = String(body?.[key] ?? '').trim()
        if (value) config[key] = value
      }
      const env = normalizeKeyValue(body?.env, '=')
      if (Object.keys(env).length) config.env = env
    } else {
      const url = String(body?.url ?? '').trim()
      if (!/^https?:\/\/\S+$/u.test(url)) throw new Error('url must be an http(s) endpoint')
      config.url = url
      const headers = normalizeKeyValue(body?.headers, ':')
      if (Object.keys(headers).length) config.headers = headers
    }
    const timeout = Number(body?.toolCallTimeoutMs)
    if (Number.isFinite(timeout) && timeout > 0) config.toolCallTimeoutMs = Math.floor(timeout)
    return config
  }

  async function setEnabled(body) {
    const id = String(body?.id ?? '')
    const enabled = body?.enabled === true
    const match = rows().find((row) => row.id === id)
    if (!match) throw new Error(`no installed MCP row "${id}"`)
    const manager = ctx.get('pluginManager')
    const result = await manager.setPluginEnabled(id, enabled)
    return { result, enabled }
  }

  async function getSelection(body) {
    const sessionId = String(body?.sessionId ?? '')
    if (!sessionId) throw new Error('sessionId is required')
    return { servers: selectionOf(sessionId) }
  }

  async function setSelection(body) {
    const sessionId = String(body?.sessionId ?? '')
    if (!sessionId) throw new Error('sessionId is required')
    const installed = installedServers()
    let next
    if (body?.servers === null || body?.servers === undefined) {
      next = null
    } else {
      if (!Array.isArray(body.servers)) throw new Error('servers must be an array of server names or null')
      next = []
      for (const value of body.servers) {
        const server = String(value)
        if (!installed.includes(server)) throw new Error(`server "${server}" is not installed`)
        if (!next.includes(server)) next.push(server)
      }
      if (next.length >= installed.length) next = null
    }
    if (next === null) selections.delete(sessionId)
    else selections.set(sessionId, next)
    for (const agent of ctx.agents.list()) {
      if (agent.session && agent.session.id === sessionId) refreshRestriction(agent)
    }
    return { servers: next }
  }

  /** The complete raw config of one row, for the edit dialog. */
  async function getConfig(body) {
    const row = rows().find((candidate) => candidate.id === String(body?.id ?? ''))
    if (!row) throw new Error(`no installed MCP row "${String(body?.id ?? '')}"`)
    const raw = JSON.stringify(row.config ?? {})
    if (raw.includes('__jsExpr')) {
      throw new Error('this server uses loader expressions in its config; edit the file that declares it by hand')
    }
    return { id: row.id, config: row.config ?? {} }
  }

  /** Save an edited config: managed rows write their list file, other rows get a profile override. */
  async function updateRow(body) {
    const id = String(body?.id ?? '')
    const row = rows().find((candidate) => candidate.id === id)
    if (!row) throw new Error(`no installed MCP row "${id}"`)
    const config = buildConfig(body)
    if (config.serverName !== row.serverName && rows().some((other) => other.id !== id && other.serverName === config.serverName)) {
      throw new Error(`server "${config.serverName}" is already installed`)
    }
    if (row.managed) {
      await includeTree().update(row.localId, { config })
    } else {
      const editor = ctx.get('configEditor')
      if (!editor) throw new Error('editing an externally installed server needs the config editor service')
      await editor.edit(row.entry, () => config)
    }
    return { id, serverName: config.serverName }
  }

  /**
   * Remove one server completely. Managed rows leave the list file; a row a
   * bundle declares is removed with that bundle, refused when the bundle
   * carries anything else so a delete never takes neighbours with it.
   */
  async function removeRow(body) {
    const id = String(body?.id ?? '')
    const row = rows().find((candidate) => candidate.id === id)
    if (!row) throw new Error(`no installed MCP row "${id}"`)
    if (row.managed) {
      await includeTree().remove(row.localId)
      return { removed: 'managed', id }
    }
    const bundles = await ctx.get('pluginManager').listBundles()
    const owners = (bundles ?? []).filter(
      (bundle) =>
        Array.isArray(bundle.rows) &&
        bundle.rows.some(
          (declared) => declared.name === MCP_PACKAGE && (declared.id === row.localId || row.id.endsWith(`:${declared.id}`)),
        ),
    )
    if (owners.length === 0) {
      throw new Error('this server comes from a profile patch; remove its row from cordis.patch.yml by hand')
    }
    if (owners.length > 1) {
      throw new Error(`this server is declared by several bundles: ${owners.map((bundle) => bundle.name).join(', ')}`)
    }
    const owner = owners[0]
    const mcpRows = owner.rows.filter((declared) => declared.name === MCP_PACKAGE)
    if (mcpRows.length > 1) {
      throw new Error(`bundle "${owner.name}" declares ${mcpRows.length} MCP servers; remove that bundle from the Plugins page instead`)
    }
    const result = await ctx.get('pluginManager').removeBundle(owner.name)
    return { removed: 'bundle', bundle: owner.name, result }
  }

  async function dispatch(body) {
    switch (body?.action) {
      case 'list':
        return await list()
      case 'install':
        return await install(body)
      case 'getConfig':
        return await getConfig(body)
      case 'update':
        return await updateRow(body)
      case 'remove':
        return await removeRow(body)
      case 'setEnabled':
        return await setEnabled(body)
      case 'getSelection':
        return await getSelection(body)
      case 'setSelection':
        return await setSelection(body)
      default:
        throw new Error(`unknown action: ${String(body?.action)}`)
    }
  }

  async function onRequest(request) {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: 'request body must be JSON' }, 400)
    }
    try {
      return json({ ok: true, value: await dispatch(body) })
    } catch (error) {
      const message = messageOf(error)
      ctx.logger.warn('[mcp-manager] %s', message)
      return json({ ok: false, error: message })
    }
  }

  // ------------------------------------------------------------- task gate

  /** Names of global MCP tools the given selection must not see. */
  function denyNamesFor(selection) {
    const servers = installedServers()
    const names = []
    for (const definition of ctx.tools.definitions()) {
      if (!definition.name.startsWith(MCP_TOOL_PREFIX)) continue
      const server = serverOfToolName(definition.name, servers)
      if (server !== undefined && !selection.includes(server)) names.push(definition.name)
    }
    return names
  }

  function forgetAgent(agent) {
    const cleanup = restrictions.get(agent)
    if (!cleanup) return
    restrictions.delete(agent)
    try {
      cleanup()
    } catch (error) {
      ctx.logger.warn('[mcp-manager] lifting a restriction failed: %s', messageOf(error))
    }
  }

  /** Hide the unselected MCP tools from one agent, keeping bookkeeping in both owners. */
  function refreshRestriction(agent) {
    if (refreshing || disposed) return
    refreshing = true
    try {
      const sessionId = agent.session ? agent.session.id : undefined
      const selection = sessionId !== undefined ? selections.get(sessionId) : undefined
      if (!selection) {
        forgetAgent(agent)
        return
      }
      const deny = denyNamesFor(selection)
      const previous = restrictions.get(agent)
      const key = JSON.stringify(deny)
      if (previous && previous.key === key) return
      forgetAgent(agent)
      if (!deny.length) return
      // The agent context owns the restriction; this plugin also keeps its
      // disposer so either teardown removes it. `tools/change` emitted from
      // inside the restriction re-enters this function and stops at the key
      // comparison above, so the refresh cannot loop.
      const outer = agent.ctx.effect(() => {
        try {
          return agent.ctx.tools.restrict({ deny })
        } catch (error) {
          ctx.logger.warn('[mcp-manager] tools.restrict failed: %s', messageOf(error))
          return undefined
        }
      })
      const tracked = () => outer()
      tracked.key = key
      restrictions.set(agent, tracked)
    } catch (error) {
      ctx.logger.warn('[mcp-manager] refreshRestriction failed: %s', messageOf(error))
    } finally {
      refreshing = false
    }
  }

  function refreshSession(sessionId) {
    for (const agent of ctx.agents.list()) {
      if (agent.session && agent.session.id === sessionId) refreshRestriction(agent)
    }
  }

  ctx.on('agent/created', ({ agent }) => {
    refreshRestriction(agent)
  })

  ctx.on('agent/disposed', ({ agent }) => {
    forgetAgent(agent)
  })

  ctx.on('tools/change', () => {
    for (const agent of ctx.agents.list()) {
      if (agent.session && selections.has(agent.session.id)) refreshRestriction(agent)
    }
  })

  // The gate itself: even when a fresh tool escaped the snapshot the
  // restriction hides, the selection still refuses its execution. While the
  // managed list is briefly unavailable the gate stays open; the restriction
  // still hides the tools, and an unavailable include must not fail calls.
  ctx.on('tools/pre-execute', (exec, next) => {
    const agent = exec.agent
    if (!agent || !agent.session) return next()
    const selection = selections.get(agent.session.id)
    if (!selection) return next()
    let server
    try {
      server = serverOfToolName(exec.name, installedServers())
    } catch {
      return next()
    }
    if (server === undefined || selection.includes(server)) return next()
    return {
      kind: 'deny',
      reason: `MCP server "${server}" is not selected for this task; selected servers: ${
        selection.length ? selection.join(', ') : '(none)'
      }`,
    }
  })

  // --------------------------------------------------------------- endpoint

  ctx.inject(['connection'], (scope) => {
    scope.effect(
      () =>
        scope.connection.fetch.register({
          path: API_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: onRequest,
        }),
      `mcp-manager: ${API_PATH}`,
    )
  })

  ctx.effect(
    () => () => {
      disposed = true
      for (const agent of [...restrictions.keys()]) forgetAgent(agent)
    },
    'mcp-manager: teardown',
  )
}
