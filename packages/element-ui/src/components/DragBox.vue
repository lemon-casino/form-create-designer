<script>
import {defineComponent, h} from 'vue';
import draggable from 'vuedraggable/src/vuedraggable';

export default defineComponent({
    name: 'DragBox',
    inject: ['collabState'],
    props: ['rule', 'tag', 'formCreateInject', 'list'],
    render() {
        const attrs = {...this.rule.props, ...this.$attrs};
        let _class = '_fd-' + this.tag + '-drag _fd-drag-box';
        if (!Object.keys(this.$slots).length) {
            _class += ' drag-holder';
        }
        attrs.class = _class;
        attrs.modelValue = this.list || [...this.formCreateInject.children];

        const keys = {};
        if (this.$slots.default) {
            const children = this.$slots.default();
            children.forEach(v => {
                if (v.key) {
                    keys[v.key] = v;
                }
            })
        }
        return h(draggable, attrs, {
            item: ({element, index}) => {
                const key = element?.__fc__?.key;
                let vnode;
                if (key) {
                    vnode = keys['_' + element.slot];
                    if (vnode) {
                        vnode.children.forEach(v => {
                            if (v.key === key + 'fc') {
                                vnode = v;
                            }
                        });
                    } else {
                        vnode = keys[key + 'fc'];
                    }
                }
                const nodes = [];
                if (vnode) {
                    nodes.push(vnode);
                }
                const row = element && element._fc_table_row;
                const fid = row !== undefined ? row : (element && (element._fc_id || (element.__fc__ && element.__fc__.id)));
                const field = element && element.field;
                const user = this.collabState && (this.collabState[fid] || this.collabState[field]);
                if (user) {
                    nodes.push(h('span', {class: 'fc-collab-indicator'}, user));
                }
                return h('div', {class: '_fc-' + this.tag + '-item _fd-drag-item', key: key || index}, nodes);
            }
        });
    }
});
</script>
<style>
.fc-collab-indicator {
    position: absolute;
    top: 0;
    right: 0;
    background: rgba(255, 255, 0, 0.8);
    font-size: 12px;
    padding: 2px 4px;
    z-index: 10;
    border-radius: 2px;
}
</style>
