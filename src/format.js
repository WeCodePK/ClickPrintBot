'use strict';

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
    '',
    'Use /name <new name> to change your name.',
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

function formatDraft(draft) {
  const shopName = draft.shop && draft.shop.name ? draft.shop.name : '(not selected)';
  const lines = [
    bold('📝 Current Draft'),
    '',
    bold('Files:'),
    formatDraftFiles(draft),
    '',
    `${bold('Shop:')} ${shopName}`,
  ];

  const ready = draft.files && draft.files.length && draft.shop;
  lines.push('');
  if (ready) {
    lines.push('✅ Ready. Send /check to see the price quote.');
  } else {
    const missing = [];
    if (!draft.files || !draft.files.length) missing.push('a file');
    if (!draft.shop) missing.push('a shop (/shops)');
    lines.push(`⏳ Still need: ${missing.join(', ')}.`);
  }
  return lines.join('\n');
}

function formatShopList(shops) {
  if (!shops.length) return 'No shops are available right now.';
  const lines = [bold('🏪 Available Shops'), ''];
  shops.forEach((s, i) => {
    const status = s.isOnline ? '🟢 online' : '⚪ offline';
    lines.push(`${i + 1}. ${bold(s.name)} — ${status}`);
    if (s.address) lines.push(`   ${s.address}`);
  });
  lines.push('');
  lines.push('Use /shop <number> to pick a shop for your draft.');
  return lines.join('\n');
}

function formatShop(shop) {
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
  (cost.lines || []).forEach((l) => {
    // [name, quantity, rate, subtotal]
    const [name, qty, rate, sub] = l;
    lines.push(`  ${name}  ${qty} × ${money(rate)} = ${money(sub)}`);
  });
  (cost.extra || []).forEach((e) => {
    // [name, amount]
    const [name, amount] = e;
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
    '',
    'Send /confirm to place the order, or keep editing your draft.',
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

function formatJobList(jobs) {
  if (!jobs.length) return 'You have no active jobs.';
  const lines = [bold('📦 Your Jobs'), ''];
  jobs.forEach((j, i) => {
    const shopName = j.shop && j.shop.name ? j.shop.name : 'shop';
    const fileCount = (j.files || []).length;
    const total = j.cost ? ` · ${money(j.cost.total)}` : '';
    lines.push(
      `${i + 1}. ${statusLabel(j.status)} — ${shopName}` +
        ` (${fileCount} file${fileCount === 1 ? '' : 's'}${total})`
    );
  });
  lines.push('');
  lines.push('Use /cancel <number> to cancel a job.');
  return lines.join('\n');
}

function formatJob(job) {
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
    'Send me files to print, pick a shop, and place your order.',
    '',
    bold('Getting started'),
    '  • Just send an image or document to add it to your order.',
    '  • Then choose a shop and confirm.',
    '',
    bold('Profile'),
    '  /profile — view your name & balance',
    '  /name <new name> — change your name',
    '',
    bold('Building an order'),
    '  /draft — view your current draft',
    '  /files — list files in the draft',
    '  /set <file#> <option> <value> — change print settings',
    '  /removefile <file#> — remove a file',
    '  /shops — list shops',
    '  /shop <number> — pick a shop',
    '  /canceldraft — discard the current draft',
    '',
    bold('Placing the order'),
    '  /check — see the price quote',
    '  /confirm — submit the order',
    '',
    bold('Your orders'),
    '  /jobs — list your active jobs',
    '  /cancel <number> — cancel a job',
    '',
    bold('Print options (for /set)'),
    '  color on|off',
    '  copies <number>',
    '  sided single|double|short   (double = long-edge duplex)',
    '  orientation portrait|landscape',
    '  pages <e.g. 1-3,5>   (blank = all pages)',
    '  perpage <number>     (pages per sheet)',
    '  type <e.g. A4>',
    '',
    'Example: /set 1 color on',
  ].join('\n');
}

module.exports = {
  formatProfile,
  formatSettings,
  formatDraft,
  formatShopList,
  formatShop,
  formatQuote,
  formatJobList,
  formatJob,
  helpText,
};
