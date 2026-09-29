# 26MLP_team07_frontend

机器学习理论与实践课程大作业 —— 算法可视化平台前端（26MLP 第 07 组）。

后端算法仓库见 [26MLP_team07](https://github.com/Icey18899877399/26MLP_team07)。

## 技术栈

- Vue 3 + Vite 7（纯 JS，无 TypeScript）
- Element Plus（UI 组件库）
- ECharts 5（图表）
- Pinia（状态管理）+ Vue Router

## 接口合同

前后端通过 **HTTP REST** 通信，唯一合同为 `HTTP_API_CONTRACT.md`（与后端同目录）。前端不依赖任何其他协议。

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查；`ml_backend.available=false` 时前端禁止一切实验 |
| `GET /api/models` | 模型发现（id / 任务类型 / 兼容数据集 / 默认参数 / 参数说明） |
| `GET /api/datasets` | 数据集发现（id / 任务类型 / 样本数 / 特征数） |
| `POST /api/experiments` | 提交实验（同步训练，直接返回 `run_id` + `metrics`） |

错误约定：`{ detail: { code, message } }`，`400 ml_request_rejected` / `422` 请求校验 / `502 ml_execution_failed` / `503 ml_backend_unavailable`。

## 运行

```bash
# 安装依赖（Node.js ≥ 20.19，Vite 7 要求）
npm install

# 同时启动前端（:5173）与内置 Mock 后端（:8765）
npm run start

# 仅启动前端
npm run dev

# 仅启动 Mock 后端（可选 --no-ml 模拟 ML 包缺失、--port N、--delay N）
npm run mock
```

浏览器访问 http://localhost:5173

> 默认后端地址为合同地址 `http://127.0.0.1:8000`（真实 FastAPI 后端）。
> 使用内置 Mock 时，点右上角连接徽标，把 HTTP 基础地址改为 `http://127.0.0.1:8765`。
> 后端跑在队友电脑上时改为 `http://<IP>:8000`。

## 训练语义（同步）

训练是同步 HTTP 请求：点击"开始训练"后前端只显示等待态与耗时，直到后端返回最终结果（默认 5 分钟超时）。没有进度流/取消/断线续跑；关闭页面或超时后服务端运行的状态前端无法查询——若需要异步查询，应先补充合同再改前端。

## 目录结构

```
src/
├── views/        # 页面：实验工作台 / 算法对比 / 数据集 / 使用手册
├── components/   # 可复用组件（图表 / 实验面板 / 指标卡 / 通用件）
├── stores/       # Pinia 全局状态（连接注册表 / 训练运行）
├── services/     # httpClient（fetch 封装）/ api（合同端点）/ adapters（合同↔内部形状）
├── config/       # 全局配置 / 兜底注册表 / 指标定义 / ECharts 主题
└── utils/        # 格式化、超参 schema、ID 生成等工具函数
mock/             # Node Mock 后端（HTTP 合同替身，模拟数据）
```

## 架构设计

- **配置驱动**：前端界面完全由后端注册表（模型/数据集）动态渲染，后端新增内容前端零改动；后端未连接时使用内置兜底注册表（与 Mock 数据逐字节一致）。
- **协议唯一**：只有 `src/services/api.js` 出现 `/api/*` 路径；合同字段到组件消费形状的映射集中在 `src/services/adapters.js`。
- **超参表单推断**：表单控件由 `default_params` 的值类型推断（bool→开关、整数→整数输入、小数→小数输入、字符串→文本框、null→跳过），`parameter_descriptions` 显示为帮助提示。
- **gating**：`ml_backend.available=false` 或后端不可达时，训练按钮禁用并显示警告（合同要求）。

## 当前状态

| 模块 | 状态 |
|------|------|
| 实验工作台（算法选择 / 超参表单 / 训练监控 / 结果图表） | ✅ 已完成（HTTP 合同版） |
| 数据集页 | ⬜ 待开发（需合同补充数据集详情端点） |
| 算法对比（Benchmark）页 | ⬜ 待开发 |
| 使用手册页 | ⬜ 待开发 |
| artifacts 渲染 | ⬜ 待合同约定 URI 发布/访问策略 |
