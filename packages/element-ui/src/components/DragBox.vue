<script>
import {defineComponent, h, inject, useAttrs} from 'vue';
import draggable from 'vuedraggable/src/vuedraggable';

export default defineComponent({
    name: 'DragBox',
    props: ['rule', 'tag', 'formCreateInject', 'list'],
    setup(props, {slots}) {
        const attrs = useAttrs();
        const collabState = inject('collabState', {});
        return () => {
            const dragAttrs = {...props.rule.props, ...attrs};
            let _class = '_fd-' + props.tag + '-drag _fd-drag-box';
            if (!slots.default) {
                _class += ' drag-holder';
            }
            dragAttrs.class = _class;
            dragAttrs.modelValue = props.list || [...props.formCreateInject.children];

            const keys = {};
            if (slots.default) {
                const children = slots.default();
                children.forEach(v => {
                    if (v.key) {
                        keys[v.key] = v;
                    }
                });
            }
            return h(draggable, dragAttrs, {
                item: ({element, index}) => {
                    const key = element?.__fc__?.key;
                    if (key) {
                        let vnode = keys['_' + element.slot];
                        if (vnode) {
                            vnode.children.forEach(v => {
                                if (v.key === key + 'fc') {
                                    vnode = v;
                                }
                            });
                        } else {
                            vnode = keys[key + 'fc'];
                        }
                        if (vnode) {
                            const unames = collabState && element ? collabState[element.field] || element.unames : undefined;
                            const children = [vnode];
                            if (unames && Array.isArray(unames) && unames.length) {
                                children.push(
                                    h('div', {class: '_fc-editing-users'}, unames.map(n => h('span', {class: '_fc-user'}, n)))
                                );
                            }
                            return h('div', {
                                class: '_fc-' + props.tag + '-item _fd-drag-item',
                                key,
                                style: unames && unames.length ? {position: 'relative'} : undefined
                            }, children);
                        }
                    }
                    return h('div', {class: '_fc-' + props.tag + '-item _fd-drag-item', key: index}, null);
                }
            });
        };
    }
});
</script>
