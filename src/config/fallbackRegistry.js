/**
 * 静态兜底注册表（fallback registry）
 *
 * 当后端未连接时，前端使用这份静态配置渲染界面，保证 UI 可以独立运行和演示。
 * 注意：schema 与后端通过 WebSocket 发送的 `config.registry` 消息完全一致
 * （协议见 docs/PROTOCOL.md），mock/registry.js 是它的"增强版"参考实现。
 *
 * 可扩展性说明：
 * - 后端新增一个算法/数据集/指标 → 前端界面自动出现，无需改任何前端代码
 * - 超参数 type 决定表单控件：int/float → 数字输入框，choice → 下拉框，
 *   bool → 开关，range → 双滑块；未知类型降级为普通文本框
 * - 指标 type 决定渲染器：scalar → 数值卡片，matrix → 热力图，
 *   curve → 曲线图；未知类型 → 通用 JSON 表格
 */
export const fallbackRegistry = {
  server: {
    name: '静态兜底配置（未连接后端）',
    version: '0.0.0',
    protocolVersion: 1
  },
  taskTypes: ['classification', 'regression', 'clustering'],
  algorithms: [
    {
      id: 'knn',
      name: 'K近邻',
      taskTypes: ['classification', 'regression'],
      description: '基于距离度量的惰性学习算法，投票/加权平均决定预测结果',
      hyperparams: [
        { name: 'n_neighbors', label: '邻居数 k', type: 'int', default: 5, min: 1, max: 50, step: 1, group: '基本参数', hint: '参与投票的最近邻居个数' },
        { name: 'weights', label: '权重方式', type: 'choice', default: 'uniform', options: ['uniform', 'distance'], group: '基本参数', hint: 'uniform 等权投票，distance 按距离倒数加权' },
        { name: 'metric', label: '距离度量', type: 'choice', default: 'minkowski', options: ['minkowski', 'euclidean', 'manhattan'], group: '基本参数' },
        { name: 'p', label: '闵氏距离 p 值', type: 'float', default: 2.0, min: 1.0, max: 5.0, step: 0.5, group: '高级参数', hint: 'p=1 为曼哈顿距离，p=2 为欧氏距离' }
      ]
    },
    {
      id: 'decision_tree',
      name: '决策树',
      taskTypes: ['classification', 'regression'],
      description: '基于信息增益/基尼系数的树形模型，可解释性强',
      hyperparams: [
        { name: 'criterion', label: '划分准则', type: 'choice', default: 'gini', options: ['gini', 'entropy'], group: '基本参数' },
        { name: 'max_depth', label: '最大深度', type: 'int', default: 10, min: 1, max: 30, step: 1, group: '基本参数', hint: '限制树深度防止过拟合' },
        { name: 'min_samples_split', label: '分裂最小样本数', type: 'int', default: 2, min: 2, max: 20, step: 1, group: '高级参数' },
        { name: 'min_samples_leaf', label: '叶节点最小样本数', type: 'int', default: 1, min: 1, max: 10, step: 1, group: '高级参数' }
      ]
    },
    {
      id: 'naive_bayes',
      name: '朴素贝叶斯',
      taskTypes: ['classification'],
      description: '基于贝叶斯定理与特征条件独立假设的概率模型',
      hyperparams: [
        { name: 'var_smoothing', label: '方差平滑系数', type: 'float', default: 1e-9, min: 1e-12, max: 1e-6, step: 1e-9, group: '基本参数', hint: '防止零概率，数值越小越接近无平滑' }
      ]
    },
    {
      id: 'logistic_regression',
      name: '逻辑回归',
      taskTypes: ['classification'],
      description: '线性分类模型，通过 sigmoid 输出类别概率',
      hyperparams: [
        { name: 'learning_rate', label: '学习率', type: 'float', default: 0.01, min: 0.0001, max: 1.0, step: 0.001, group: '基本参数' },
        { name: 'max_iter', label: '最大迭代次数', type: 'int', default: 100, min: 10, max: 2000, step: 10, group: '基本参数' },
        { name: 'regularization', label: '正则化', type: 'choice', default: 'l2', options: ['none', 'l1', 'l2'], group: '高级参数' },
        { name: 'fit_intercept', label: '拟合截距', type: 'bool', default: true, group: '高级参数' }
      ]
    },
    {
      id: 'kmeans',
      name: 'K均值聚类',
      taskTypes: ['clustering'],
      description: '基于质心的划分聚类算法，最小化簇内平方和',
      hyperparams: [
        { name: 'n_clusters', label: '簇数 k', type: 'int', default: 3, min: 2, max: 20, step: 1, group: '基本参数' },
        { name: 'n_init', label: '初始化次数', type: 'int', default: 10, min: 1, max: 100, step: 1, group: '基本参数', hint: '取多次运行中最优的一次，避免局部最优' },
        { name: 'tol', label: '收敛阈值', type: 'float', default: 0.0001, min: 0.00001, max: 0.1, step: 0.0001, group: '高级参数' }
      ]
    }
  ],
  datasets: [
    {
      id: 'iris',
      name: '鸢尾花',
      taskType: 'classification',
      nSamples: 150,
      nFeatures: 4,
      nClasses: 3,
      description: '经典三分类数据集，根据花萼/花瓣尺寸区分三种鸢尾花',
      split: { defaultTestRatio: 0.3, defaultSeed: 42, stratifySupported: true }
    },
    {
      id: 'wine',
      name: '葡萄酒',
      taskType: 'classification',
      nSamples: 178,
      nFeatures: 13,
      nClasses: 3,
      description: '根据化学成分区分三种葡萄酒产地',
      split: { defaultTestRatio: 0.3, defaultSeed: 42, stratifySupported: true }
    },
    {
      id: 'breast_cancer',
      name: '乳腺癌诊断',
      taskType: 'classification',
      nSamples: 569,
      nFeatures: 30,
      nClasses: 2,
      description: '根据细胞核特征判断肿瘤良恶性（二分类）',
      split: { defaultTestRatio: 0.3, defaultSeed: 42, stratifySupported: true }
    },
    {
      id: 'boston',
      name: '波士顿房价',
      taskType: 'regression',
      nSamples: 506,
      nFeatures: 13,
      nClasses: 0,
      description: '经典回归数据集，预测波士顿地区房价中位数',
      split: { defaultTestRatio: 0.3, defaultSeed: 42, stratifySupported: false }
    }
  ],
  metrics: {
    classification: [
      { id: 'accuracy', name: '准确率', type: 'scalar', higherIsBetter: true, hint: '预测正确的样本占比' },
      { id: 'precision', name: '精确率', type: 'scalar', higherIsBetter: true, hint: '预测为正类中真正的正类占比' },
      { id: 'recall', name: '召回率', type: 'scalar', higherIsBetter: true, hint: '真正的正类中被找出的占比' },
      { id: 'f1', name: 'F1分数', type: 'scalar', higherIsBetter: true, hint: '精确率与召回率的调和平均' },
      { id: 'confusion_matrix', name: '混淆矩阵', type: 'matrix', chart: 'heatmap', hint: '行列分别为真实/预测类别' },
      { id: 'roc_auc', name: 'ROC曲线', type: 'curve', chart: 'roc', higherIsBetter: true, hint: 'AUC 越大分类能力越强' }
    ],
    regression: [
      { id: 'mse', name: '均方误差', type: 'scalar', higherIsBetter: false },
      { id: 'rmse', name: '均方根误差', type: 'scalar', higherIsBetter: false },
      { id: 'mae', name: '平均绝对误差', type: 'scalar', higherIsBetter: false },
      { id: 'r2', name: 'R² 决定系数', type: 'scalar', higherIsBetter: true, hint: '越接近 1 拟合越好' }
    ],
    clustering: [
      { id: 'silhouette', name: '轮廓系数', type: 'scalar', higherIsBetter: true, hint: '越接近 1 聚类越紧密' },
      { id: 'davies_bouldin', name: 'DB指数', type: 'scalar', higherIsBetter: false, hint: '越小聚类质量越好' },
      { id: 'inertia', name: '簇内平方和', type: 'scalar', higherIsBetter: false }
    ]
  }
}
