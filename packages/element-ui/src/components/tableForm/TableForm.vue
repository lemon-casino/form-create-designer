<template>
    <div class="_fc-table-form" :class="{'_fc-disabled': disabled}">
        <component :is="Form" :option="options" :rule="rule" :extendOption="true"
                   :disabled="disabled"
                   @change="formChange"
                   v-model:api="fapi"
                   @emit-event="$emit"></component>
        <el-button link type="primary" class="fc-clock" v-if="!disabled" @click="batchImport">
            <i class="fc-icon icon-import" style="font-weight: 700;"></i>
            {{ formCreateInject.t('batchImport') || '批量导入' }}
        </el-button>
        <el-button link type="primary" class="fc-clock" v-if="hasData" @click="batchExport" :loading="exporting">
            <i class="fc-icon icon-save" style="font-weight: 700;"></i>
            {{ formCreateInject.t('batchExport') || '批量导出' }}
        </el-button>
        <el-button link type="primary" class="fc-clock" v-if="(!max || max > this.trs.length) && !disabled"
                   @click="addRaw(true)"><i class="fc-icon icon-add-circle" style="font-weight: 700;"></i>
            {{ formCreateInject.t('add') || '添加' }}
        </el-button>
        <ImportSteps
            v-model="showImport"
            :columns="columns"
            :on-import="handleImport"
        />
        
        <!-- 导出进度对话框 -->
        <el-dialog
            v-model="showExportProgress"
            :title="formCreateInject.t('exporting') || '正在导出'"
            width="30%"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :show-close="false">
            <div class="export-progress">
                <p>{{ exportProgressText }}</p>
                <el-progress :percentage="exportProgressPercentage" :indeterminate="exportProgressPercentage === 0"></el-progress>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import {markRaw, reactive} from 'vue';
import ImportSteps from '../import/ImportSteps.vue';
import * as XLSX from 'xlsx';

export default {
    name: 'TableForm',
    components: { ImportSteps },
    emits: ['change', 'add', 'delete', 'update:modelValue', 'batch-import', 'batch-export'],
    props: {
        formCreateInject: Object,
        modelValue: {
            type: Array,
            default: () => [],
        },
        columns: {
            type: Array,
            required: true,
            default: () => []
        },
        filterEmptyColumn: {
            type: Boolean,
            default: true,
        },
        options: {
            type: Object,
            default: () => reactive(({
                submitBtn: false,
                resetBtn: false,
            }))
        },
        max: Number,
        disabled: Boolean,
        exportConfig: {
            type: Object,
            default: () => ({
                // 是否将值转换为标签文本
                useLabel: true,
                // 是否尝试从缓存获取标签
                useCache: true,
                // 缓存key前缀
                cacheKeyPrefix: 'api_select_label_cache_',
                // 导出文件名，支持函数和字符串
                fileName: 'export.xlsx',
                // 导出格式，支持 'xlsx' 和 'csv'
                format: 'xlsx',
                // CSV格式分隔符，仅在format为csv时有效
                csvSeparator: ',',
                // 是否显示导出进度
                showProgress: true,
                // 导出前数据处理钩子，返回处理后的数据
                beforeExport: null,
                // 标准组件优先级是否高于自定义组件
                standardComponentPriority: true,
                // 标准组件类型列表
                standardComponents: ['radio', 'checkbox', 'select', 'cascader', 'rate', 'slider', 'switch'],
                // 自定义工作表选项
                sheetOptions: {
                    // 工作表名称
                    sheetName: 'Sheet1',
                    // 是否添加序号列
                    showIndex: false,
                    // 序号列标题
                    indexTitle: '序号',
                }
            })
        },
    },
    watch: {
        modelValue: {
            handler() {
                this.updateTable()
            },
            deep: true
        },
        'formCreateInject.preview': function (n) {
            this.emptyRule.children[0].props.colspan = this.columns.length + (n ? 1 : 2);
        },
    },
    data() {
        // 确保 modelValue 是一个数组
        const modelValue = Array.isArray(this.modelValue) ? this.modelValue : [];
        
        return {
            rule: [],
            trs: [],
            fapi: {},
            Form: markRaw(this.formCreateInject.form.$form()),
            copyTrs: '',
            oldValue: '',
            showImport: false,
            labelCache: {},
            exporting: false,
            showExportProgress: false,
            exportProgressPercentage: 0,
            exportProgressText: '',
            internalModelValue: modelValue, // 添加内部 modelValue 副本
            emptyRule: {
                type: 'tr',
                _isEmpty: true,
                native: true,
                subRule: true,
                children: [
                    {
                        type: 'td',
                        style: {
                            textAlign: 'center',
                        },
                        native: true,
                        subRule: true,
                        props: {
                            colspan: this.columns.length + (this.formCreateInject.preview ? 1 : 2),
                        },
                        children: [this.formCreateInject.t('dataEmpty') || '暂无数据']
                    }
                ]
            },
        };
    },
    computed: {
        hasData() {
            return Array.isArray(this.internalModelValue) && this.internalModelValue.length > 0;
        }
    },
    methods: {
        getOptionLabel(value, rule, field) {
            // 如果没有值或规则，直接返回原值
            if (value === undefined || value === null || !rule) {
                return value;
            }
            
            const type = rule.type;
            
            // 只对 UserSelect 组件进行标签转换，其他所有组件都直接返回原值
            if (type !== 'UserSelect') {
                return value;
            }
            
            // 确保 exportConfig 已初始化
            const exportConfig = this.exportConfig || {
                useCache: true
            };
            
            // 只对 UserSelect 组件进行缓存标签转换
            if (exportConfig.useCache) {
                try {
                    // 对于多选框，值可能是数组
                    if (Array.isArray(value)) {
                        return value.map(v => {
                            // 尝试多种可能的键名获取缓存
                            const urlKey = rule.url || field;
                            return this.getLabelFromCache(urlKey, v, rule) || 
                                   // 尝试不带前缀的键
                                   this.getLabelFromCache(v, v, rule) || 
                                   v;
                        }).join(', ');
                    } else {
                        // 尝试多种可能的键名获取缓存
                        const urlKey = rule.url || field;
                        return this.getLabelFromCache(urlKey, value, rule) || 
                               // 尝试不带前缀的键
                               this.getLabelFromCache(value, value, rule) || 
                               value;
                    }
                } catch (e) {
                    console.error('获取标签缓存失败:', e);
                }
            }
            
            return value;
        },
        
        // 从localStorage缓存中获取标签
        getLabelFromCache(key, value, rule) {
            try {
                // 确保 exportConfig 已初始化
                const exportConfig = this.exportConfig || {
                    useCache: true,
                    cacheKeyPrefix: 'api_select_label_cache_'
                };
                
                if (!exportConfig.useCache || value === undefined || value === null) {
                    return null;
                }
                
                // 只对 UserSelect 组件使用缓存标签转换
                if (!rule || rule.type !== 'UserSelect') {
                    return null;
                }
                
                // 将value转换为字符串
                const stringValue = String(value);
                
                // 1. 优先使用全局labelCache对象的getLabel方法
                if (window && window.labelCache && typeof window.labelCache.getLabel === 'function') {
                    // 尝试多种可能的key来调用全局labelCache
                    const possibleKeys = [];
                    
                    // 如果rule有url属性，优先使用url
                    if (rule && rule.url) {
                        possibleKeys.push(rule.url);
                    }
                    
                    // 使用传入的key
                    if (key) {
                        possibleKeys.push(key);
                    }
                    
                    // 如果rule有field属性，也尝试使用field
                    if (rule && rule.field) {
                        possibleKeys.push(rule.field);
                    }
                    
                    // 对于UserSelect组件，尝试一些常见的key
                    possibleKeys.push('UserSelect', 'user', 'users');
                    
                    // 尝试所有可能的key
                    for (const possibleKey of possibleKeys) {
                        try {
                            const label = window.labelCache.getLabel(possibleKey, stringValue);
                            if (label && label !== stringValue) {
                                console.log(`通过全局labelCache找到标签: key=${possibleKey}, value=${stringValue}, label=${label}`);
                                return label;
                            }
                        } catch (e) {
                            // 继续尝试下一个key
                        }
                    }
                }
                
                // 2. 尝试使用全局反向查找函数（如果存在）
                if (window && window.labelCache && typeof window.labelCache.findLabelByValue === 'function') {
                    try {
                        const label = window.labelCache.findLabelByValue(stringValue);
                        if (label && label !== stringValue) {
                            console.log(`通过全局反向查找找到标签: value=${stringValue}, label=${label}`);
                            return label;
                        }
                    } catch (e) {
                        // 忽略错误，继续其他方法
                    }
                }
                
                // 3. 尝试从已扫描的缓存中获取（只对 UserSelect 组件）
                if (this.labelCache && this.labelCache[stringValue]) {
                    console.log(`从本地缓存找到标签: value=${stringValue}, label=${this.labelCache[stringValue]}`);
                    return this.labelCache[stringValue];
                }
                
                // 4. 手动从localStorage查找，使用与另一个项目兼容的格式
                const possibleCacheKeys = this.generateCacheKeys(key, value, rule);
                
                for (const cacheKey of possibleCacheKeys) {
                    try {
                        const cached = localStorage.getItem(cacheKey);
                        if (cached) {
                            // 尝试解析JSON格式
                            try {
                                const data = JSON.parse(cached);
                                if (data.label && data.label !== stringValue) {
                                    console.log(`从localStorage找到标签(JSON格式): ${cacheKey} -> ${data.label}`);
                                    return data.label;
                                }
                            } catch (e) {
                                // 如果解析失败，说明是直接存储的字符串
                                if (cached !== stringValue) {
                                    console.log(`从localStorage找到标签(字符串格式): ${cacheKey} -> ${cached}`);
                                    return cached;
                                }
                            }
                        }
                    } catch (e) {
                        // 继续尝试下一个缓存键
                    }
                }
                
                return null;
            } catch (e) {
                console.error('读取标签缓存失败:', e);
                return null;
            }
        },
        
        // 生成所有可能的缓存键
        generateCacheKeys(key, value, rule) {
            const stringValue = String(value);
            const cacheKeys = [];
            
            // 基础前缀列表
            const basePrefixes = [
                'api_select_label_cache_', // 标准前缀
                'user_cache_',
                'users_cache_'
            ];
            
            // 可能的键名列表
            const possibleKeys = [];
            
            // 添加各种可能的键名
            if (rule && rule.url) {
                possibleKeys.push(rule.url);
            }
            if (key) {
                possibleKeys.push(key);
            }
            if (rule && rule.field) {
                possibleKeys.push(rule.field);
            }
            if (rule && rule.type) {
                possibleKeys.push(rule.type);
                possibleKeys.push(rule.type.toLowerCase());
            }
            
            // 对于UserSelect组件，添加更多可能的键名
            if (rule && rule.type === 'UserSelect') {
                possibleKeys.push('UserSelect', 'user', 'users', 'User', 'Users');
            }
            
            // 生成所有可能的缓存键组合
            for (const prefix of basePrefixes) {
                for (const possibleKey of possibleKeys) {
                    // 格式1: prefix + key + _ + value (与另一个项目兼容)
                    cacheKeys.push(`${prefix}${possibleKey}_${stringValue}`);
                    
                    // 格式2: prefix + key + :: + value (新格式)
                    cacheKeys.push(`${prefix}${possibleKey}::${stringValue}`);
                }
                
                // 直接使用前缀 + 值的格式
                cacheKeys.push(`${prefix}${stringValue}`);
            }
            
            // 添加一些特殊格式
            cacheKeys.push(`user_${stringValue}`);
            cacheKeys.push(`users_${stringValue}`);
            
            return cacheKeys;
        },
        formChange() {
            this.updateValue();
        },
        batchImport() {
            this.showImport = true;
            this.$emit('batch-import');
        },
        batchExport() {
            // 设置导出状态
            this.exporting = true;
            
            // 使用内部 modelValue 副本
            const modelValue = this.internalModelValue;
            
            // 如果配置了显示进度，则显示进度对话框
            if (this.exportConfig && this.exportConfig.showProgress) {
                this.showExportProgress = true;
                this.exportProgressPercentage = 0;
                this.exportProgressText = this.formCreateInject.t('preparingExport') || '正在准备导出数据...';
            }
            
            // 使用setTimeout延迟执行，以便UI能够更新
            setTimeout(async () => {
                try {
                    // 首先尝试预加载所有标签
                    this.updateExportProgress(10, this.formCreateInject.t('loadingLabels') || '正在加载标签数据...');
                    await this.preloadLabelsForExport();
                    
                    // 扫描localStorage中的所有标签缓存
                    this.updateExportProgress(20, this.formCreateInject.t('scanningCache') || '正在扫描缓存...');
                    this.scanLocalStorageForLabels();
                    
                    // 准备导出数据
                    this.updateExportProgress(40, this.formCreateInject.t('preparingData') || '正在准备数据...');
                    let exportData = (modelValue).map((row, index) => {
                        // 更新进度
                        const progressPercentage = Math.min(40 + Math.floor((index / modelValue.length) * 40), 80);
                        this.updateExportProgress(progressPercentage, this.formCreateInject.t('processingData') || '正在处理数据...');
                        
                        console.log(`\n=== 处理第 ${index + 1} 行数据 ===`);
                        console.log('原始行数据:', row);
                        
                        const item = {};
                        this.columns.forEach((col, colIndex) => {
                            const field = col.rule && col.rule[0] && col.rule[0].field;
                            if (field) {
                                // 获取字段值
                                const value = row[field];
                                const ruleObj = col.rule[0];
                                
                                console.log(`\n--- 处理列 ${colIndex + 1}: ${col.label} ---`);
                                console.log('字段名:', field);
                                console.log('原始值:', value);
                                console.log('组件类型:', ruleObj.type);
                                console.log('组件规则:', ruleObj);
                                
                                if (this.exportConfig.useLabel) {
                                    // 将值转换为对应的标签文本
                                    
                                    // 首先尝试从组件自身的options获取标签（优先处理标准组件）
                                    let label = this.getOptionLabel(value, ruleObj, field);
                                    console.log('getOptionLabel 结果:', label);
                                    
                                    // 如果无法从组件自身获取，则尝试从组件实例获取标签
                                    if (!label || label === value) {
                                        const componentLabel = this.tryGetLabelFromComponent(value, ruleObj, field);
                                        console.log('tryGetLabelFromComponent 结果:', componentLabel);
                                        if (componentLabel && componentLabel !== value) {
                                            label = componentLabel;
                                        }
                                    }
                                    
                                    // 如果仍然无法获取标签，尝试从扫描的缓存中获取
                                    if ((!label || label === value) && ruleObj.type === 'UserSelect' && this.labelCache && this.labelCache[value]) {
                                        console.log('从扫描缓存获取标签 (仅UserSelect):', this.labelCache[value]);
                                        label = this.labelCache[value];
                                    }
                                    
                                    console.log('最终标签值:', label);
                                    item[col.label] = label;
                                } else {
                                    // 直接使用原始值
                                    console.log('直接使用原始值 (useLabel=false)');
                                    item[col.label] = value;
                                }
                                
                                console.log(`${col.label}: ${value} -> ${item[col.label]}`);
                            }
                        });
                        
                        console.log('处理后的行数据:', item);
                        return item;
                    });
                    
                    // 应用导出前数据处理钩子
                    if (typeof this.exportConfig.beforeExport === 'function') {
                        try {
                            this.updateExportProgress(82, this.formCreateInject.t('processingCustomData') || '正在处理自定义数据...');
                            const processedData = await Promise.resolve(this.exportConfig.beforeExport(exportData, this.columns));
                            if (Array.isArray(processedData)) {
                                exportData = processedData;
                            } else {
                                console.warn('beforeExport钩子返回的数据不是数组，将使用原始数据');
                            }
                        } catch (error) {
                            console.error('应用beforeExport钩子失败:', error);
                        }
                    }
                    
                    // 添加序号列
                    if (this.exportConfig.sheetOptions && this.exportConfig.sheetOptions.showIndex) {
                        const indexTitle = this.exportConfig.sheetOptions.indexTitle || '序号';
                        exportData = exportData.map((item, index) => {
                            return {
                                [indexTitle]: index + 1,
                                ...item
                            };
                        });
                    }
                    
                    // 创建工作表
                    this.updateExportProgress(85, this.formCreateInject.t('creatingWorksheet') || '正在创建工作表...');
                    const ws = XLSX.utils.json_to_sheet(exportData);
                    const wb = XLSX.utils.book_new();
                    
                    // 获取工作表名称
                    const sheetName = this.exportConfig.sheetOptions && this.exportConfig.sheetOptions.sheetName 
                        ? this.exportConfig.sheetOptions.sheetName 
                        : 'Sheet1';
                    
                    XLSX.utils.book_append_sheet(wb, ws, sheetName);
                    
                    // 获取导出格式
                    const format = (this.exportConfig.format || 'xlsx').toLowerCase();
                    
                    // 获取文件名
                    let fileName = this.exportConfig.fileName || `export.${format}`;
                    
                    // 如果文件名是函数，则调用函数获取文件名
                    if (typeof fileName === 'function') {
                        try {
                            fileName = fileName(this.modelValue, this.columns);
                        } catch (e) {
                            console.error('获取文件名失败:', e);
                            fileName = `export.${format}`;
                        }
                    }
                    
                    // 确保文件名有正确的扩展名
                    if (!fileName.toLowerCase().endsWith(`.${format}`)) {
                        fileName += `.${format}`;
                    }
                    
                    // 导出文件
                    this.updateExportProgress(95, this.formCreateInject.t('exportingFile') || '正在导出文件...');
                    
                    // 根据格式导出文件
                    if (format === 'csv') {
                        // 获取CSV分隔符
                        const separator = this.exportConfig.csvSeparator || ',';
                        
                        // 使用XLSX库导出CSV
                        const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: separator });
                        
                        // 创建Blob对象
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        
                        // 创建下载链接
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = fileName;
                        link.style.display = 'none';
                        
                        // 添加到DOM并触发点击
                        document.body.appendChild(link);
                        link.click();
                        
                        // 清理
                        setTimeout(() => {
                            document.body.removeChild(link);
                            URL.revokeObjectURL(link.href);
                        }, 100);
                    } else {
                        // 默认导出为Excel
                        XLSX.writeFile(wb, fileName);
                    }
                    
                    // 完成导出
                    this.updateExportProgress(100, this.formCreateInject.t('exportComplete') || '导出完成！');
                    this.$emit('batch-export', exportData);
                    
                    // 延迟关闭进度对话框
                    setTimeout(() => {
                        this.showExportProgress = false;
                        this.exporting = false;
                    }, 500);
                } catch (error) {
                    console.error('导出失败:', error);
                    this.updateExportProgress(0, this.formCreateInject.t('exportFailed') || '导出失败！');
                    
                    // 延迟关闭进度对话框
                    setTimeout(() => {
                        this.showExportProgress = false;
                        this.exporting = false;
                    }, 2000);
                }
            }, 100);
        },
        handleImport(data) {
            this.$emit('update:modelValue', data);
            this.$emit('change', data);
            return Promise.resolve();
        },
        updateValue() {
            try {
                const value = this.trs.map((tr, idx) => {
                    return {
                        ...(this.internalModelValue[idx] || {}),
                        ...this.fapi.getChildrenFormData(tr)
                    }
                }).filter(v => {
                    if (!this.filterEmptyColumn) {
                        return true;
                    }
                    if (v === undefined || v === null) {
                        return false;
                    }
                    let flag = false;
                    Object.keys(v).forEach(k => {
                        flag = flag || (v[k] !== undefined && v[k] !== '' && v[k] !== null)
                    })
                    return flag;
                });
                const str = JSON.stringify(value);
                if (str !== this.oldValue) {
                    this.oldValue = str;
                    this.internalModelValue = value; // 更新内部 modelValue 副本
                    this.$emit('update:modelValue', value);
                    this.$emit('change', value);
                }
            } catch (error) {
                console.error('TableForm: Error in updateValue', error);
                // 确保组件不会因为错误而崩溃
                this.$emit('update:modelValue', []);
                this.$emit('change', []);
            }
        },
        setRawData(idx, formData) {
            const raw = this.trs[idx];
            this.fapi.setChildrenFormData(raw, formData, true);
        },
        updateTable() {
            try {
                // 更新内部 modelValue 副本，处理不同类型的数据
                if (Array.isArray(this.modelValue)) {
                    // 如果是数组，直接使用
                    this.internalModelValue = this.modelValue;
                } else if (this.modelValue && typeof this.modelValue === 'object') {
                    // 处理对象格式的数据
                    console.log('TableForm: modelValue is an object', this.modelValue);
                    
                    // 检查对象中是否有数组属性
                    const arrayProps = Object.entries(this.modelValue).find(([_, value]) => Array.isArray(value));
                    
                    if (arrayProps) {
                        // 如果找到了数组属性，使用该数组作为数据源
                        console.log(`TableForm: Found array property ${arrayProps[0]}`, arrayProps[1]);
                        this.internalModelValue = arrayProps[1];
                    } else {
                        // 否则，将整个对象作为单行数据
                        console.log('TableForm: No array property found, using object as single row');
                        this.internalModelValue = [this.modelValue];
                    }
                } else {
                    // 如果不是数组也不是对象，使用空数组
                    this.internalModelValue = [];
                }
                
                const str = JSON.stringify(this.internalModelValue);
                if (this.oldValue === str) {
                    return;
                }
                this.oldValue = str;
                this.trs = this.trs.splice(0, this.internalModelValue.length);
                if (!this.internalModelValue.length) {
                    this.addEmpty();
                } else {
                    this.clearEmpty();
                }
                
                // 使用安全的数组引用
                this.internalModelValue.forEach((data, idx) => {
                    if (!this.trs[idx]) {
                        this.addRaw();
                    }
                    this.setRawData(idx, data || {});
                });
                
                this.rule[0].children[1].children = this.trs;
            } catch (error) {
                console.error('TableForm: Error in updateTable', error);
                // 确保组件不会因为错误而崩溃
                this.addEmpty();
                this.rule[0].children[1].children = this.trs;
            }
        },
        addEmpty() {
            if (this.trs.length) {
                this.trs.splice(0, this.trs.length);
            }
            this.trs.push(this.emptyRule);
        },
        clearEmpty() {
            if (this.trs[0] && this.trs[0]._isEmpty) {
                this.trs.splice(0, 1);
            }
        },
        delRaw(idx) {
            if (this.disabled) {
                return;
            }
            this.trs.splice(idx, 1);
            this.updateValue();
            if (this.trs.length) {
                this.trs.forEach(tr => this.updateRaw(tr));
            } else {
                this.addEmpty();
            }
            this.$emit('delete', idx);
        },
        addRaw(flag) {
            if (flag && this.disabled) {
                return;
            }
            const tr = this.formCreateInject.form.parseJson(this.copyTrs)[0];
            if (this.trs.length === 1 && this.trs[0]._isEmpty) {
                this.trs.splice(0, 1);
            }
            this.trs.push(tr);
            this.updateRaw(tr);
            if (flag) {
                this.$emit('add', this.trs.length);
                this.updateValue();
            }
        },
        updateRaw(tr) {
            const idx = this.trs.indexOf(tr);
            tr.children[0].props.innerText = idx + 1;
            tr.children[tr.children.length - 1].children[0].props.onClick = () => {
                this.delRaw(idx);
            };
        },
        loadRule() {
            const header = [{
                type: 'th',
                native: true,
                class: '_fc-tf-head-idx',
                props: {
                    innerText: '#'
                }
            }];
            let body = [{
                type: 'td',
                class: '_fc-tf-idx',
                native: true,
                props: {
                    innerText: '0'
                }
            }];
            this.columns.forEach((column) => {
                header.push({
                    type: 'th',
                    native: true,
                    style: column.style,
                    class: column.required ? '_fc-tf-head-required' : '',
                    props: {
                        innerText: column.label || ''
                    }
                });
                body.push({
                    type: 'td',
                    native: true,
                    children: [...(column.rule || [])]
                });
            });
            header.push({
                type: 'th',
                native: true,
                class: '_fc-tf-edit fc-clock',
                props: {
                    innerText: this.formCreateInject.t('operation') || '操作'
                }
            });
            body.push({
                type: 'td',
                native: true,
                class: '_fc-tf-btn fc-clock',
                children: [
                    {
                        type: 'i',
                        native: true,
                        class: 'fc-icon icon-delete',
                        props: {},
                    }
                ],
            });
            this.copyTrs = this.formCreateInject.form.toJson([
                {
                    type: 'tr',
                    native: true,
                    subRule: true,
                    children: body
                }
            ]);
            this.rule = [
                {
                    type: 'table',
                    native: true,
                    class: '_fc-tf-table',
                    props: {
                        border: '1',
                        cellspacing: '0',
                        cellpadding: '0',
                    },
                    children: [
                        {
                            type: 'thead',
                            native: true,
                            children: [
                                {
                                    type: 'tr',
                                    native: true,
                                    children: header
                                }
                            ]
                        },
                        {
                            type: 'tbody',
                            native: true,
                            children: this.trs
                        }
                    ]
                }
            ]
        },
        // 更新导出进度
        updateExportProgress(percentage, text) {
            try {
                // 确保 exportConfig 已初始化
                const exportConfig = this.exportConfig || { showProgress: true };
                
                if (!exportConfig.showProgress) return;
                
                this.exportProgressPercentage = percentage;
                if (text) {
                    this.exportProgressText = text;
                }
            } catch (error) {
                console.error('TableForm: Error in updateExportProgress', error);
            }
        },
        
        // 预加载所有标签，用于导出
        preloadLabelsForExport() {
            try {
                // 检查window对象中是否存在全局标签缓存
                if (window && window.labelCache) {
                    // 如果存在全局labelCache对象，使用其扫描功能
                    if (typeof window.labelCache.scanAll === 'function') {
                        try {
                            const allLabels = window.labelCache.scanAll();
                            this.labelCache = { ...this.labelCache, ...allLabels };
                            console.log('使用全局扫描功能，找到', Object.keys(allLabels).length, '个标签');
                        } catch (e) {
                            console.error('使用全局扫描功能失败:', e);
                        }
                    }
                    
                    // 使用内部 modelValue 副本
                    const modelValue = this.internalModelValue;
                    
                    // 尝试预加载当前表单中的所有值
                    if (typeof window.labelCache.preload === 'function' && modelValue.length > 0) {
                        try {
                            // 收集所有需要预加载的ID和URL
                            const urlToIdsMap = new Map();
                            
                            modelValue.forEach(row => {
                                this.columns.forEach(col => {
                                    const field = col.rule && col.rule[0] && col.rule[0].field;
                                    const ruleObj = col.rule && col.rule[0];
                                    
                                    if (field && ruleObj && row[field] !== undefined && row[field] !== null) {
                                        const value = row[field];
                                        const url = ruleObj.url || field;
                                        
                                        if (!urlToIdsMap.has(url)) {
                                            urlToIdsMap.set(url, new Set());
                                        }
                                        
                                        if (Array.isArray(value)) {
                                            value.forEach(v => urlToIdsMap.get(url).add(v));
                                        } else {
                                            urlToIdsMap.get(url).add(value);
                                        }
                                    }
                                });
                            });
                            
                            // 对每个URL进行预加载
                            urlToIdsMap.forEach((ids, url) => {
                                const idsArray = Array.from(ids);
                                if (idsArray.length > 0) {
                                    console.log(`预加载URL[${url}]的${idsArray.length}个ID`);
                                    window.labelCache.preload(url, idsArray);
                                }
                            });
                        } catch (e) {
                            console.error('预加载标签失败:', e);
                        }
                    }
                    
                    return;
                }
                
                // 如果没有全局labelCache对象，使用原有的扫描方法
                const allCacheKeys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.indexOf('api_select_label_cache_') === 0) {
                        allCacheKeys.push(key);
                    }
                }
                
                console.log('预加载标签缓存，找到', allCacheKeys.length, '个缓存项');
            } catch (error) {
                console.error('TableForm: Error in preloadLabelsForExport', error);
            }
        },
        
        // 扫描localStorage中的所有标签缓存
        scanLocalStorageForLabels() {
            // 初始化标签缓存对象
            if (!this.labelCache) {
                this.labelCache = {};
            }
            
            // 如果有全局扫描函数，优先使用
            if (window && window.labelCache && typeof window.labelCache.scanAll === 'function') {
                try {
                    const allLabels = window.labelCache.scanAll();
                    this.labelCache = { ...this.labelCache, ...allLabels };
                    console.log('使用全局扫描功能，找到', Object.keys(allLabels).length, '个标签');
                    return;
                } catch (e) {
                    console.error('使用全局扫描功能失败:', e);
                }
            }
            
            // 扫描localStorage中的所有键
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // 扫描所有可能的缓存键前缀
                const cacheKeyPrefixes = [
                    'api_select_label_cache_',
                    'user_cache_',
                    'users_cache_',
                    'user_'
                ];
                
                let isValidCacheKey = false;
                for (const prefix of cacheKeyPrefixes) {
                    if (key && key.indexOf(prefix) === 0) {
                        isValidCacheKey = true;
                        break;
                    }
                }
                
                if (isValidCacheKey) {
                    try {
                        // 尝试解析键名，支持新旧两种格式
                        let value, label;
                        
                        // 尝试解析新格式 (使用::分隔符)
                        if (key.includes('::')) {
                            const parts = key.split('::');
                            if (parts.length >= 2) {
                                value = parts[parts.length - 1];
                                const cachedData = localStorage.getItem(key);
                                
                                if (cachedData) {
                                    try {
                                        // 尝试解析JSON格式
                                        const data = JSON.parse(cachedData);
                                        if (data.label) {
                                            label = data.label;
                                        }
                                    } catch (e) {
                                        // 如果解析失败，说明是直接存储的字符串
                                        label = cachedData;
                                    }
                                }
                            }
                        } 
                        // 尝试解析旧格式 (使用_分隔符)
                        else {
                            const parts = key.split('_');
                            if (parts.length >= 2) {
                                value = parts[parts.length - 1];
                                label = localStorage.getItem(key);
                            }
                        }
                        
                        if (label && value) {
                            // 存储到缓存对象中
                            this.labelCache[value] = label;
                        }
                    } catch (e) {
                        console.error('解析标签缓存键失败:', e);
                    }
                }
            }
            
            console.log('扫描标签缓存完成，找到', Object.keys(this.labelCache).length, '个标签');
        },
        
        tryGetLabelFromComponent(value, rule, field) {
            if (value === undefined || value === null || !rule) {
                return value;
            }
            
            // 只对 UserSelect 组件进行标签转换
            if (rule.type !== 'UserSelect') {
                return value;
            }
            
            // 使用配置中的标准组件列表
            const type = rule.type;
            
            try {
                // 1. 优先检查是否有全局的labelCache对象
                if (window && window.labelCache && typeof window.labelCache.getLabel === 'function') {
                    // 为全局labelCache尝试多种可能的key
                    const possibleKeys = [];
                    
                    if (rule.url) {
                        possibleKeys.push(rule.url);
                    }
                    if (field) {
                        possibleKeys.push(field);
                    }
                    if (rule.field) {
                        possibleKeys.push(rule.field);
                    }
                    // 对于UserSelect组件，添加常见的key
                    possibleKeys.push('UserSelect', 'user', 'users');
                    
                    // 尝试每个可能的key
                    for (const possibleKey of possibleKeys) {
                        try {
                            if (Array.isArray(value)) {
                                const labels = value.map(v => {
                                    const label = window.labelCache.getLabel(possibleKey, String(v));
                                    return label && label !== String(v) ? label : v;
                                });
                                // 如果至少有一个值被成功转换，返回结果
                                if (labels.some((label, index) => label !== value[index])) {
                                    console.log(`通过全局labelCache转换数组值: key=${possibleKey}, values=${value} -> labels=${labels}`);
                                    return labels.join(', ');
                                }
                            } else {
                                const label = window.labelCache.getLabel(possibleKey, String(value));
                                if (label && label !== String(value)) {
                                    console.log(`通过全局labelCache转换单个值: key=${possibleKey}, value=${value} -> label=${label}`);
                                    return label;
                                }
                            }
                        } catch (e) {
                            // 继续尝试下一个key
                        }
                    }
                }
                
                // 2. 检查是否有全局的modelValueLabels映射
                if (window && window.modelValueLabels) {
                    if (Array.isArray(value)) {
                        const labels = value.map(v => {
                            const stringValue = String(v);
                            return window.modelValueLabels[stringValue] || v;
                        });
                        // 如果至少有一个值被成功转换，返回结果
                        if (labels.some((label, index) => label !== value[index])) {
                            console.log(`通过全局modelValueLabels转换数组值: values=${value} -> labels=${labels}`);
                            return labels.join(', ');
                        }
                    } else {
                        const stringValue = String(value);
                        const label = window.modelValueLabels[stringValue];
                        if (label && label !== stringValue) {
                            console.log(`通过全局modelValueLabels转换单个值: value=${value} -> label=${label}`);
                            return label;
                        }
                    }
                }
                
                // 3. 尝试扫描DOM中的select元素，查找匹配的option
                if (typeof document !== 'undefined') {
                    const selects = document.querySelectorAll('select');
                    for (let i = 0; i < selects.length; i++) {
                        const select = selects[i];
                        const options = select.querySelectorAll('option');
                        for (let j = 0; j < options.length; j++) {
                            const option = options[j];
                            if (option.value == value) {
                                const label = option.textContent || option.innerText;
                                if (label && label !== String(value)) {
                                    console.log(`从DOM中找到标签: value=${value} -> label=${label}`);
                                    return label;
                                }
                            }
                        }
                    }
                }
                
                // 4. 尝试从Vue组件实例中获取（对所有组件有效）
                if (this.fapi && this.fapi.$form && this.fapi.$form.$children) {
                    // 遍历所有子组件
                    const findLabel = (components, val) => {
                        for (const component of components) {
                            // 检查组件是否有options属性
                            if (component.options && Array.isArray(component.options)) {
                                const option = component.options.find(opt => opt.value == val);
                                if (option) {
                                    return option.label;
                                }
                            }
                            
                            // 检查组件是否有modelValueLabels属性
                            if (component.modelValueLabels && component.modelValueLabels[val]) {
                                return component.modelValueLabels[val];
                            }
                            
                            // 递归检查子组件
                            if (component.$children && component.$children.length) {
                                const label = findLabel(component.$children, val);
                                if (label) {
                                    return label;
                                }
                            }
                        }
                        return null;
                    };
                    
                    if (Array.isArray(value)) {
                        const labels = value.map(v => {
                            return findLabel(this.fapi.$form.$children, v) || v;
                        });
                        // 如果至少有一个值被成功转换，返回结果
                        if (labels.some((label, index) => label !== value[index])) {
                            console.log(`从Vue组件实例转换数组值: values=${value} -> labels=${labels}`);
                            return labels.join(', ');
                        }
                    } else {
                        const label = findLabel(this.fapi.$form.$children, value);
                        if (label && label !== String(value)) {
                            console.log(`从Vue组件实例转换单个值: value=${value} -> label=${label}`);
                            return label;
                        }
                    }
                }
            } catch (e) {
                console.error('尝试从组件获取标签失败:', e);
            }
            
            return value;
        },
    },
    created() {
        this.loadRule();
    },
    mounted() {
        try {
            // 使用 updateTable 方法处理各种类型的 modelValue
            // 不直接修改父组件的 modelValue，而是在内部处理
            this.updateTable();
        } catch (error) {
            console.error('TableForm: Error in mounted hook', error);
            // 确保组件不会因为错误而崩溃
            this.addEmpty();
            this.rule[0].children[1].children = this.trs;
        }
    }
};
</script>

<style>
._fc-table-form {
  overflow: auto;
  color: #666666;
}

._fc-table-form .form-create .el-form-item {
  margin-bottom: 1px;
}

._fc-table-form .form-create .el-form-item.is-error {
  margin-bottom: 22px;
}

._fc-table-form .el-form-item__label, ._fc-table-form .van-field__label {
  display: none !important;
}

._fc-table-form .el-form-item__content {
  display: flex;
  margin-left: 0px !important;
  width: 100% !important;
}

._fc-tf-head-idx, ._fc-tf-idx {
  width: 40px;
  min-width: 40px;
  font-weight: 500;
  text-align: center;
}

._fc-tf-edit, ._fc-tf-btn {
  width: 70px;
  min-width: 70px;
  text-align: center;
}

._fc-tf-btn .fc-icon {
  cursor: pointer;
}

._fc-table-form._fc-disabled ._fc-tf-btn .fc-icon, ._fc-table-form._fc-disabled > .el-button {
  cursor: not-allowed;
}

._fc-tf-table {
  width: max-content;
  min-width: 100%;
  height: 100%;
  overflow: hidden;
  table-layout: auto;
  border: 1px solid #EBEEF5;
  border-bottom: 0 none;
}

._fc-table-form ._fc-tf-table > thead > tr > th {
  border: 0 none;
  border-bottom: 1px solid #EBEEF5;
  height: 40px;
  font-weight: 500;
}

._fc-table-form ._fc-tf-table > thead > tr > th + th {
  border-left: 1px solid #EBEEF5;
}

._fc-table-form tr {
  min-height: 50px;
}

._fc-table-form ._fc-read-view {
  text-align: center;
  width: 100%;
}

._fc-table-form td {
  padding: 5px;
  min-height: 50px;
  min-width: 80px;
  position: relative;
  box-sizing: border-box;
  overflow-wrap: break-word;
  /*white-space: nowrap;*/
  overflow: hidden;
  border: 0 none;
  border-bottom: 1px solid #EBEEF5;
}

._fc-table-form td + td {
  border-left: 1px solid #EBEEF5;
}

._fc-tf-table .el-input-number, ._fc-tf-table .el-select, ._fc-tf-table .el-slider, ._fc-tf-table .el-cascader, ._fc-tf-table .el-date-editor {
  width: 100%;
}

._fc-tf-head-required:before {
  content: '*';
  color: #f56c6c;
  margin-right: 4px;
}
</style>
