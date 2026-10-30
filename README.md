# 深谋远虑（foresight）

历史剧情策略向游戏的**工程骨架**，用 [Sublimation for Game](../sublimation%20for%20game)（SfG）构建：
Sublimation 语言写的场景逻辑（`app/*.subl`），编译到浏览器（`--target=browser`），
KAPLAY 渲染，三段载入的壳工程跑起来。**单仓库自包含**——引擎源码全部内联在本仓：

| 目录 | 内容 | 来源 |
| --- | --- | --- |
| `app/` | SfG 游戏库声明（game/geo/input/sprite/loop/camera/collision）+ 冒烟场景（main/smoke-data） | SfG 仓 `app/` 对应文件 + 本仓新写 |
| `core/` | Sublimation 标准库源码（zfc/collection/string/real/…，browser 目标剔除 net） | 编译器仓 `core/` 副本 |
| `js/game-runtime.js` | 桥接层：`__SG_OPS` 注册表 + `globalThis.__subl.call(op, args)` 单入口分派 | SfG 壳工程内联 |
| `vendor/kaplay.js` | KAPLAY 3001.0.19 **补丁版**（CJK 字体图集分桶 + 精灵纹理强制 NEAREST） | GameDemo 补丁版逐字节内联 |
| `vendor/fonts/` | Maple Mono Normal CN 三个字重 | GameDemo 内联 |
| `scripts/build.ps1` | 编译链 + 打包 | 本仓新写 |
| `test/smoke.js` | Node 冒烟测试（KAPLAY 桩，无浏览器） | 本仓新写 |

> 方向：本体将是**模组加载器**（mods/&lt;modid&gt;/ 下 mod.json + entities.json + logic/*.subl，
> 启动扫描；内置最小示例模组），内容全由模组驱动——骨架阶段不涉及，见后续任务。

## 构建

需要本机的工具链（路径均有默认值，可覆盖）：

```bat
powershell -ExecutionPolicy Bypass -File scripts\build.ps1
```

链路：`sublimation.jar compile`（--target=browser，S-1 形态产物）→ `-p game.subs`
注解处理器做 `@game` op 白名单校验（笔误挡在编译期）→ 打包到 `build/game/`。

产物 `build/game/` 是自包含网页（index.html + app.js + js/ + vendor/ + fonts/）：

```bat
cd build\game
python -m http.server 8080
```

浏览器开 `http://localhost:8080/`（静态服务器即可；file:// 下字体加载依浏览器而异，建议走 http）。

## 冒烟场景

`index.html` 三段载入（KAPLAY → 桥运行时 → 编译产物）后调 `__subl.main()`
（S-1 装载模型：装载与执行分离）。场景（`app/main.subl`）为**纯技术验证**，无剧情玩法：

- 标题屏「深谋远虑」+ 提示标签；
- 三地块地图（凹形 / 菱形 / 带洞，验 mapLoad 烘焙、tint 渲染、射线法命中、多环 even-odd）；
- 点击地块选中（换金 + 标签）、拖拽平移（钳制）、滚轮以光标为锚缩放。

## 测试

```bat
node test\smoke.js
```

Node 桩冒烟（S-1 装载、mapLoad 烘焙、标题屏、点击选中、缩放/平移）。
