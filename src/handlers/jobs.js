'use strict';

const api = require('../api');
const whatsapp = require('../whatsapp');
const format = require('../format');
const { encodeId } = require('../interactive');

const MAX_JOB_ROWS = 10;
const CANCELLABLE_STATUSES = new Set(['submitted', 'queued']);

async function showJobList(to) {
  const jobs = await api.listJobs(to);
  if (!jobs.length) {
    await whatsapp.sendText(to, 'You have no active jobs.');
    return;
  }
  const rows = jobs.slice(0, MAX_JOB_ROWS).map((j) => {
    const shopName = j.shop && j.shop.name ? j.shop.name : 'shop';
    return {
      id: encodeId('job', 'view', j._id),
      title: `${format.statusLabel(j.status)}`,
      description: shopName,
    };
  });
  await whatsapp.sendList(to, '📦 Your jobs — tap one for details.', 'View Jobs', [{ title: 'Jobs', rows }]);
}

async function showJobDetail(to, jobId) {
  const jobs = await api.listJobs(to);
  const job = jobs.find((j) => j._id === jobId);
  if (!job) {
    await whatsapp.sendText(to, "I couldn't find that job anymore.");
    await showJobList(to);
    return;
  }

  const buttons = [{ id: encodeId('job', 'back'), title: 'Back' }];
  if (CANCELLABLE_STATUSES.has(job.status)) {
    buttons.unshift({ id: encodeId('job', 'cancel', jobId), title: 'Cancel Job' });
  }
  await whatsapp.sendButtons(to, format.formatJobDetail(job), buttons);
}

async function cancelJob(to, jobId) {
  const job = await api.updateJobStatus(to, jobId, 'cancelled');
  await whatsapp.sendText(to, `❌ Job cancelled.\n\n${format.formatJobDetail(job)}`);
}

module.exports = { showJobList, showJobDetail, cancelJob };
