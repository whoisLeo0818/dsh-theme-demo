# dsh-plugin-steel-skin

冷调深蓝皮肤 —— 深色 token + 背景图 + 组件对比度修复。

## 装/卸

```powershell
dsh plugin --profile web add D:\dsh-workspace\dsh-plugin-steel-skin
dsh plugin --profile web remove @dsh-external/dsh-plugin-steel-skin
```

装完重启 `dsh web` 生效。卸载后界面完全恢复原样（所有副作用都挂在 `ctx.effect` 上）。

## 它做两件事

**1. 覆盖 13 个 `--dsw-alias-*` token。** 这是官方支持的换肤途径，覆盖所有读 token 层的界面。

**2. 一张样式表修复 token 覆盖不到的组件。** 这些补丁存在的原因很具体：应用有些地方写死了浅色底，而强制白字落在浅底上就是看不见。每个补丁都把前景色和背景色**成对**设置，所以任何组合都不会产生不可读的内容。

背景图不能走 token —— theme token 声明的类型是 CSS color，`url(...)` 会被拒。所以图片走样式表，由本包的 host 半通过自己的 HTTP 路由提供。

## 改配置

`lib/client.js` 顶部的 `SKIN` 对象，所有值都在那里，改完重启即可。

```js
const SKIN = {
  white: true,      // 强制全局白字
  patch: true,      // 组件补丁（跟 white 是一套，见下）
  image: '/steel-skin/assets/background.png',  // null = 纯深色背景
  strength: 0.45,   // 图片透出程度
  ...
}
```

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

**改这个值时上色层和清除层会自动配对** —— 代码里 `cleared` 数组会按 `inputLevel` 动态加入 `SCROLL`。这不是可选的：上色层和清除层用同样的选择器 + `!important` 会互相抵消，开发时边框就是这么消失过一次的。

### `white` 和 `patch` 是一套，不是两个开关

补丁存在的唯一原因是白字会落在浅色底上。关掉 `white` 但留着 `patch`，得到的是一个诊断用的半状态，不是一种设计。

想要"不折腾"的版本：两个都设 `false`，只留 13 个 token —— 深色不彻底，但**不会再有看不见的组件**，文字颜色由产品自己配对决定。

### 换背景图

丢进 `assets/`，然后改 `SKIN.image` 为 `/steel-skin/assets/<文件名>`。

**图片宽高比必须接近 16:9**，否则 `cover` 会裁掉大块内容 —— 这是几何问题，没有 CSS 解法。`assets/` 里两张都是 1672×941。

## 已知边界

界面上仍可能有没被覆盖的浅底组件：对话框、右键菜单、tooltip、diff 视图、开关、徽章。发现一个就往 `SKIN` 里加一组配色 + 一个 `*Css()` 函数，照现有模式写。

根因是「强制全局白字 + 改不了的静态底色」这个组合本身 —— 只要还开着 `white`，就是打一个补一个。

## 结构

```
package.json        dsh.bundle.patch（组成 profile 层）+ dsh.client（浏览器半）
cordis.patch.yml    插入 host 行
lib/index.js        host 半：只提供 /steel-skin/assets 路由
lib/client.js       浏览器半：token 覆盖 + 样式表
assets/             背景图
```

不需要构建步骤。`lib/client.js` 手写成模块加载器的信封格式（`window.__ModuleLoader__.load`），跟随包的插件产物同构。

## 验证脚本

```powershell
dsh web --port 8477 --no-open   # 另起一个测试端口
node verify-skin-route.mjs      # 资源路由（含穿越防护）
node verify-skin-bundle.mjs     # 浏览器半能否解析、apply() 契约
node verify-skin-css.mjs        # 样式表括号平衡 + 15 项回归检查
```

`verify-skin-css.mjs` 里那 15 项检查对应开发过程中真实踩过的坑（shiki 内联色被 `!important` 压平、clipPath rect 被误当图形、mirror 幽灵文字、placeholder 前缀写在一个逗号列表里被整条丢弃等）。改样式表后跑一遍。
