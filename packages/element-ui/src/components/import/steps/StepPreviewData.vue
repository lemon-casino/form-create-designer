<template>
  <div class="step-preview-data" :class="{ 'mobile': isMobile }">
    <div class="preview-header" :class="{ 'mobile-header': isMobile }">
      <div class="sheet-selector" v-if="sheets.length > 1">
        <span class="label">工作表:</span>
        <el-select 
          v-model="currentSheet" 
          @change="handleSheetChange" 
          :size="isMobile ? 'large' : 'small'"
          class="sheet-select"
        >
          <el-option 
            v-for="sheet in sheets" 
            :key="sheet" 
            :label="sheet" 
            :value="sheet"
          />
        </el-select>
      </div>

      <div class="data-info">
        <el-alert
          :title="`数据预览最多展示${isMobile ? '50' : '100'}条数据，共${excelData.length}条数据`"
          type="info"
          :closable="false"
          show-icon
          :class="{ 'mobile-alert': isMobile }"
        />
      </div>
    </div>

    <div class="preview-table" v-if="excelData.length > 0">
      <!-- 移动端卡片式布局 -->
      <div v-if="isMobile" class="mobile-table">
        <div 
          v-for="(row, rowIndex) in mobileTableData" 
          :key="rowIndex"
          class="mobile-row"
        >
          <div class="row-header">
            <span class="row-number">第{{ rowIndex + 1 }}行</span>
          </div>
          <div class="row-content">
            <div 
              v-for="(value, key) in row" 
              :key="key"
              class="row-item"
            >
              <div class="item-label">{{ key }}</div>
              <div class="item-value">{{ value || '-' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 桌面端表格布局 -->
      <el-table
        v-else
        :data="tableData"
        style="width: 100%"
        max-height="350"
        size="small"
        border
        class="desktop-table"
      >
        <el-table-column
          type="index"
          width="50"
          label="序号"
          align="center"
        />
        <el-table-column
          v-for="column in tableColumns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          min-width="120"
        />
      </el-table>
    </div>

    <div class="empty-data" v-else>
      <el-empty description="没有检测到数据" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

defineOptions({ name: 'StepPreviewData' })

const props = defineProps({
  excelData: { type: Array, required: true },
  sheets: { type: Array, default: () => [] },
  selectedSheet: { type: String, default: '' },
  isMobile: { type: Boolean, default: false }
})

const emit = defineEmits(['change-sheet'])

const currentSheet = ref(props.selectedSheet)

watch(() => props.selectedSheet, (val) => { currentSheet.value = val })

const tableData = computed(() => props.excelData.slice(0, 100))

const mobileTableData = computed(() => props.excelData.slice(0, 50))

const tableColumns = computed(() => {
  if (props.excelData.length === 0) return []
  const firstRow = props.excelData[0]
  return Object.keys(firstRow).map(key => ({ prop: key, label: key }))
})

const handleSheetChange = (sheet) => { emit('change-sheet', sheet) }
</script>

<style scoped>
.step-preview-data {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.step-preview-data .preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.step-preview-data .preview-header .sheet-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-preview-data .preview-header .sheet-selector .label {
  font-size: 14px;
  color: #606266;
}

.step-preview-data .empty-data {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

/* 移动端适配样式 */
.step-preview-data.mobile .preview-header {
  flex-direction: column;
  align-items: flex-start;
  gap: 15px;
}

.step-preview-data.mobile .sheet-selector {
  width: 100%;
}

.step-preview-data.mobile .sheet-selector .label {
  font-size: 16px;
  font-weight: 500;
  min-width: 60px;
}

.step-preview-data.mobile .sheet-select {
  width: 100%;
}

.step-preview-data.mobile .data-info {
  width: 100%;
}

.step-preview-data.mobile .mobile-alert {
  font-size: 14px;
}

/* 移动端卡片式表格 */
.mobile-table {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 400px;
  overflow-y: auto;
}

.mobile-row {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.mobile-row .row-header {
  background: #f5f7fa;
  padding: 12px 15px;
  border-bottom: 1px solid #ebeef5;
}

.mobile-row .row-header .row-number {
  font-weight: 500;
  color: #303133;
  font-size: 14px;
}

.mobile-row .row-content {
  padding: 15px;
}

.mobile-row .row-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.mobile-row .row-item:last-child {
  border-bottom: none;
}

.mobile-row .row-item .item-label {
  font-weight: 500;
  color: #606266;
  font-size: 13px;
  min-width: 80px;
  margin-right: 15px;
}

.mobile-row .row-item .item-value {
  color: #303133;
  font-size: 13px;
  flex: 1;
  word-break: break-all;
  line-height: 1.4;
}

/* 桌面端表格隐藏 */
.desktop-table {
  display: block;
}

.step-preview-data.mobile .desktop-table {
  display: none;
}

/* 响应式断点 */
@media (max-width: 768px) {
  .step-preview-data {
    gap: 12px;
  }
  
  .step-preview-data .preview-header {
    margin-bottom: 8px;
  }
  
  .mobile-table {
    max-height: 350px;
  }
  
  .mobile-row .row-header {
    padding: 10px 12px;
  }
  
  .mobile-row .row-content {
    padding: 12px;
  }
  
  .mobile-row .row-item {
    padding: 6px 0;
  }
  
  .mobile-row .row-item .item-label {
    font-size: 12px;
    min-width: 70px;
    margin-right: 12px;
  }
  
  .mobile-row .row-item .item-value {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .step-preview-data .preview-header .sheet-selector .label {
    font-size: 15px;
    min-width: 55px;
  }
  
  .mobile-table {
    max-height: 300px;
  }
  
  .mobile-row .row-header {
    padding: 8px 10px;
  }
  
  .mobile-row .row-content {
    padding: 10px;
  }
  
  .mobile-row .row-item {
    padding: 5px 0;
  }
  
  .mobile-row .row-item .item-label {
    font-size: 11px;
    min-width: 60px;
    margin-right: 10px;
  }
  
  .mobile-row .row-item .item-value {
    font-size: 11px;
  }
}

/* 触摸优化 */
@media (hover: none) and (pointer: coarse) {
  .mobile-row:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .mobile-row .row-item:hover {
    background-color: #f5f7fa;
  }
}
</style>
