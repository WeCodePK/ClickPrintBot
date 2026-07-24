'use strict';

// Plain-text formatting for message bodies. The old bot rendered shops/jobs
// as numbered text lists; those are now rendered as interactive list rows
// instead (see interactive.js + handlers/*), so this module only keeps the
// formatting still needed for message bodies and confirmations.

const money = (n) => `Rs ${n}`;

function bold(s) {
  return `*${s}*`;
}

function formatProfile(p) {
  return [
    bold('👤 Your Profile'),
    '',
    `Name:    ${p.name || '—'}`,
    `Number:  ${p.number}`,
    `Balance: ${money(p.balance)}`,
  ].join('\n');
}

const SIDED_LABEL = {
  none: 'single-sided',
  long: 'double-sided (long edge)',
  short: 'double-sided (short edge)',
};

function formatSettings(s) {
  const sided = SIDED_LABEL[s.sidedness] || s.sidedness || 'single-sided';
  const parts = [
    s.color ? 'Colour' : 'B&W',
    s.pageType,
    `${s.numberOfCopies} cop${s.numberOfCopies === 1 ? 'y' : 'ies'}`,
    sided,
    `${s.orientation}`,
  ];
  if (s.pagesPerSheet && s.pagesPerSheet > 1) parts.push(`${s.pagesPerSheet}/sheet`);
  if (s.pageSelection) parts.push(`pages ${s.pageSelection}`);
  return parts.join(' · ');
}

function formatDraftFiles(draft) {
  if (!draft.files || !draft.files.length) return '  (no files yet)';
  return draft.files
    .map((f, i) => {
      const name = (f.file && f.file.originalName) || 'file';
      const pages = f.file && f.file.numberOfPages;
      const pageStr = pages ? ` (${pages}p)` : '';
      return `  ${i + 1}. ${name}${pageStr}\n     ${formatSettings(f.settings)}`;
    })
    .join('\n');
}

function formatDraftSummary(draft) {
  const shopName = draft.shop && draft.shop.name ? draft.shop.name : '(not selected)';
  const ready = draft.files && draft.files.length && draft.shop;
  const lines = [
    bold('📝 Current Draft'),
    '',
    bold('Files:'),
    formatDraftFiles(draft),
    '',
    `${bold('Shop:')} ${shopName}`,
    '',
  ];
  if (ready) {
    lines.push('✅ Ready — you can check the price or submit.');
  } else {
    const missing = [];
    if (!draft.files || !draft.files.length) missing.push('a file');
    if (!draft.shop) missing.push('a shop');
    lines.push(`⏳ Still need: ${missing.join(', ')}.`);
  }
  return lines.join('\n');
}

function formatShopDetail(shop) {
  const lines = [bold(`🏪 ${shop.name}`), ''];
  if (shop.address) lines.push(`📍 ${shop.address}`);
  lines.push(shop.isOnline ? '🟢 Online' : '⚪ Offline');
  if (Array.isArray(shop.timings) && shop.timings.length) {
    lines.push('', bold('Timings:'));
    shop.timings.forEach((t) => lines.push(`  ${t}`));
  }
  if (Array.isArray(shop.prices) && shop.prices.length) {
    lines.push('', bold('Prices:'));
    shop.prices.forEach((p) => lines.push(`  ${p.name}: ${money(p.rate)}/page`));
  }
  return lines.join('\n');
}

function formatCost(cost) {
  if (!cost) return '';
  const lines = [];
  (cost.lines || []).forEach(([name, qty, rate, sub]) => {
    lines.push(`  ${name}  ${qty} × ${money(rate)} = ${money(sub)}`);
  });
  (cost.extra || []).forEach(([name, amount]) => {
    lines.push(`  ${name}: ${money(amount)}`);
  });
  lines.push(`  ${bold(`Total: ${money(cost.total)}`)}`);
  return lines.join('\n');
}

function formatQuote(draft) {
  const shopName = draft.shop && draft.shop.name ? draft.shop.name : '';
  return [
    bold('🧾 Price Quote'),
    '',
    `Shop: ${shopName}`,
    bold('Files:'),
    formatDraftFiles(draft),
    '',
    formatCost(draft.cost),
  ].join('\n');
}

const STATUS_EMOJI = {
  submitted: '📨',
  queued: '📋',
  printing: '🖨️',
  ready: '✅',
  completed: '🎉',
  collected: '🎉',
  cancelled: '❌',
  rejected: '🚫',
};

function statusLabel(status) {
  const emoji = STATUS_EMOJI[status] || '•';
  return `${emoji} ${status}`;
}

function formatJobDetail(job) {
  const shopName = job.shop && job.shop.name ? job.shop.name : '';
  return [
    bold('📦 Job'),
    '',
    `Shop:   ${shopName}`,
    `Status: ${statusLabel(job.status)}`,
    '',
    bold('Files:'),
    formatDraftFiles(job),
    '',
    formatCost(job.cost),
  ].join('\n');
}

function helpText() {
  return [
    bold('🖨️ ClickPrint Bot'),
    'Send me a file to print, then use the buttons to pick a shop and place your order.',
    '',
    bold('Getting started'),
    '  • Send an image or document to add it to your draft.',
    '  • Open *My Draft* to review files, change settings, or pick a shop.',
    '  • Once you have a file and a shop, check the price and submit.',
    '',
    'Send anything to come back to the menu.',
  ].join('\n');
}

module.exports = {
  formatProfile,
  formatSettings,
  formatDraftFiles,
  formatDraftSummary,
  formatShopDetail,
  formatCost,
  formatQuote,
  statusLabel,
  formatJobDetail,
  helpText,
};
