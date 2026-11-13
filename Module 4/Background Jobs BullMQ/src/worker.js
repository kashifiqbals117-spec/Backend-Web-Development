'use strict';

// ─── YOUR FILE, implement this ───────────────────────────────────────────────
// Create a BullMQ Worker that processes jobs from the 'email' queue.
//
// Requirements:
//  1. Handle job.name === 'otp': send an email with the OTP using transporter.
//  2. Configure retries: attempts: 3, backoff: { type: 'exponential', delay: 1000 }
//  3. Log worker.on('completed') and worker.on('failed') events.
//  4. Throwing inside the worker function → job fails → BullMQ retries.
//     Returning without throwing → job completed.

const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { transporter } = require('./email');

const worker = new Worker(
  'email',
  async (job) => {
    if (job.name === 'otp') {
      const { to, otp } = job.data;
      await transporter.sendMail({
        from: process.env.SMTP_USER || 'noreply@example.com',
        to,
        subject: 'Your Verification OTP',
        text: `Your OTP is: ${otp}`,
        html: `<p>Your OTP is: <strong>${otp}</strong></p>`,
      });
    }
  },
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error: ${err?.message || err}`);
});

module.exports = { worker };
