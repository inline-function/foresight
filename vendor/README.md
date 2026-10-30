# vendor/

《深谋远虑》的第三方依赖。**不随上游自动更新**——本目录的 KAPLAY 是带补丁的定制构建。

## kaplay.js

- 版本基线：**KAPLAY 3001.0.19**（npm `kaplay`，MIT 许可，https://kaplayjs.com/ ）
- **来源：逐字节拷贝自 `GameDemo/vendor/kaplay.js`**（本机的 SfG 示范工程；与 SfG 仓
  `game-app/vendor/kaplay.js` 同源，后者之上叠加了 GameDemo 的补丁）。
- 与 pristine 上游（`unpkg kaplay@3001.0.19/dist/kaplay.js`）有**两处差异**：

  1. **CJK 字形图集按字号分桶**（共享补丁，SfG 与 GameDemo 两版均带）：
     字体图集缓存键由字体系名改为 `字体系名@渲染桶位`（`bs>64 ? fam+"@"+bs : fam`，
     桶位 = 32 的倍数、夹在 64..192）。CJK 字符集大，不同字号共用单个 2048×2048
     图集时会互相占位/溢出；分桶后每个字号独立图集，中文密集文本才稳定。
     **这是历史剧情向游戏的刚需**（大量中文对白/标签）。
     核对方法：在上游文件里搜 `+"@"+`，pristine 无此模式。

  2. **精灵纹理过滤强制 NEAREST**（GameDemo 叠加的补丁，带 `/*[SfG] ...*/` 注记）：
     把精灵纹理的过滤器选择代码替换为常量 `s.NEAREST`，不再跟随
     `texFilter` 全局默认（桥 `gameStart` 传 linear 保证文字 AA）。用途：策略地图
     烘焙精灵的硬边像素轮廓（扫描线填充 + Bresenham 描边不被双线性模糊）。
     TTF 文字不经 GL 纹理，保持 AA 不受影响。
     核对方法：在上游文件里搜 `linear:s.LINEAR`，pristine 该处为
     `o.filter??e.opts.texFilter??"nearest"`。

## fonts/

Maple Mono Normal CN（SIL OFL 1.1，https://github.com/subframe7536/maple-font ）三个字重。
来源同 GameDemo/vendor/fonts（本机文件拷贝）。页面 @font-face 按字重分成三个 family
（`MapleMonoCN` / `MapleMonoCN-Semibold` / `MapleMonoCN-Bold`），桥 compText 的
weight 参数映射到对应 family。

## 升级方法（kaplay）

1. 取上游新版本：`curl -o /tmp/kaplay.js https://unpkg.com/kaplay@<版本>/dist/kaplay.js`
2. **重放两处补丁**（或从 `GameDemo/vendor/kaplay.js` 重新拷贝并核对差异仅剩这两处）：
   - CJK 图集分桶（在 formatText 字体图集缓存键处）
   - 精灵纹理强制 NEAREST（在 pushTexture2D 的 filter 选择处）
3. 改本 README 的版本基线；同步给 GameDemo / SfG 各仓（保持补丁同源）。
4. 回归：`node test/smoke.js` + 浏览器开 `build/game/index.html` 检查中文文本与地图硬边。
