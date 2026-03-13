const cron = require('node-cron');
const supabase = require('../config/supabase');

const startCronJobs = (io) => {
  // Check follow-ups every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date().toISOString();
    const { data: leads } = await supabase
      .from('leads')
      .select('id, name, phone, follow_up_at')
      .eq('follow_up_done', false)
      .lte('follow_up_at', now)
      .not('follow_up_at', 'is', null);

    for (const lead of (leads || [])) {
      await supabase.from('notifications').insert({
        title: '⏰ Follow-up Due!',
        message: `Follow-up due for ${lead.name || lead.phone}`,
        type: 'followup'
      });
      if (io) io.emit('notification:new', { type: 'followup', lead });
    }
  });

  // Daily summary at 9 AM
  cron.schedule('0 9 * * *', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { count: newLeads } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .gte('created_at', yesterday.toISOString());

    const { count: followUps } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('follow_up_done', false)
      .lte('follow_up_at', new Date().toISOString())
      .not('follow_up_at', 'is', null);

    await supabase.from('notifications').insert({
      title: '📊 Daily Summary',
      message: `Yesterday: ${newLeads} new leads. Today: ${followUps} follow-ups pending.`,
      type: 'info'
    });

    if (io) io.emit('notification:new', { type: 'daily_summary' });
  });

  // Weekly report every Monday at 9 AM
  cron.schedule('0 9 * * 1', async () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const { count: weekLeads } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .gte('created_at', lastWeek.toISOString());

    const { data: byStage } = await supabase
      .from('leads')
      .select('lead_stages(name)')
      .gte('created_at', lastWeek.toISOString());

    await supabase.from('notifications').insert({
      title: '📈 Weekly Report',
      message: `This week: ${weekLeads} new leads added. Check your dashboard for details.`,
      type: 'info'
    });

    if (io) io.emit('notification:new', { type: 'weekly_report' });
  });

  console.log('Cron jobs started');
};

module.exports = { startCronJobs };
