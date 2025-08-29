<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    :width="isMobile ? '95%' : '800px'"
    :close-on-click-modal="false"
    :destroy-on-close="true"
    :class="{ 'mobile-dialog': isMobile }"
    @closed="onClose"
  >
    <div class="import-steps">
      <div class="manual-steps mb-20px" :class="{ 'mobile-steps': isMobile }">
        <div
          v-for="(step, index) in stepTitles"
          :key="index"
          class="manual-step"
          :class="{ 
            active: index === activeStep, 
            done: index < activeStep,
            'mobile-step': isMobile 
          }"
        >
          <div class="step-indicator">{{ index + 1 }}</div>
          <div class="step-label">{{ step }}</div>
        </div>
      </div>

      <div class="step-content" :class="{ 'mobile-content': isMobile }">
        <!-- 步骤1: 选择EXCEL表 -->
        <StepSelectFile
          v-if="activeStep === 0"
          :columns="columns"
          :table-title="tableTitle"
          :is-mobile="isMobile"
          @select-file="handleFileSelected"
          @download-template="handleDownloadTemplate"
        />

        <!-- 步骤2: 数据预览 -->
        <StepPreviewData
          v-if="activeStep === 1"
          :excel-data="excelData"
          :sheets="excelSheets"
          :selected-sheet="selectedSheet"
          :is-mobile="isMobile"
          @change-sheet="handleSheetChange"
        />

        <!-- 步骤3: 导入设置 -->
        <StepImportSettings
          v-if="activeStep === 2"
          :excel-data="excelData"
          :columns="columns"
          :column-mapping="columnMapping"
          :is-mobile="isMobile"
          @update-mapping="handleUpdateMapping"
        />

        <!-- 步骤4: 导入数据 -->
        <StepImportData
          v-if="activeStep === 3"
          :status="importStatus"
          :total="importTotal"
          :success="importSuccess"
          :fail="importFail"
          :warnings="importWarnings"
          :is-mobile="isMobile"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer" :class="{ 'mobile-footer': isMobile }">
        <el-button @click="dialogVisible = false" :size="isMobile ? 'large' : 'default'">取消</el-button>
        <el-button 
          v-if="activeStep > 0" 
          @click="prevStep"
          :size="isMobile ? 'large' : 'default'"
        >
          上一步
        </el-button>
        <el-button 
          v-if="activeStep < 3" 
          type="primary" 
          :disabled="!canGoNext"
          :size="isMobile ? 'large' : 'default'"
          @click="nextStep"
        >
          下一步
        </el-button>
        <el-button 
          v-if="activeStep === 3 && importStatus === 'success'"
          type="primary" 
          :size="isMobile ? 'large' : 'default'"
          @click="dialogVisible = false"
        >
          完成
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import StepSelectFile from './steps/StepSelectFile.vue'
import StepPreviewData from './steps/StepPreviewData.vue'
import StepImportSettings from './steps/StepImportSettings.vue'
import StepImportData from './steps/StepImportData.vue'
import * as XLSX from 'xlsx'
import { ElMessage } from 'element-plus'

defineOptions({ name: 'ImportSteps' })

// 定义组件接受的参数
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  columns: {
    type: Array,
    required: true
  },
  tableTitle: {
    type: String,
    default: ''
  },
  onImport: {
    type: Function,
    required: true
  }
})

// 定义组件事件
const emit = defineEmits(['update:modelValue', 'imported'])

// 移动端检测
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// 对话框可见性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 对话框标题
const title = computed(() => `批量导入${props.tableTitle || '数据'}`)

// 步骤标题
const stepTitles = ['选择EXCEL表', '数据预览', '导入设置', '导入数据']

// 当前激活的步骤
const activeStep = ref(0)

// Excel相关数据
const excelFile = ref(null)
const excelData = ref([])
const excelSheets = ref([])
const selectedSheet = ref('')

// 映射关系
const columnMapping = ref({})

// 导入状态和结果
const importStatus = ref('idle')
const importTotal = ref(0)
const importSuccess = ref(0)
const importFail = ref(0)
const importWarnings = ref([])

// 是否可以进入下一步
const canGoNext = computed(() => {
  switch (activeStep.value) {
    case 0:
      return !!excelFile.value
    case 1:
      return excelData.value.length > 0
    case 2:
      return Object.keys(columnMapping.value).length > 0
    default:
      return true
  }
})

// 上一步
const prevStep = () => {
  if (activeStep.value > 0) {
    activeStep.value--
  }
}

// 下一步
const nextStep = async () => {
  if (activeStep.value < 3) {
    if (activeStep.value === 2) {
      importStatus.value = 'importing'
      startImport()
    }
    activeStep.value++
  }
}

// 处理文件选择
const handleFileSelected = async (file) => {
  excelFile.value = file
  try {
    const arrayBuffer = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    const readOpts = {
      type: 'array',
      raw: true,
      cellDates: true,
      cellStyles: true,
      cellNF: true,
      dateNF: 'yyyy-mm-dd',
      sheetStubs: true,
      WTF: true
    }

    const workbook = XLSX.read(data, readOpts)
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('无效的Excel文件结构')
    }

    excelSheets.value = workbook.SheetNames
    selectedSheet.value = workbook.SheetNames[0]

    const sheetName = selectedSheet.value
    const worksheet = workbook.Sheets[sheetName]

    if (!worksheet) {
      throw new Error(`无法获取工作表: ${sheetName}`)
    }

    let allData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false
    })

    if (!allData || allData.length === 0) {
      throw new Error('Excel文件为空或格式不正确')
    }

    const headers = allData[0]

    if (Array.isArray(headers)) {
      excelData.value = allData.slice(1).map(row => {
        const obj = {}
        headers.forEach((header, index) => {
          if (header) {
            obj[header] = Array.isArray(row) && index < row.length ? row[index] : ''
          }
        })
        return obj
      })
    } else {
      excelData.value = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        blankrows: false
      })
    }

    if (!excelData.value || excelData.value.length === 0) {
      throw new Error('无法从Excel提取有效数据')
    }

    createInitialMapping()
  } catch (error) {
    excelData.value = []
    ElMessage.error('解析Excel文件失败: ' + (error.message || '未知错误'))
  }
}

// 创建初始字段映射关系
const createInitialMapping = () => {
  if (excelData.value.length === 0) return
  const firstRow = excelData.value[0]
  const mapping = {}

  for (const excelCol in firstRow) {
    const matchedColumn = props.columns.find((col) => {
      return col.label === excelCol || (col.rule && col.rule[0] && col.rule[0].field === excelCol)
    })

    if (matchedColumn) {
      mapping[excelCol] = matchedColumn.rule[0].field
    }
  }

  columnMapping.value = mapping
}

// 切换Sheet
const handleSheetChange = (sheet) => {
  selectedSheet.value = sheet
  if (!excelFile.value) return

  const reader = new FileReader()
  reader.onload = (e) => {
    if (!e.target || !e.target.result) return
    try {
      const data = new Uint8Array(e.target.result)
      const readOpts = {
        type: 'array',
        raw: true,
        cellDates: true,
        cellStyles: true,
        cellNF: true,
        dateNF: 'yyyy-mm-dd',
        sheetStubs: true,
        WTF: true
      }
      const workbook = XLSX.read(data, readOpts)
      const worksheet = workbook.Sheets[sheet]
      if (!worksheet) {
        throw new Error(`无法获取工作表: ${sheet}`)
      }
      let allData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false
      })
      if (!allData || allData.length === 0) {
        throw new Error('Excel工作表为空或格式不正确')
      }
      const headers = allData[0]
      if (Array.isArray(headers)) {
        excelData.value = allData.slice(1).map(row => {
          const obj = {}
          headers.forEach((header, index) => {
            if (header) {
              obj[header] = Array.isArray(row) && index < row.length ? row[index] : ''
            }
          })
          return obj
        })
      } else {
        excelData.value = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          blankrows: false
        })
      }
      if (!excelData.value || excelData.value.length === 0) {
        throw new Error('无法从Excel工作表提取有效数据')
      }
      createInitialMapping()
    } catch (error) {
      excelData.value = []
      ElMessage.error('切换Excel工作表失败: ' + (error.message || '未知错误'))
    }
  }
  reader.onerror = () => {
    ElMessage.error('读取Excel文件失败')
  }
  reader.readAsArrayBuffer(excelFile.value)
}

// 更新字段映射
const handleUpdateMapping = (mapping) => {
  columnMapping.value = mapping
}

// 处理模板下载
const handleDownloadTemplate = () => {
  const wb = XLSX.utils.book_new()
  const headers = props.columns.map((col) => col.label)
  const ws = XLSX.utils.aoa_to_sheet([headers])
  XLSX.utils.book_append_sheet(wb, ws, '导入模板')
  XLSX.writeFile(wb, `${props.tableTitle || '数据'}导入模板.xlsx`)
}

// 开始导入过程
const startImport = async () => {
  importTotal.value = excelData.value.length
  importSuccess.value = 0
  importFail.value = 0
  importWarnings.value = []
  try {
    const transformedData = excelData.value.map(row => {
      const result = {}
      for (const excelCol in row) {
        const fieldName = columnMapping.value[excelCol]
        if (fieldName) {
          result[fieldName] = row[excelCol]
        }
      }
      return result
    })

    props.columns.forEach((col) => {
      const field = col.rule && col.rule[0]
      if (field && field.$required) {
        transformedData.forEach((row, index) => {
          if (row[field.field] === undefined || row[field.field] === '') {
            importWarnings.value.push(`第${index + 1}行缺少必填字段: ${col.label}`)
          }
        })
      }
    })

    await props.onImport(transformedData)
    importSuccess.value = transformedData.length
    importStatus.value = 'success'
  } catch (error) {
    importFail.value = importTotal.value
    importStatus.value = 'error'
  }
}

// 关闭对话框时重置状态
const onClose = () => {
  activeStep.value = 0
  excelFile.value = null
  excelData.value = []
  excelSheets.value = []
  selectedSheet.value = ''
  columnMapping.value = {}
  importStatus.value = 'idle'
  importTotal.value = 0
  importSuccess.value = 0
  importFail.value = 0
  importWarnings.value = []

  if (importStatus.value === 'success') {
    emit('imported', {
      success: importSuccess.value,
      fail: importFail.value,
      warnings: importWarnings.value
    })
  }
}
</script>

<style scoped>
.import-steps {
  padding: 0 20px;
}
.import-steps .mb-20px {
  margin-bottom: 20px;
}
.manual-steps {
  display: flex;
  justify-content: space-between;
}
.manual-step {
  flex: 1;
  text-align: center;
  position: relative;
}
.manual-step::after {
  content: '';
  position: absolute;
  top: 12px;
  left: 50%;
  right: -50%;
  height: 1px;
  background: #dcdfe6;
}
.manual-step:last-child::after {
  display: none;
}
.manual-step.done::after,
.manual-step.active::after {
  background: #409eff;
}
.step-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 4px;
  background: #fff;
}
.manual-step.done .step-indicator,
.manual-step.active .step-indicator {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}
.step-label {
  font-size: 12px;
  color: #606266;
}
.manual-step.done .step-label,
.manual-step.active .step-label {
  color: #409eff;
}
.import-steps .step-content {
  min-height: 300px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 移动端适配样式 */
.mobile-dialog :deep(.el-dialog) {
  margin: 5vh auto;
  max-height: 90vh;
}

.mobile-dialog :deep(.el-dialog__body) {
  padding: 15px;
  max-height: 70vh;
  overflow-y: auto;
}

.mobile-dialog :deep(.el-dialog__header) {
  padding: 15px 20px;
}

.mobile-dialog :deep(.el-dialog__footer) {
  padding: 15px 20px;
}

/* 移动端步骤保持横向显示，但优化间距 */
.mobile-steps {
  flex-direction: row;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.mobile-step {
  flex: none;
  min-width: 120px;
}

.mobile-step::after {
  display: none;
}

.mobile-step .step-indicator {
  width: 28px;
  height: 28px;
  font-size: 14px;
  margin-bottom: 6px;
}

.mobile-step .step-label {
  font-size: 12px;
  line-height: 1.2;
  word-break: break-word;
}

.mobile-content {
  padding: 0 10px;
}

/* 移动端按钮上下对齐，修复错位 */
.mobile-footer {
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
}

.mobile-footer .el-button {
  width: 100%;
  height: 44px;
  font-size: 16px;
  margin: 0;
}

/* 响应式断点 */
@media (max-width: 768px) {
  .import-steps {
    padding: 0 10px;
  }
  
  .import-steps .mb-20px {
    margin-bottom: 15px;
  }
  
  .import-steps .step-content {
    min-height: 250px;
  }
  
  /* 移动端步骤优化 */
  .mobile-steps {
    gap: 8px;
  }
  
  .mobile-step {
    min-width: 100px;
  }
  
  .mobile-step .step-indicator {
    width: 26px;
    height: 26px;
    font-size: 13px;
  }
  
  .mobile-step .step-label {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .mobile-dialog :deep(.el-dialog) {
    margin: 2vh auto;
    max-height: 96vh;
  }
  
  .mobile-dialog :deep(.el-dialog__body) {
    padding: 10px;
  }
  
  .mobile-dialog :deep(.el-dialog__header) {
    padding: 10px 15px;
  }
  
  .mobile-dialog :deep(.el-dialog__footer) {
    padding: 10px 15px;
  }
  
  /* 小屏移动端步骤进一步优化 */
  .mobile-steps {
    gap: 6px;
  }
  
  .mobile-step {
    min-width: 80px;
  }
  
  .mobile-step .step-indicator {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
  
  .mobile-step .step-label {
    font-size: 10px;
  }
  
  .mobile-footer {
    gap: 10px;
  }
  
  .mobile-footer .el-button {
    height: 40px;
    font-size: 15px;
  }
}
</style>
