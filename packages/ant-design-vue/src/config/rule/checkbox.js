import uniqueId from '@form-create/utils/lib/unique';
import {localeProps, makeOptionsRule, makeTreeOptions} from '../../utils/index';

const label = '多选框';
const name = 'checkbox';

export default {
    menu: 'main',
    icon: 'icon-checkbox',
    label,
    name,
    input: true,
    event: ['change'],
    validate: ['array'],
    rule({t}) {
        return {
            type: name,
            field: uniqueId(),
            title: t('com.checkbox.name'),
            info: '',
            effect: {
                fetch: ''
            },
            $required: false,
            props: {},
            options: makeTreeOptions(t('props.option'), {label: 'label', value: 'value'}, 1)
        };
    },
    loadRule(rule) {
        // 多选框回显兼容性处理：支持字符串格式自动转换为数组
        // 检查是否存在value字段且为字符串类型（非空字符串）
        if (rule.value && typeof rule.value === 'string' && rule.value.trim() !== '') {
            // 将字符串转换为包含该字符串的数组
            rule.value = [rule.value];
        }
        // 数组格式保持不变，确保向后兼容性
    },
    props(_, {t}) {
        return localeProps(t, name + '.props', [
            makeOptionsRule(t, 'options'),
            ...[
                {
                    type: 'switch',
                    field: 'disabled'
                },
            ]
        ]);
    }
};
