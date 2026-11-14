/** Tiny element builder: h('div', { class: 'x', onclick }, 'text', child) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (id) => document.getElementById(id);

/** Only touches the DOM when the value actually changes. */
export function setText(el, value) {
  const s = String(value);
  if (el.textContent !== s) el.textContent = s;
}

export function toggle(el, attr, on) {
  if (el.hasAttribute(attr) !== on) el.toggleAttribute(attr, on);
}
