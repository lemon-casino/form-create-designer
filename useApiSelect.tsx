import request from '@/config/axios'
import { isEmpty } from '@/utils/is'
import { ApiSelectProps } from '@/components/FormCreate/src/type'
import { jsonParse } from '@/utils'
import { Fragment } from 'vue'

// 添加本地存储工具
const CACHE_KEY_PREFIX = 'api_select_label_cache_'
// 缓存键分隔符，用于分隔键名的不同部分
const CACHE_KEY_SEPARATOR = '::'
// 缓存有效期（毫秒），默认7天
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000
// 缓存最大数量
const CACHE_MAX_ITEMS = 1000
// 日志级别: 0=关闭, 1=错误, 2=警告, 3=信息, 4=调试
const LOG_LEVEL = 3

// 日志工具
const logger = {
  error(message: string, ...args: any[]): void {
    if (LOG_LEVEL >= 1) {
      console.error(`[ApiSelect错误] ${message}`, ...args)
    }
  },
  warn(message: string, ...args: any[]): void {
    if (LOG_LEVEL >= 2) {
      console.warn(`[ApiSelect警告] ${message}`, ...args)
    }
  },
  info(message: string, ...args: any[]): void {
    if (LOG_LEVEL >= 3) {
      console.info(`[ApiSelect信息] ${message}`, ...args)
    }
  },
  debug(message: string, ...args: any[]): void {
    if (LOG_LEVEL >= 4) {
      console.log(`[ApiSelect调试] ${message}`, ...args)
    }
  }
}

// 缓存持久化工具
const labelCache = {
  // 获取缓存的标签
  getLabel(key: string, value: string | number): string | null {
    try {
      if (!key || value === undefined || value === null) {
        logger.debug('获取缓存标签失败: 无效的键或值', { key, value })
        return null
      }
      
      // 优化缓存键格式，使用明确的分隔符
      const cacheKey = `${CACHE_KEY_PREFIX}${key}${CACHE_KEY_SEPARATOR}${value}`
      const cachedData = localStorage.getItem(cacheKey)
      
      if (!cachedData) {
        logger.debug('未找到缓存标签', { key, value, cacheKey })
        return null
      }
      
      try {
        // 尝试解析JSON格式的缓存数据
        const parsedData = JSON.parse(cachedData)
        
        // 检查缓存是否过期
        if (parsedData.expires && parsedData.expires < Date.now()) {
          // 缓存已过期，删除并返回null
          localStorage.removeItem(cacheKey)
          logger.debug('缓存标签已过期', { key, value, cacheKey })
          return null
        }
        
        // 返回缓存的标签值
        logger.debug('成功获取缓存标签', { key, value, label: parsedData.label })
        return parsedData.label
      } catch (parseError) {
        // 如果解析失败，说明是旧格式的缓存，直接返回
        logger.debug('使用旧格式缓存标签', { key, value, label: cachedData })
        return cachedData
      }
    } catch (e) {
      logger.error('读取标签缓存失败:', e)
      return null
    }
  },
  
  // 保存标签到缓存
  saveLabel(key: string, value: string | number, label: string): void {
    try {
      if (!key || value === undefined || value === null) {
        logger.debug('保存缓存标签失败: 无效的键或值', { key, value })
        return
      }
      
      if (!label || isLikelyId(label)) {
        logger.debug('保存缓存标签失败: 无效的标签或标签可能是ID', { key, value, label })
        return
      }
      
      // 检查缓存数量是否超过限制
      this.checkCacheSize()
      
      // 优化缓存键格式，使用明确的分隔符
      const cacheKey = `${CACHE_KEY_PREFIX}${key}${CACHE_KEY_SEPARATOR}${value}`
      
      // 存储带有过期时间的缓存数据
      const cacheData = {
        label: label,
        expires: Date.now() + CACHE_TTL,
        timestamp: Date.now()
      }
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      
      // 同时存储一个反向索引，方便根据值查找标签
      const reverseKey = `${CACHE_KEY_PREFIX}value${CACHE_KEY_SEPARATOR}${value}`
      localStorage.setItem(reverseKey, JSON.stringify(cacheData))
      
      logger.debug('成功保存缓存标签', { key, value, label })
    } catch (e) {
      logger.error('保存标签缓存失败:', e)
    }
  },
  
  // 批量保存标签
  saveLabels(key: string, items: {value: string | number, label: string}[]): void {
    if (!key || !Array.isArray(items) || items.length === 0) {
      logger.debug('批量保存标签失败: 无效的键或空数组', { key, itemsCount: items?.length })
      return
    }
    
    let savedCount = 0
    items.forEach(item => {
      if (item.value && item.label && !isLikelyId(item.label)) {
        this.saveLabel(key, item.value, item.label)
        savedCount++
      }
    })
    
    logger.debug(`批量保存标签完成，共保存 ${savedCount}/${items.length} 个标签`, { key })
  },
  
  // 检查并清理缓存
  checkCacheSize(): void {
    try {
      // 计算缓存数量
      let cacheCount = 0
      const cacheItems = []
      
      // 遍历localStorage中的所有键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          cacheCount++
          
          try {
            const value = localStorage.getItem(key)
            if (value) {
              const data = JSON.parse(value)
              if (data.timestamp) {
                cacheItems.push({
                  key,
                  timestamp: data.timestamp
                })
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
      // 如果缓存数量超过限制，清理最旧的缓存
      if (cacheCount > CACHE_MAX_ITEMS && cacheItems.length > 0) {
        // 按时间戳排序
        cacheItems.sort((a, b) => a.timestamp - b.timestamp)
        
        // 删除最旧的缓存，直到数量降至限制以下
        const itemsToRemove = cacheCount - CACHE_MAX_ITEMS
        for (let i = 0; i < itemsToRemove && i < cacheItems.length; i++) {
          localStorage.removeItem(cacheItems[i].key)
        }
        
        logger.info(`已清理 ${itemsToRemove} 个过期缓存项`)
      }
    } catch (e) {
      logger.error('检查缓存大小失败:', e)
    }
  },
  
  // 清理过期缓存
  clearExpiredCache(): void {
    try {
      const now = Date.now()
      let clearedCount = 0
      
      // 遍历localStorage中的所有键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          try {
            const value = localStorage.getItem(key)
            if (value) {
              const data = JSON.parse(value)
              if (data.expires && data.expires < now) {
                localStorage.removeItem(key)
                clearedCount++
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
      if (clearedCount > 0) {
        logger.info(`已清理 ${clearedCount} 个过期缓存项`)
      }
    } catch (e) {
      logger.error('清理过期缓存失败:', e)
    }
  },
  
  // 根据值查找标签（从所有缓存中）
  findLabelByValue(value: string | number): string | null {
    if (value === undefined || value === null) return null
    
    try {
      const stringValue = String(value)
      
      // 首先尝试使用反向索引
      const reverseKey = `${CACHE_KEY_PREFIX}value${CACHE_KEY_SEPARATOR}${stringValue}`
      const cachedData = localStorage.getItem(reverseKey)
      
      if (cachedData) {
        try {
          // 尝试解析JSON格式的缓存数据
          const parsedData = JSON.parse(cachedData)
          
          // 检查缓存是否过期
          if (parsedData.expires && parsedData.expires < Date.now()) {
            // 缓存已过期，删除并继续搜索
            localStorage.removeItem(reverseKey)
          } else {
            // 返回缓存的标签值
            return parsedData.label
          }
        } catch (parseError) {
          // 如果解析失败，说明是旧格式的缓存，直接返回
          return cachedData
        }
      }
      
      // 如果反向索引没有找到，扫描所有缓存
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(CACHE_KEY_PREFIX) && key.endsWith(`${CACHE_KEY_SEPARATOR}${stringValue}`)) {
          const value = localStorage.getItem(key)
          if (value) {
            try {
              const data = JSON.parse(value)
              if (data.expires && data.expires < Date.now()) {
                // 缓存已过期，删除并继续搜索
                localStorage.removeItem(key)
              } else {
                // 返回缓存的标签值
                return data.label
              }
            } catch (e) {
              // 如果解析失败，说明是旧格式的缓存，直接返回
              return value
            }
          }
        }
      }
      
      return null
    } catch (e) {
      logger.error('根据值查找标签失败:', e)
      return null
    }
  }
}

// 将labelCache暴露到全局作用域，使TableForm组件能够访问到它
if (typeof window !== 'undefined') {
  (window as any).labelCache = labelCache
}

// 请求限制工具，防止频繁请求
const requestLimiter = {
  failedRequests: new Map<string, {count: number, lastAttempt: number}>(),
  
  // 记录请求失败
  recordFailure(key: string): void {
    const now = Date.now()
    const record = this.failedRequests.get(key) || { count: 0, lastAttempt: 0 }
    record.count += 1
    record.lastAttempt = now
    this.failedRequests.set(key, record)
  },
  
  // 检查是否应该限制请求
  shouldLimit(key: string): boolean {
    const record = this.failedRequests.get(key)
    if (!record) return false
    
    const now = Date.now()
    const timeSinceLastAttempt = now - record.lastAttempt
    
    // 根据失败次数增加等待时间
    let waitTime = 0
    if (record.count <= 2) {
      waitTime = 5000 // 5秒
    } else if (record.count <= 5) {
      waitTime = 30000 // 30秒
    } else if (record.count <= 10) {
      waitTime = 300000 // 5分钟
    } else {
      waitTime = 3600000 // 1小时
    }
    
    return timeSinceLastAttempt < waitTime
  },
  
  // 重置失败记录
  resetFailure(key: string): void {
    this.failedRequests.delete(key)
  }
}

// 检测字符串是否可能是ID而不是名称
function isLikelyId(text: string | null | undefined): boolean {
  if (!text) return true
  
  // 纯数字
  if (/^\d+$/.test(text)) return true
  
  // 类UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return true
  
  // 其他明显不是名称的格式 (如包含特殊字符等)
  if (/^[_\-\.\/:@]+$/.test(text)) return true
  
  return false
}

export const useApiSelect = (option: ApiSelectProps) => {
  return defineComponent({
    name: option.name,
    props: {
      // 选项标签
      labelField: {
        type: String,
        default: () => option.labelField ?? 'label'
      },
      // 选项的值
      valueField: {
        type: String,
        default: () => option.valueField ?? 'value'
      },
      // api 接口
      url: {
        type: String,
        default: () => option.url ?? ''
      },
      // 请求类型
      method: {
        type: String,
        default: 'GET'
      },
      // 选项解析函数
      parseFunc: {
        type: String,
        default: ''
      },
      // 请求参数
      data: {
        type: String,
        default: ''
      },
      // 选择器类型，下拉框 select、多选框 checkbox、单选框 radio
      selectType: {
        type: String,
        default: 'select'
      },
      // 是否多选
      multiple: {
        type: Boolean,
        default: false
      },
      // 是否远程搜索
      remote: {
        type: Boolean,
        default: false
      },
      // 远程搜索时携带的参数
      remoteField: {
        type: String,
        default: 'label'
      }
    },
    setup(props) {
      const attrs = useAttrs()
      const options = ref<any[]>([]) // 下拉数据
      const loading = ref(false) // 是否正在从远程获取数据
      const queryParam = ref<any>() // 当前输入的值
      const modelValueLabels = ref<Record<string, string>>({}) // 用于存储modelValue对应的label
      const isDataLoaded = ref(false) // 标记数据是否已加载
      const tempOptions = ref<any[]>([]) // 临时选项，用于在数据加载前显示当前值
      const autoReloadTimer = ref<number | null>(null) // 自动重新加载定时器
      const requestInProgress = ref(false) // 请求进行中标记，防止并发请求

      // 将modelValueLabels暴露到全局作用域，使TableForm组件能够访问到它
      if (typeof window !== 'undefined') {
        // 如果window.modelValueLabels已经存在，则合并而不是覆盖
        if ((window as any).modelValueLabels) {
          // 监听modelValueLabels的变化，同步到全局对象
          watch(modelValueLabels, (newVal) => {
            (window as any).modelValueLabels = {
              ...(window as any).modelValueLabels,
              ...newVal
            }
          }, { deep: true })
        } else {
          // 直接设置全局对象
          (window as any).modelValueLabels = modelValueLabels.value
          
          // 监听modelValueLabels的变化，同步到全局对象
          watch(modelValueLabels, (newVal) => {
            (window as any).modelValueLabels = newVal
          }, { deep: true })
        }
      }

      // 获取选项数据的函数
      const getOptions = async () => {
        // 如果URL为空或者已有请求在进行中，直接返回
        if (isEmpty(props.url) || requestInProgress.value) {
          return
        }

        // 检查是否应该限制请求
        const requestKey = `${props.url}_all`
        if (requestLimiter.shouldLimit(requestKey)) {
          console.log(`接口[${props.url}]请求已被限制，等待一段时间后再试`)
          return
        }

        requestInProgress.value = true
        loading.value = true
        
        try {
          let responseData
          switch (props.method) {
            case 'GET':
              let url: string = props.url
              if (props.remote) {
                if (queryParam.value != undefined) {
                  if (url.includes('?')) {
                    url = `${url}&${props.remoteField}=${queryParam.value}`
                  } else {
                    url = `${url}?${props.remoteField}=${queryParam.value}`
                  }
                }
              }
              responseData = await request.get({ url: url })
              break
            case 'POST':
              const data: any = jsonParse(props.data)
              if (props.remote) {
                data[props.remoteField] = queryParam.value
              }
              responseData = await request.post({ url: props.url, data: data })
              break
          }
          
          parseOptions(responseData)
          
          // 将解析后的选项保存到本地缓存
          if (options.value && options.value.length > 0) {
            labelCache.saveLabels(props.url, options.value)
          }
          
          updateModelValueLabels()
          isDataLoaded.value = true
          
          // 重置请求失败计数
          requestLimiter.resetFailure(requestKey)
        } catch (error) {
          console.error(`获取选项数据失败:`, error)
          requestLimiter.recordFailure(requestKey)
        } finally {
          requestInProgress.value = false
          loading.value = false
        }
      }

      // 根据ID直接获取用户信息，优化单选时的显示
      const fetchUserInfoById = async (id: any) => {
        // 确保id是string或number类型
        if (id === undefined || id === null || id === '') {
          return false
        }
        
        // 将id转换为string
        const safeId = typeof id === 'object' ? JSON.stringify(id) : String(id)
        
        // 先检查缓存中是否有对应的标签
        const cachedLabel = labelCache.getLabel(props.url, safeId)
        if (cachedLabel && !isLikelyId(cachedLabel)) {
          // 如果缓存中有有效的标签，直接使用
          modelValueLabels.value[safeId] = cachedLabel
          createTempOption()
          return true
        }
        
        if (isEmpty(props.url) || requestInProgress.value) {
          return false
        }

        // 检查是否应该限制请求
        const requestKey = `${props.url}_${safeId}`
        if (requestLimiter.shouldLimit(requestKey)) {
          console.log(`用户ID[${safeId}]的请求已被限制，等待一段时间后再试`)
          return false
        }

        requestInProgress.value = true
        loading.value = true
        
        try {
          // 构建获取单个用户信息的请求URL/参数
          let url: string = props.url
          let data: any = {}
          let result: any = null
          
          // 添加ID过滤参数，通常后端API支持按ID过滤
          if (props.method === 'GET') {
            // 使用?id=xxx的方式过滤单个用户
            url = `${url}?${props.valueField}=${safeId}`
            result = await request.get({ url: url })
          } else {
            // POST方式，在data中添加id过滤
            data = jsonParse(props.data) || {}
            data[props.valueField] = safeId
            result = await request.post({ url: props.url, data: data })
          }
          
          // 解析返回结果，查找匹配的用户信息
          if (result) {
            // 检查是否有data字段，这是标准API返回格式
            if (result.data) {
              result = result.data
            }
            
            let userInfo = null
            
            // 如果是数组，查找匹配ID的项
            if (Array.isArray(result)) {
              userInfo = result.find(item => String(item[props.valueField]) === safeId)
            } 
            // 如果有list属性且为数组，在list中查找
            else if (result.list && Array.isArray(result.list)) {
              userInfo = result.list.find(item => String(item[props.valueField]) === safeId)
            }
            // 如果只返回单个对象，直接使用
            else if (result[props.valueField] && String(result[props.valueField]) === safeId) {
              userInfo = result
            }
            
            // 如果找到用户信息，更新缓存和临时选项
            if (userInfo) {
              // 确保userInfo是有效对象
              if (typeof userInfo === 'object' && userInfo !== null) {
                const label = parseExpression(userInfo, String(props.labelField))
                
                if (!isLikelyId(label)) {
                  modelValueLabels.value[safeId] = label
                  // 保存到本地缓存
                  labelCache.saveLabel(props.url, safeId, label)
                  // 更新tempOptions
                  createTempOption()
                  
                  // 重置请求失败计数
                  requestLimiter.resetFailure(requestKey)
                  return true
                }
              }
            }
          }
          
          requestLimiter.recordFailure(requestKey)
          return false
        } catch (error) {
          console.error('获取用户信息失败:', error)
          requestLimiter.recordFailure(requestKey)
          return false
        } finally {
          requestInProgress.value = false
          loading.value = false
        }
      }

      // 更新modelValue对应的标签信息
      const updateModelValueLabels = () => {
        if (!attrs.modelValue || options.value.length === 0) return
        
        // 处理单选情况
        if (!props.multiple && attrs.modelValue) {
          const stringValue = String(attrs.modelValue)
          const selectedOption = options.value.find(opt => String(opt.value) === stringValue)
          if (selectedOption) {
            modelValueLabels.value[stringValue] = selectedOption.label
            // 保存到缓存
            labelCache.saveLabel(props.url, stringValue, selectedOption.label)
          }
        } 
        // 处理多选情况
        else if (props.multiple && Array.isArray(attrs.modelValue) && attrs.modelValue.length > 0) {
          attrs.modelValue.forEach(value => {
            const stringValue = String(value)
            const selectedOption = options.value.find(opt => String(opt.value) === stringValue)
            if (selectedOption) {
              modelValueLabels.value[stringValue] = selectedOption.label
              // 保存到缓存
              labelCache.saveLabel(props.url, stringValue, selectedOption.label)
            }
          })
        }
      }

      // 创建临时选项
      const createTempOption = () => {
        tempOptions.value = []
        if (!props.multiple && attrs.modelValue) {
          const stringValue = String(attrs.modelValue)
          // 检查现有选项中是否已有此值
          const existingOption = options.value.find(opt => String(opt.value) === stringValue)
          
          if (!existingOption) {
            // 如果缓存中有标签，使用缓存的标签
            if (modelValueLabels.value[stringValue]) {
              tempOptions.value.push({
                label: modelValueLabels.value[stringValue],
                value: attrs.modelValue
              })
            } 
            // 否则使用值作为临时标签
            else {
              tempOptions.value.push({
                label: String(attrs.modelValue),
                value: attrs.modelValue
              })
            }
          }
        }
      }

      function parseOptions(data: any) {
        //  情况一：如果有自定义解析函数优先使用自定义解析
        if (!isEmpty(props.parseFunc)) {
          options.value = parseFunc()?.(data)
          return
        }
        
        // 检查是否有 data 字段，这是标准 API 返回格式
        if (data && data.data) {
          data = data.data
        }
        
        // 情况二：返回的直接是一个列表
        if (Array.isArray(data)) {
          parseOptions0(data)
          return
        }
        // 情况三：返回的是分页数据,尝试读取 list
        if (data && data.list) {
          data = data.list
          if (Array.isArray(data)) {
            parseOptions0(data)
            return
          }
        }
        // 情况四：不是标准返回
        console.warn(
          `接口[${props.url}] 返回结果不是标准返回格式，建议采用自定义解析函数处理`
        )
      }

      function parseOptions0(data: any[]) {
        if (Array.isArray(data)) {
          options.value = data.map((item: any) => ({
            label: parseExpression(item, props.labelField),
            value: parseExpression(item, props.valueField)
          }))
          return
        }
        console.warn(`接口[${props.url}] 返回结果不是一个数组`)
      }

      function parseFunc() {
        let parse: any = null
        if (!!props.parseFunc) {
          // 解析字符串函数
          parse = new Function(`return ${props.parseFunc}`)()
        }
        return parse
      }

      function parseExpression(data: any, template: string) {
        // 检测是否使用了表达式
        if (template.indexOf('${') === -1) {
          const result = data[template]
          if (result === undefined || result === null) {
            console.warn(
              `接口选择器选项[${template}] 解析值失败，请检查属性名称是否存在于接口返回值中`
            )
            // 返回一个友好的提示，而不是 undefined
            return `未知(ID:${data.id || '未知'})`
          }
          return result
        }
        // 正则表达式匹配模板字符串中的 ${...}
        const pattern = /\$\{([^}]*)}/g
        // 使用replace函数配合正则表达式和回调函数来进行替换
        return template.replace(pattern, (_, expr) => {
          // expr 是匹配到的 ${} 内的表达式（这里是属性名），从 data 中获取对应的值
          const result = data[expr.trim()] // 去除前后空白，以防用户输入带空格的属性名
          if (result === undefined || result === null) {
            console.warn(
              `接口选择器选项模版[${template}][${expr.trim()}] 解析值失败结果为[${result}], 请检查属性名称是否存在于接口返回值中,存在则忽略此条！！！`
            )
            // 返回一个友好的提示，而不是 undefined
            return `未知(ID:${data.id || '未知'})`
          }
          return result
        })
      }

      const remoteMethod = async (query: any) => {
        if (!query) {
          return
        }
        loading.value = true
        try {
          queryParam.value = query
          await getOptions()
        } finally {
          loading.value = false
        }
      }

      // 添加一个新的方法来确保数据已加载
      const ensureDataLoaded = async (value: any) => {
        if (!value) return false

        // 检查是否已经有对应的标签
        const stringValue = String(value)
        const hasValidLabel = modelValueLabels.value[stringValue] && 
                            !isLikelyId(modelValueLabels.value[stringValue])

        // 如果已经有有效的标签（不是ID），则返回true
        if (hasValidLabel) return true

        // 如果没有有效标签，先尝试获取单个用户信息
        const success = await fetchUserInfoById(value)
        if (success) return true

        // 如果获取单个用户信息失败且选项还未加载，尝试加载所有选项
        if (!isDataLoaded.value) {
          try {
            await getOptions()
            // 再次检查是否有了有效的标签
            updateModelValueLabels()
            return modelValueLabels.value[stringValue] && 
                  !isLikelyId(modelValueLabels.value[stringValue])
          } catch (error) {
            console.error('确保数据加载失败:', error)
            return false
          }
        }

        return false
      }

      // 添加自动检测并重新加载机制，但使用更智能的方式减少请求
      const checkAndReloadIfNeeded = async () => {
        if (!attrs.modelValue) return

        if (!props.multiple) {
          // 单选模式
          const currentValue = attrs.modelValue
          await ensureDataLoaded(currentValue)
        } else if (Array.isArray(attrs.modelValue)) {
          // 多选模式，检查每个选中的值
          for (const value of attrs.modelValue) {
            await ensureDataLoaded(value)
            // 添加短暂延迟，避免同时发送大量请求
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
      }

      // 启动自动检测
      const startAutoDetection = () => {
        // 先清除可能存在的定时器
        stopAutoDetection()
        
        // 延迟2秒后首次检查，避免与初始加载冲突
        setTimeout(async () => {
          await checkAndReloadIfNeeded()
          
          // 然后每30秒检查一次，如果还有数字ID就重新加载
          // 这个频率低得多，减少了服务器负担
          autoReloadTimer.value = window.setInterval(checkAndReloadIfNeeded, 30000)
        }, 2000)
      }

      // 停止自动检测
      const stopAutoDetection = () => {
        if (autoReloadTimer.value !== null) {
          clearInterval(autoReloadTimer.value)
          autoReloadTimer.value = null
        }
      }

      // 修改组件挂载时的逻辑
      onMounted(async () => {
        // 先尝试从缓存创建临时选项
        if (attrs.modelValue) {
          if (!props.multiple) {
            const stringValue = String(attrs.modelValue)
            const cachedLabel = labelCache.getLabel(props.url, stringValue)
            if (cachedLabel) {
              modelValueLabels.value[stringValue] = cachedLabel
            }
          } else if (Array.isArray(attrs.modelValue)) {
            attrs.modelValue.forEach(value => {
              const stringValue = String(value)
              const cachedLabel = labelCache.getLabel(props.url, stringValue)
              if (cachedLabel) {
                modelValueLabels.value[stringValue] = cachedLabel
              }
            })
          }
          createTempOption()
        }
        
        // 加载选项数据
        await getOptions()
        
        // 启动自动检测，但使用更低的频率
        startAutoDetection()
      })

      // 在组件卸载时清除定时器
      onUnmounted(() => {
        stopAutoDetection()
        // 注意：不要清除window.labelCache和window.modelValueLabels，因为其他组件可能仍在使用它们
      })

      // 在attrs.modelValue发生变化时也要重新检查
      watch(() => attrs.modelValue, async (newVal) => {
        if (newVal) {
          // 创建临时选项
          createTempOption()
          
          // 使用节流方式检查，避免频繁请求
          setTimeout(async () => {
            await checkAndReloadIfNeeded()
          }, 500)
        }
      }, { deep: true })

      const buildSelect = () => {
        // 结合临时选项和实际选项以确保即使在数据加载前也能正确显示
        const mergedOptions = [...tempOptions.value, ...options.value]
        
        // 去重，如果临时选项的值在options中已存在就不显示临时选项
        const uniqueOptions = mergedOptions.reduce((acc, current) => {
          const stringValue = String(current.value)
          const exists = acc.find(item => String(item.value) === stringValue)
          
          if (!exists) {
            acc.push(current)
          }
          
          return acc
        }, [] as any[])
        
        if (props.multiple) {
          // fix：多写此步是为了解决 multiple 属性问题
          return (
            <el-select
              class="w-full"
              style="width: 100%"
              multiple
              filterable
              loading={loading.value}
              {...attrs}
              remote={props.remote}
              {...(props.remote && { remoteMethod: remoteMethod })}
            >
              {uniqueOptions.map((item, index) => (
                <el-option key={index} label={item.label} value={item.value} />
              ))}
            </el-select>
          )
        }
        return (
          <el-select
            class="w-full"
            style="width: 100%"
            filterable
            loading={loading.value}
            {...attrs}
            remote={props.remote}
            {...(props.remote && { remoteMethod: remoteMethod })}
          >
            {uniqueOptions.map((item, index) => (
              <el-option key={index} label={item.label} value={item.value} />
            ))}
          </el-select>
        )
      }
      const buildCheckbox = () => {
        if (isEmpty(options.value)) {
          options.value = [
            { label: '选项1', value: '选项1' },
            { label: '选项2', value: '选项2' }
          ]
        }
        return (
          <el-checkbox-group class="w-full" style="width: 100%" {...attrs}>
            {options.value.map((item, index) => (
              <el-checkbox key={index} label={item.value}>
                {item.label}
              </el-checkbox>
            ))}
          </el-checkbox-group>
        )
      }
      const buildRadio = () => {
        if (isEmpty(options.value)) {
          options.value = [
            { label: '选项1', value: '选项1' },
            { label: '选项2', value: '选项2' }
          ]
        }
        return (
          <el-radio-group class="w-full" style="width: 100%" {...attrs}>
            {options.value.map((item, index) => (
              <el-radio key={index} value={item.value}>
                {item.label}
              </el-radio>
            ))}
          </el-radio-group>
        )
      }
      return () => (
        <Fragment>
          {props.selectType === 'select'
            ? buildSelect()
            : props.selectType === 'radio'
              ? buildRadio()
              : props.selectType === 'checkbox'
                ? buildCheckbox()
                : buildSelect()}
        </Fragment>
      )
    }
  })
}

// 导出labelCache对象，使其可以被TableForm组件使用
export const apiSelectLabelCache = labelCache;

// 导出批量预加载函数
export const preloadLabels = async (url: string, ids: (string | number)[], options?: {
  method?: 'GET' | 'POST',
  valueField?: string,
  labelField?: string,
  data?: any
}): Promise<Record<string, string>> => {
  if (!url || !Array.isArray(ids) || ids.length === 0) {
    logger.warn('预加载标签失败: 无效的URL或空ID数组', { url, idsCount: ids?.length });
    return {};
  }
  
  // 默认选项
  const defaultOptions = {
    method: 'GET',
    valueField: 'value',
    labelField: 'label',
    data: {}
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  const { method, valueField, labelField, data } = mergedOptions;
  
  // 过滤掉已经有缓存的ID
  const idsToLoad = ids.filter(id => {
    const cachedLabel = labelCache.getLabel(url, id);
    return !cachedLabel;
  });
  
  if (idsToLoad.length === 0) {
    logger.debug('所有ID已有缓存，无需预加载', { url, ids });
    return {};
  }
  
  logger.info(`开始预加载 ${idsToLoad.length} 个标签`, { url });
  
  try {
    let responseData;
    
    // 构建请求参数
    if (method === 'GET') {
      // 构建查询参数
      const idsParam = idsToLoad.join(',');
      let requestUrl = url;
      
      // 添加ID过滤参数
      if (requestUrl.includes('?')) {
        requestUrl = `${requestUrl}&${valueField}=${idsParam}`;
      } else {
        requestUrl = `${requestUrl}?${valueField}=${idsParam}`;
      }
      
      responseData = await request.get({ url: requestUrl });
    } else {
      // POST请求
      const postData = { ...data };
      postData[valueField] = idsToLoad;
      
      responseData = await request.post({ url, data: postData });
    }
    
    // 处理响应数据
    if (!responseData) {
      logger.warn('预加载标签失败: 服务器返回空数据', { url, idsToLoad });
      return {};
    }
    
    // 检查是否有data字段
    if (responseData.data) {
      responseData = responseData.data;
    }
    
    let items = [];
    
    // 处理不同格式的响应
    if (Array.isArray(responseData)) {
      items = responseData;
    } else if (responseData.list && Array.isArray(responseData.list)) {
      items = responseData.list;
    } else {
      logger.warn('预加载标签失败: 无法解析服务器返回的数据格式', { url, responseData });
      return {};
    }
    
    // 提取标签并保存到缓存
    const labels: Record<string, string> = {};
    
    items.forEach(item => {
      if (item && item[valueField] !== undefined) {
        const id = item[valueField];
        const label = item[labelField];
        
        if (label && !isLikelyId(label)) {
          labels[id] = label;
          labelCache.saveLabel(url, id, label);
        }
      }
    });
    
    logger.info(`预加载完成，成功加载 ${Object.keys(labels).length} 个标签`, { url });
    return labels;
  } catch (error) {
    logger.error('预加载标签失败:', error);
    return {};
  }
};

// 导出全局函数，用于扫描所有缓存并返回标签映射
export const scanAllLabelCache = (): Record<string, string> => {
  const labels: Record<string, string> = {};
  
  try {
    // 扫描localStorage中的所有键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        try {
          // 尝试解析键名
          const parts = key.split(CACHE_KEY_SEPARATOR);
          if (parts.length >= 2) {
            // 最后一部分是值
            const value = parts[parts.length - 1];
            const cachedData = localStorage.getItem(key);
            
            if (cachedData) {
              let label;
              
              // 尝试解析JSON格式
              try {
                const data = JSON.parse(cachedData);
                if (data.label && !data.expires || data.expires > Date.now()) {
                  label = data.label;
                }
              } catch (e) {
                // 如果解析失败，说明是旧格式的缓存，直接使用
                label = cachedData;
              }
              
              if (label && !isLikelyId(label)) {
                labels[value] = label;
              }
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
    
    logger.info(`扫描缓存完成，找到 ${Object.keys(labels).length} 个标签`);
    return labels;
  } catch (e) {
    logger.error('扫描缓存失败:', e);
    return labels;
  }
};

// 将全局函数暴露到window对象，使TableForm组件能够访问
if (typeof window !== 'undefined') {
  (window as any).labelCache = {
    ...labelCache,
    scanAll: scanAllLabelCache,
    preload: preloadLabels
  };
  
  // 创建全局modelValueLabels对象
  if (!(window as any).modelValueLabels) {
    (window as any).modelValueLabels = {};
  }
}
