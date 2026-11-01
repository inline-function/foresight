# build.ps1 —— 《深谋远虑》foresight 工程可复现构建（编译链 + 打包）
#
# 链路：mods/ 启动扫描（scripts/gen-mods.js 烘焙为 app/mods-data.subl）
#       -> sublimation.jar compile（--target=browser，S-1 形态产物）
#       -> 注解处理器（-p game.subs）做 @game op 白名单校验
#       -> 产物打包到 build/game/（index.html + js/ + vendor/ + mods/ + app.js 自包含网页）
#
# 用法（从仓根或任意目录）：
#   powershell -ExecutionPolicy Bypass -File scripts\build.ps1
# 全部参数都有默认值，需替换时显式传入，例如换 java/jar 路径：
#   powershell -ExecutionPolicy Bypass -File scripts\build.ps1 -JavaPath D:\jdk\bin\java.exe
param(
    [string]$JavaPath     = "F:\jdk-17.0.13.11-hotspot\bin\java.exe",
    [string]$JarPath      = "F:\KotlinProject\Sublimation\release\sublimation.jar",
    [string]$ProcessorPath = "F:\SublimationProject\sublimation for game\annotation processer\game.subs",
    [string]$AppJsName    = "app.js",
    [string]$OutDir       = ""
)
$ErrorActionPreference = "Continue"
$R = Split-Path -Parent $PSScriptRoot          # 仓根（foresight）
if ([string]::IsNullOrEmpty($OutDir)) { $OutDir = Join-Path $R "build\game" }

# ---- 模组启动扫描：mods/ -> app/mods-data.subl（顶栏底栏数据源；本体不写内容）----
$scan = (& node (Join-Path $R 'scripts\gen-mods.js') 2>&1)
Write-Host ($scan -join "`n")
if ($LASTEXITCODE -ne 0) { exit 1 }

# ---- 组装编译输入目录（app 源码 + 自带 core 副本；browser 目标剔除 net ----
$bdir = Join-Path $R "build-input-smoke"
if (Test-Path $bdir) { Remove-Item $bdir -Recurse -Force }
New-Item -ItemType Directory -Path $bdir | Out-Null
Copy-Item (Join-Path $R "app\*.subl") $bdir -Force
New-Item -ItemType Directory (Join-Path $bdir 'core') | Out-Null
foreach ($m in (Get-ChildItem -Directory (Join-Path $R 'core'))) {
    Copy-Item $m.FullName (Join-Path $bdir 'core') -Recurse -Force
}

# ---- 编译：CWD=仓根（core/ 对处理器脚本的类型检查可见），-p 指 @game 处理器 ----
$appJs = Join-Path $R (Join-Path "build" $AppJsName)
Push-Location $R
$jar = (& $JavaPath -jar $JarPath compile $bdir -o $appJs --target=browser -p $ProcessorPath 2>&1)
Pop-Location
$err = $jar | Select-String -Pattern '错误'
if ($err) { Write-Host ($jar -join "`n"); exit 1 }
Remove-Item $bdir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ("COMPILE-OK " + $AppJsName + " " + (Get-Item $appJs).Length + " B")

# ---- 打包：build/game/ = 可直接打开的自包含网页 ----
foreach ($d in @($OutDir, (Join-Path $OutDir "js"), (Join-Path $OutDir "vendor"), (Join-Path $OutDir "vendor\fonts"))) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}
Copy-Item (Join-Path $R "index.html")  $OutDir -Force
Copy-Item (Join-Path $R "js\*")       (Join-Path $OutDir "js") -Recurse -Force
Copy-Item (Join-Path $R "vendor\kaplay.js") (Join-Path $OutDir "vendor") -Force
Copy-Item (Join-Path $R "vendor\README.md") (Join-Path $OutDir "vendor") -Force
Copy-Item (Join-Path $R "vendor\fonts\*")  (Join-Path $OutDir "vendor\fonts") -Force
# 音频与图标资产（TFR 素材：bgm/sfx/img）随包复制到 build/game/assets
New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "assets") | Out-Null
if (Test-Path (Join-Path $R "assets")) { Copy-Item (Join-Path $R "assets\*") (Join-Path $OutDir "assets") -Recurse -Force }

# 模组源一并随包（数据本体在构建期已烘焙进 app.js；mods/ 保留源布局供阅读/扩展）
New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "mods") | Out-Null
Copy-Item (Join-Path $R "mods\*") (Join-Path $OutDir "mods") -Recurse -Force
if (-not (Test-Path $appJs)) { throw "JS 产物不存在：$appJs" }
Copy-Item $appJs (Join-Path $OutDir $AppJsName) -Force
Write-Host ("PACKAGE-OK " + $OutDir)
