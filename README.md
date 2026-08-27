# dsh-theme-demo

一个改 DSH Web 界面外观的插件示例 —— 冷调深蓝 + 背景图 + 组件对比度修复。

写成这样是想说明一件事：**换肤的正路是覆盖 theme token，但 token 覆盖不到全部界面。** 剩下那部分怎么补、补的时候会踩什么坑，代码和注释里都写了。

## 装/卸

```powershell
git clone https://github.com/liuruoxi1990/dsh-theme-demo.git
dsh plugin --profile web add <clone 下来的目录>
```

卸载：

```powershell
dsh plugin --profile web remove @dsh-external/dsh-theme-demo
```

装完重启 `dsh web` 生效。**不需要构建步骤** —— `lib/` 是手写的成品，不是编译产物。

卸载后界面完全恢复原样：所有副作用都挂在 `ctx.effect` 上，插件停止时自动撤销。

## 它做两件事

**1. 覆盖 13 个 `--dsw-alias-*` token。** 这是官方支持的换肤途径，覆盖所有读 token 层的界面。13 个 token 全部要求同时给出 light 和 dark 两个值。

**2. 一张样式表修复 token 覆盖不到的组件。** 这些补丁存在的原因很具体：应用有些地方写死了浅色底，而强制白字落在浅底上就是看不见。

**每个补丁都把前景色和背景色成对设置** —— 这是刻意的，所以任何配置组合都不会产生不可读的内容。

背景图不能走 token：theme token 声明的类型是 CSS color，`url(...)` 会被拒。所以图片走样式表，由本包的 node 半通过自己的 HTTP 路由提供。

## 改配置

`lib/client.js` 顶部的 `SKIN` 对象，所有值都在那里，改完重启即可。

```js
const SKIN = {
  white: true,      // 强制全局白字
  patch: true,      // 组件补丁（跟 white 是一套，见下）
  image: '/dsh-theme-demo/assets/background.png',  // null = 纯深色背景
  strength: 0.45,   // 图片透出程度
  ...
}
```

### `white` 和 `patch` 是一套，不是两个开关

补丁存在的唯一原因是白字会落在浅色底上。关掉 `white` 但留着 `patch`，得到的是一个诊断用的半状态，不是一种设计。

想要"不折腾"的版本：两个都设 `false`，只留 13 个 token —— 深色不彻底，但**不会再有看不见的组件**，文字颜色由产品自己配对决定。

### 两个"跟随"开关

`toolbar.followBlock` 和 `icon.followBlock` 决定按钮取哪套配色：

- `true` → 用代码块的深蓝，按钮融进所在容器
- `false` → 用中性面板 token，按钮保持"应用外壳"的身份

当前配置：工具条 `true`（融进输入区），操作按钮 `false`（属于外壳）。

### `inputLevel` 决定给哪一层上色

输入区是多层嵌套：外框 → `data-input-scroll` → 内部的 grow 包裹层 / textarea / 高亮背板 / 测量镜像。

- `l0` 贴着文字
- `l1` 含内边距，读起来像一个输入框（当前值）
- `l2` 整个外框，含工具条那一行

**改这个值时上色层和清除层会自动配对** —— `cleared` 数组按 `inputLevel` 动态加入 `SCROLL`。这不是可选的：上色层和清除层用同样的选择器 + `!important` 会互相抵消，开发时边框就是这么消失过一次的。

### 换背景图

丢进 `assets/`，然后改 `SKIN.image` 为 `/dsh-theme-demo/assets/<文件名>`。

**图片宽高比必须接近 16:9**，否则 `cover` 会裁掉大块内容 —— 这是几何问题，没有 CSS 解法。`assets/` 里两张都是 1672×941。

## 已知边界

界面上仍可能有没被覆盖的浅底组件：对话框、右键菜单、tooltip、diff 视图、开关、徽章。发现一个就往 `SKIN` 里加一组配色 + 一个 `*Css()` 函数，照现有模式写。

根因是「强制全局白字 + 改不了的静态底色」这个组合本身 —— 只要还开着 `white`，就是打一个补一个。这个插件补了 16 轮才收敛。

## 结构

```
package.json        dsh.bundle.patch（组成 profile 层）+ dsh.client（浏览器半）
cordis.patch.yml    插入 host 行
lib/index.js        node 半：只提供 /dsh-theme-demo/assets 路由
lib/client.js       浏览器半：token 覆盖 + 样式表
verify/             无需浏览器的检查脚本
assets/             背景图
```

`dsh.bundle` 是关键：**只有 `dsh.client` 的话，包会被当成普通依赖装进去，一行都不会挂载。** 安装时会有警告提示这一点。

`lib/client.js` 手写成模块加载器的信封格式（`window.__ModuleLoader__.load`），跟随包的插件产物同构。

## 验证

```powershell
node verify/check-config.mjs
```

18 项检查：括号平衡、13 个 token 是否都带 light/dark、输入框上色层与清除层是否正确配对、以及 12 项开发时真实踩过的坑。

不需要浏览器，也不需要跑着的 DSH —— 它用 stub DOM 抓出样式表再检查。改样式表后跑一遍。

## 几个值得记住的坑

写在这里是因为它们不直观，而且每一个都是真的踩过：

- **CSS Modules 的类名带构建哈希，每次重建都变。** 只能匹配局部名子串（`[class*="_banner"]`），或者优先用 ARIA role。
- **`[class*="_item"]` 会同时匹配 `_itemWrap`/`_itemIcon`/`_itemLabel`**，一口气画出三层嵌套的底色。用 `role="menuitem"`。
- **SVG 文字用 `fill` 上色，`color` 对它无效。** 而 `<rect fill="currentColor">` 是文字的背板 —— 两者必须成对设置。
- **`svg:not(defs)`**：不加这个，`<clipPath>` 里的 rect 也会被当成图形填色。
- **作者样式的 `!important` 能压过内联样式** —— 所以带 `!important` 的后代通配选择器会把 shiki 的语法高亮压平。气泡配色只作用于气泡本身和直接子元素。
- **`opacity` 会合成整个子树且子元素无法撤销** —— 背景蒙版必须用渐变图层，不能用 `opacity`。
- **`outline` 画在边框外面**，看起来像第二个框。用 `box-shadow: inset`。
- **`scrollbar-width`/`scrollbar-color` 只要是非 `auto` 值，Chromium 会丢弃全部 `::-webkit-scrollbar*` 规则。**

## 许可

MIT。

`assets/` 里的图片仅为演示占位，请替换为你自己有权使用的图片。
