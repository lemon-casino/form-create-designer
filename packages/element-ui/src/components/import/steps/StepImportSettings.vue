<template>
  <div class="step-import-settings" :class="{ 'mobile': isMobile }">
    <div class="settings-header">
      <el-alert
        title="请设置Excel列和字段的对应关系"
        type="info"
        :closable="false"
        show-icon
        :class="{ 'mobile-alert': isMobile }"
      />
    </div>

    <div class="mapping-area" :class="{ 'mobile-mapping': isMobile }">
      <!-- 移动端卡片式布局 -->
      <div v-if="isMobile" class="mobile-mapping-list">
        <div 
          v-for="(excelColumn, index) in excelColumns" 
          :key="index"
          class="mobile-mapping-item"
        >
          <div class="mapping-header-mobile">
            <div class="excel-column-label">Excel列名</div>
            <div class="excel-column-value">{{ excelColumn }}</div>
          </div>
          <div class="mapping-field-mobile">
            <div class="field-label">对应字段</div>
            <el-select
              v-model="mapping[excelColumn]"
              placeholder="请选择"
              clearable
              filterable
              :size="isMobile ? 'large' : 'default'"
              @change="updateMapping"
              class="field-select"
            >
              <el-option
                v-for="field in fieldOptions"
                :key="field.value"
                :label="field.label"
                :value="field.value"
              />
            </el-select>
          </div>
        </div>
      </div>

      <!-- 桌面端表格布局 -->
      <div v-else class="desktop-mapping">
        <div class="mapping-header">
          <div class="excel-column">Excel列名</div>
          <div class="field-column">对应字段</div>
        </div>

        <div class="mapping-rows">
          <div class="mapping-row" v-for="(excelColumn, index) in excelColumns" :key="index">
            <div class="excel-column">{{ excelColumn }}</div>
            <div class="field-column">
              <el-select
                v-model="mapping[excelColumn]"
                placeholder="请选择"
                clearable
                filterable
                @change="updateMapping"
              >
                <el-option
                  v-for="field in fieldOptions"
                  :key="field.value"
                  :label="field.label"
                  :value="field.value"
                />
              </el-select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="validation-results" v-if="validationMessage">
      <el-alert
        :title="validationMessage"
        :type="hasMapping ? 'success' : 'warning'"
        :closable="false"
        show-icon
        :class="{ 'mobile-validation': isMobile }"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

defineOptions({ name: 'StepImportSettings' })

const props = defineProps({
  excelData: { type: Array, required: true },
  columns: { type: Array, required: true },
  columnMapping: { type: Object, default: () => ({}) },
  isMobile: { type: Boolean, default: false }
})

const emit = defineEmits(['update-mapping'])

const excelColumns = computed(() => {
  if (props.excelData.length === 0) return []
  const firstRow = props.excelData[0]
  return Object.keys(firstRow)
})

const fieldOptions = computed(() => {
  return props.columns.map((col) => {
    const field = col.rule?.[0]?.field || ''
    const required = col.rule?.[0]?.$required || false
    return { label: `${col.label}${required ? ' (必填)' : ''}`, value: field }
  })
})

const mapping = ref({})

onMounted(() => { mapping.value = { ...props.columnMapping } })

watch(() => props.columnMapping, (val) => { mapping.value = { ...val } }, { deep: true })

const updateMapping = () => { emit('update-mapping', mapping.value) }

const hasMapping = computed(() => Object.values(mapping.value).some(v => !!v))

const validationMessage = computed(() => {
  if (!hasMapping.value) return '请至少设置一个字段映射关系'
  const requiredFields = props.columns
    .filter((col) => col.rule?.[0]?.$required)
    .map((col) => col.rule[0].field)
  const mappedFields = Object.values(mapping.value)
  const missingRequired = requiredFields.filter(field => !mappedFields.includes(field))
  if (missingRequired.length > 0) {
    const missingLabels = missingRequired.map(field => {
      const col = props.columns.find((c) => c.rule?.[0]?.field === field)
      return col ? col.label : field
    })
    return `有${missingRequired.length}个必填字段未映射: ${missingLabels.join(', ')}`
  }
  return `已设置${Object.keys(mapping.value).length}个字段映射`
})
</script>

<style scoped>
.step-import-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step-import-settings .mapping-area {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.step-import-settings .mapping-area .mapping-header {
  display: flex;
  background-color: #f5f7fa;
  padding: 10px;
  font-weight: bold;
}

.step-import-settings .mapping-area .mapping-header .excel-column {
  flex: 1;
  padding: 0 10px;
}

.step-import-settings .mapping-area .mapping-header .field-column {
  flex: 1;
  padding: 0 10px;
}

.step-import-settings .mapping-area .mapping-rows {
  max-height: 350px;
  overflow-y: auto;
}

.step-import-settings .mapping-area .mapping-rows .mapping-row {
  display: flex;
  border-top: 1px solid #ebeef5;
  padding: 10px;
}

.step-import-settings .mapping-area .mapping-rows .mapping-row:hover {
  background-color: #f5f7fa;
}

.step-import-settings .mapping-area .mapping-rows .mapping-row .excel-column {
  flex: 1;
  padding: 0 10px;
  display: flex;
  align-items: center;
}

.step-import-settings .mapping-area .mapping-rows .mapping-row .field-column {
  flex: 1;
  padding: 0 10px;
}

.step-import-settings .mapping-area .mapping-rows .mapping-row .field-column .el-select {
  width: 100%;
}

.step-import-settings .validation-results {
  margin-top: 10px;
}

/* 移动端适配样式 */
.step-import-settings.mobile .settings-header {
  margin-bottom: 15px;
}

.step-import-settings.mobile .mobile-alert {
  font-size: 14px;
}

.step-import-settings.mobile .mapping-area {
  border: none;
  background: transparent;
}

/* 移动端映射列表 */
.mobile-mapping-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.mobile-mapping-item {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.mobile-mapping-item .mapping-header-mobile {
  background: #f5f7fa;
  padding: 12px 15px;
  border-bottom: 1px solid #ebeef5;
}

.mobile-mapping-item .excel-column-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 5px;
}

.mobile-mapping-item .excel-column-value {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.mobile-mapping-item .mapping-field-mobile {
  padding: 15px;
}

.mobile-mapping-item .field-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.mobile-mapping-item .field-select {
  width: 100%;
}

.step-import-settings.mobile .validation-results {
  margin-top: 15px;
}

.step-import-settings.mobile .mobile-validation {
  font-size: 14px;
}

/* 桌面端映射隐藏 */
.desktop-mapping {
  display: block;
}

.step-import-settings.mobile .desktop-mapping {
  display: none;
}

/* 响应式断点 */
@media (max-width: 768px) {
  .step-import-settings {
    gap: 15px;
  }
  
  .mobile-mapping-list {
    gap: 12px;
  }
  
  .mobile-mapping-item .mapping-header-mobile {
    padding: 10px 12px;
  }
  
  .mobile-mapping-item .mapping-field-mobile {
    padding: 12px;
  }
  
  .mobile-mapping-item .excel-column-value {
    font-size: 13px;
  }
  
  .mobile-mapping-item .field-label {
    font-size: 11px;
    margin-bottom: 6px;
  }
}

@media (max-width: 480px) {
  .step-import-settings {
    gap: 12px;
  }
  
  .mobile-mapping-list {
    gap: 10px;
  }
  
  .mobile-mapping-item .mapping-header-mobile {
    padding: 8px 10px;
  }
  
  .mobile-mapping-item .mapping-field-mobile {
    padding: 10px;
  }
  
  .mobile-mapping-item .excel-column-value {
    font-size: 12px;
  }
  
  .mobile-mapping-item .field-label {
    font-size: 10px;
    margin-bottom: 5px;
  }
}

/* 触摸优化 */
@media (hover: none) and (pointer: coarse) {
  .mobile-mapping-item:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .mobile-mapping-item .mapping-field-mobile:hover {
    background-color: #fafafa;
  }
}
</style>
