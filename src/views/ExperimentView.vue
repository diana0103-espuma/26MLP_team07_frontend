<script setup>
import { computed, ref, watch } from 'vue'
import { useConnectionStore } from '../stores/connection'
import { useTrainingStore } from '../stores/training'
import { CONFIG } from '../config'
import { formatDuration } from '../utils/format'
import AlgorithmList from '../components/experiment/AlgorithmList.vue'
import HyperparamForm from '../components/experiment/HyperparamForm.vue'
import RunMonitor from '../components/experiment/RunMonitor.vue'
import MetricCard from '../components/metrics/MetricCard.vue'
import JsonFallback from '../components/metrics/JsonFallback.vue'

/**
 * 实验工作台（核心页面）：
 * 左：算法列表（注册表驱动）｜右上：超参数表单 + 数据集/切分设置｜右下：训练监控与结果
 * HTTP 合同下训练是同步请求：监控面板只有等待态与失败态，结果面板展示最终 metrics。
 */
const conn = useConnectionStore()
const training = useTrainingStore()

const selectedAlgo = ref(null)
const selectedDatasetId = ref('')
const split = ref({ testSize: CONFIG.defaultTestSize, seed: CONFIG.defaultSeed })

const algorithms = computed(() => conn.registry.algorithms || [])
const datasets = computed(() => conn.registry.datasets || [])

/** 当前算法适用的数据集（按任务类型过滤） */
const availableDatasets = computed(() => {
  if (!selectedAlgo.value) return []
  return datasets.value.filter((d) => (selectedAlgo.value.taskTypes || []).includes(d.taskType))
})

const selectedDataset = computed(() =>
  datasets.value.find((d) => d.id === selectedDatasetId.value)
)

// 切换算法时自动选中第一个适用数据集，并重置切分参数为默认值
watch(
  () => selectedAlgo.value?.id,
  () => {
    const list = availableDatasets.value
    if (list.length > 0) {
      selectedDatasetId.value = list[0].id
      split.value = { testSize: CONFIG.defaultTestSize, seed: CONFIG.defaultSeed }
    } else {
      selectedDatasetId.value = ''
    }
  }
)

function handleTrain(hyperparams) {
  if (!selectedAlgo.value || !selectedDataset.value) return
  training.startRun({
    modelId: selectedAlgo.value.id,
    modelName: selectedAlgo.value.name,
    datasetId: selectedDataset.value.id,
    datasetName: selectedDataset.value.name,
    taskType: selectedDataset.value.taskType,
    params: hyperparams,
    testSize: split.value.testSize,
    randomState: split.value.seed
  })
}

const selectedRunId = ref('')
const selectedRun = computed(() => training.getRun(selectedRunId.value))

// 新完成的 run 自动选中（结果面板跟随最新一次训练）
watch(
  () => training.finishedRuns[0]?.id,
  (id) => {
    if (id) selectedRunId.value = id
  }
)

/** 结果指标定义：按 run 的任务类型从静态指标表取 */
const metricDefs = computed(() => {
  if (!selectedRun.value) return []
  return conn.registry.metrics?.[selectedRun.value.taskType] || []
})

/** 只渲染结果中实际存在的指标（合同 metrics 键不透明，图表键可能缺失） */
const visibleMetricDefs = computed(() =>
  metricDefs.value.filter((d) => {
    const v = selectedRun.value?.result?.metrics?.[d.id]
    return v !== undefined && v !== null
  })
)

const gatingMessage = computed(() => {
  switch (conn.status) {
    case 'offline':
      return '未连接后端服务器，当前显示离线兜底配置，无法发起实验'
    case 'unavailable':
      return '后端服务可达，但 ML 包不可用，无法发起实验'
    case 'connecting':
      return '正在连接后端服务器…'
    default:
      return ''
  }
})
</script>

<template>
  <div class="experiment-layout">
    <!-- 左：算法列表 -->
    <div class="panel-left page-card">
      <h3 class="page-card-title">算法选择</h3>
      <AlgorithmList :algorithms="algorithms" :active-id="selectedAlgo?.id" @select="selectedAlgo = $event" />
    </div>

    <!-- 右：配置 + 训练 + 结果 -->
    <div class="panel-right">
      <div class="page-card">
        <div v-if="selectedAlgo" class="algo-header">
          <div>
            <h3 class="page-card-title">{{ selectedAlgo.name }}</h3>
            <p class="algo-summary">{{ selectedAlgo.description }}</p>
          </div>
          <el-tag v-if="conn.isUsingFallback" type="info" effect="plain">离线兜底配置</el-tag>
        </div>

        <el-alert
          v-if="!conn.canRunExperiments"
          type="warning"
          :closable="false"
          show-icon
          class="gating-alert"
        >
          {{ gatingMessage }}
        </el-alert>

        <el-form label-position="top" class="dataset-form">
          <div class="dataset-row">
            <el-form-item label="数据集">
              <el-select v-model="selectedDatasetId" style="width: 220px">
                <el-option
                  v-for="d in availableDatasets"
                  :key="d.id"
                  :label="`${d.name}（${d.nSamples} 样本 × ${d.nFeatures} 特征）`"
                  :value="d.id"
                />
              </el-select>
            </el-form-item>
            <!-- 合同：聚类实验必须省略 test_size；异常检测忽略该值 -->
            <el-form-item
              v-if="selectedDataset && selectedDataset.taskType !== 'clustering' && selectedDataset.taskType !== 'anomaly_detection'"
              label="测试集比例"
            >
              <el-slider v-model="split.testSize" :min="0.1" :max="0.5" :step="0.05" style="width: 160px" show-input :show-input-controls="false" />
            </el-form-item>
            <el-form-item label="随机种子">
              <el-input-number v-model="split.seed" :min="0" :max="99999" controls-position="right" style="width: 130px" />
            </el-form-item>
          </div>
        </el-form>

        <HyperparamForm :algorithm="selectedAlgo" :disabled="!conn.canRunExperiments" @submit="handleTrain" />
      </div>

      <!-- 训练监控：等待中 + 失败 -->
      <div v-if="training.activeRuns.length > 0 || training.errorRuns.length > 0" class="page-card">
        <h3 class="page-card-title">训练监控</h3>
        <RunMonitor v-for="run in training.activeRuns" :key="run.id" :run="run" />
        <RunMonitor v-for="run in training.errorRuns" :key="run.id" :run="run" />
      </div>

      <!-- 历史结果 -->
      <div v-if="training.finishedRuns.length > 0" class="page-card">
        <h3 class="page-card-title">
          训练结果
          <el-button text size="small" @click="training.clearRuns()">清空</el-button>
        </h3>
        <el-radio-group v-model="selectedRunId" size="small" class="run-selector">
          <el-radio-button v-for="run in training.finishedRuns" :key="run.id" :value="run.id">
            {{ run.modelName }} · {{ run.datasetName }}
          </el-radio-button>
        </el-radio-group>
        <div v-if="selectedRun" class="result-area">
          <div class="result-meta">
            <el-tag type="success" size="small">已完成</el-tag>
            <span class="meta-text">耗时 {{ formatDuration(selectedRun.elapsedMs) }}</span>
            <span class="meta-text mono">run_id: {{ selectedRun.runId || selectedRun.id }}</span>
          </div>
          <div class="metric-grid">
            <MetricCard
              v-for="metric in visibleMetricDefs"
              :key="metric.id"
              :metric="metric"
              :value="selectedRun.result?.metrics?.[metric.id]"
              :extra="selectedRun.result?.metrics"
            />
          </div>
          <!-- 合同 metrics 键不透明：无已知定义命中时展示原始 JSON -->
          <JsonFallback v-if="visibleMetricDefs.length === 0" :value="selectedRun.result?.metrics" />

          <el-collapse class="result-details">
            <el-collapse-item v-if="selectedRun.result?.effective_params" title="有效参数">
              <JsonFallback :value="selectedRun.result.effective_params" />
            </el-collapse-item>
            <el-collapse-item v-if="selectedRun.result?.metadata" title="元数据">
              <JsonFallback :value="selectedRun.result.metadata" />
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.experiment-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.panel-left {
  width: 300px;
  flex-shrink: 0;
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.panel-right {
  flex: 1;
  min-width: 0;
}

.algo-header {
  margin-bottom: 8px;
}

.algo-summary {
  margin: -4px 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.gating-alert {
  margin-bottom: 12px;
}

.dataset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 8px;
}

.run-selector {
  margin-bottom: 16px;
}

.result-area {
  margin-top: 8px;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.meta-text {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.mono {
  font-family: Consolas, Menlo, monospace;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.result-details {
  margin-top: 12px;
}
</style>
