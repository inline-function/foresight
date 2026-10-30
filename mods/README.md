# mods/ —— 深谋远虑模组目录约定

foresight 本体是**模组加载器**：顶栏/底栏/面板的一切文案与数据都从模组 JSON 读，
本体不含具体政策/属性内容。构建期 `scripts/gen-mods.js` 扫描本目录并烘焙为
`app/mods-data.subl`（浏览器静态页无法运行时列目录，故扫描发生在构建期；
应用启动时从烘焙表装载=“启动扫描”）。

## 目录约定

```
mods/<modid>/
  mod.json        元信息（id/name/version/deps）+ 玩家归属 + 时间配置
  entities.json   实体数据（schema 见下）
  logic/*.subl    模组附着逻辑（占位；执行待 t84 内置解释器）
```

## mod.json

| 字段 | 说明 |
|---|---|
| id / name / version / deps | 模组标识、显示名、版本、依赖声明位（预留） |
| player.country | 玩家国家名（顶栏主标题，全不透明） |
| player.faction | 玩家派系 id（顶栏副标题弱透明；控制政策解锁数据位） |
| time.era | 时期名（时间显示前缀，模组数据驱动） |
| time.startYear / startMonth | 起始年月 |
| time.monthsPerTick | 每 tick 推进月数 |
| time.tickSeconds | tick 秒数（“慢一点的实时制”：内置 tick 计数，呈现为年月） |

## entities.json schema（本体起草）

```
countries:   [{id, name}]              国家（地块归属解析）
factions:    [{id, name, desc}]        派系（影响政策解锁）
ui:          {basic, tree, attrs, blocks}  四个底栏面板按钮的文案（缺失则回退内置默认）
policiesBasic: [{id, name, desc, faction, on}]   基本政策（开关型；on=默认开）
policiesTree:  [{id, name, requires, faction}]   国家政策（树状解锁占位：前置+派系数据位）
attrs:         [{id, name, value, max}]          国家属性数值面板
blocks:        [{id, name, owner}]               地块（命名/归属驱动演示地图三地块）
```

派系解锁为**预留数据位**：面板渲染把 `faction` 显示为标签，
`factionUnlocks(rowFaction, playerFaction)` 目前恒真（不实现玩法，等 logic/*.subl 接通）。

## 内置示例

`mods/example/`（近现代感、不写大内容）让顶栏底栏有数据可显、面板有东西可点，
即冒烟验收形态。多模组并列时本体取烘焙表第一个为活动模组（选择 UI 待后续）。
