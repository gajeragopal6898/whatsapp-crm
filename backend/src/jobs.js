const cron = require('node-cron');
const supabase = require('./supabase');

function scheduledJobs(io) {
  // Check follow-ups every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date().toISOString();
    const { data } = await supabase.from('leads')
      .select('id, name, phone, follow_up_at')
      .eq('follow_up_done', false)
      .lte('follow_up_at', now)
      .not('follow_up_at', 'is', null);

    for (const lead of (data || [])) {
      io.emit('followup:due', lead);
      await supabase.from('notifications').insert({
        title: 'Follow-up Due',
        message: `Follow up with ${lead.name || lead.phone}`,
        type: 'followup'
      });
    }
  });

  // Daily summary at 9am
  cron.schedule('0 9 * * *', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { count } = await supabase.from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    io.emit('report:daily', { newLeads: count, date: new Date().toISOString() });
    await supabase.from('notifications').insert({
      title: 'Daily Summary',
      message: `${count} new leads in the last 24 hours`,
      type: 'info'
    });
  });
}

module.exports = { scheduledJobs };
