<template>
  <div class="step-import-data" :class="{ 'mobile': isMobile }">
    <!-- 导入中 -->
    <div v-if="status === 'importing'" class="importing">
      <div class="loading-icon">
        <el-icon class="is-loading" :size="isMobile ? 80 : 60"><loading /></el-icon>
      </div>
      <div class="loading-text">数据导入中，请耐心等待...</div>
    </div>

    <!-- 导入成功 -->
    <div v-else-if="status === 'success'" class="success">
      <div class="result-icon">
        <el-icon color="#67C23A" :size="isMobile ? 80 : 60"><circle-check /></el-icon>
      </div>
      <div class="result-title">导入成功</div>
      <div class="result-summary">
        共{{total}}条数据，成功导入{{success}}条
        <template v-if="fail > 0">，失败{{fail}}条</template>
      </div>

      <!-- 有警告信息 -->
      <div class="warning-area" v-if="warnings.length > 0">
        <el-alert
          title="以下数据存在问题，但不影响导入"
          type="warning"
          :closable="false"
          show-icon
          :class="{ 'mobile-warning-alert': isMobile }"
        />
        <el-scrollbar :height="isMobile ? '200px' : '150px'">
          <div class="warning-list" :class="{ 'mobile-warning-list': isMobile }">
            <div class="warning-item" v-for="(warning, index) in warnings" :key="index">
              {{ warning }}
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>

    <!-- 导入失败 -->
    <div v-else-if="status === 'error'" class="error">
      <div class="result-icon">
        <el-icon color="#F56C6C" :size="isMobile ? 80 : 60"><circle-close /></el-icon>
      </div>
      <div class="result-title">导入失败</div>
      <div class="result-summary">
        请检查数据格式或稍后重试
      </div>
    </div>

    <!-- 默认状态 -->
    <div v-else class="idle">
      <el-empty description="准备导入数据" />
    </div>
  </div>
</template>

<script setup>
import { CircleCheck, CircleClose, Loading } from '@element-plus/icons-vue'

defineOptions({ name: 'StepImportData' })

const props = defineProps({
  status: { type: String, default: 'idle' },
  total: { type: Number, default: 0 },
  success: { type: Number, default: 0 },
  fail: { type: Number, default: 0 },
  warnings: { type: Array, default: () => [] },
  isMobile: { type: Boolean, default: false }
})
</script>

<style scoped>
.step-import-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.step-import-data .importing,
.step-import-data .success,
.step-import-data .error,
.step-import-data .idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.step-import-data .loading-text,
.step-import-data .result-title {
  font-size: 18px;
  font-weight: bold;
  margin: 20px 0 10px;
}

.step-import-data .result-summary {
  color: #606266;
  margin-bottom: 20px;
}

.step-import-data .warning-area {
  width: 100%;
  margin-top: 20px;
}

.step-import-data .warning-area .warning-list {
  margin-top: 10px;
}

.step-import-data .warning-area .warning-list .warning-item {
  padding: 8px;
  border-bottom: 1px solid #ebeef5;
  color: #E6A23C;
}

.step-import-data .warning-area .warning-list .warning-item:last-child {
  border-bottom: none;
}

/* 移动端适配样式 */
.step-import-data.mobile {
  min-height: 250px;
  padding: 0 20px;
}

.step-import-data.mobile .loading-text,
.step-import-data.mobile .result-title {
  font-size: 20px;
  margin: 25px 0 15px;
  text-align: center;
}

.step-import-data.mobile .result-summary {
  font-size: 16px;
  margin-bottom: 25px;
  text-align: center;
  line-height: 1.5;
}

.step-import-data.mobile .warning-area {
  margin-top: 25px;
  width: 100%;
}

.step-import-data.mobile .mobile-warning-alert {
  font-size: 14px;
}

.step-import-data.mobile .mobile-warning-list {
  margin-top: 15px;
}

.step-import-data.mobile .warning-area .warning-list .warning-item {
  padding: 12px;
  font-size: 14px;
  line-height: 1.4;
}

/* 响应式断点 */
@media (max-width: 768px) {
  .step-import-data {
    min-height: 280px;
  }
  
  .step-import-data .loading-text,
  .step-import-data .result-title {
    font-size: 19px;
    margin: 22px 0 12px;
  }
  
  .step-import-data .result-summary {
    font-size: 15px;
    margin-bottom: 22px;
  }
  
  .step-import-data .warning-area {
    margin-top: 22px;
  }
  
  .step-import-data .warning-area .warning-list .warning-item {
    padding: 10px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .step-import-data.mobile {
    padding: 0 15px;
    min-height: 220px;
  }
  
  .step-import-data .loading-text,
  .step-import-data .result-title {
    font-size: 18px;
    margin: 20px 0 10px;
  }
  
  .step-import-data .result-summary {
    font-size: 14px;
    margin-bottom: 20px;
  }
  
  .step-import-data .warning-area {
    margin-top: 20px;
  }
  
  .step-import-data .warning-area .warning-list .warning-item {
    padding: 8px;
    font-size: 12px;
  }
}

/* 触摸优化 */
@media (hover: none) and (pointer: coarse) {
  .step-import-data .warning-area .warning-list .warning-item:hover {
    background-color: #fdf6ec;
  }
}
</style>
