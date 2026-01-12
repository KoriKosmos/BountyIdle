export function formatNumber(num, decimals = 0) {
    return num.toLocaleString(undefined, { 
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals 
    });
}

export function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}
