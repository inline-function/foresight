# mods/ —— 《深谋远虑》模组目录约定与叙事引擎 schema

foresight 本体是**模组加载器 + 叙事引擎**：顶栏/底栏/面板/章节/事件的一切文案与数据
都从模组 JSON 读，本体不含具体剧情与数值内容。构建期 `scripts/gen-mods.js` 扫描本目录
并烘焙为 `app/mods-data.subl`（浏览器静态页无法运行时列目录，故扫描发生在构建期；
应用启动时从烘焙表装载 = "启动扫描"）。

## 目录约定

```
mods/<modid>/
  mod.json        元信息（id/name/version/deps）+ 玩家归属 + 时间配置
  entities.json   实体与叙事数据（schema 见下）
  logic/*.subl    模组附着逻辑（占位；执行待 t84 内置解释器）
```

## mod.json

| 字段 | 说明 |
|---|---|
| id / name / version / deps | 模组标识、显示名、版本、依赖声明位（预留） |
| player.country | 玩家国家名（顶栏主标题，全不透明） |
| player.faction | 玩家派系 id（顶栏副标题弱透明） |
| time.era | 时期名（时间显示前缀，模组数据驱动） |
| time.startYear / startMonth / startDay | 起始年月日（**回合计：tick = 1 天**，顶栏按天推进） |
| time.daysPerTick | 每 tick 推进天数（预留，当前固定 1） |

## 叙事引擎（六段 tick 循环）

引擎为**回合制非实时钟**（无 every 计时器）：结算后直接进入下一 tick。

```
 1. tick 开始：顶栏年月日按天推进 + 资源按 perTick 产出 + 状态自然变化
 2. 玩家操作阶段：操作面板按章切换内容（行动点 2~4，每项消耗 1 点，
    可不操作；行动点用完自动结算）
 3. 事件触发阶段：按 tick 序数 / 条件 / 副线筛选，事件卡 / 沉浸式 / 超事件
    按优先级入队
 4. 玩家处理事件：事件卡点击选项；沉浸式/超事件逐行继续
 5. 结算：应用效果 + 章末判定（tick 预算用尽，或 end.when 条件）
 6. 下一 tick（章末由演出 dateJump 跳日期后开新章）
```

## entities.json schema

```
countries:   [{id, name}]                    国家（地块归属解析）
factions:    [{id, name, desc}]              派系
ui:          {ops, policy, attrs, blocks, gameOver}
                                             底栏四按钮文案（缺失回退内置默认）
blocks:      [{id, name, owner}]             控制地块（命名/归属驱动演示地图三地块）

resources:   [{id, name, start, max, produce}]
                                             资源：初值/上限/每 tick 产出
                                             （顶栏显示前 3 项；国家属性面板全列）
policies:    [{id, name, desc, requires[], effects[]}]
                                             国策树：前置链 + 效果；面板示
                                             [已行]/[可解]/[锁定]，点击解锁

chapters:    [{id, act, name, ticks, ap, perTick[], ops[], end}]
  act/name         幕名/章名（操作面板标题与章末演出引用）
  ticks            tick 预算（章节内 tick 数；用尽或 end.when 满足即章末）
  ap               行动点上限（2~4）
  perTick[]        每 tick 自动效果（产出/状态自然变化）
  ops[]            操作页列表
    [{id, name, desc, status[], options[]}]
      status[]     页头状态条引用的资源 id
      options[]    [{id, name, desc, effects[]}]  互斥 radio 组
  end              {when[], next, dateJump, effects[], lines[]}
    when[]         章末附加条件（空数组 = 仅看 tick 预算）
    next           下一章序号；-1 = 篇终
    dateJump       {y, m, d} 章末演出跳转到的开幕日
    lines[]        章末超事件逐行文本（JSON 数组）

events:      [{id, kind, title, when[], priority, once, ...}]
  kind             "card"（事件卡：标题+内容+选项）
                   "imm"（沉浸式：背景+立绘+对话逐行+继续）
                   "super"（超事件：全屏黑底逐行，BGM 挂载点，强制暂停整屏输入）
  when[]           触发条件（AND 语义；空数组恒真）：
                     {op:"tick", n}      tick 序数相等
                     {op:"tickGte", n}   tick 序数 >= n
                     {op:"flag", v}      已置 flag
                     {op:"flagNot", v}   未置 flag
                     {op:"resGte", v, n} 资源 >= n
                     {op:"resLte", v, n} 资源 <= n
  priority         优先级（覆盖 kind 默认值：super 30 / imm 20 / card 10；
                   队列按 30->0 降序，同优先级按 JSON 声明序）
  once             true=一次性（默认 true；false=条件满足可重复触发）
  card:            content + options[{name, effects[]}]
  imm:             bg, portrait（缺失渲染【缺图】占位框）, lines[]
  super:           bgm（音频挂载点；缺失静默不抛）, lines[]
```

## effects[] 效果语法

```
{op:"flagSet", v}      置 flag（仪表盘/事件条件/国策前置共用）
{op:"flagClear", v}    清 flag
{op:"res", v, n}       资源增减 n（可为负；clamp 到 [0, max]）
```

## 持久化与音频（宿主桥 SfG op，非 @game 白名单）

模组经 `__subl.call(op, args)` 调用（t84 解释器交付前仅测试模组可用）：

- `saveLoad(name, json) / saveGet(name) / saveKeys() / saveDrop(name)`
  模组 JSON 存档：浏览器 localStorage（键前缀 `__sg_save_`），回落内存。
- `bgmMount(name) / bgmPlay(name) / bgmStop()`
  音乐接入点：Audio 循环播放；资产缺失静默（返回 false 不抛）。
```

## 现有模组

- `modern-example/`：近现代示例（引擎冒烟测试用；非正式剧情）。
  正式剧情模组按 `mods/lieyan/`（烈焰升腾，队长编写）规划。
