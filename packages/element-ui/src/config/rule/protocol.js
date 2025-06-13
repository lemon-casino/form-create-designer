import uniqueId from '@form-create/utils/lib/unique';
import {localeProps} from '../../utils';

const label = '协议';
const name = 'protocol';

export default {
    menu: 'main',
    icon: 'icon-link',
    label,
    name,
    input: true,
    event: ['blur', 'focus', 'change', 'input', 'clear'],
    rule({t}) {
        return {
            type: 'FcProtocolInput',
            field: uniqueId(),
            title: t('com.protocol.name'),
            info: '',
            $required: false,
            props: {
                placeholder: t('com.protocol.placeholder'),
            },
        };
    },
    props(_, {t}) {
        return localeProps(t, name + '.props', [
            { type: 'input', field: 'placeholder' }
        ]);
    }
};
