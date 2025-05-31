<template>
    <Struct class="_fd-hidden-config" :modelValue="hidden" @update:modelValue="onInput" :title="t('form.setHiddenCondition')">
        <i class="fc-icon icon-edit"></i>
    </Struct>
</template>

<script>
import {defineComponent} from 'vue';
import Struct from './Struct.vue';

export default defineComponent({
    name: 'HiddenConfig',
    components: {Struct},
    inject: ['designer'],
    computed: {
        t() {
            return this.designer.setupState.t;
        },
        activeRule() {
            return this.designer.setupState.activeRule;
        },
        hidden() {
            return this.activeRule._computed?.hidden;
        }
    },
    methods: {
        onInput(val) {
            if (!this.activeRule._computed) this.activeRule._computed = {};
            if (!val || (typeof val === 'object' && Object.keys(val).length === 0)) {
                delete this.activeRule._computed.hidden;
            } else {
                this.activeRule._computed.hidden = val;
            }
        }
    }
});
</script>

<style>
._fd-hidden-config {
    display: inline-block;
    width: 16px;
}

._fd-hidden-config .fc-icon {
    cursor: pointer;
}
</style>
