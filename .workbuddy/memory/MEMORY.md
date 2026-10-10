# Tolaria 项目长期笔记

## 协作方式（2026-10-09 用户明确约定）
- **Agent 负责改代码，用户负责测试与验收。** Agent 不要反复跑测试套件刷屏，也不要为「证明自己没引入失败」而做大范围对照实验。
- 改动完成后：说明改了哪些文件、怎么启动/怎么看效果、还剩什么待办即可。测试结果由用户在真机上反馈。
- 项目工作区经常处于**未提交的半成品重构状态**（多会话/多轮交叉修改），因此 git status 里出现非本次改动的文件是常态，不必逐一排查归因，简单标注即可。
- ⚠️ **多会话并行改同一仓库**：自己的改动"消失"时，先查 `docs/adr/` 有没有新增推翻它的 ADR，别当成回归去"修复"（2026-10-09 踩过：我把被有意回退的 `noteTree.ts` 又改回树感知版）。

## 树结构与图标 —— **ADR 0190 已推翻 ADR 0188 / 0185**
- `docs/adr/0190-markdown-only-portable-note-tree.md` 原文：*Supersedes ADR 0188's vault-tree sidecar storage decision; restores the frontmatter ownership from ADR 0185*。
- 即：树结构与图标**回到 Markdown frontmatter**（`_parent_note` / `_icon`），`tolaria/config/tree.yml` 侧车方案作废。按 0188 落地的前端链路（`vaultTree.ts`、`noteTree.ts` 树感知版）可能已被有意回退。
- 仍有效的基础事实：`attachments/` 已在 `tolaria/` 下；`views/` 与 `type/*.md`、`AGENTS.md`/`CLAUDE.md`/`GEMINI.md` 留在 vault 根；托管目录名单在 `src/utils/managedVaultPaths.ts`。
- **ADR 编号有坑**：目录里 `0188` 被两个 ADR 占用（tree.yml 与 offline-embedded-mind-maps），且 README 索引落后于实际文件（0190/0191 未索引）。取编号前先 `ls docs/adr/`。

## 本机环境
- Rust 工具链在 `~/.cargo/bin`（不在 PATH）；`cargo test --lib` 在 Windows 上可跑，`--all-targets` 需先修 Unix-only 测试。
- 前端：`npx tsc -p tsconfig.app.json --noEmit`、`npx vitest run <path>`、`npx vite --port 5199`。
- **dev 端口固定 5202**（`vite.config.ts` 的 `server.strictPort: true`，`tauri.conf.json` 的 `devUrl: http://localhost:5202`）。别再起第二个 vite，会直接报端口占用。
- **重启应用**：vite dev server 与桌面应用是两个独立进程，杀掉 `tolaria.exe` 不影响 vite（它仍服务 5202）。
  应用 = `src-tauri/target/debug/tolaria.exe`（debug 内置 devUrl，前端改动 HMR 即生效，无需 cargo 重建）。
  ⚠️ 从 Agent 会话里启动它有两个坑：① 必须让它以**自身目录为工作目录**（`cd src-tauri/target/debug` 后直接跑），否则秒退；
  ② `cmd //c start` / `explorer.exe` 方式启动的会被会话清理掉，只有作为**后台任务**跑起来才稳定存活（窗口标题 Tolaria，`tasklist /V` 可验）。
  启动时日志会报 `reg.exe 被安全策略拦截`（本机 Program Blacklist），**属正常噪声、不致命**。应用日志：`%LOCALAPPDATA%\club.refactoring.tolaria.dev\logs\Tolaria Dev.log`（**时间戳是 UTC**）。

## 嵌入式块（durable block）架构 —— 新增一类块要动 5 处
模板：drawio（ADR 0187）、tldraw、mermaid、mindmap、html、sheet（ADR 0192）走同一套管线。
1. `src/utils/xxxMarkdown.ts` —— 导出 `DurableBlockCodec`：`tokenPrefix/tokenSuffix`、`readFenceMetadata`、`buildPayload`、`decodePayload`、`buildBlock`（payload→BlockNote 块，含 props）、`readCodeBlock`、`isBlock`、`serializeBlock`（块→```xxx 围栏）。
2. `src/components/xxxBlockSpec.ts` —— `createReactBlockSpec({ type, propSchema, content: 'none' }, { runsBefore: ['codeBlock'], meta: { selectable: false }, render })`。
3. `src/components/editorSchema.tsx` —— 注册 `blockSpecs`。
4. `src/utils/editorDurableMarkdown.ts` —— 加入 `EDITOR_DURABLE_MARKDOWN_CODECS` 数组。
5. `src/components/tolariaEditorFormattingConfig.ts` —— `getTolariaSlashMenuItems` 里加 `createBlockSlashMenuItem`（含 key/title/aliases/type/props/eventName）。
- 管线三层：`preProcessDurableMarkdownBlocks`（围栏→`@@TOKEN@@`）→ BlockNote 解析 → `injectDurableMarkdownBlocks`（token 段落 **或** 同语言 codeBlock → `buildBlock`）；反向 `serializeDurableMarkdownBlocks`（`isBlock` → `serializeBlock`）。
- `splitMarkdownLines` 用 `/[^\n]*(?:\n|$)/g` **保留换行符**，所以 `buildPayload` 用 `lines.slice(start+1,end).join('')` 能重建原文（不是 join('\n')）。
- 存储原则（ADR 0187）：数据随文档走，序列化为 fenced code block，**不产生 sidecar/config/attachment 文件**；外部 Markdown 工具能读到原文但不会渲染。

## 表格与电子表格（三条独立链路，别混淆）
- **Markdown 表格**：md 管道语法 → 自研 `parseTable`（`src/hooks/editorFastMarkdownBlocks.ts:327`）→ BlockNote 原生 `table` 块，块内就地编辑。斜杠 `/table` 可用（默认项未被 `UNSUPPORTED_SLASH_MENU_KEYS` 禁用）。写回 `blocksToMarkdownDirect`（`src/utils/blockNoteDirectMarkdown.ts:521`）。
- **Sheet 笔记（整文件）**：`_display: sheet` frontmatter（`src/utils/noteFormat.ts`）+ 正文 CSV，由 `SheetEditor.tsx` 用 **IronCalc**（`@ironcalc/workbook`，WASM，带公式）整文件渲染。
- **Sheet 块（嵌入式，ADR 0192）**：见下节。
- 只读渲染（AI 消息）走 `MarkdownContent.tsx` = react-markdown + remark-gfm；注意 `MODERN_REGEX_AVAILABLE` 门控 —— 环境不支持 lookbehind 时 `remarkGfm` **整个不加载**，表格降级为纯文本（见 `MarkdownContent.webkit.test.tsx`）。

## 嵌入式电子表格块（ADR 0192，2026-10-09 实现）
- ⚠️ 需求表述反复过一轮：用户先说「复用现有 md 表格块」，随即澄清**要的是 Sheet 那种 Excel 手感的表格，不是 `table`**。最终落地为 `sheetBlock`。
- `sheetBlock` = 把整文件 Sheet 用的 `SheetEditor`（IronCalc）**内联进块**，可拖拽调整大小（右缘/下缘/右下角手柄，最小 280×200，默认宽随编辑器、高 360px）+ 自身滚动，**块内直接编辑**（用户明确不要弹窗）。
- 尺寸持久化在围栏信息行：```sheet 640x420（0 = 未设置），`readSheetFenceInfo` 解析；props 为 `document`/`width`/`height`。
- ⚠️ **IronCalc 画布尺寸只在它自己渲染时量一次**（`Xv.setContext` 写死 canvas 宽高），且只响应**浏览器窗口** resize。块自身变大不会触发重测量 → 下方留白、行数不变。修法：`SheetEditor` 的 `viewportSize` 入参 → `SheetWorkbookSurface` 尺寸变化时 bump `refreshId`（`workbook.refreshId + gridMeasureEpoch`）强制重渲染重测量。整文件 Sheet 不传该入参。
- 文件：`src/utils/sheetMarkdown.ts`（codec，围栏 ```` ```sheet ````）／`src/components/SheetBlock.tsx`／`src/components/sheetBlockSpec.ts`／`src/components/SheetBlock.css`。
- 数据：围栏内容 = sheet 文档本身（CSV 正文，可带 `---` 元数据块存列宽/格式），块 props 名 `document`。**整文件 Sheet 与块内内容可互相复制**。
- 懒加载：`SheetBlock.tsx` 内 `lazy(() => import('./SheetEditor'))` —— 与 `editor-content/EditorContentLayout.tsx:84` 一致。**别静态 import `SheetEditor`**，否则 WASM 引擎进主包。
- 回写：`editor.updateBlock(id, {props:{document}})` + `dispatchRichEditorExternalChange(editor)`（照 drawio）。`useSheetWorkbookController` 的 `shouldSkipWorkbookRebuild` 靠 `content === lastEmittedContentRef` 去重，**天然避免「回写→重建」循环**。
- `SheetEditor` 复用要点：props 为 `content`(CSV/文档) / `path`(仅作 workbook 名与去重键，块内传 `sheet-block/<blockId>`) / `onContentChange(path, content)` / `locale`(用 `useDocumentLocale()` from `markdownHighlightControlState`)。`entries`/`vaultPath`/`sourceEntry` 有默认值。
- 已知限制：每块一个 IronCalc model（多表笔记内存上升，卸载时 free）；块内不传 vault entries → 跨笔记公式 / wikilink 单元格不可用；序列化走编辑器 450ms debounce，窗口内切笔记可能丢最后一次编辑。

## 内联数据表块（ADR 0193，2026-10-09 二次实现：**块自持数据**）
- 需求走过两版：① 先做的「行 = 笔记、列 = frontmatter 的集合视图」被用户明确否掉（*「我要的是可编辑的数据存储，不是笔记的数据表」*）→ ② 重做为 **`viewTableBlock`：数据存在块里**。
- `viewTableBlock`（围栏 ```` ```view ````，别名 `database`/`db`/`data`；斜杠 `/view`，别名 数据库/数据表/视图）= 带类型列的记录表，**数据在围栏 JSON 里，不读也不写任何别的笔记**。
- 围栏体 = JSON：`{title?, columns:[{id,name,type,width?,options?}], filters?:[{id,columnId,op,value}], sort?:{columnId,direction}, rows:[{列id: 值}], height?}`。**行 = 「列 id → 值」映射**（改列名不破坏数据）；行没有 id，位置即身份。删列会同步清掉所有行里的该键，以及指向它的 filter/sort。
- 列类型（`ViewTableColumnType`）：`text`/`number`/`date`/`checkbox`/`select`/`multiSelect`/`url`。**改类型会重新规范化该列全部单元格**（`changeViewTableColumnType`），并把该列上「新类型表达不了」的 filter op 换成新类型的第一个 op。
- 排序/筛选：`setViewTableSort`（列菜单里升序/降序/清除 + 工具条 chip）与 `addViewTableFilter`/`updateViewTableFilter`/`removeViewTableFilter`（工具条「筛选」popover，AND 组合）。**都写进围栏**（不是显示态），重开笔记保留。`viewTableVisibleRows(data, search)` = 过滤 → 搜索 → 排序，返回 `{row, index}`（index 是**原始行号**，保证编辑仍落到正确的行）；排序稳定（原始序号 tie-break），**空值恒排最后**（两个方向都是）；值的比较用 `compareViewTableCells`（number 走数值、checkbox 走 false<true、其余 `localeCompare{numeric:true}`）。**filter 的 value 为空时视为不生效**，否则输一半就会把行全藏起来。
- 校验/降级：非 JSON 或 >200k 字符 → 保持 codeBlock（保留原围栏语言，走 `payload.language`）；规范化上限 50 列 / 2000 行 / 20 条 filter，坏列·坏单元格·坏选项静默丢弃。
- 编辑面：行 增/删/复制/上下移（行首菜单）、列 增/删/左右移/改名/改类型/改选项/拖拽列宽、单元格按类型编辑、排序、筛选、行内搜索（搜索是瞬态、不入围栏）、`height` 可手写固定高度。
- 文本类单元格 = 本地草稿 + blur/Enter 提交（避免每键一次 `updateBlock`）；`select`/`multiSelect` 用 Popover，输入自定义值会**同时**写进列的 `options`。
- 🔴 **块内事件必须用「原生监听器」隔离，React 的 stopPropagation 无效**：ProseMirror 的 `mousedown` handler（`prosemirror-view` 的 `handlers.mousedown`）会重设选区并重聚焦编辑器 → 输入框一点就失焦、Radix popover 被 focus-outside 关掉。React 的事件委托挂在 app root，**在编辑器元素之上**，所以 `onMouseDown` 里的 `stopPropagation` 永远慢一步。`ViewTableBlock` 的 `useIsolatedBlockEvents` 在**块根上挂原生冒泡监听器**（mousedown/mouseup/dblclick/contextmenu/drag*/beforeinput/paste/copy/cut/key*/touch*）并就地 stopPropagation —— 块根在编辑器元素**内部**，所以先于 ProseMirror 被调用。**故意不拦** `click`/`pointerdown`/`pointerup`/`input`/`focus*`（Radix popover、复选框、列宽手柄、React `onChange` 都靠它们）。代价：块内 React **冒泡阶段**的 handler 对上述事件收不到，**块内的 keydown 必须用 `onKeyDownCapture`**；Popover 里的控件不受影响（portal 在块外）。
- 文件：`src/utils/viewTableModel.ts`（模型·规范化·序列化·行列/filter/sort 纯函数）／`src/utils/viewTableMarkdown.ts`（codec）／`src/components/ViewTableBlock.tsx`／`src/components/view-table/{ViewTableGrid,ViewTableCell,ViewTableColumnMenu,ViewTableToolbar,columnTypes}`／`src/components/ViewTableBlock.css`／`src/components/viewTableBlockSpec.ts`／ADR `docs/adr/0193-inline-data-table-markdown-block.md`。
- ⚠️ 上一版（集合视图）的 `viewBlockConfig.ts`／`viewBlockData.ts`／`viewMarkdown.ts`／`ViewBlock.tsx`／`viewBlockActions.tsx` 与 `Editor`/`useEditorContentModel`/`EditorContentLayout` 里下传的 `onUpdateProperty`/`onCreateNote`/`onOpenNote` **已全部删除**，别照旧记忆去找。
- ⚠️ 与 `sheetBlock` 的分工：sheet = 自由网格 + 公式（IronCalc）；viewTable = 带类型列的记录表，无公式。两者都自持数据、都嵌在笔记内。

## 编辑器表格样式（`EditorTheme.css:1030`）
- 该段依赖 `--table-border-color` / `--table-header-background` / `--table-cell-padding-vertical|horizontal` / `--table-font-size`，**这 5 个变量全项目无定义、无动态注入** → 除 `text-align: start` 与 `.selectedCell::after` 的 inset 外，整段被浏览器丢弃，表格外观实际由 @blocknote/mantine 默认样式决定。若要调表格外观，根因在此。
