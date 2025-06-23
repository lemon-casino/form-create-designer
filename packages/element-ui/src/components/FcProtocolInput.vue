<template>
  <div class="fc-protocol-input">
    <el-input
      v-model="currentValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      @input="handleInput"
      @blur="$emit('blur')"
      @focus="$emit('focus')"
      @change="$emit('change', currentValue)"
      @clear="$emit('clear')"
    >
      <template #append>
        <a
          ref="linkRef"
          :href="linkUrl || 'javascript:void(0);'"
          target="_blank"
          :style="linkStyle"
          @click="handleLinkClick"
        >
          点击链接
        </a>
      </template>
    </el-input>
  </div>
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue';

export default defineComponent({
  name: 'FcProtocolInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: '请输入URL'
    },
    disabled: {
      type: Boolean,
      default: false
    },
    readonly: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'input', 'change', 'blur', 'focus', 'clear'],
  setup(props, { emit }) {
    const currentValue = ref(props.modelValue || '');
    const linkUrl = ref('');
    
    // 监听外部值变化
    watch(() => props.modelValue, (newVal) => {
      currentValue.value = newVal || '';
      updateLinkState();
    });
    
    // 计算链接样式
    const linkStyle = computed(() => {
      const isVisible = !!linkUrl.value;
      return {
        display: isVisible ? 'inline-block' : 'none',
        marginLeft: '4px',
        color: '#409EFF',
        cursor: 'pointer',
        fontWeight: 'bold',
        textDecoration: 'underline'
      };
    });
    
    // 处理输入事件
    const handleInput = (val) => {
      currentValue.value = val;
      emit('update:modelValue', val);
      emit('input', val);
      updateLinkState();
    };
    
    // 更新链接状态
    const updateLinkState = () => {
      const value = String(currentValue.value || '');
      const isMatch = /^https?:\/\//.test(value);
      linkUrl.value = isMatch ? value : '';
    };
    
    // 处理链接点击
    const handleLinkClick = (e) => {
      if (!linkUrl.value) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      window.open(linkUrl.value, '_blank');
      return false;
    };
    
    // 初始化
    updateLinkState();
    
    return {
      currentValue,
      linkUrl,
      linkStyle,
      handleInput,
      handleLinkClick
    };
  }
});
</script>

<style>
.fc-protocol-input .el-input-group__append {
  padding: 0;
}
.fc-protocol-input .el-input-group__append a {
  padding: 0 10px;
  height: 100%;
  display: flex;
  align-items: center;
}
</style> 